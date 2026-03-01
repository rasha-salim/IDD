/**
 * Intent: Test all granular subcommands (components, graph, security, schema).
 * Uses library API directly (same pattern as analyze-command.test.ts).
 *
 * Guarantees: Each subcommand produces valid, parseable JSON output matching expected shapes.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { detectLanguage } from '../../src/core/language-detector.js';
import { createAnalyzer } from '../../src/core/language-analyzer.js';
import { buildGraph } from '../../src/core/graph-builder.js';
import { loadSecurityConfig } from '../../src/core/config-loader.js';
import { runSchema } from '../../src/cli/commands/schema.js';
import type { CmiwComponent } from '../../src/types/components.js';
import type { KnowledgeGraph } from '../../src/types/graph.js';
import type { SecurityPosture } from '../../src/types/security.js';

const TS_FIXTURE = resolve(import.meta.dirname, '../fixtures/simple-project');
const TS_VULNERABLE = resolve(import.meta.dirname, '../fixtures/security-vulnerable');
const PY_FIXTURE = resolve(import.meta.dirname, '../fixtures/python-project');
const PY_VULNERABLE = resolve(import.meta.dirname, '../fixtures/python-vulnerable');

describe('components subcommand logic', () => {
  it('should extract TS components as valid CmiwComponent[]', async () => {
    const language = detectLanguage(TS_FIXTURE);
    const analyzer = await createAnalyzer(language);
    await analyzer.loadProject(TS_FIXTURE);
    const components: CmiwComponent[] = analyzer.extractComponents();

    expect(Array.isArray(components)).toBe(true);
    expect(components.length).toBeGreaterThan(0);

    // Verify shape of each component
    for (const comp of components) {
      expect(comp).toHaveProperty('id');
      expect(comp).toHaveProperty('name');
      expect(comp).toHaveProperty('type');
      expect(comp).toHaveProperty('filePath');
      expect(comp).toHaveProperty('startLine');
      expect(comp).toHaveProperty('endLine');
      expect(comp).toHaveProperty('metadata');
      expect(typeof comp.metadata.loc).toBe('number');
      expect(typeof comp.metadata.isExported).toBe('boolean');
    }

    // Verify JSON serialization round-trips cleanly
    const json = JSON.stringify(components, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(components.length);
  });

  it('should extract Python components as valid CmiwComponent[]', async () => {
    const language = detectLanguage(PY_FIXTURE);
    expect(language).toBe('python');

    const analyzer = await createAnalyzer(language);
    await analyzer.loadProject(PY_FIXTURE);
    const components: CmiwComponent[] = analyzer.extractComponents();

    expect(Array.isArray(components)).toBe(true);
    expect(components.length).toBeGreaterThan(0);

    for (const comp of components) {
      expect(comp).toHaveProperty('id');
      expect(comp).toHaveProperty('name');
      expect(comp).toHaveProperty('type');
      expect(comp).toHaveProperty('filePath');
    }
  });
});

describe('graph subcommand logic', () => {
  it('should build TS graph with nodes, edges, clusters', async () => {
    const language = detectLanguage(TS_FIXTURE);
    const analyzer = await createAnalyzer(language);
    await analyzer.loadProject(TS_FIXTURE);
    const components = analyzer.extractComponents();
    const relationships = analyzer.buildRelationships(components);
    const graph: KnowledgeGraph = buildGraph(components, relationships);

    expect(graph).toHaveProperty('nodes');
    expect(graph).toHaveProperty('edges');
    expect(graph).toHaveProperty('clusters');
    expect(graph).toHaveProperty('circularDependencies');
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.nodes.length).toBeGreaterThan(0);

    // Verify node shape
    for (const node of graph.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('label');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('group');
      expect(node).toHaveProperty('size');
      expect(typeof node.size).toBe('number');
    }

    // Verify JSON serialization
    const json = JSON.stringify(graph, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.nodes.length).toBe(graph.nodes.length);
    expect(parsed.edges.length).toBe(graph.edges.length);
  });
});

describe('security subcommand logic', () => {
  it('should return clean security for simple TS project', async () => {
    const language = detectLanguage(TS_FIXTURE);
    const analyzer = await createAnalyzer(language);
    await analyzer.loadProject(TS_FIXTURE);
    const config = loadSecurityConfig({ targetDir: TS_FIXTURE });
    const security: SecurityPosture = analyzer.analyzeSecurityPosture(config);

    expect(security.score).toBe(100);
    expect(security.grade).toBe('A');
    expect(security.findings.length).toBe(0);

    // Verify JSON serialization
    const json = JSON.stringify(security, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.score).toBe(100);
    expect(parsed.grade).toBe('A');
  });

  it('should detect findings in vulnerable TS project', async () => {
    const language = detectLanguage(TS_VULNERABLE);
    const analyzer = await createAnalyzer(language);
    await analyzer.loadProject(TS_VULNERABLE);
    const config = loadSecurityConfig({ targetDir: TS_VULNERABLE });
    const security: SecurityPosture = analyzer.analyzeSecurityPosture(config);

    expect(security.findings.length).toBeGreaterThan(0);
    expect(security.grade).toBe('F');
    expect(security.score).toBeLessThan(50);

    // Verify finding shape
    for (const finding of security.findings) {
      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('ruleId');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('title');
      expect(finding).toHaveProperty('filePath');
      expect(finding).toHaveProperty('startLine');
      expect(finding).toHaveProperty('snippet');
      expect(finding).toHaveProperty('recommendation');
    }
  });

  it('should detect findings in vulnerable Python project', async () => {
    const language = detectLanguage(PY_VULNERABLE);
    expect(language).toBe('python');

    const analyzer = await createAnalyzer(language);
    await analyzer.loadProject(PY_VULNERABLE);
    const config = loadSecurityConfig({ targetDir: PY_VULNERABLE });
    const security: SecurityPosture = analyzer.analyzeSecurityPosture(config);

    expect(security.findings.length).toBeGreaterThan(0);
    expect(security.score).toBeLessThan(100);
  });
});

describe('schema subcommand logic', () => {
  it('should output valid JSON schema for each type', () => {
    const types = ['components', 'graph', 'security', 'report'];

    for (const typeName of types) {
      // Capture console.log output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      runSchema(typeName);

      console.log = originalLog;

      expect(logs.length).toBe(1);
      const schema = JSON.parse(logs[0]);
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('title');
      expect(schema).toHaveProperty('type');
    }
  });

  it('should set exitCode 1 for unknown schema type', () => {
    const originalExitCode = process.exitCode;
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (msg: string) => errors.push(msg);

    runSchema('nonexistent');

    console.error = originalError;

    expect(process.exitCode).toBe(1);
    expect(errors[0]).toContain('Unknown schema type');

    // Reset
    process.exitCode = originalExitCode;
  });
});
