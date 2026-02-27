/**
 * Intent: Define prompt templates for LLM enrichment.
 * Prompts are designed to extract architectural insight and security assessment
 * from structured data (not raw code), minimizing token usage.
 */

import type { KnowledgeGraph } from '../types/graph.js';
import type { SecurityPosture } from '../types/security.js';
import type { CmiwComponent, CmiwRelationship } from '../types/components.js';

export const ARCHITECTURE_SYSTEM_PROMPT = `You are a senior software architect analyzing a codebase structure. You will receive a summary of components and their relationships extracted via static analysis. Provide architectural analysis including:

1. Layer classification (presentation, API, business logic, data access, infrastructure, shared)
2. Architecture patterns detected (MVC, layered, microservices, monolith, etc.)
3. Key design decisions and their tradeoffs

Respond in JSON format matching this structure:
{
  "layers": [{ "name": string, "type": string, "componentIds": string[], "description": string }],
  "patterns": [{ "name": string, "confidence": number (0-1), "evidence": string[] }],
  "decisions": [{ "title": string, "description": string, "rationale": string }],
  "summary": string
}`;

export const SECURITY_SYSTEM_PROMPT = `You are a senior application security engineer reviewing static analysis findings. You will receive security findings from automated rules. Provide:

1. Assessment of the overall security posture
2. Prioritized recommendations
3. Context about the severity and exploitability of each finding category
4. Any patterns or systemic issues visible across the findings

Respond as a concise security assessment paragraph (2-4 paragraphs).`;

export function buildArchitecturePrompt(
  components: CmiwComponent[],
  relationships: CmiwRelationship[],
  graph: KnowledgeGraph,
): string {
  const componentSummary = components.map((c) => ({
    name: c.name,
    type: c.type,
    filePath: c.filePath,
    exported: c.metadata.isExported,
    loc: c.metadata.loc,
  }));

  const relationshipSummary = relationships.map((r) => ({
    source: r.source,
    target: r.target,
    type: r.type,
  }));

  const clusterSummary = graph.clusters.map((c) => ({
    label: c.label,
    nodeCount: c.nodeIds.length,
  }));

  return `Analyze this codebase structure:

## Components (${components.length} total)
${JSON.stringify(componentSummary, null, 2)}

## Relationships (${relationships.length} total)
${JSON.stringify(relationshipSummary, null, 2)}

## Directory Clusters
${JSON.stringify(clusterSummary, null, 2)}

## Circular Dependencies
${graph.circularDependencies.length > 0 ? JSON.stringify(graph.circularDependencies, null, 2) : 'None detected'}`;
}

export function buildSecurityPrompt(posture: SecurityPosture): string {
  const findingSummary = posture.findings.map((f) => ({
    rule: f.ruleId,
    severity: f.severity,
    title: f.title,
    file: f.filePath,
    line: f.startLine,
    cwe: f.cweId,
  }));

  return `Review these security analysis results:

## Score: ${posture.score}/100 (Grade: ${posture.grade})

## Findings (${posture.findings.length} total)
${JSON.stringify(findingSummary, null, 2)}

## Rules Applied
${posture.rules.map((r) => `- ${r.id}: ${r.name} (${r.severity})`).join('\n')}

Provide your security assessment.`;
}
