/**
 * Intent: Detect path traversal vulnerabilities where user input is used in file system paths.
 * Uses data-flow analysis to verify user input reaches fs operations.
 * Also detects mitigation patterns (path.resolve, path.normalize) that reduce risk.
 *
 * Detection strategy:
 * 1. Find calls to fs functions (readFile, writeFile, etc.)
 * 2. Check if any arguments are tainted by user input
 * 3. Check if path validation (path.resolve, path.normalize) is applied before the call
 * 4. If validated, skip the finding (mitigation detected)
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';
import { hasPathValidation } from '../data-flow.js';

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
  id: 'idd-sec-007',
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
          ruleId: 'idd-sec-007',
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

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const exprText = node.getExpression().getText();
      const isFsCall = FS_FUNCTIONS.some(
        (fn) => exprText === fn || exprText.endsWith(`.${fn}`),
      );

      if (!isFsCall) return;

      const args = node.getArguments();
      if (args.length === 0) return;

      // Check if any argument is tainted
      let taintedArg = false;
      let taintSource: string | undefined;
      for (const arg of args) {
        const taintResult = context.isNodeTainted(arg);
        if (taintResult.isTainted) {
          taintedArg = true;
          taintSource = taintResult.source;
          break;
        }
      }

      if (!taintedArg) return;

      // Check if path validation is applied before this call
      if (hasPathValidation(node)) {
        return;
      }

      const line = node.getStartLineNumber();
      findings.push({
        id: generateComponentId('finding', filePath, `path-traversal-${line}`),
        ruleId: 'idd-sec-007',
        severity: 'high',
        title: 'Path traversal via tainted input',
        description: `User input from ${taintSource} used in ${exprText}() at line ${line} without path validation`,
        filePath,
        startLine: line,
        endLine: node.getEndLineNumber(),
        snippet: node.getText().substring(0, 200),
        recommendation: 'Validate and sanitize file paths. Use path.resolve() and verify the resolved path is within the expected directory. Reject paths containing "..".',
        cweId: 'CWE-22',
        owaspCategory: 'A01:2021-Broken Access Control',
      });
    });

    return findings;
  },
};
