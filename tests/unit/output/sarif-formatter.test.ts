import { describe, it, expect } from 'vitest';
import { formatSarif } from '../../../src/output/sarif-formatter.js';
import type { CmiwReport } from '../../../src/types/report.js';

function createMockReport(): CmiwReport {
  return {
    metadata: {
      version: '0.1.0',
      timestamp: '2026-01-01T00:00:00.000Z',
      analyzedPath: '/test/project',
      totalFiles: 1,
      totalComponents: 1,
      totalRelationships: 0,
      analysisTimeMs: 500,
      llmEnriched: false,
    },
    components: [],
    relationships: [],
    graph: { nodes: [], edges: [], clusters: [], circularDependencies: [] },
    architecture: { layers: [], patterns: [], decisions: [], summary: '' },
    security: {
      score: 75,
      grade: 'C',
      findings: [
        {
          id: 'finding-1',
          ruleId: 'cmiw-sec-002',
          severity: 'critical',
          title: 'SQL Injection',
          description: 'SQL injection found',
          filePath: '/src/server.ts',
          startLine: 10,
          endLine: 10,
          snippet: 'SELECT * FROM users',
          recommendation: 'Use parameterized queries',
          cweId: 'CWE-89',
          owaspCategory: 'A03:2021',
        },
      ],
      rules: [
        { id: 'cmiw-sec-002', name: 'SQL Injection', description: 'Detects SQL injection', severity: 'critical' },
      ],
      summary: '1 finding',
    },
  };
}

describe('formatSarif', () => {
  it('should produce valid JSON', () => {
    const report = createMockReport();
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
  });

  it('should follow SARIF 2.1.0 schema structure', () => {
    const report = createMockReport();
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed.$schema).toContain('sarif');
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toBeDefined();
    expect(parsed.runs.length).toBe(1);
  });

  it('should include the tool driver info', () => {
    const report = createMockReport();
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].tool.driver.name).toBe('cmiw');
  });

  it('should include findings as results', () => {
    const report = createMockReport();
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].results.length).toBe(1);
    expect(parsed.runs[0].results[0].ruleId).toBe('cmiw-sec-002');
  });

  it('should map severity to SARIF levels', () => {
    const report = createMockReport();
    const output = formatSarif(report);
    const parsed = JSON.parse(output);
    expect(parsed.runs[0].results[0].level).toBe('error');
  });
});
