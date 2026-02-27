/**
 * Intent: Define architecture analysis output types.
 * Captures layer classification, patterns detected, and design decisions.
 */

export type LayerType =
  | 'presentation'
  | 'api'
  | 'business-logic'
  | 'data-access'
  | 'infrastructure'
  | 'shared'
  | 'unknown';

export interface Layer {
  name: string;
  type: LayerType;
  componentIds: string[];
  description: string;
}

export interface ArchitecturePattern {
  name: string;
  confidence: number;
  evidence: string[];
}

export interface ArchitectureDecision {
  title: string;
  description: string;
  rationale: string;
}

export interface Architecture {
  layers: Layer[];
  patterns: ArchitecturePattern[];
  decisions: ArchitectureDecision[];
  summary: string;
  llmAnalysis?: string;
}
