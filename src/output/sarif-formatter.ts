/**
 * Intent: Format security findings as SARIF 2.1.0 for integration with security tools.
 * Guarantees: Valid SARIF schema. All findings are included as results.
 */

import {
  SarifBuilder,
  SarifRunBuilder,
  SarifResultBuilder,
  SarifRuleBuilder,
} from 'node-sarif-builder';
import type { IddReport } from '../types/report.js';
import type { Severity } from '../types/security.js';

const SEVERITY_TO_SARIF_LEVEL: Record<Severity, 'error' | 'warning' | 'note' | 'none'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
  info: 'none',
};

/**
 * Format security findings from an IDD report as SARIF 2.1.0 JSON.
 *
 * Intent: Produce SARIF output for integration with GitHub Code Scanning, VS Code SARIF Viewer, etc.
 * Guarantees: Valid SARIF 2.1.0 schema. Every finding maps to a result.
 */
export function formatSarif(report: IddReport): string {
  const sarifBuilder = new SarifBuilder();
  const runBuilder = new SarifRunBuilder().initSimple({
    toolDriverName: 'idd',
    toolDriverVersion: report.metadata.version,
  });

  // Add rules
  for (const rule of report.security.rules) {
    const ruleBuilder = new SarifRuleBuilder().initSimple({
      ruleId: rule.id,
      shortDescriptionText: rule.name,
      fullDescriptionText: rule.description,
    });
    runBuilder.addRule(ruleBuilder);
  }

  // Add results
  for (const finding of report.security.findings) {
    const resultBuilder = new SarifResultBuilder().initSimple({
      ruleId: finding.ruleId,
      messageText: finding.description,
      level: SEVERITY_TO_SARIF_LEVEL[finding.severity],
      fileUri: finding.filePath,
      startLine: finding.startLine,
      endLine: finding.endLine,
    });
    runBuilder.addResult(resultBuilder);
  }

  sarifBuilder.addRun(runBuilder);
  return sarifBuilder.buildSarifJsonString({ indent: true });
}
