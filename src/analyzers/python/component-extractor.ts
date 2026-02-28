/**
 * Intent: Extract components (files, classes, functions, decorators) from Python source code
 * using tree-sitter AST parsing.
 *
 * Guarantees: Every .py file produces a File component. Every class/function definition
 * produces a corresponding component with metadata (decorators, parameters, properties, methods).
 */

import type Parser from 'web-tree-sitter';
import {
  ComponentType,
  type CmiwComponent,
  type ComponentMetadata,
  type ParameterInfo,
  type PropertyInfo,
  type MethodInfo,
} from '../../types/components.js';
import { generateComponentId } from '../../utils/id-generator.js';
import { logger } from '../../utils/logger.js';

export interface ParsedPythonFile {
  filePath: string;
  source: string;
  tree: Parser.Tree;
}

/**
 * Extract all components from parsed Python files.
 *
 * Intent: Produce a flat list of every identifiable Python code component.
 * Guarantees: Each component has a unique ID, file path, and line range.
 */
export function extractPythonComponents(files: ParsedPythonFile[]): CmiwComponent[] {
  const components: CmiwComponent[] = [];

  for (const file of files) {
    logger.debug(`Extracting Python components from: ${file.filePath}`);

    components.push(extractFileComponent(file));
    components.push(...extractClasses(file));
    components.push(...extractTopLevelFunctions(file));
  }

  logger.info(`Extracted ${components.length} Python components`);
  return components;
}

function extractFileComponent(file: ParsedPythonFile): CmiwComponent {
  const lines = file.source.split('\n');
  const loc = lines.length;
  const baseName = file.filePath.split('/').pop() ?? file.filePath;

  return {
    id: generateComponentId('file', file.filePath, baseName),
    name: baseName,
    type: ComponentType.File,
    filePath: file.filePath,
    startLine: 1,
    endLine: loc,
    metadata: {
      loc,
      isExported: false,
      isDefault: false,
    },
  };
}

function extractClasses(file: ParsedPythonFile): CmiwComponent[] {
  const components: CmiwComponent[] = [];
  const rootNode = file.tree.rootNode;

  for (const node of rootNode.children) {
    const classNode = node.type === 'class_definition' ? node
      : (node.type === 'decorated_definition' ? node.childForFieldName('definition') : null);

    if (!classNode || classNode.type !== 'class_definition') continue;

    const nameNode = classNode.childForFieldName('name');
    if (!nameNode) continue;

    const name = nameNode.text;
    const startLine = classNode.startPosition.row + 1;
    const endLine = classNode.endPosition.row + 1;

    const decorators = extractDecorators(node);
    const bases = extractBases(classNode);
    const body = classNode.childForFieldName('body');
    const methods = body ? extractMethods(body, file) : [];
    const properties = body ? extractClassProperties(body) : [];

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: true,
      isDefault: false,
      decorators,
      properties,
      methods,
      extends: bases[0],
      implements: bases.slice(1),
    };

    components.push({
      id: generateComponentId('class', file.filePath, name),
      name,
      type: ComponentType.Class,
      filePath: file.filePath,
      startLine,
      endLine,
      metadata,
    });
  }

  return components;
}

function extractTopLevelFunctions(file: ParsedPythonFile): CmiwComponent[] {
  const components: CmiwComponent[] = [];
  const rootNode = file.tree.rootNode;

  for (const node of rootNode.children) {
    const funcNode = node.type === 'function_definition' ? node
      : (node.type === 'decorated_definition' ? node.childForFieldName('definition') : null);

    if (!funcNode || funcNode.type !== 'function_definition') continue;

    const nameNode = funcNode.childForFieldName('name');
    if (!nameNode) continue;

    const name = nameNode.text;
    const startLine = funcNode.startPosition.row + 1;
    const endLine = funcNode.endPosition.row + 1;

    const decorators = extractDecorators(node);
    const parameters = extractParameters(funcNode);
    const returnType = extractReturnAnnotation(funcNode);

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: !name.startsWith('_'),
      isDefault: false,
      decorators,
      parameters,
      returnType: returnType ?? undefined,
    };

    components.push({
      id: generateComponentId('function', file.filePath, name),
      name,
      type: ComponentType.Function,
      filePath: file.filePath,
      startLine,
      endLine,
      metadata,
    });
  }

  return components;
}

function extractDecorators(node: Parser.SyntaxNode): string[] {
  if (node.type !== 'decorated_definition') return [];

  const decorators: string[] = [];
  for (const child of node.children) {
    if (child.type === 'decorator') {
      // Get the decorator text after '@'
      const text = child.text.replace(/^@/, '').trim();
      decorators.push(text);
    }
  }
  return decorators;
}

function extractBases(classNode: Parser.SyntaxNode): string[] {
  const bases: string[] = [];
  const argList = classNode.childForFieldName('superclasses');
  if (!argList) return bases;

  for (const child of argList.namedChildren) {
    if (child.type === 'identifier' || child.type === 'attribute') {
      bases.push(child.text);
    } else if (child.type === 'keyword_argument') {
      // metaclass=ABCMeta -- skip
    } else {
      bases.push(child.text);
    }
  }

  return bases;
}

function extractMethods(body: Parser.SyntaxNode, file: ParsedPythonFile): MethodInfo[] {
  const methods: MethodInfo[] = [];

  for (const child of body.children) {
    const funcNode = child.type === 'function_definition' ? child
      : (child.type === 'decorated_definition' ? child.childForFieldName('definition') : null);

    if (!funcNode || funcNode.type !== 'function_definition') continue;

    const nameNode = funcNode.childForFieldName('name');
    if (!nameNode) continue;

    const name = nameNode.text;
    const decorators = extractDecorators(child);
    const params = extractParameters(funcNode);
    // Filter out 'self' and 'cls' from parameters
    const filteredParams = params.filter((p) => p.name !== 'self' && p.name !== 'cls');
    const returnType = extractReturnAnnotation(funcNode) ?? 'unknown';

    const isStatic = decorators.includes('staticmethod');
    const isClassMethod = decorators.includes('classmethod');
    const isAsync = funcNode.children.some((c) => c.type === 'async');

    let visibility: 'public' | 'protected' | 'private' = 'public';
    if (name.startsWith('__') && !name.endsWith('__')) {
      visibility = 'private';
    } else if (name.startsWith('_')) {
      visibility = 'private';
    }

    methods.push({
      name,
      parameters: filteredParams,
      returnType,
      visibility,
      isStatic: isStatic || isClassMethod,
      isAsync,
    });
  }

  return methods;
}

function extractClassProperties(body: Parser.SyntaxNode): PropertyInfo[] {
  const properties: PropertyInfo[] = [];
  const seen = new Set<string>();

  // Look for self.x = ... assignments in __init__ or class body
  for (const child of body.children) {
    const funcNode = child.type === 'function_definition' ? child
      : (child.type === 'decorated_definition' ? child.childForFieldName('definition') : null);

    if (funcNode?.type === 'function_definition') {
      const nameNode = funcNode.childForFieldName('name');
      if (nameNode?.text === '__init__') {
        const funcBody = funcNode.childForFieldName('body');
        if (funcBody) {
          extractSelfAssignments(funcBody, properties, seen);
        }
      }
    }

    // Class-level assignments: x: int = 5 or x = 5
    if (child.type === 'expression_statement') {
      const expr = child.firstChild;
      if (expr?.type === 'assignment') {
        const left = expr.childForFieldName('left');
        if (left?.type === 'identifier' && !seen.has(left.text)) {
          seen.add(left.text);
          const typeAnnotation = extractAssignmentTypeAnnotation(expr);
          properties.push({
            name: left.text,
            type: typeAnnotation ?? 'unknown',
            visibility: left.text.startsWith('_') ? 'private' : 'public',
            isStatic: false,
            isReadonly: false,
          });
        }
      }
    }

    if (child.type === 'expression_statement') {
      const expr = child.firstChild;
      if (expr?.type === 'type_alias_statement' || child.text.includes(':')) {
        // Annotated assignment: x: int = 5
        // These are parsed differently
      }
    }
  }

  return properties;
}

function extractSelfAssignments(body: Parser.SyntaxNode, properties: PropertyInfo[], seen: Set<string>): void {
  walkDescendants(body, (node) => {
    if (node.type === 'assignment') {
      const left = node.childForFieldName('left');
      if (left?.type === 'attribute') {
        const obj = left.childForFieldName('object');
        const attr = left.childForFieldName('attribute');
        if (obj?.text === 'self' && attr && !seen.has(attr.text)) {
          seen.add(attr.text);
          properties.push({
            name: attr.text,
            type: 'unknown',
            visibility: attr.text.startsWith('_') ? 'private' : 'public',
            isStatic: false,
            isReadonly: false,
          });
        }
      }
    }
  });
}

function extractParameters(funcNode: Parser.SyntaxNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramsNode = funcNode.childForFieldName('parameters');
  if (!paramsNode) return params;

  for (const child of paramsNode.namedChildren) {
    if (child.type === 'identifier') {
      params.push({ name: child.text, type: 'unknown', isOptional: false });
    } else if (child.type === 'typed_parameter') {
      const nameNode = child.firstNamedChild;
      const typeNode = child.childForFieldName('type');
      params.push({
        name: nameNode?.text ?? 'unknown',
        type: typeNode?.text ?? 'unknown',
        isOptional: false,
      });
    } else if (child.type === 'default_parameter') {
      const nameNode = child.childForFieldName('name');
      params.push({
        name: nameNode?.text ?? 'unknown',
        type: 'unknown',
        isOptional: true,
      });
    } else if (child.type === 'typed_default_parameter') {
      const nameNode = child.childForFieldName('name');
      const typeNode = child.childForFieldName('type');
      params.push({
        name: nameNode?.text ?? 'unknown',
        type: typeNode?.text ?? 'unknown',
        isOptional: true,
      });
    } else if (child.type === 'list_splat_pattern' || child.type === 'dictionary_splat_pattern') {
      const prefix = child.type === 'list_splat_pattern' ? '*' : '**';
      const nameNode = child.firstNamedChild;
      params.push({
        name: `${prefix}${nameNode?.text ?? 'args'}`,
        type: 'unknown',
        isOptional: true,
      });
    }
  }

  return params;
}

function extractReturnAnnotation(funcNode: Parser.SyntaxNode): string | null {
  const returnType = funcNode.childForFieldName('return_type');
  if (returnType) return returnType.text;
  return null;
}

function extractAssignmentTypeAnnotation(node: Parser.SyntaxNode): string | null {
  const typeNode = node.childForFieldName('type');
  if (typeNode) return typeNode.text;
  return null;
}

/**
 * Walk all descendants of a node, calling the callback for each.
 */
export function walkDescendants(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
  for (const child of node.children) {
    callback(child);
    walkDescendants(child, callback);
  }
}
