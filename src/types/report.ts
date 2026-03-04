/**
 * Intent: Define the top-level report structure.
 * This is the complete output of an IDD analysis run.
 */

import type { IddComponent, IddRelationship } from './components.js';
import type { KnowledgeGraph } from './graph.js';
import type { SecurityPosture } from './security.js';
import type { Architecture } from './architecture.js';

export interface ReportMetadata {
  version: string;
  timestamp: string;
  analyzedPath: string;
  totalFiles: number;
  totalComponents: number;
  totalRelationships: number;
  analysisTimeMs: number;
  llmEnriched: boolean;
}

export interface IddReport {
  metadata: ReportMetadata;
  components: IddComponent[];
  relationships: IddRelationship[];
  graph: KnowledgeGraph;
  architecture: Architecture;
  security: SecurityPosture;
}
