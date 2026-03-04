import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildArchitecturePrompt, buildSecurityPrompt } from '../../../src/llm/prompts.js';
import { ComponentType, RelationshipType } from '../../../src/types/components.js';
import type { IddComponent, IddRelationship } from '../../../src/types/components.js';
import type { KnowledgeGraph } from '../../../src/types/graph.js';
import type { SecurityPosture } from '../../../src/types/security.js';

const mockComponents: IddComponent[] = [
  {
    id: 'class-user-abc123',
    name: 'User',
    type: ComponentType.Class,
    filePath: '/src/models/user.ts',
    startLine: 1,
    endLine: 20,
    metadata: { loc: 20, isExported: true, isDefault: false },
  },
  {
    id: 'class-userservice-def456',
    name: 'UserService',
    type: ComponentType.Class,
    filePath: '/src/services/user-service.ts',
    startLine: 1,
    endLine: 30,
    metadata: { loc: 30, isExported: true, isDefault: false },
  },
];

const mockRelationships: IddRelationship[] = [
  {
    id: 'rel-imports-abc',
    source: 'class-userservice-def456',
    target: 'class-user-abc123',
    type: RelationshipType.Imports,
    metadata: { importSpecifiers: ['User'] },
  },
];

const mockGraph: KnowledgeGraph = {
  nodes: [
    { id: 'class-user-abc123', label: 'User', type: 'class', group: 'models', size: 5, metadata: {} },
    { id: 'class-userservice-def456', label: 'UserService', type: 'class', group: 'services', size: 8, metadata: {} },
  ],
  edges: [
    { id: 'rel-imports-abc', source: 'class-userservice-def456', target: 'class-user-abc123', type: 'imports', weight: 2, metadata: {} },
  ],
  clusters: [
    { id: 'cluster-models', label: 'models', nodeIds: ['class-user-abc123'] },
    { id: 'cluster-services', label: 'services', nodeIds: ['class-userservice-def456'] },
  ],
  circularDependencies: [],
};

const mockPosture: SecurityPosture = {
  score: 45,
  grade: 'F',
  findings: [
    {
      id: 'finding-1',
      ruleId: 'idd-sec-002',
      severity: 'critical',
      title: 'SQL Injection',
      description: 'Template literal SQL query',
      filePath: '/src/server.ts',
      startLine: 10,
      endLine: 10,
      snippet: 'const q = `SELECT * FROM users WHERE id = ${id}`',
      recommendation: 'Use parameterized queries.',
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021-Injection',
    },
  ],
  rules: [
    { id: 'idd-sec-002', name: 'SQL Injection', description: 'SQL injection detection', severity: 'critical' },
  ],
  summary: 'Found 1 critical finding.',
};

describe('buildArchitecturePrompt', () => {
  it('should include component count in prompt', () => {
    const prompt = buildArchitecturePrompt(mockComponents, mockRelationships, mockGraph);
    expect(prompt).toContain('Components (2 total)');
  });

  it('should include relationship count in prompt', () => {
    const prompt = buildArchitecturePrompt(mockComponents, mockRelationships, mockGraph);
    expect(prompt).toContain('Relationships (1 total)');
  });

  it('should include cluster information', () => {
    const prompt = buildArchitecturePrompt(mockComponents, mockRelationships, mockGraph);
    expect(prompt).toContain('models');
    expect(prompt).toContain('services');
  });

  it('should indicate no circular dependencies when none exist', () => {
    const prompt = buildArchitecturePrompt(mockComponents, mockRelationships, mockGraph);
    expect(prompt).toContain('None detected');
  });
});

describe('buildSecurityPrompt', () => {
  it('should include score and grade', () => {
    const prompt = buildSecurityPrompt(mockPosture);
    expect(prompt).toContain('45/100');
    expect(prompt).toContain('Grade: F');
  });

  it('should include finding count', () => {
    const prompt = buildSecurityPrompt(mockPosture);
    expect(prompt).toContain('Findings (1 total)');
  });

  it('should include rule IDs', () => {
    const prompt = buildSecurityPrompt(mockPosture);
    expect(prompt).toContain('idd-sec-002');
  });

  it('should include CWE references', () => {
    const prompt = buildSecurityPrompt(mockPosture);
    expect(prompt).toContain('CWE-89');
  });
});
