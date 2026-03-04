/**
 * Intent: Detect command injection vulnerabilities via child_process with user input.
 * Uses data-flow analysis to verify that command arguments actually originate from user input,
 * reducing false positives from exec calls with constant/config strings.
 *
 * Detection strategy:
 * 1. Find calls to exec/execSync/execFile/execFileSync
 * 2. Check if the command argument uses template literals or concatenation
 * 3. With data-flow: verify the argument (or its parts) are tainted
 * 4. Without data-flow: fall back to heuristic matching (req., input, params)
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const EXEC_FUNCTIONS = ['exec', 'execSync', 'execFile', 'execFileSync'];

export const commandInjectionRule: SecurityRuleDefinition = {
  id: 'idd-sec-006',
  name: 'Command Injection',
  description: 'User input passed to child_process execution functions',
  severity: 'critical',
  cweId: 'CWE-78',
  owaspCategory: 'A03:2021-Injection',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const exprText = node.getExpression().getText();
      const isExecCall = EXEC_FUNCTIONS.some(
        (fn) => exprText === fn || exprText.endsWith(`.${fn}`),
      );

      if (!isExecCall) return;

      const args = node.getArguments();
      if (args.length === 0) return;

      const firstArg = args[0];
      const argText = firstArg.getText();

      const hasTemplateExpr = firstArg.getKind() === SyntaxKind.TemplateExpression;
      const hasConcatenation =
        firstArg.getKind() === SyntaxKind.BinaryExpression && argText.includes('+');
      const hasUserInput = argText.includes('req.') || argText.includes('input') || argText.includes('params');

      if (hasTemplateExpr || hasConcatenation || hasUserInput) {
        const line = node.getStartLineNumber();
        findings.push({
          id: generateComponentId('finding', filePath, `cmd-injection-${line}`),
          ruleId: 'idd-sec-006',
          severity: 'critical',
          title: 'Potential command injection',
          description: `Dynamic input passed to ${exprText}() at line ${line}`,
          filePath,
          startLine: line,
          endLine: node.getEndLineNumber(),
          snippet: node.getText().substring(0, 200),
          recommendation: 'Use execFile/spawn with argument arrays instead of exec with string commands. Never pass unsanitized input to shell commands.',
          cweId: 'CWE-78',
          owaspCategory: 'A03:2021-Injection',
        });
      }
    });

    return findings;
  },

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();
    const customCommandSinks = context.securityConfig.customSinks?.['command'] ?? [];
    const allExecFunctions = [...EXEC_FUNCTIONS, ...customCommandSinks];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const exprText = node.getExpression().getText();
      const isExecCall = allExecFunctions.some(
        (fn) => exprText === fn || exprText.endsWith(`.${fn}`),
      );

      if (!isExecCall) return;

      const args = node.getArguments();
      if (args.length === 0) return;

      const firstArg = args[0];

      // Skip string literals (constant commands are safe)
      if (firstArg.getKind() === SyntaxKind.StringLiteral ||
          firstArg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
        return;
      }

      // Check if the argument is tainted
      const taintResult = context.isNodeTainted(firstArg);
      if (!taintResult.isTainted) return;

      const line = node.getStartLineNumber();
      findings.push({
        id: generateComponentId('finding', filePath, `cmd-injection-${line}`),
        ruleId: 'idd-sec-006',
        severity: 'critical',
        title: 'Command injection via tainted input',
        description: `User input from ${taintResult.source} flows to ${exprText}() at line ${line}`,
        filePath,
        startLine: line,
        endLine: node.getEndLineNumber(),
        snippet: node.getText().substring(0, 200),
        recommendation: 'Use execFile/spawn with argument arrays instead of exec with string commands. Never pass unsanitized input to shell commands.',
        cweId: 'CWE-78',
        owaspCategory: 'A03:2021-Injection',
      });
    });

    return findings;
  },
};
