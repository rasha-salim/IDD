/**
 * Intent: Define the knowledge graph structure for visualization.
 * Nodes represent components, edges represent relationships.
 * This is the data contract between analysis and rendering.
 */

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  size: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  circularDependencies: CircularDependency[];
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface CircularDependency {
  path: string[];
  severity: 'warning' | 'error';
}
