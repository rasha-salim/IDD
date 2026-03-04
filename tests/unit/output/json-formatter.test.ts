import { describe, it, expect } from 'vitest';
import { formatJson } from '../../../src/output/json-formatter.js';
import type { IddReport } from '../../../src/types/report.js';

function createMockReport(): IddReport {
  return {
    metadata: {
      version: '0.1.0',
      timestamp: '2026-01-01T00:00:00.000Z',
      analyzedPath: '/test/project',
      totalFiles: 4,
      totalComponents: 12,
      totalRelationships: 3,
      analysisTimeMs: 1000,
      llmEnriched: false,
    },
    components: [],
    relationships: [],
    graph: { nodes: [], edges: [], clusters: [], circularDependencies: [] },
    architecture: { layers: [], patterns: [], decisions: [], summary: 'Test summary' },
    security: {
      score: 100,
      grade: 'A',
      findings: [],
      rules: [],
      summary: 'No findings',
    },
  };
}

describe('formatJson', () => {
  it('should produce valid JSON', () => {
    const report = createMockReport();
    const output = formatJson(report);
    const parsed = JSON.parse(output);
    expect(parsed.metadata.version).toBe('0.1.0');
  });

  it('should include all top-level keys', () => {
    const report = createMockReport();
    const output = formatJson(report);
    const parsed = JSON.parse(output);
    expect(Object.keys(parsed)).toEqual([
      'metadata',
      'components',
      'relationships',
      'graph',
      'architecture',
      'security',
    ]);
  });

  it('should use 2-space indentation', () => {
    const report = createMockReport();
    const output = formatJson(report);
    expect(output).toContain('  "metadata"');
  });
});
