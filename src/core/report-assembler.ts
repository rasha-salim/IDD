/**
 * Intent: Combine all analysis results into a complete IddReport.
 * Guarantees: All fields are populated. Metadata includes timing and counts.
 */

import type { IddComponent, IddRelationship } from '../types/components.js';
import type { KnowledgeGraph } from '../types/graph.js';
import type { SecurityPosture } from '../types/security.js';
import type { Architecture } from '../types/architecture.js';
import type { IddReport, ReportMetadata } from '../types/report.js';
import { logger } from '../utils/logger.js';

const IDD_VERSION = '0.1.0';

export interface AssembleInput {
  analyzedPath: string;
  components: IddComponent[];
  relationships: IddRelationship[];
  graph: KnowledgeGraph;
  architecture: Architecture;
  security: SecurityPosture;
  startTime: number;
  llmEnriched: boolean;
}

/**
 * Assemble all analysis pieces into the final report.
 *
 * Intent: Create the complete, typed output structure.
 * Guarantees: All metadata fields are computed. Type-safe against IddReport.
 */
export function assembleReport(input: AssembleInput): IddReport {
  const analysisTimeMs = Date.now() - input.startTime;

  const fileComponents = input.components.filter((c) => c.type === 'file');

  const metadata: ReportMetadata = {
    version: IDD_VERSION,
    timestamp: new Date().toISOString(),
    analyzedPath: input.analyzedPath,
    totalFiles: fileComponents.length,
    totalComponents: input.components.length,
    totalRelationships: input.relationships.length,
    analysisTimeMs,
    llmEnriched: input.llmEnriched,
  };

  const report: IddReport = {
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
