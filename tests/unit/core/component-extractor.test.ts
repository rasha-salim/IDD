import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { loadProject } from '../../../src/core/project-loader.js';
import { extractComponents } from '../../../src/core/component-extractor.js';
import { ComponentType, type IddComponent } from '../../../src/types/components.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../../fixtures/simple-project');

describe('extractComponents', () => {
  let components: IddComponent[];

  beforeAll(() => {
    const project = loadProject({ targetPath: FIXTURE_PATH });
    components = extractComponents(project);
  });

  it('should extract file components for each source file', () => {
    const files = components.filter((c) => c.type === ComponentType.File);
    // 4 files: user.ts, user-service.ts, validators.ts, index.ts
    expect(files.length).toBe(4);
  });

  it('should extract classes', () => {
    const classes = components.filter((c) => c.type === ComponentType.Class);
    const classNames = classes.map((c) => c.name);
    expect(classNames).toContain('User');
    expect(classNames).toContain('UserService');
    expect(classes.length).toBe(2);
  });

  it('should extract class metadata correctly', () => {
    const userClass = components.find(
      (c) => c.type === ComponentType.Class && c.name === 'User'
    );
    expect(userClass).toBeDefined();
    expect(userClass!.metadata.isExported).toBe(true);
    expect(userClass!.metadata.implements).toContain('UserProfile');
    expect(userClass!.metadata.methods).toBeDefined();
    expect(userClass!.metadata.methods!.length).toBeGreaterThanOrEqual(1);
    const isAdminMethod = userClass!.metadata.methods!.find((m) => m.name === 'isAdmin');
    expect(isAdminMethod).toBeDefined();
    expect(isAdminMethod!.returnType).toBe('boolean');
  });

  it('should extract functions', () => {
    const functions = components.filter((c) => c.type === ComponentType.Function);
    const fnNames = functions.map((c) => c.name);
    expect(fnNames).toContain('createDefaultUser');
    expect(fnNames).toContain('validateEmail');
    expect(fnNames).toContain('validateName');
    expect(functions.length).toBe(3);
  });

  it('should extract interfaces', () => {
    const interfaces = components.filter((c) => c.type === ComponentType.Interface);
    expect(interfaces.length).toBe(1);
    expect(interfaces[0].name).toBe('UserProfile');
  });

  it('should extract enums', () => {
    const enums = components.filter((c) => c.type === ComponentType.Enum);
    expect(enums.length).toBe(1);
    expect(enums[0].name).toBe('UserRole');
  });

  it('should extract type aliases', () => {
    const typeAliases = components.filter((c) => c.type === ComponentType.TypeAlias);
    expect(typeAliases.length).toBe(1);
    expect(typeAliases[0].name).toBe('ValidationResult');
  });

  it('should assign deterministic IDs', () => {
    const userClass = components.find(
      (c) => c.type === ComponentType.Class && c.name === 'User'
    );
    expect(userClass!.id).toMatch(/^class-user-/);
  });

  it('should include correct line ranges', () => {
    const userClass = components.find(
      (c) => c.type === ComponentType.Class && c.name === 'User'
    );
    expect(userClass!.startLine).toBeGreaterThan(0);
    expect(userClass!.endLine).toBeGreaterThan(userClass!.startLine);
    expect(userClass!.metadata.loc).toBeGreaterThan(0);
  });
});
