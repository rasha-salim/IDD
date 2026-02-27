/**
 * Intent: Define security analysis output types.
 * Aligned with SARIF 2.1.0 concepts for interoperability.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  id: string;
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  recommendation: string;
  cweId?: string;
  owaspCategory?: string;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  cweId?: string;
  owaspCategory?: string;
}

export interface SecurityPosture {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  findings: SecurityFinding[];
  rules: SecurityRule[];
  summary: string;
  llmAssessment?: string;
}
