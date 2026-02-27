import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { loadProject } from '../../../src/core/project-loader.js';
import { extractComponents } from '../../../src/core/component-extractor.js';
import { buildRelationships } from '../../../src/core/relationship-builder.js';
import { buildGraph } from '../../../src/core/graph-builder.js';
import type { KnowledgeGraph } from '../../../src/types/graph.js';

const FIXTURE_PATH = resolve(import.meta.dirname, '../../fixtures/simple-project');

describe('buildGraph', () => {
  let graph: KnowledgeGraph;

  beforeAll(() => {
    const project = loadProject({ targetPath: FIXTURE_PATH });
    const components = extractComponents(project);
    const relationships = buildRelationships(project, components);
    graph = buildGraph(components, relationships);
  });

  it('should create a node for every component', () => {
    // 12 components: 4 files + 2 classes + 3 functions + 1 interface + 1 enum + 1 type alias
    expect(graph.nodes.length).toBe(12);
  });

  it('should create an edge for every relationship', () => {
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('should assign groups based on directory', () => {
    const groups = new Set(graph.nodes.map((n) => n.group));
    expect(groups.size).toBeGreaterThan(0);
  });

  it('should calculate node sizes based on connections and LOC', () => {
    const connectedNodes = graph.nodes.filter((n) => n.size > 1);
    expect(connectedNodes.length).toBeGreaterThan(0);
  });

  it('should assign edge weights based on relationship type', () => {
    for (const edge of graph.edges) {
      expect(edge.weight).toBeGreaterThan(0);
    }
  });

  it('should detect clusters by directory', () => {
    expect(graph.clusters.length).toBeGreaterThan(0);
    for (const cluster of graph.clusters) {
      expect(cluster.nodeIds.length).toBeGreaterThan(0);
    }
  });

  it('should not find circular dependencies in simple fixture', () => {
    expect(graph.circularDependencies.length).toBe(0);
  });

  it('should include metadata on nodes', () => {
    for (const node of graph.nodes) {
      expect(node.metadata).toBeDefined();
      expect(node.metadata.filePath).toBeDefined();
    }
  });
});
