/**
 * Intent: Detect use of eval(), Function constructor, innerHTML, and other code execution sinks.
 * These are common XSS vectors and code injection points.
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
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
      // Check call expressions like eval(...), new Function(...)
      if (Node.isCallExpression(node)) {
        const exprText = node.getExpression().getText();

        if (DANGEROUS_FUNCTIONS.includes(exprText)) {
          // For setTimeout/setInterval, only flag when first arg is a string
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

        // Check document.write
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

      // Check property access like element.innerHTML = ...
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
};
