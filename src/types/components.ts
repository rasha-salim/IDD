/**
 * Intent: Define the fundamental building blocks extracted from source code.
 * These types represent what the component extractor discovers in the codebase.
 */

export enum ComponentType {
  File = 'file',
  Class = 'class',
  Function = 'function',
  Interface = 'interface',
  TypeAlias = 'type-alias',
  Enum = 'enum',
  Module = 'module',
  Decorator = 'decorator',
}

export enum RelationshipType {
  Imports = 'imports',
  Exports = 'exports',
  Extends = 'extends',
  Implements = 'implements',
  Calls = 'calls',
  UsesType = 'uses-type',
  Contains = 'contains',
  DependsOn = 'depends-on',
}

export interface CmiwComponent {
  id: string;
  name: string;
  type: ComponentType;
  filePath: string;
  startLine: number;
  endLine: number;
  metadata: ComponentMetadata;
}

export interface ComponentMetadata {
  loc: number;
  isExported: boolean;
  isDefault: boolean;
  decorators?: string[];
  parameters?: ParameterInfo[];
  returnType?: string;
  properties?: PropertyInfo[];
  methods?: MethodInfo[];
  extends?: string;
  implements?: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

export interface PropertyInfo {
  name: string;
  type: string;
  visibility: 'public' | 'protected' | 'private';
  isStatic: boolean;
  isReadonly: boolean;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  visibility: 'public' | 'protected' | 'private';
  isStatic: boolean;
  isAsync: boolean;
}

export interface CmiwRelationship {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  metadata?: RelationshipMetadata;
}

export interface RelationshipMetadata {
  importSpecifiers?: string[];
  callCount?: number;
  weight?: number;
}
