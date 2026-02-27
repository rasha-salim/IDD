/**
 * Intent: Detect command injection vulnerabilities via child_process with user input.
 * Looks for exec/execSync/spawn with template literals or string concatenation.
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const EXEC_FUNCTIONS = ['exec', 'execSync', 'execFile', 'execFileSync'];

export const commandInjectionRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-006',
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

      // Flag if the command argument uses template literals or concatenation with variables
      const hasTemplateExpr = firstArg.getKind() === SyntaxKind.TemplateExpression;
      const hasConcatenation =
        firstArg.getKind() === SyntaxKind.BinaryExpression && argText.includes('+');
      const hasUserInput = argText.includes('req.') || argText.includes('input') || argText.includes('params');

      if (hasTemplateExpr || hasConcatenation || hasUserInput) {
        const line = node.getStartLineNumber();
        findings.push({
          id: generateComponentId('finding', filePath, `cmd-injection-${line}`),
          ruleId: 'cmiw-sec-006',
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
};
