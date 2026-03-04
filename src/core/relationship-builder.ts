/**
 * Intent: Analyze a ts-morph Project to discover relationships between components.
 * Relationships include: imports, class hierarchy, function calls, type usage.
 * Guarantees: Relationships are deduplicated by ID. Only resolved references are included.
 */

import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph';
import {
  RelationshipType,
  type IddComponent,
  type IddRelationship,
} from '../types/components.js';
import { generateComponentId, generateRelationshipId } from '../utils/id-generator.js';
import { logger } from '../utils/logger.js';

/**
 * Build all relationships between the given components.
 *
 * Intent: Discover how components connect to each other via imports, inheritance, calls, and types.
 * Guarantees: No duplicate relationships. Only references that resolve to known components are included.
 */
export function buildRelationships(
  project: Project,
  components: IddComponent[],
): IddRelationship[] {
  const componentIndex = buildComponentIndex(components);
  const relationships = new Map<string, IddRelationship>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (filePath.includes('node_modules') || filePath.endsWith('.d.ts')) {
      continue;
    }

    addImportRelationships(sourceFile, componentIndex, relationships);
    addClassHierarchy(sourceFile, componentIndex, relationships);
    addCallRelationships(sourceFile, componentIndex, relationships);
  }

  const result = Array.from(relationships.values());
  logger.info(`Built ${result.length} relationships`);
  return result;
}

type ComponentIndex = Map<string, IddComponent>;

function buildComponentIndex(components: IddComponent[]): ComponentIndex {
  const index = new Map<string, IddComponent>();
  for (const comp of components) {
    index.set(comp.id, comp);
  }
  return index;
}

function findComponentByFileAndName(
  index: ComponentIndex,
  filePath: string,
  name: string,
  type: string,
): IddComponent | undefined {
  const id = generateComponentId(type, filePath, name);
  return index.get(id);
}

function findFileComponent(index: ComponentIndex, filePath: string, baseName: string): IddComponent | undefined {
  const id = generateComponentId('file', filePath, baseName);
  return index.get(id);
}

function addRelationship(
  relationships: Map<string, IddRelationship>,
  sourceId: string,
  targetId: string,
  type: RelationshipType,
  metadata?: IddRelationship['metadata'],
): void {
  const id = generateRelationshipId(sourceId, targetId, type);
  if (!relationships.has(id)) {
    relationships.set(id, { id, source: sourceId, target: targetId, type, metadata });
  }
}

function addImportRelationships(
  sourceFile: SourceFile,
  index: ComponentIndex,
  relationships: Map<string, IddRelationship>,
): void {
  const srcPath = sourceFile.getFilePath();
  const srcBaseName = sourceFile.getBaseName();
  const srcFileComp = findFileComponent(index, srcPath, srcBaseName);
  if (!srcFileComp) return;

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDecl.getModuleSpecifierSourceFile();
    if (!targetSourceFile) continue;

    const targetPath = targetSourceFile.getFilePath();
    if (targetPath.includes('node_modules')) continue;

    const targetBaseName = targetSourceFile.getBaseName();
    const targetFileComp = findFileComponent(index, targetPath, targetBaseName);
    if (!targetFileComp) continue;

    const specifiers = importDecl.getNamedImports().map((n) => n.getName());
    const defaultImport = importDecl.getDefaultImport()?.getText();
    if (defaultImport) specifiers.push(defaultImport);

    addRelationship(relationships, srcFileComp.id, targetFileComp.id, RelationshipType.Imports, {
      importSpecifiers: specifiers,
    });
  }
}

function addClassHierarchy(
  sourceFile: SourceFile,
  index: ComponentIndex,
  relationships: Map<string, IddRelationship>,
): void {
  const filePath = sourceFile.getFilePath();

  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName();
    if (!className) continue;

    const classComp = findComponentByFileAndName(index, filePath, className, 'class');
    if (!classComp) continue;

    // extends
    const extendsExpr = cls.getExtends();
    if (extendsExpr) {
      const baseClassName = extendsExpr.getText();
      const baseType = extendsExpr.getType();
      const symbol = baseType.getSymbol();
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations.length > 0) {
          const decl = declarations[0];
          const declFile = decl.getSourceFile().getFilePath();
          const baseComp = findComponentByFileAndName(index, declFile, baseClassName, 'class');
          if (baseComp) {
            addRelationship(relationships, classComp.id, baseComp.id, RelationshipType.Extends);
          }
        }
      }
    }

    // implements
    for (const impl of cls.getImplements()) {
      const ifaceName = impl.getText();
      const implType = impl.getType();
      const symbol = implType.getSymbol();
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations.length > 0) {
          const decl = declarations[0];
          const declFile = decl.getSourceFile().getFilePath();
          const ifaceComp = findComponentByFileAndName(index, declFile, ifaceName, 'interface');
          if (ifaceComp) {
            addRelationship(relationships, classComp.id, ifaceComp.id, RelationshipType.Implements);
          }
        }
      }
    }
  }
}

function addCallRelationships(
  sourceFile: SourceFile,
  index: ComponentIndex,
  relationships: Map<string, IddRelationship>,
): void {
  const filePath = sourceFile.getFilePath();

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const expression = node.getExpression();
    let callerComp: IddComponent | undefined;

    // Find the containing function or class method
    const containingFunction = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
    const containingMethod = node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);

    if (containingFunction) {
      const fnName = containingFunction.getName();
      if (fnName) {
        callerComp = findComponentByFileAndName(index, filePath, fnName, 'function');
      }
    } else if (containingMethod) {
      const cls = containingMethod.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
      if (cls) {
        const className = cls.getName();
        if (className) {
          callerComp = findComponentByFileAndName(index, filePath, className, 'class');
        }
      }
    }

    if (!callerComp) return;

    // Try to resolve what's being called
    try {
      const symbol = expression.getSymbol();
      if (!symbol) return;

      const declarations = symbol.getDeclarations();
      if (declarations.length === 0) return;

      const decl = declarations[0];
      const declFile = decl.getSourceFile().getFilePath();
      if (declFile.includes('node_modules')) return;

      let targetComp: IddComponent | undefined;

      if (Node.isFunctionDeclaration(decl)) {
        const fnName = decl.getName();
        if (fnName) {
          targetComp = findComponentByFileAndName(index, declFile, fnName, 'function');
        }
      } else if (Node.isMethodDeclaration(decl)) {
        const cls = decl.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
        if (cls) {
          const className = cls.getName();
          if (className) {
            targetComp = findComponentByFileAndName(index, declFile, className, 'class');
          }
        }
      }

      if (targetComp && targetComp.id !== callerComp.id) {
        addRelationship(relationships, callerComp.id, targetComp.id, RelationshipType.Calls);
      }
    } catch {
      // Resolution failed - skip this call expression
    }
  });
}
