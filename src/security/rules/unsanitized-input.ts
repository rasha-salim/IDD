/**
 * Intent: Detect unsanitized user input flowing into sensitive sinks.
 * Uses data-flow analysis to trace from user input sources to dangerous sinks
 * instead of same-line text matching, reducing false positives.
 *
 * Detection strategy:
 * 1. Find dangerous sink operations (innerHTML, .query(), .execute(), etc.)
 * 2. With data-flow: check if any argument/value is tainted by user input
 * 3. Without data-flow: fall back to same-line pattern matching
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const DANGEROUS_SINKS = [
  'innerHTML',
  'outerHTML',
  'document.write',
  'insertAdjacentHTML',
  '.query(',
  '.execute(',
  '.raw(',
];

const USER_INPUT_PATTERNS = [
  'req.body',
  'req.query',
  'req.params',
  'request.body',
  'request.query',
  'request.params',
];

const SINK_METHODS = ['query', 'execute', 'raw', 'insertAdjacentHTML'];

export const unsanitizedInputRule: SecurityRuleDefinition = {
  id: 'idd-sec-001',
  name: 'Unsanitized Input',
  description: 'User input from request objects flows directly into dangerous sinks without sanitization',
  severity: 'high',
  cweId: 'CWE-79',
  owaspCategory: 'A03:2021-Injection',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();
    const text = sourceFile.getFullText();

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasUserInput = USER_INPUT_PATTERNS.some((p) => line.includes(p));
      const hasSink = DANGEROUS_SINKS.some((s) => line.includes(s));

      if (hasUserInput && hasSink) {
        findings.push({
          id: generateComponentId('finding', filePath, `unsanitized-${i}`),
          ruleId: 'idd-sec-001',
          severity: 'high',
          title: 'Unsanitized user input in dangerous sink',
          description: `User input appears to flow directly into a dangerous operation on line ${i + 1}`,
          filePath,
          startLine: i + 1,
          endLine: i + 1,
          snippet: line.trim(),
          recommendation: 'Sanitize user input before using in HTML output or database queries. Use parameterized queries for databases and DOMPurify for HTML.',
          cweId: 'CWE-79',
          owaspCategory: 'A03:2021-Injection',
        });
      }
    }

    return findings;
  },

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      // Check call expressions like .query(), .execute(), .raw()
      if (Node.isCallExpression(node)) {
        const exprText = node.getExpression().getText();
        const isSinkCall = SINK_METHODS.some((m) => exprText.endsWith(`.${m}`));

        if (isSinkCall) {
          for (const arg of node.getArguments()) {
            const taintResult = context.isNodeTainted(arg);
            if (taintResult.isTainted) {
              const line = node.getStartLineNumber();
              findings.push({
                id: generateComponentId('finding', filePath, `unsanitized-${line}`),
                ruleId: 'idd-sec-001',
                severity: 'high',
                title: 'Unsanitized user input in dangerous sink',
                description: `User input from ${taintResult.source} flows into ${exprText}() at line ${line}`,
                filePath,
                startLine: line,
                endLine: node.getEndLineNumber(),
                snippet: node.getText().substring(0, 200),
                recommendation: 'Sanitize user input before using in HTML output or database queries. Use parameterized queries for databases and DOMPurify for HTML.',
                cweId: 'CWE-79',
                owaspCategory: 'A03:2021-Injection',
              });
              break;
            }
          }
        }
      }

      // Check innerHTML/outerHTML assignments
      if (Node.isPropertyAccessExpression(node)) {
        const propName = node.getName();
        if (propName === 'innerHTML' || propName === 'outerHTML') {
          const parent = node.getParent();
          if (parent && Node.isBinaryExpression(parent)) {
            const right = parent.getChildAtIndex(2);
            if (right) {
              const taintResult = context.isNodeTainted(right);
              if (taintResult.isTainted) {
                const line = parent.getStartLineNumber();
                findings.push({
                  id: generateComponentId('finding', filePath, `unsanitized-html-${line}`),
                  ruleId: 'idd-sec-001',
                  severity: 'high',
                  title: 'Unsanitized user input assigned to innerHTML',
                  description: `User input from ${taintResult.source} assigned to ${propName} at line ${line}`,
                  filePath,
                  startLine: line,
                  endLine: parent.getEndLineNumber(),
                  snippet: parent.getText().substring(0, 200),
                  recommendation: 'Sanitize HTML with DOMPurify before assigning to innerHTML. Use textContent for plain text.',
                  cweId: 'CWE-79',
                  owaspCategory: 'A03:2021-Injection',
                });
              }
            }
          }
        }
      }
    });

    return findings;
  },
};
