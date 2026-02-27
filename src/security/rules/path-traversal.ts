/**
 * Intent: Detect path traversal vulnerabilities where user input is used in file system paths.
 * Looks for req.body/query/params flowing into fs operations or path.join without validation.
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const FS_FUNCTIONS = [
  'readFile', 'readFileSync',
  'writeFile', 'writeFileSync',
  'readdir', 'readdirSync',
  'unlink', 'unlinkSync',
  'stat', 'statSync',
  'access', 'accessSync',
  'createReadStream', 'createWriteStream',
];

const USER_INPUT_INDICATORS = ['req.', 'request.', 'params', 'query', 'body', 'input'];

export const pathTraversalRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-007',
  name: 'Path Traversal',
  description: 'User input used in file system paths without validation',
  severity: 'high',
  cweId: 'CWE-22',
  owaspCategory: 'A01:2021-Broken Access Control',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const exprText = node.getExpression().getText();
      const isFsCall = FS_FUNCTIONS.some(
        (fn) => exprText === fn || exprText.endsWith(`.${fn}`),
      );

      if (!isFsCall) return;

      const fullText = node.getText();
      const hasUserInput = USER_INPUT_INDICATORS.some((indicator) =>
        fullText.includes(indicator),
      );

      if (hasUserInput) {
        const line = node.getStartLineNumber();
        findings.push({
          id: generateComponentId('finding', filePath, `path-traversal-${line}`),
          ruleId: 'cmiw-sec-007',
          severity: 'high',
          title: 'Potential path traversal',
          description: `User input used in file system operation at line ${line}`,
          filePath,
          startLine: line,
          endLine: node.getEndLineNumber(),
          snippet: node.getText().substring(0, 200),
          recommendation: 'Validate and sanitize file paths. Use path.resolve() and verify the resolved path is within the expected directory. Reject paths containing "..".',
          cweId: 'CWE-22',
          owaspCategory: 'A01:2021-Broken Access Control',
        });
      }
    });

    return findings;
  },
};
