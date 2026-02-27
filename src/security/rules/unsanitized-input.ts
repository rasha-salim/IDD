/**
 * Intent: Detect unsanitized user input flowing into sensitive sinks.
 * Looks for req.body/req.query/req.params used directly in DB calls or HTML output.
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
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

export const unsanitizedInputRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-001',
  name: 'Unsanitized Input',
  description: 'User input from request objects flows directly into dangerous sinks without sanitization',
  severity: 'high',
  cweId: 'CWE-79',
  owaspCategory: 'A03:2021-Injection',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();
    const text = sourceFile.getFullText();

    // Check for user input patterns near dangerous sinks
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasUserInput = USER_INPUT_PATTERNS.some((p) => line.includes(p));
      const hasSink = DANGEROUS_SINKS.some((s) => line.includes(s));

      if (hasUserInput && hasSink) {
        findings.push({
          id: generateComponentId('finding', filePath, `unsanitized-${i}`),
          ruleId: 'cmiw-sec-001',
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
};
