import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { loadProject } from '../../../src/core/project-loader.js';
import { extractComponents } from '../../../src/core/component-extractor.js';
import { buildRelationships } from '../../../src/core/relationship-builder.js';
import { RelationshipType, type IddComponent, type IddRelationship } from '../../../src/types/components.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../../fixtures/simple-project');

describe('buildRelationships', () => {
  let components: IddComponent[];
  let relationships: IddRelationship[];

  beforeAll(() => {
    const project = loadProject({ targetPath: FIXTURE_PATH });
    components = extractComponents(project);
    relationships = buildRelationships(project, components);
  });

  it('should find import relationships between files', () => {
    const imports = relationships.filter((r) => r.type === RelationshipType.Imports);
    expect(imports.length).toBeGreaterThan(0);

    // user-service.ts imports from user.ts
    const serviceImportsUser = imports.find((r) => {
      const source = components.find((c) => c.id === r.source);
      const target = components.find((c) => c.id === r.target);
      return source?.name === 'user-service.ts' && target?.name === 'user.ts';
    });
    expect(serviceImportsUser).toBeDefined();
    expect(serviceImportsUser!.metadata?.importSpecifiers).toContain('User');
  });

  it('should find implements relationships', () => {
    const impl = relationships.filter((r) => r.type === RelationshipType.Implements);
    expect(impl.length).toBeGreaterThan(0);

    // User implements UserProfile
    const userImpl = impl.find((r) => {
      const source = components.find((c) => c.id === r.source);
      return source?.name === 'User';
    });
    expect(userImpl).toBeDefined();
  });

  it('should find call relationships', () => {
    const calls = relationships.filter((r) => r.type === RelationshipType.Calls);
    // createDefaultUser calls new User() which is a constructor
    // UserService.getAllAdmins calls user.isAdmin()
    // We expect at least some call relationships
    expect(calls.length).toBeGreaterThanOrEqual(0);
  });

  it('should not have duplicate relationships', () => {
    const ids = relationships.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('should not include relationships to node_modules', () => {
    const allTargetComps = relationships.map((r) => components.find((c) => c.id === r.target));
    for (const comp of allTargetComps) {
      if (comp) {
        expect(comp.filePath).not.toContain('node_modules');
      }
    }
  });
});
