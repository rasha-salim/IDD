import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadProject } from '../../src/core/project-loader.js';
import { extractComponents } from '../../src/core/component-extractor.js';
import { buildRelationships } from '../../src/core/relationship-builder.js';
import { buildGraph } from '../../src/core/graph-builder.js';
import { analyzeSecurityPosture } from '../../src/core/security-analyzer.js';
import { assembleReport } from '../../src/core/report-assembler.js';
import { formatJson } from '../../src/output/json-formatter.js';
import { formatSarif } from '../../src/output/sarif-formatter.js';
import { formatMarkdown } from '../../src/output/markdown-formatter.js';
import type { IddReport } from '../../src/types/report.js';

const SIMPLE_FIXTURE = resolve(import.meta.dirname, '../fixtures/simple-project');
const VULNERABLE_FIXTURE = resolve(import.meta.dirname, '../fixtures/security-vulnerable');

describe('Full analysis pipeline - simple project', () => {
  let report: IddReport;

  it('should complete the full pipeline without errors', () => {
    const startTime = Date.now();
    const project = loadProject({ targetPath: SIMPLE_FIXTURE });
    const components = extractComponents(project);
    const relationships = buildRelationships(project, components);
    const graph = buildGraph(components, relationships);
    const security = analyzeSecurityPosture(project);

    report = assembleReport({
      analyzedPath: SIMPLE_FIXTURE,
      components,
      relationships,
      graph,
      architecture: {
        layers: [],
        patterns: [],
        decisions: [],
        summary: 'LLM skipped for test',
      },
      security,
      startTime,
      llmEnriched: false,
    });

    expect(report).toBeDefined();
    expect(report.metadata.version).toBe('0.1.0');
  });

  it('should have expected component counts', () => {
    expect(report.metadata.totalFiles).toBe(4);
    expect(report.metadata.totalComponents).toBe(12);
  });

  it('should produce valid JSON output', () => {
    const json = formatJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.components).toBeDefined();
    expect(parsed.graph).toBeDefined();
    expect(parsed.security).toBeDefined();
  });

  it('should produce valid SARIF output', () => {
    const sarif = formatSarif(report);
    const parsed = JSON.parse(sarif);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toBeDefined();
  });

  it('should produce valid Markdown output', () => {
    const md = formatMarkdown(report);
    expect(md).toContain('# IDD Analysis Report');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Security');
  });

  it('should have clean security for the simple fixture', () => {
    expect(report.security.score).toBe(100);
    expect(report.security.grade).toBe('A');
    expect(report.security.findings.length).toBe(0);
  });
});

describe('Full analysis pipeline - vulnerable project', () => {
  it('should detect security issues', () => {
    const startTime = Date.now();
    const project = loadProject({ targetPath: VULNERABLE_FIXTURE });
    const components = extractComponents(project);
    const relationships = buildRelationships(project, components);
    const graph = buildGraph(components, relationships);
    const security = analyzeSecurityPosture(project);

    const report = assembleReport({
      analyzedPath: VULNERABLE_FIXTURE,
      components,
      relationships,
      graph,
      architecture: { layers: [], patterns: [], decisions: [], summary: 'LLM skipped' },
      security,
      startTime,
      llmEnriched: false,
    });

    expect(report.security.findings.length).toBeGreaterThan(0);
    expect(report.security.grade).toBe('F');
    expect(report.security.score).toBeLessThan(50);
  });
});
