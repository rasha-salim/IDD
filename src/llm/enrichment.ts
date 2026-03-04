/**
 * Intent: Orchestrate LLM enrichment of analysis results.
 * Uses Claude to enhance architecture analysis and security assessment.
 * Guarantees: If LLM fails, the report explicitly states why (no silent fallback).
 */

import type { IddComponent, IddRelationship } from '../types/components.js';
import type { KnowledgeGraph } from '../types/graph.js';
import type { Architecture } from '../types/architecture.js';
import type { SecurityPosture } from '../types/security.js';
import { sendPrompt } from './client.js';
import {
  ARCHITECTURE_SYSTEM_PROMPT,
  SECURITY_SYSTEM_PROMPT,
  buildArchitecturePrompt,
  buildSecurityPrompt,
} from './prompts.js';
import { LlmError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface EnrichmentResult {
  architecture: Architecture;
  securityAssessment: string | undefined;
}

/**
 * Enrich analysis results with LLM insights.
 *
 * Intent: Add human-quality architectural analysis and security assessment.
 * Guarantees: On LLM failure, architecture.llmAnalysis and security.llmAssessment
 * contain the error message explaining why enrichment failed.
 */
export async function enrichWithLlm(
  components: IddComponent[],
  relationships: IddRelationship[],
  graph: KnowledgeGraph,
  securityPosture: SecurityPosture,
): Promise<EnrichmentResult> {
  let architecture: Architecture;
  let securityAssessment: string | undefined;

  // Architecture analysis
  try {
    logger.info('Requesting architecture analysis from Claude...');
    const archPrompt = buildArchitecturePrompt(components, relationships, graph);
    const archResponse = await sendPrompt(ARCHITECTURE_SYSTEM_PROMPT, archPrompt);

    architecture = parseArchitectureResponse(archResponse);
    architecture.llmAnalysis = archResponse;
    logger.info('Architecture analysis complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Architecture LLM enrichment failed: ${message}`);
    architecture = {
      layers: [],
      patterns: [],
      decisions: [],
      summary: `LLM architecture analysis unavailable: ${message}`,
      llmAnalysis: `FAILED: ${message}`,
    };
  }

  // Security assessment
  try {
    logger.info('Requesting security assessment from Claude...');
    const secPrompt = buildSecurityPrompt(securityPosture);
    securityAssessment = await sendPrompt(SECURITY_SYSTEM_PROMPT, secPrompt);
    logger.info('Security assessment complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Security LLM enrichment failed: ${message}`);
    securityAssessment = `LLM security assessment unavailable: ${message}`;
  }

  return { architecture, securityAssessment };
}

function parseArchitectureResponse(response: string): Architecture {
  try {
    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, response];
    const jsonStr = jsonMatch[1]?.trim() ?? response;
    const parsed = JSON.parse(jsonStr);

    return {
      layers: parsed.layers ?? [],
      patterns: parsed.patterns ?? [],
      decisions: parsed.decisions ?? [],
      summary: parsed.summary ?? 'Architecture analysis complete.',
    };
  } catch {
    // If JSON parsing fails, treat the whole response as a summary
    return {
      layers: [],
      patterns: [],
      decisions: [],
      summary: response,
    };
  }
}
