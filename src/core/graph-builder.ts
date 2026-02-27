/**
 * Intent: Transform extracted components and relationships into a knowledge graph.
 * The graph format is optimized for visualization (D3.js force-directed graphs).
 * Guarantees: All components become nodes. All relationships become edges.
 * Circular dependencies are detected and reported.
 */

import { dirname, basename } from 'node:path';
import type { CmiwComponent, CmiwRelationship } from '../types/components.js';
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphCluster,
  CircularDependency,
} from '../types/graph.js';
import { logger } from '../utils/logger.js';

/**
 * Build a knowledge graph from components and relationships.
 *
 * Intent: Produce a graph structure suitable for visualization and analysis.
 * Guarantees: Every component has a node. Every relationship has an edge.
 * Nodes are grouped by directory. Circular dependencies are detected.
 */
export function buildGraph(
  components: CmiwComponent[],
  relationships: CmiwRelationship[],
): KnowledgeGraph {
  const nodes = components.map(componentToNode);
  const edges = relationships.map(relationshipToEdge);
  const clusters = buildClusters(components);
  const circularDependencies = detectCircularDependencies(components, relationships);

  // Adjust node sizes based on connection count
  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes) {
    const connections = connectionCounts.get(node.id) ?? 0;
    const comp = components.find((c) => c.id === node.id);
    const loc = comp?.metadata.loc ?? 1;
    node.size = Math.max(1, Math.log2(loc + 1) + connections);
  }

  logger.info(
    `Built graph: ${nodes.length} nodes, ${edges.length} edges, ` +
    `${clusters.length} clusters, ${circularDependencies.length} circular deps`,
  );

  return { nodes, edges, clusters, circularDependencies };
}

function componentToNode(component: CmiwComponent): GraphNode {
  const dir = dirname(component.filePath);
  const group = basename(dir);

  return {
    id: component.id,
    label: component.name,
    type: component.type,
    group,
    size: 1,
    metadata: {
      filePath: component.filePath,
      startLine: component.startLine,
      endLine: component.endLine,
      loc: component.metadata.loc,
      isExported: component.metadata.isExported,
    },
  };
}

function relationshipToEdge(relationship: CmiwRelationship): GraphEdge {
  const weight = getEdgeWeight(relationship.type);

  return {
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    type: relationship.type,
    weight,
    metadata: { ...relationship.metadata } as Record<string, unknown>,
  };
}

function getEdgeWeight(type: string): number {
  switch (type) {
    case 'extends':
    case 'implements':
      return 3;
    case 'imports':
      return 2;
    case 'calls':
      return 1;
    case 'uses-type':
      return 1;
    default:
      return 1;
  }
}

function buildClusters(components: CmiwComponent[]): GraphCluster[] {
  const dirGroups = new Map<string, string[]>();

  for (const comp of components) {
    const dir = dirname(comp.filePath);
    if (!dirGroups.has(dir)) {
      dirGroups.set(dir, []);
    }
    dirGroups.get(dir)!.push(comp.id);
  }

  return Array.from(dirGroups.entries()).map(([dir, nodeIds]) => ({
    id: `cluster-${basename(dir)}`,
    label: basename(dir),
    nodeIds,
  }));
}

/**
 * Detect circular dependencies using DFS on file-level import relationships.
 *
 * Intent: Find cycles in the import graph that indicate architectural issues.
 * Guarantees: Each cycle is reported once, with the full path.
 */
function detectCircularDependencies(
  components: CmiwComponent[],
  relationships: CmiwRelationship[],
): CircularDependency[] {
  // Build adjacency list from import relationships
  const importEdges = relationships.filter((r) => r.type === 'imports');
  const adjacency = new Map<string, Set<string>>();

  for (const edge of importEdges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    adjacency.get(edge.source)!.add(edge.target);
  }

  const cycles: CircularDependency[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string): void {
    if (inStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = stack.indexOf(nodeId);
      const cyclePath = stack.slice(cycleStart).concat(nodeId);
      const labels = cyclePath.map((id) => {
        const comp = components.find((c) => c.id === id);
        return comp?.name ?? id;
      });
      cycles.push({
        path: labels,
        severity: 'warning',
      });
      return;
    }

    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    stack.push(nodeId);

    const neighbors = adjacency.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
    }

    stack.pop();
    inStack.delete(nodeId);
  }

  for (const nodeId of adjacency.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}
