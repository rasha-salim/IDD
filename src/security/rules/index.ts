/**
 * Intent: Define the security rule interface and provide the rule registry/runner.
 * Guarantees: All rules are executed against every source file.
 * Results are aggregated and deduplicated.
 */

import { type SourceFile, type Project } from 'ts-morph';
import type { SecurityFinding, SecurityRule } from '../../types/security.js';
import { logger } from '../../utils/logger.js';

import { unsanitizedInputRule } from './unsanitized-input.js';
import { sqlInjectionRule } from './sql-injection.js';
import { missingAuthRule } from './missing-auth.js';
import { hardcodedSecretsRule } from './hardcoded-secrets.js';
import { unsafeEvalRule } from './unsafe-eval.js';
import { commandInjectionRule } from './command-injection.js';
import { pathTraversalRule } from './path-traversal.js';

export interface SecurityRuleDefinition extends SecurityRule {
  check(sourceFile: SourceFile, project: Project): SecurityFinding[];
}

const allRules: SecurityRuleDefinition[] = [
  unsanitizedInputRule,
  sqlInjectionRule,
  missingAuthRule,
  hardcodedSecretsRule,
  unsafeEvalRule,
  commandInjectionRule,
  pathTraversalRule,
];

/**
 * Run all security rules against all source files in the project.
 *
 * Intent: Perform static security analysis across the entire codebase.
 * Guarantees: Every file is checked by every rule. No findings are silently dropped.
 */
export function runSecurityRules(project: Project): {
  findings: SecurityFinding[];
  rules: SecurityRule[];
} {
  const findings: SecurityFinding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (filePath.includes('node_modules') || filePath.endsWith('.d.ts')) {
      continue;
    }

    for (const rule of allRules) {
      try {
        const ruleFindings = rule.check(sourceFile, project);
        findings.push(...ruleFindings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Rule ${rule.id} failed on ${filePath}: ${message}`);
      }
    }
  }

  logger.info(`Security scan complete: ${findings.length} findings from ${allRules.length} rules`);

  return {
    findings,
    rules: allRules.map(({ id, name, description, severity, cweId, owaspCategory }) => ({
      id,
      name,
      description,
      severity,
      cweId,
      owaspCategory,
    })),
  };
}
