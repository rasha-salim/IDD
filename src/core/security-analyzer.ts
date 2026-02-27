/**
 * Intent: Orchestrate security analysis, calculate posture score, and produce SecurityPosture.
 * Guarantees: Score is 0-100. Grade maps to letter grades. All findings are included.
 */

import type { Project } from 'ts-morph';
import type { SecurityPosture, Severity } from '../types/security.js';
import type { SecurityConfig } from '../types/config.js';
import { runSecurityRules } from '../security/rules/index.js';
import { logger } from '../utils/logger.js';

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

/**
 * Run security analysis and produce a posture assessment.
 *
 * Intent: Aggregate security findings into an actionable security posture.
 * Guarantees: Score is clamped to 0-100. Grade is A-F based on score.
 */
export function analyzeSecurityPosture(project: Project, config?: SecurityConfig): SecurityPosture {
  const { findings, rules } = runSecurityRules(project, config);

  // Calculate score: start at 100, deduct per finding based on severity
  let deductions = 0;
  for (const finding of findings) {
    deductions += SEVERITY_WEIGHTS[finding.severity] ?? 0;
  }
  const score = Math.max(0, Math.min(100, 100 - deductions));
  const grade = scoreToGrade(score);

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  const summary = findings.length === 0
    ? 'No security findings detected. Static analysis passed all rules.'
    : `Found ${findings.length} security issues: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low. Score: ${score}/100 (${grade}).`;

  logger.info(`Security posture: ${grade} (${score}/100) with ${findings.length} findings`);

  return {
    score,
    grade,
    findings,
    rules,
    summary,
  };
}

function scoreToGrade(score: number): SecurityPosture['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
