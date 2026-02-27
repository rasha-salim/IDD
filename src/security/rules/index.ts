/**
 * Intent: Define the security rule interface and provide the rule registry/runner.
 * Guarantees: All enabled rules are executed against every source file.
 * Results are aggregated, deduplicated, and filtered by minSeverity.
 * Rules with checkWithContext get taint analysis; others fall back to check.
 */

import { type SourceFile, type Project, type Node } from 'ts-morph';
import type { SecurityFinding, SecurityRule, Severity } from '../../types/security.js';
import type { SecurityConfig, RuleContext, TaintResult } from '../../types/config.js';
import { logger } from '../../utils/logger.js';
import { buildFileTaintMaps, isNodeTainted } from '../data-flow.js';

import { unsanitizedInputRule } from './unsanitized-input.js';
import { sqlInjectionRule } from './sql-injection.js';
import { missingAuthRule } from './missing-auth.js';
import { hardcodedSecretsRule } from './hardcoded-secrets.js';
import { unsafeEvalRule } from './unsafe-eval.js';
import { commandInjectionRule } from './command-injection.js';
import { pathTraversalRule } from './path-traversal.js';

export interface SecurityRuleDefinition extends SecurityRule {
  check(sourceFile: SourceFile, project: Project): SecurityFinding[];
  checkWithContext?(
    sourceFile: SourceFile,
    project: Project,
    context: RuleContext,
  ): SecurityFinding[];
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

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * Run all security rules against all source files in the project.
 *
 * Intent: Perform static security analysis across the entire codebase.
 * Guarantees: Every file is checked by every enabled rule. No findings are silently dropped.
 * Rules are skipped if disabled in config. Findings are filtered by minSeverity.
 */
export function runSecurityRules(
  project: Project,
  config?: SecurityConfig,
): {
  findings: SecurityFinding[];
  rules: SecurityRule[];
} {
  const findings: SecurityFinding[] = [];
  const effectiveConfig = config ?? {};

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (filePath.includes('node_modules') || filePath.endsWith('.d.ts')) {
      continue;
    }

    // Build taint maps for this file (used by rules with checkWithContext)
    let fileTaintMaps: Map<Node, Map<string, TaintResult>> | undefined;

    for (const rule of allRules) {
      // Check if rule is disabled
      const ruleConfig = effectiveConfig.rules?.[rule.id];
      if (ruleConfig?.enabled === false) {
        logger.debug(`Rule ${rule.id} disabled by config, skipping`);
        continue;
      }

      try {
        let ruleFindings: SecurityFinding[];

        if (rule.checkWithContext) {
          // Build taint maps lazily (only if at least one rule needs them)
          if (!fileTaintMaps) {
            fileTaintMaps = buildFileTaintMaps(sourceFile, effectiveConfig.customSources);
          }

          // Create a taint checker function that looks up the node's enclosing function
          const taintChecker = (node: Node): TaintResult => {
            for (const [_body, taintMap] of fileTaintMaps!) {
              const result = isNodeTainted(node, taintMap, effectiveConfig.customSources);
              if (result.isTainted) return result;
            }
            return { isTainted: false, path: [] };
          };

          const context: RuleContext = {
            config: ruleConfig ?? { enabled: true },
            securityConfig: effectiveConfig,
            isNodeTainted: taintChecker,
          };

          ruleFindings = rule.checkWithContext(sourceFile, project, context);
        } else {
          ruleFindings = rule.check(sourceFile, project);
        }

        // Apply severity override from config
        if (ruleConfig?.severity) {
          ruleFindings = ruleFindings.map((f) => ({
            ...f,
            severity: ruleConfig.severity!,
          }));
        }

        findings.push(...ruleFindings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Rule ${rule.id} failed on ${filePath}: ${message}`);
      }
    }
  }

  // Filter by minSeverity
  let filteredFindings = findings;
  if (effectiveConfig.minSeverity) {
    const minLevel = SEVERITY_ORDER[effectiveConfig.minSeverity];
    filteredFindings = findings.filter(
      (f) => SEVERITY_ORDER[f.severity] >= minLevel,
    );
    if (filteredFindings.length < findings.length) {
      logger.info(
        `Filtered ${findings.length - filteredFindings.length} findings below ${effectiveConfig.minSeverity} severity`,
      );
    }
  }

  logger.info(`Security scan complete: ${filteredFindings.length} findings from ${allRules.length} rules`);

  return {
    findings: filteredFindings,
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
