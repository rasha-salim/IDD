/**
 * Intent: Detect use of eval(), Function constructor, innerHTML, and other code execution sinks.
 * Uses data-flow analysis to distinguish eval(taintedVariable) from eval(constant).
 * eval with string literal argument is downgraded to info severity.
 *
 * Detection strategy:
 * 1. Find calls to eval(), Function(), setTimeout/setInterval with string arg
 * 2. Find innerHTML/outerHTML assignments
 * 3. With data-flow: check if the argument is tainted -> critical/high; constant -> info
 * 4. Without data-flow: flag all occurrences at standard severity
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding, Severity } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const DANGEROUS_FUNCTIONS = ['eval', 'Function', 'setTimeout', 'setInterval'];
const DANGEROUS_PROPERTIES = ['innerHTML', 'outerHTML'];
const DANGEROUS_METHODS = ['document.write', 'document.writeln'];

export const unsafeEvalRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-005',
  name: 'Unsafe Eval/Code Execution',
  description: 'Use of eval(), Function constructor, innerHTML, or other dynamic code execution',
  severity: 'high',
  cweId: 'CWE-95',
  owaspCategory: 'A03:2021-Injection',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const exprText = node.getExpression().getText();

        if (DANGEROUS_FUNCTIONS.includes(exprText)) {
          if (exprText === 'setTimeout' || exprText === 'setInterval') {
            const firstArg = node.getArguments()[0];
            if (!firstArg || firstArg.getKind() !== SyntaxKind.StringLiteral) {
              return;
            }
          }

          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `unsafe-eval-${line}`),
            ruleId: 'cmiw-sec-005',
            severity: exprText === 'eval' ? 'critical' : 'high',
            title: `Unsafe use of ${exprText}()`,
            description: `${exprText}() used at line ${line} can execute arbitrary code`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: `Avoid ${exprText}(). Use safer alternatives like JSON.parse() for data or explicit function references.`,
            cweId: 'CWE-95',
            owaspCategory: 'A03:2021-Injection',
          });
        }

        if (DANGEROUS_METHODS.some((m) => exprText.includes(m))) {
          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `unsafe-docwrite-${line}`),
            ruleId: 'cmiw-sec-005',
            severity: 'high',
            title: `Unsafe use of ${exprText}`,
            description: `${exprText} at line ${line} can inject arbitrary HTML`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: 'Use DOM manipulation methods (createElement, textContent) instead of document.write().',
            cweId: 'CWE-95',
            owaspCategory: 'A03:2021-Injection',
          });
        }
      }

      if (Node.isPropertyAccessExpression(node)) {
        const propName = node.getName();
        if (DANGEROUS_PROPERTIES.includes(propName)) {
          const parent = node.getParent();
          if (parent && Node.isBinaryExpression(parent)) {
            const line = parent.getStartLineNumber();
            findings.push({
              id: generateComponentId('finding', filePath, `unsafe-html-${line}`),
              ruleId: 'cmiw-sec-005',
              severity: 'high',
              title: `Unsafe assignment to ${propName}`,
              description: `Direct assignment to ${propName} at line ${line} can enable XSS`,
              filePath,
              startLine: line,
              endLine: parent.getEndLineNumber(),
              snippet: parent.getText().substring(0, 200),
              recommendation: 'Use textContent for text, or sanitize HTML with DOMPurify before assigning to innerHTML.',
              cweId: 'CWE-79',
              owaspCategory: 'A03:2021-Injection',
            });
          }
        }
      }
    });

    return findings;
  },

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const exprText = node.getExpression().getText();

        if (DANGEROUS_FUNCTIONS.includes(exprText)) {
          if (exprText === 'setTimeout' || exprText === 'setInterval') {
            const firstArg = node.getArguments()[0];
            if (!firstArg || firstArg.getKind() !== SyntaxKind.StringLiteral) {
              return;
            }
          }

          const firstArg = node.getArguments()[0];
          let severity: Severity = exprText === 'eval' ? 'critical' : 'high';

          // If the argument is a string literal, downgrade to info
          if (firstArg && firstArg.getKind() === SyntaxKind.StringLiteral) {
            severity = 'info';
          } else if (firstArg) {
            // Check if the argument is tainted -- keep high/critical severity
            const taintResult = context.isNodeTainted(firstArg);
            if (!taintResult.isTainted) {
              // Not tainted, not a literal -- could be config/internal variable
              // Downgrade but still flag
              severity = exprText === 'eval' ? 'high' : 'medium';
            }
          }

          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `unsafe-eval-${line}`),
            ruleId: 'cmiw-sec-005',
            severity,
            title: `Unsafe use of ${exprText}()`,
            description: `${exprText}() used at line ${line} can execute arbitrary code`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: `Avoid ${exprText}(). Use safer alternatives like JSON.parse() for data or explicit function references.`,
            cweId: 'CWE-95',
            owaspCategory: 'A03:2021-Injection',
          });
        }

        if (DANGEROUS_METHODS.some((m) => exprText.includes(m))) {
          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `unsafe-docwrite-${line}`),
            ruleId: 'cmiw-sec-005',
            severity: 'high',
            title: `Unsafe use of ${exprText}`,
            description: `${exprText} at line ${line} can inject arbitrary HTML`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: 'Use DOM manipulation methods (createElement, textContent) instead of document.write().',
            cweId: 'CWE-95',
            owaspCategory: 'A03:2021-Injection',
          });
        }
      }

      if (Node.isPropertyAccessExpression(node)) {
        const propName = node.getName();
        if (DANGEROUS_PROPERTIES.includes(propName)) {
          const parent = node.getParent();
          if (parent && Node.isBinaryExpression(parent)) {
            // Check if the assigned value is tainted
            const right = parent.getChildAtIndex(2);
            const taintResult = right ? context.isNodeTainted(right) : { isTainted: false, path: [] as string[] };
            const severity = taintResult.isTainted ? 'high' : 'medium';

            const line = parent.getStartLineNumber();
            findings.push({
              id: generateComponentId('finding', filePath, `unsafe-html-${line}`),
              ruleId: 'cmiw-sec-005',
              severity,
              title: `Unsafe assignment to ${propName}`,
              description: `Direct assignment to ${propName} at line ${line} can enable XSS`,
              filePath,
              startLine: line,
              endLine: parent.getEndLineNumber(),
              snippet: parent.getText().substring(0, 200),
              recommendation: 'Use textContent for text, or sanitize HTML with DOMPurify before assigning to innerHTML.',
              cweId: 'CWE-79',
              owaspCategory: 'A03:2021-Injection',
            });
          }
        }
      }
    });

    return findings;
  },
};
