/**
 * Intent: Walk all source files in a ts-morph Project and extract components.
 * Components include: files, classes, functions, interfaces, type aliases, enums.
 * Guarantees: Every extractable declaration gets a unique, deterministic ID.
 */

import { Project, SourceFile, SyntaxKind, type Scope } from 'ts-morph';
import {
  ComponentType,
  type IddComponent,
  type ComponentMetadata,
  type ParameterInfo,
  type PropertyInfo,
  type MethodInfo,
} from '../types/components.js';
import { generateComponentId } from '../utils/id-generator.js';
import { logger } from '../utils/logger.js';

/**
 * Extract all components from a ts-morph Project.
 *
 * Intent: Produce a flat list of every identifiable code component.
 * Guarantees: Each component has a unique ID, file path, and line range.
 */
export function extractComponents(project: Project): IddComponent[] {
  const components: IddComponent[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // Skip declaration files and node_modules
    if (filePath.includes('node_modules') || filePath.endsWith('.d.ts')) {
      continue;
    }

    logger.debug(`Extracting components from: ${filePath}`);

    components.push(extractFileComponent(sourceFile));
    components.push(...extractClasses(sourceFile));
    components.push(...extractFunctions(sourceFile));
    components.push(...extractInterfaces(sourceFile));
    components.push(...extractTypeAliases(sourceFile));
    components.push(...extractEnums(sourceFile));
  }

  logger.info(`Extracted ${components.length} components`);
  return components;
}

function extractFileComponent(sourceFile: SourceFile): IddComponent {
  const filePath = sourceFile.getFilePath();
  const loc = sourceFile.getEndLineNumber();

  return {
    id: generateComponentId('file', filePath, sourceFile.getBaseName()),
    name: sourceFile.getBaseName(),
    type: ComponentType.File,
    filePath,
    startLine: 1,
    endLine: loc,
    metadata: {
      loc,
      isExported: false,
      isDefault: false,
    },
  };
}

function extractClasses(sourceFile: SourceFile): IddComponent[] {
  const filePath = sourceFile.getFilePath();

  return sourceFile.getClasses().map((cls) => {
    const name = cls.getName() ?? 'AnonymousClass';
    const startLine = cls.getStartLineNumber();
    const endLine = cls.getEndLineNumber();

    const properties: PropertyInfo[] = cls.getProperties().map((prop) => ({
      name: prop.getName(),
      type: prop.getType().getText(prop),
      visibility: mapScope(prop.getScope()),
      isStatic: prop.isStatic(),
      isReadonly: prop.isReadonly(),
    }));

    const methods: MethodInfo[] = cls.getMethods().map((method) => ({
      name: method.getName(),
      parameters: method.getParameters().map(mapParameter),
      returnType: method.getReturnType().getText(method),
      visibility: mapScope(method.getScope()),
      isStatic: method.isStatic(),
      isAsync: method.isAsync(),
    }));

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: cls.isExported(),
      isDefault: cls.isDefaultExport(),
      decorators: cls.getDecorators().map((d) => d.getName()),
      properties,
      methods,
      extends: cls.getExtends()?.getText(),
      implements: cls.getImplements().map((i) => i.getText()),
    };

    return {
      id: generateComponentId('class', filePath, name),
      name,
      type: ComponentType.Class,
      filePath,
      startLine,
      endLine,
      metadata,
    };
  });
}

function extractFunctions(sourceFile: SourceFile): IddComponent[] {
  const filePath = sourceFile.getFilePath();

  return sourceFile.getFunctions().map((fn) => {
    const name = fn.getName() ?? 'anonymous';
    const startLine = fn.getStartLineNumber();
    const endLine = fn.getEndLineNumber();

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: fn.isExported(),
      isDefault: fn.isDefaultExport(),
      parameters: fn.getParameters().map(mapParameter),
      returnType: fn.getReturnType().getText(fn),
    };

    return {
      id: generateComponentId('function', filePath, name),
      name,
      type: ComponentType.Function,
      filePath,
      startLine,
      endLine,
      metadata,
    };
  });
}

function extractInterfaces(sourceFile: SourceFile): IddComponent[] {
  const filePath = sourceFile.getFilePath();

  return sourceFile.getInterfaces().map((iface) => {
    const name = iface.getName();
    const startLine = iface.getStartLineNumber();
    const endLine = iface.getEndLineNumber();

    const properties: PropertyInfo[] = iface.getProperties().map((prop) => ({
      name: prop.getName(),
      type: prop.getType().getText(prop),
      visibility: 'public' as const,
      isStatic: false,
      isReadonly: prop.isReadonly(),
    }));

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: iface.isExported(),
      isDefault: iface.isDefaultExport(),
      properties,
    };

    return {
      id: generateComponentId('interface', filePath, name),
      name,
      type: ComponentType.Interface,
      filePath,
      startLine,
      endLine,
      metadata,
    };
  });
}

function extractTypeAliases(sourceFile: SourceFile): IddComponent[] {
  const filePath = sourceFile.getFilePath();

  return sourceFile.getTypeAliases().map((alias) => {
    const name = alias.getName();
    const startLine = alias.getStartLineNumber();
    const endLine = alias.getEndLineNumber();

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: alias.isExported(),
      isDefault: alias.isDefaultExport(),
    };

    return {
      id: generateComponentId('type-alias', filePath, name),
      name,
      type: ComponentType.TypeAlias,
      filePath,
      startLine,
      endLine,
      metadata,
    };
  });
}

function extractEnums(sourceFile: SourceFile): IddComponent[] {
  const filePath = sourceFile.getFilePath();

  return sourceFile.getEnums().map((enumDecl) => {
    const name = enumDecl.getName();
    const startLine = enumDecl.getStartLineNumber();
    const endLine = enumDecl.getEndLineNumber();

    const metadata: ComponentMetadata = {
      loc: endLine - startLine + 1,
      isExported: enumDecl.isExported(),
      isDefault: false,
    };

    return {
      id: generateComponentId('enum', filePath, name),
      name,
      type: ComponentType.Enum,
      filePath,
      startLine,
      endLine,
      metadata,
    };
  });
}

function mapParameter(param: { getName: () => string; getType: () => { getText: (node?: any) => string }; isOptional: () => boolean }): ParameterInfo {
  return {
    name: param.getName(),
    type: param.getType().getText(),
    isOptional: param.isOptional(),
  };
}

function mapScope(scope: Scope | undefined): 'public' | 'protected' | 'private' {
  if (!scope) return 'public';
  switch (scope) {
    case 'public': return 'public';
    case 'protected': return 'protected';
    case 'private': return 'private';
    default: return 'public';
  }
}
