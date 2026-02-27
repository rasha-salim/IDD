import { describe, it, expect } from 'vitest';
import { generateComponentId, generateRelationshipId } from '../../../src/utils/id-generator.js';

describe('generateComponentId', () => {
  it('should produce deterministic IDs for same inputs', () => {
    const id1 = generateComponentId('class', 'src/auth/user.ts', 'UserService');
    const id2 = generateComponentId('class', 'src/auth/user.ts', 'UserService');
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different inputs', () => {
    const id1 = generateComponentId('class', 'src/auth/user.ts', 'UserService');
    const id2 = generateComponentId('class', 'src/auth/user.ts', 'AuthService');
    expect(id1).not.toBe(id2);
  });

  it('should include component type and name in the ID', () => {
    const id = generateComponentId('function', 'src/utils/helper.ts', 'calculateTotal');
    expect(id).toMatch(/^function-calculatetotal-/);
  });

  it('should sanitize special characters in name', () => {
    const id = generateComponentId('interface', 'src/types.ts', 'Map<string, number>');
    expect(id).not.toMatch(/[<>,\s]/);
  });
});

describe('generateRelationshipId', () => {
  it('should produce deterministic IDs for same inputs', () => {
    const id1 = generateRelationshipId('source-abc', 'target-xyz', 'imports');
    const id2 = generateRelationshipId('source-abc', 'target-xyz', 'imports');
    expect(id1).toBe(id2);
  });

  it('should produce different IDs for different relationship types', () => {
    const id1 = generateRelationshipId('source-abc', 'target-xyz', 'imports');
    const id2 = generateRelationshipId('source-abc', 'target-xyz', 'calls');
    expect(id1).not.toBe(id2);
  });

  it('should include relationship type in the ID', () => {
    const id = generateRelationshipId('source-abc', 'target-xyz', 'extends');
    expect(id).toMatch(/^rel-extends-/);
  });
});
