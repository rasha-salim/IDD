/**
 * Intent: Extract relationships (imports, inheritance, calls) from Python source code
 * using tree-sitter AST analysis.
 *
 * Limitations:
 * - Import resolution is file-path based (no Python type checker)
 * - Call resolution is name-based (no dynamic type resolution)
 * - Third-party imports are skipped (only project-internal relationships)
 *
 * Guarantees: Relationships are deduplicated by ID. Only resolved references included.
 */

import type Parser from 'web-tree-sitter';
import {
  RelationshipType,
  type IddComponent,
  type IddRelationship,
} from '../../types/components.js';
import { generateComponentId, generateRelationshipId } from '../../utils/id-generator.js';
import { logger } from '../../utils/logger.js';
import type { ParsedPythonFile } from './component-extractor.js';
import { walkDescendants } from './component-extractor.js';

interface ImportInfo {
  module: string;
  names: string[];
  isRelative: boolean;
  level: number;
}

/**
 * Build all relationships between Python components.
 *
 * Intent: Discover how components connect via imports, inheritance, and function calls.
 * Guarantees: No duplicate relationships. Only project-internal references included.
 */
export function buildPythonRelationships(
  files: ParsedPythonFile[],
  components: IddComponent[],
): IddRelationship[] {
  const componentIndex = new Map<string, IddComponent>();
  for (const comp of components) {
    componentIndex.set(comp.id, comp);
  }

  // Build file path -> file component map
  const fileByPath = new Map<string, IddComponent>();
  for (const comp of components) {
    if (comp.type === 'file') {
      fileByPath.set(comp.filePath, comp);
    }
  }

  // Build module name -> file path map for import resolution
  const moduleMap = buildModuleMap(files);

  // Build name -> component map for call resolution
  const nameToComponent = new Map<string, IddComponent>();
  for (const comp of components) {
    if (comp.type !== 'file') {
      nameToComponent.set(comp.name, comp);
    }
  }

  const relationships = new Map<string, IddRelationship>();

  for (const file of files) {
    const fileComp = fileByPath.get(file.filePath);
    if (!fileComp) continue;

    addImportRelationships(file, fileComp, fileByPath, moduleMap, relationships);
    addInheritanceRelationships(file, componentIndex, nameToComponent, relationships);
    addCallRelationships(file, componentIndex, nameToComponent, relationships);
  }

  const result = Array.from(relationships.values());
  logger.info(`Built ${result.length} Python relationships`);
  return result;
}

/**
 * Build a map from Python module paths to file paths.
 * e.g., 'app.models' -> '/project/app/models.py'
 */
function buildModuleMap(files: ParsedPythonFile[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const file of files) {
    // Convert file path to potential module name
    // /project/app/models.py -> app.models (relative to project root)
    const parts = file.filePath.replace(/\.py$/, '').split('/');

    // Register multiple potential module names (from shortest to longest)
    for (let i = 0; i < parts.length; i++) {
      const moduleName = parts.slice(i).join('.');
      if (moduleName && !moduleName.startsWith('.')) {
        map.set(moduleName, file.filePath);
      }
    }

    // Also register just the filename without extension
    const baseName = parts[parts.length - 1];
    if (baseName) {
      map.set(baseName, file.filePath);
    }
  }

  return map;
}

function addImportRelationships(
  file: ParsedPythonFile,
  fileComp: IddComponent,
  fileByPath: Map<string, IddComponent>,
  moduleMap: Map<string, string>,
  relationships: Map<string, IddRelationship>,
): void {
  const imports = extractImports(file.tree.rootNode);

  for (const imp of imports) {
    const targetPath = resolveImport(imp, moduleMap, file.filePath);
    if (!targetPath) continue;

    const targetFileComp = fileByPath.get(targetPath);
    if (!targetFileComp) continue;

    const id = generateRelationshipId(fileComp.id, targetFileComp.id, RelationshipType.Imports);
    if (!relationships.has(id)) {
      relationships.set(id, {
        id,
        source: fileComp.id,
        target: targetFileComp.id,
        type: RelationshipType.Imports,
        metadata: {
          importSpecifiers: imp.names.length > 0 ? imp.names : undefined,
        },
      });
    }
  }
}

function extractImports(rootNode: Parser.SyntaxNode): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const node of rootNode.children) {
    if (node.type === 'import_statement') {
      // import x, import x.y
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        imports.push({
          module: nameNode.text,
          names: [],
          isRelative: false,
          level: 0,
        });
      }
    } else if (node.type === 'import_from_statement') {
      // from x import y, from .x import y
      const moduleNode = node.childForFieldName('module_name');
      const moduleName = moduleNode?.text ?? '';

      // Count dots for relative imports
      let level = 0;
      for (const child of node.children) {
        if (child.type === 'relative_import') {
          const dots = child.text.replace(/[^.]/g, '');
          level = dots.length;
        }
        if (child.text === '.') level++;
      }

      // Extract imported names
      const names: string[] = [];
      for (const child of node.namedChildren) {
        if (child.type === 'dotted_name' && child !== moduleNode) {
          names.push(child.text);
        } else if (child.type === 'aliased_import') {
          const nameChild = child.childForFieldName('name');
          if (nameChild) names.push(nameChild.text);
        }
      }

      imports.push({
        module: moduleName,
        names,
        isRelative: level > 0,
        level,
      });
    }
  }

  return imports;
}

function resolveImport(
  imp: ImportInfo,
  moduleMap: Map<string, string>,
  currentFilePath: string,
): string | undefined {
  if (imp.isRelative) {
    // Relative import: navigate up from current file
    const parts = currentFilePath.split('/');
    parts.pop(); // Remove filename
    for (let i = 1; i < imp.level; i++) {
      parts.pop(); // Navigate up
    }
    if (imp.module) {
      const target = [...parts, ...imp.module.split('.')].join('/') + '.py';
      return moduleMap.get(imp.module) ?? findByPath(moduleMap, target);
    }
    return undefined;
  }

  // Absolute import: look up in module map
  return moduleMap.get(imp.module);
}

function findByPath(moduleMap: Map<string, string>, targetPath: string): string | undefined {
  for (const [, filePath] of moduleMap) {
    if (filePath.endsWith(targetPath) || filePath === targetPath) {
      return filePath;
    }
  }
  return undefined;
}

function addInheritanceRelationships(
  file: ParsedPythonFile,
  componentIndex: Map<string, IddComponent>,
  nameToComponent: Map<string, IddComponent>,
  relationships: Map<string, IddRelationship>,
): void {
  const rootNode = file.tree.rootNode;

  for (const node of rootNode.children) {
    const classNode = node.type === 'class_definition' ? node
      : (node.type === 'decorated_definition' ? node.childForFieldName('definition') : null);

    if (!classNode || classNode.type !== 'class_definition') continue;

    const nameNode = classNode.childForFieldName('name');
    if (!nameNode) continue;

    const classComp = componentIndex.get(
      generateComponentId('class', file.filePath, nameNode.text),
    );
    if (!classComp) continue;

    const argList = classNode.childForFieldName('superclasses');
    if (!argList) continue;

    let isFirst = true;
    for (const child of argList.namedChildren) {
      if (child.type === 'keyword_argument') continue;

      const baseName = child.text;
      const baseComp = nameToComponent.get(baseName);
      if (!baseComp) continue;

      // First base is extends, rest are implements-like (mixins)
      const relType = isFirst ? RelationshipType.Extends : RelationshipType.Implements;
      isFirst = false;

      const id = generateRelationshipId(classComp.id, baseComp.id, relType);
      if (!relationships.has(id)) {
        relationships.set(id, {
          id,
          source: classComp.id,
          target: baseComp.id,
          type: relType,
        });
      }
    }
  }
}

function addCallRelationships(
  file: ParsedPythonFile,
  componentIndex: Map<string, IddComponent>,
  nameToComponent: Map<string, IddComponent>,
  relationships: Map<string, IddRelationship>,
): void {
  const rootNode = file.tree.rootNode;

  // Find top-level functions and class methods, then look for calls inside them
  for (const node of rootNode.children) {
    let funcNode: Parser.SyntaxNode | null = null;
    let callerComp: IddComponent | undefined;

    if (node.type === 'function_definition' || (node.type === 'decorated_definition' && node.childForFieldName('definition')?.type === 'function_definition')) {
      funcNode = node.type === 'function_definition' ? node : node.childForFieldName('definition');
      if (funcNode) {
        const nameNode = funcNode.childForFieldName('name');
        if (nameNode) {
          callerComp = componentIndex.get(
            generateComponentId('function', file.filePath, nameNode.text),
          );
        }
      }
    }

    if (node.type === 'class_definition' || (node.type === 'decorated_definition' && node.childForFieldName('definition')?.type === 'class_definition')) {
      const classNode = node.type === 'class_definition' ? node : node.childForFieldName('definition');
      if (classNode) {
        const classNameNode = classNode.childForFieldName('name');
        if (classNameNode) {
          const classComp = componentIndex.get(
            generateComponentId('class', file.filePath, classNameNode.text),
          );

          // Process calls inside each method
          const body = classNode.childForFieldName('body');
          if (body && classComp) {
            for (const methodNode of body.children) {
              const mFuncNode = methodNode.type === 'function_definition' ? methodNode
                : (methodNode.type === 'decorated_definition' ? methodNode.childForFieldName('definition') : null);

              if (mFuncNode?.type === 'function_definition') {
                findCallsInNode(mFuncNode, classComp, nameToComponent, relationships);
              }
            }
          }
        }
      }
      continue;
    }

    if (callerComp && funcNode) {
      findCallsInNode(funcNode, callerComp, nameToComponent, relationships);
    }
  }
}

function findCallsInNode(
  node: Parser.SyntaxNode,
  callerComp: IddComponent,
  nameToComponent: Map<string, IddComponent>,
  relationships: Map<string, IddRelationship>,
): void {
  walkDescendants(node, (child) => {
    if (child.type === 'call') {
      const funcRef = child.childForFieldName('function');
      if (!funcRef) return;

      let calleeName: string;
      if (funcRef.type === 'identifier') {
        calleeName = funcRef.text;
      } else if (funcRef.type === 'attribute') {
        const attr = funcRef.childForFieldName('attribute');
        calleeName = attr?.text ?? funcRef.text;
      } else {
        return;
      }

      const calleeComp = nameToComponent.get(calleeName);
      if (calleeComp && calleeComp.id !== callerComp.id) {
        const id = generateRelationshipId(callerComp.id, calleeComp.id, RelationshipType.Calls);
        if (!relationships.has(id)) {
          relationships.set(id, {
            id,
            source: callerComp.id,
            target: calleeComp.id,
            type: RelationshipType.Calls,
          });
        }
      }
    }
  });
}
