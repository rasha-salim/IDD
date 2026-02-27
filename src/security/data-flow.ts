/**
 * Intent: Intra-procedural data-flow analysis for taint tracking.
 * Traces whether user-input sources actually reach dangerous sinks within the same function.
 *
 * Limitations (by design):
 * - Intra-procedural only: tracks within one function body, not across function calls
 * - Does not model control flow: if/else branches are treated as both-taken
 * - Does not track through function calls to other functions
 * - Does not track through class fields or closures
 *
 * Guarantees: If a variable is tainted, all downstream assignments of that variable
 * are also marked tainted. Constants and literals are never tainted.
 */

import { type SourceFile, type Node, SyntaxKind, ts } from 'ts-morph';
import type { TaintResult } from '../types/config.js';

/**
 * Built-in user input sources.
 * These property access patterns are considered tainted by default.
 */
const DEFAULT_TAINT_SOURCES: string[] = [
  'req.body',
  'req.query',
  'req.params',
  'req.headers',
  'request.body',
  'request.query',
  'request.params',
  'request.headers',
  'ctx.request.body',
  'ctx.query',
  'ctx.params',
  'event.body',
  'event.queryStringParameters',
];

/**
 * Check if a text string matches any taint source pattern.
 *
 * Intent: Determine if a given expression text represents user input.
 * Handles both exact matches and prefix matches (e.g., req.body.name matches req.body).
 */
function matchesTaintSource(text: string, sources: string[]): string | undefined {
  const trimmed = text.trim();
  for (const source of sources) {
    if (trimmed === source || trimmed.startsWith(source + '.') || trimmed.startsWith(source + '[')) {
      return source;
    }
  }
  return undefined;
}

/**
 * Build a taint map for all variables within a function scope.
 *
 * Intent: Walk variable declarations and assignments to propagate taint from sources.
 * Returns a Map from variable name to TaintResult.
 *
 * How it works:
 * 1. Walk all variable declarations in the function body
 * 2. If the initializer matches a taint source, mark the variable as tainted
 * 3. If the initializer is an already-tainted variable, propagate the taint
 * 4. Handle destructuring: const { name } = req.body -> name is tainted
 * 5. Handle reassignment: x = taintedVar -> x is tainted
 */
export function buildTaintMap(
  functionBody: Node,
  sourceFile: SourceFile,
  customSources?: string[],
): Map<string, TaintResult> {
  const taintMap = new Map<string, TaintResult>();
  const allSources = [...DEFAULT_TAINT_SOURCES, ...(customSources ?? [])];

  // Pass 1: Walk all variable declarations to find initial taints
  functionBody.forEachDescendant((node) => {
    // Handle: const x = req.body.name
    if (node.getKind() === SyntaxKind.VariableDeclaration) {
      const varDecl = node;
      const nameNode = varDecl.getChildAtIndex(0);
      const initializer = varDecl.getChildrenOfKind(SyntaxKind.EqualsToken).length > 0
        ? varDecl.getLastChild()
        : undefined;

      if (!initializer) return;

      const initText = initializer.getText().trim();

      // Check if it's a binding pattern (destructuring)
      if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
        // const { name, email } = req.body
        const source = matchesTaintSource(initText, allSources);
        if (source) {
          nameNode.forEachDescendant((bindingNode) => {
            if (bindingNode.getKind() === SyntaxKind.BindingElement) {
              const bindingName = bindingNode.getChildAtIndex(0).getText().trim();
              taintMap.set(bindingName, {
                isTainted: true,
                source,
                path: [source, bindingName],
              });
            }
          });
        } else {
          // Check if the initializer is a tainted variable
          const existingTaint = taintMap.get(initText);
          if (existingTaint) {
            nameNode.forEachDescendant((bindingNode) => {
              if (bindingNode.getKind() === SyntaxKind.BindingElement) {
                const bindingName = bindingNode.getChildAtIndex(0).getText().trim();
                taintMap.set(bindingName, {
                  isTainted: true,
                  source: existingTaint.source,
                  path: [...existingTaint.path, bindingName],
                });
              }
            });
          }
        }
        return;
      }

      if (nameNode.getKind() === SyntaxKind.ArrayBindingPattern) {
        // const [a, b] = taintedArray
        const source = matchesTaintSource(initText, allSources);
        const existingTaint = taintMap.get(initText);
        const taintSource = source ? { isTainted: true, source, path: [source] } : existingTaint;

        if (taintSource) {
          nameNode.forEachDescendant((bindingNode) => {
            if (bindingNode.getKind() === SyntaxKind.BindingElement) {
              const bindingName = bindingNode.getChildAtIndex(0).getText().trim();
              taintMap.set(bindingName, {
                isTainted: true,
                source: taintSource.source,
                path: [...taintSource.path, bindingName],
              });
            }
          });
        }
        return;
      }

      // Simple variable: const x = ...
      const varName = nameNode.getText().trim();

      // Direct source match: const x = req.body.name
      const source = matchesTaintSource(initText, allSources);
      if (source) {
        taintMap.set(varName, {
          isTainted: true,
          source,
          path: [source, varName],
        });
        return;
      }

      // Propagation: const y = x (where x is tainted)
      const existingTaint = taintMap.get(initText);
      if (existingTaint) {
        taintMap.set(varName, {
          isTainted: true,
          source: existingTaint.source,
          path: [...existingTaint.path, varName],
        });
        return;
      }

      // Check if initializer references a tainted variable (e.g., const cmd = `ls ${taintedVar}`)
      // This handles template literals and other compound expressions
      for (const [taintedName, taint] of taintMap.entries()) {
        if (initText.includes(taintedName) && initText !== taintedName) {
          taintMap.set(varName, {
            isTainted: true,
            source: taint.source,
            path: [...taint.path, varName],
          });
          return;
        }
      }

      // Check if initializer accesses a property of a tainted variable
      // e.g., const id = data.userId where data is tainted
      for (const [taintedName, taint] of taintMap.entries()) {
        if (initText.startsWith(taintedName + '.') || initText.startsWith(taintedName + '[')) {
          taintMap.set(varName, {
            isTainted: true,
            source: taint.source,
            path: [...taint.path, varName],
          });
          return;
        }
      }
    }

    // Handle: parameter assignments in arrow functions / function params
    // e.g., (req, res) => { ... } -- req is tainted if it matches source patterns
    if (node.getKind() === SyntaxKind.Parameter) {
      const paramName = node.getChildAtIndex(0).getText().trim();
      // Parameters named 'req' or 'request' are considered potential taint carriers
      // Their properties (.body, .query, etc.) are the actual taint sources
      // We don't mark the parameter itself as tainted, only its property accesses
    }
  });

  // Pass 2: Handle reassignments (x = taintedVar)
  functionBody.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.BinaryExpression) {
      const text = node.getText();
      const parts = text.split('=');
      if (parts.length < 2) return;

      const compilerNode = node.compilerNode as ts.BinaryExpression;
      if (compilerNode.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;

      const leftText = parts[0].trim();
      const rightText = parts.slice(1).join('=').trim();

      // Don't process comparisons (==, ===, !=, !==)
      if (leftText.endsWith('!') || leftText.endsWith('=') || leftText.endsWith('<') || leftText.endsWith('>')) return;

      const source = matchesTaintSource(rightText, allSources);
      if (source) {
        taintMap.set(leftText, {
          isTainted: true,
          source,
          path: [source, leftText],
        });
        return;
      }

      const existingTaint = taintMap.get(rightText);
      if (existingTaint) {
        taintMap.set(leftText, {
          isTainted: true,
          source: existingTaint.source,
          path: [...existingTaint.path, leftText],
        });
      }
    }
  });

  return taintMap;
}

/**
 * Check if a specific AST node's value originates from user input.
 *
 * Intent: Determine whether a node in a function body is tainted by user input.
 * Used by security rules to decide whether to flag a finding.
 *
 * Guarantees: Returns isTainted=false for literals, constants, and non-tracked expressions.
 */
export function isNodeTainted(
  node: Node,
  taintMap: Map<string, TaintResult>,
  customSources?: string[],
): TaintResult {
  const allSources = [...DEFAULT_TAINT_SOURCES, ...(customSources ?? [])];
  const nodeText = node.getText().trim();

  // String/number literals are never tainted
  if (
    node.getKind() === SyntaxKind.StringLiteral ||
    node.getKind() === SyntaxKind.NumericLiteral ||
    node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return { isTainted: false, path: [] };
  }

  // Direct source match
  const directSource = matchesTaintSource(nodeText, allSources);
  if (directSource) {
    return { isTainted: true, source: directSource, path: [directSource] };
  }

  // Check if node text matches a tainted variable
  const taint = taintMap.get(nodeText);
  if (taint) {
    return taint;
  }

  // Check if node is a property access of a tainted variable
  for (const [taintedName, taintResult] of taintMap.entries()) {
    if (nodeText.startsWith(taintedName + '.') || nodeText.startsWith(taintedName + '[')) {
      return {
        isTainted: true,
        source: taintResult.source,
        path: [...taintResult.path, nodeText],
      };
    }
  }

  // For template expressions, check if any interpolated parts are tainted
  if (node.getKind() === SyntaxKind.TemplateExpression) {
    for (const child of node.getDescendantsOfKind(SyntaxKind.TemplateSpan)) {
      const expr = child.getFirstChild();
      if (expr) {
        const exprResult = isNodeTainted(expr, taintMap, customSources);
        if (exprResult.isTainted) {
          return {
            isTainted: true,
            source: exprResult.source,
            path: [...exprResult.path, 'template expression'],
          };
        }
      }
    }
  }

  // For binary expressions (string concatenation), check both sides
  if (node.getKind() === SyntaxKind.BinaryExpression) {
    const children = node.getChildren();
    for (const child of children) {
      if (child.getKind() !== SyntaxKind.PlusToken) {
        const childResult = isNodeTainted(child, taintMap, customSources);
        if (childResult.isTainted) {
          return {
            isTainted: true,
            source: childResult.source,
            path: [...childResult.path, 'concatenation'],
          };
        }
      }
    }
  }

  return { isTainted: false, path: [] };
}

/**
 * Find the enclosing function body for a given node.
 *
 * Intent: Locate the function scope for intra-procedural analysis.
 * Walks up the AST to find the nearest function/method/arrow body.
 */
export function findEnclosingFunctionBody(node: Node): Node | undefined {
  let current = node.getParent();
  while (current) {
    const kind = current.getKind();
    if (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.MethodDeclaration ||
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.FunctionExpression
    ) {
      // Return the body block
      const body = current.getChildrenOfKind(SyntaxKind.Block);
      if (body.length > 0) return body[0];
      // Arrow functions may have expression body
      return current;
    }
    current = current.getParent();
  }
  return undefined;
}

/**
 * Build taint maps for all function scopes in a source file.
 *
 * Intent: Pre-compute taint analysis for the entire file so rules can query efficiently.
 * Returns a Map from function body node to its taint map.
 */
export function buildFileTaintMaps(
  sourceFile: SourceFile,
  customSources?: string[],
): Map<Node, Map<string, TaintResult>> {
  const fileMaps = new Map<Node, Map<string, TaintResult>>();

  sourceFile.forEachDescendant((node) => {
    const kind = node.getKind();
    if (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.MethodDeclaration ||
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.FunctionExpression
    ) {
      const body = node.getChildrenOfKind(SyntaxKind.Block);
      const target = body.length > 0 ? body[0] : node;
      const taintMap = buildTaintMap(target, sourceFile, customSources);
      fileMaps.set(target, taintMap);
    }
  });

  return fileMaps;
}

/**
 * Check if a path validation function is called before an fs operation.
 *
 * Intent: Detect mitigation patterns like path.resolve() or path.normalize()
 * that indicate the developer has attempted to prevent path traversal.
 */
export function hasPathValidation(node: Node): boolean {
  const functionBody = findEnclosingFunctionBody(node);
  if (!functionBody) return false;

  const nodeStartLine = node.getStartLineNumber();
  const bodyText = functionBody.getText();

  // Check if path.resolve, path.normalize, or realpath is called before this node
  const validationPatterns = [
    'path.resolve',
    'path.normalize',
    'path.join',
    'realpath',
    'realpathSync',
    '.startsWith(',
    '.includes(\'..\')',
    '.includes("..")',
  ];

  // Look for validation calls in the function body before our node
  let foundValidation = false;
  functionBody.forEachDescendant((child) => {
    if (child.getStartLineNumber() >= nodeStartLine) return;
    const childText = child.getText();
    if (validationPatterns.some((p) => childText.includes(p))) {
      foundValidation = true;
    }
  });

  return foundValidation;
}
