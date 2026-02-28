/**
 * Intent: Intra-procedural taint tracking for Python code using tree-sitter AST.
 * Traces user-input sources to dangerous sinks within the same function scope.
 *
 * Limitations (by design):
 * - Intra-procedural only: within one function body
 * - Does not model control flow: if/else branches treated as both-taken
 * - Does not track through function calls or class fields
 *
 * Guarantees: Tainted variables propagate through assignments.
 * Literals and constants are never tainted.
 */

import type Parser from 'web-tree-sitter';
import type { TaintResult } from '../../types/config.js';
import { walkDescendants } from './component-extractor.js';

/**
 * Built-in taint sources for Python web frameworks.
 */
const DEFAULT_PYTHON_TAINT_SOURCES: string[] = [
  // Flask
  'request.form',
  'request.args',
  'request.json',
  'request.data',
  'request.files',
  'request.values',
  'request.get_json()',
  // Django
  'request.POST',
  'request.GET',
  'request.body',
  'request.FILES',
  // Generic
  'input()',
  'sys.stdin.read()',
  'sys.stdin.readline()',
];

/**
 * Sanitizer functions that neutralize taint.
 */
const SANITIZERS = new Set([
  'int',
  'float',
  'bool',
  'bleach.clean',
  'markupsafe.escape',
  'html.escape',
  'escape',
  'sanitize',
  'clean',
]);

/**
 * Path validation functions that mitigate path traversal.
 */
const PATH_VALIDATORS = new Set([
  'os.path.abspath',
  'os.path.realpath',
  'os.path.normpath',
  'pathlib.Path.resolve',
]);

export interface PythonTaintMap {
  variables: Map<string, TaintResult>;
  hasPathValidation: boolean;
}

/**
 * Build a taint map for a Python function body.
 *
 * Intent: Walk variable assignments and propagate taint from sources.
 * Returns a map from variable name to TaintResult.
 */
export function buildPythonTaintMap(
  functionBody: Parser.SyntaxNode,
  customSources?: string[],
): PythonTaintMap {
  const taintMap = new Map<string, TaintResult>();
  const allSources = [...DEFAULT_PYTHON_TAINT_SOURCES, ...(customSources ?? [])];
  let hasPathValidation = false;

  // Pass 1: Walk all assignments and track taint
  walkDescendants(functionBody, (node) => {
    // Check for path validation calls
    if (node.type === 'call') {
      const funcRef = node.childForFieldName('function');
      if (funcRef) {
        const funcText = funcRef.text;
        if (PATH_VALIDATORS.has(funcText) || funcText.endsWith('.resolve')) {
          hasPathValidation = true;
        }
      }
    }

    if (node.type === 'assignment') {
      processAssignment(node, taintMap, allSources);
    }

    // Handle augmented assignment: x += tainted
    if (node.type === 'augmented_assignment') {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      if (left && right) {
        const rightTaint = checkExpressionTaint(right, taintMap, allSources);
        if (rightTaint) {
          taintMap.set(left.text, {
            isTainted: true,
            source: rightTaint.source,
            path: [...rightTaint.path, left.text],
          });
        }
      }
    }
  });

  return { variables: taintMap, hasPathValidation };
}

function processAssignment(
  node: Parser.SyntaxNode,
  taintMap: Map<string, TaintResult>,
  allSources: string[],
): void {
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  if (!left || !right) return;

  const rightText = right.text.trim();

  // Check if right side is a sanitizer call
  if (right.type === 'call') {
    const funcRef = right.childForFieldName('function');
    if (funcRef && isSanitizer(funcRef.text)) {
      // Sanitizer removes taint
      if (left.type === 'identifier') {
        taintMap.delete(left.text);
      }
      return;
    }
  }

  // Check if right side is a taint source
  const source = matchesTaintSource(rightText, allSources);
  if (source) {
    if (left.type === 'identifier') {
      taintMap.set(left.text, {
        isTainted: true,
        source,
        path: [source, left.text],
      });
    } else if (left.type === 'pattern_list' || left.type === 'tuple_pattern') {
      // Unpacking: a, b = request.form['x'], request.form['y']
      for (const child of left.namedChildren) {
        if (child.type === 'identifier') {
          taintMap.set(child.text, {
            isTainted: true,
            source,
            path: [source, child.text],
          });
        }
      }
    }
    return;
  }

  // Check propagation: x = taintedVar
  const taint = checkExpressionTaint(right, taintMap, allSources);
  if (taint) {
    if (left.type === 'identifier') {
      taintMap.set(left.text, {
        isTainted: true,
        source: taint.source,
        path: [...taint.path, left.text],
      });
    }
    return;
  }
}

/**
 * Check if an expression is tainted.
 */
function checkExpressionTaint(
  node: Parser.SyntaxNode,
  taintMap: Map<string, TaintResult>,
  allSources: string[],
): TaintResult | undefined {
  const text = node.text.trim();

  // Direct source match
  const source = matchesTaintSource(text, allSources);
  if (source) {
    return { isTainted: true, source, path: [source] };
  }

  // Variable reference
  if (node.type === 'identifier') {
    return taintMap.get(text);
  }

  // Attribute access on tainted object: data['key'], data.name
  if (node.type === 'subscript' || node.type === 'attribute') {
    const objNode = node.childForFieldName('object') ?? node.childForFieldName('value');
    if (objNode) {
      const objTaint = taintMap.get(objNode.text);
      if (objTaint) {
        return { isTainted: true, source: objTaint.source, path: [...objTaint.path, text] };
      }
      // Also check if the full text matches a source
      const fullSource = matchesTaintSource(text, allSources);
      if (fullSource) {
        return { isTainted: true, source: fullSource, path: [fullSource] };
      }
    }
  }

  // f-string with tainted interpolation
  if (node.type === 'string' || node.type === 'concatenated_string') {
    // Check if any interpolation contains tainted values
    let found: TaintResult | undefined;
    walkDescendants(node, (child) => {
      if (found) return;
      if (child.type === 'interpolation') {
        const expr = child.firstNamedChild;
        if (expr) {
          const exprTaint = checkExpressionTaint(expr, taintMap, allSources);
          if (exprTaint) {
            found = { isTainted: true, source: exprTaint.source, path: [...exprTaint.path, 'f-string'] };
          }
        }
      }
    });
    if (found) return found;
  }

  // .format() call on string with tainted args
  if (node.type === 'call') {
    const funcRef = node.childForFieldName('function');
    if (funcRef?.type === 'attribute') {
      const method = funcRef.childForFieldName('attribute');
      if (method?.text === 'format') {
        const args = node.childForFieldName('arguments');
        if (args) {
          for (const arg of args.namedChildren) {
            const argTaint = checkExpressionTaint(arg, taintMap, allSources);
            if (argTaint) {
              return { isTainted: true, source: argTaint.source, path: [...argTaint.path, '.format()'] };
            }
          }
        }
      }
    }
  }

  // Binary expression (string concat with +)
  if (node.type === 'binary_operator') {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    if (left) {
      const leftTaint = checkExpressionTaint(left, taintMap, allSources);
      if (leftTaint) return leftTaint;
    }
    if (right) {
      const rightTaint = checkExpressionTaint(right, taintMap, allSources);
      if (rightTaint) return rightTaint;
    }
  }

  // % string formatting
  if (node.type === 'binary_operator') {
    const operator = node.children.find((c) => c.type === '%');
    if (operator) {
      const right = node.childForFieldName('right');
      if (right) {
        const rightTaint = checkExpressionTaint(right, taintMap, allSources);
        if (rightTaint) return rightTaint;
      }
    }
  }

  // Check sub-expressions for taint
  for (const [taintedName, taint] of taintMap.entries()) {
    if (text.includes(taintedName) && text !== taintedName) {
      return { isTainted: true, source: taint.source, path: [...taint.path, 'expression'] };
    }
  }

  return undefined;
}

function matchesTaintSource(text: string, sources: string[]): string | undefined {
  const trimmed = text.trim();
  for (const source of sources) {
    if (trimmed === source || trimmed.startsWith(source + '.') ||
        trimmed.startsWith(source + '[') || trimmed.startsWith(source + '(')) {
      return source;
    }
  }
  return undefined;
}

function isSanitizer(funcName: string): boolean {
  return SANITIZERS.has(funcName) || funcName.endsWith('.escape') || funcName.endsWith('.clean');
}

/**
 * Check if a specific expression text is tainted given a taint map.
 *
 * Intent: Used by security rules to check if a specific AST node is tainted.
 */
export function isPythonExprTainted(
  exprText: string,
  taintMap: Map<string, TaintResult>,
  customSources?: string[],
): TaintResult {
  const allSources = [...DEFAULT_PYTHON_TAINT_SOURCES, ...(customSources ?? [])];
  const trimmed = exprText.trim();

  // String literals are never tainted
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    // But f-strings may be tainted
    if (!trimmed.startsWith("f'") && !trimmed.startsWith('f"') &&
        !trimmed.startsWith("f'''") && !trimmed.startsWith('f"""')) {
      return { isTainted: false, path: [] };
    }
  }

  // Number literals are never tainted
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return { isTainted: false, path: [] };
  }

  // Direct source
  const source = matchesTaintSource(trimmed, allSources);
  if (source) {
    return { isTainted: true, source, path: [source] };
  }

  // Variable lookup
  const taint = taintMap.get(trimmed);
  if (taint) return taint;

  // Property access of tainted var
  for (const [name, t] of taintMap.entries()) {
    if (trimmed.startsWith(name + '.') || trimmed.startsWith(name + '[')) {
      return { isTainted: true, source: t.source, path: [...t.path, trimmed] };
    }
  }

  // Check for tainted subexpressions
  for (const [name, t] of taintMap.entries()) {
    if (trimmed.includes(name)) {
      return { isTainted: true, source: t.source, path: [...t.path, 'expression'] };
    }
  }

  return { isTainted: false, path: [] };
}

/**
 * Build taint maps for all function scopes in a file.
 *
 * Intent: Pre-compute taint analysis for the entire file.
 * Returns a Map from function node to its taint map.
 */
export function buildPythonFileTaintMaps(
  rootNode: Parser.SyntaxNode,
  customSources?: string[],
): Map<Parser.SyntaxNode, PythonTaintMap> {
  const maps = new Map<Parser.SyntaxNode, PythonTaintMap>();

  walkDescendants(rootNode, (node) => {
    if (node.type === 'function_definition') {
      const body = node.childForFieldName('body');
      if (body) {
        maps.set(node, buildPythonTaintMap(body, customSources));
      }
    }
  });

  return maps;
}
