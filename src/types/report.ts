/**
 * Intent: Define the top-level report structure.
 * This is the complete output of a CMIW analysis run.
 */

import type { CmiwComponent, CmiwRelationship } from './components.js';
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

export interface CmiwReport {
  metadata: ReportMetadata;
  components: CmiwComponent[];
  relationships: CmiwRelationship[];
  graph: KnowledgeGraph;
  architecture: Architecture;
  security: SecurityPosture;
}
