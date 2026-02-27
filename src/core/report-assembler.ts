/**
 * Intent: Combine all analysis results into a complete CmiwReport.
 * Guarantees: All fields are populated. Metadata includes timing and counts.
 */

import type { CmiwComponent, CmiwRelationship } from '../types/components.js';
import type { KnowledgeGraph } from '../types/graph.js';
import type { SecurityPosture } from '../types/security.js';
import type { Architecture } from '../types/architecture.js';
import type { CmiwReport, ReportMetadata } from '../types/report.js';
import { logger } from '../utils/logger.js';

const CMIW_VERSION = '0.1.0';

export interface AssembleInput {
  analyzedPath: string;
  components: CmiwComponent[];
  relationships: CmiwRelationship[];
  graph: KnowledgeGraph;
  architecture: Architecture;
  security: SecurityPosture;
  startTime: number;
  llmEnriched: boolean;
}

/**
 * Assemble all analysis pieces into the final CmiwReport.
 *
 * Intent: Create the complete, typed output structure.
 * Guarantees: All metadata fields are computed. Type-safe against CmiwReport.
 */
export function assembleReport(input: AssembleInput): CmiwReport {
  const analysisTimeMs = Date.now() - input.startTime;

  const fileComponents = input.components.filter((c) => c.type === 'file');

  const metadata: ReportMetadata = {
    version: CMIW_VERSION,
    timestamp: new Date().toISOString(),
    analyzedPath: input.analyzedPath,
    totalFiles: fileComponents.length,
    totalComponents: input.components.length,
    totalRelationships: input.relationships.length,
    analysisTimeMs,
    llmEnriched: input.llmEnriched,
  };

  const report: CmiwReport = {
    metadata,
    components: input.components,
    relationships: input.relationships,
    graph: input.graph,
    architecture: input.architecture,
    security: input.security,
  };

  logger.info(`Report assembled: ${metadata.totalComponents} components, ${metadata.totalRelationships} relationships, ${analysisTimeMs}ms`);

  return report;
}
