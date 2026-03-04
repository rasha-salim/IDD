/**
 * Intent: Detect hardcoded secrets like API keys, passwords, and tokens in source code.
 * Looks for string literals assigned to variables with secret-like names, or matching secret patterns.
 *
 * Configurable via SecurityConfig:
 * - falsePositivePatterns: additional strings to ignore (e.g., project-specific test values)
 */

import { type SourceFile, type Project, SyntaxKind } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const SECRET_VAR_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /private[_-]?key/i,
  /credentials?/i,
];

const SECRET_VALUE_PATTERNS = [
  /^sk[-_][a-zA-Z0-9]{20,}$/,
  /^[a-zA-Z0-9]{32,}$/,
  /^ghp_[a-zA-Z0-9]{36}$/,
  /^Bearer\s+[a-zA-Z0-9._-]+$/,
];

const DEFAULT_FALSE_POSITIVE_VALUES = [
  'process.env',
  'env.',
  'your-',
  'xxx',
  'placeholder',
  'example',
  'TODO',
  'CHANGE_ME',
  'your_',
  '<',
  'test',
];

function checkSecrets(
  sourceFile: SourceFile,
  falsePositiveValues: string[],
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const filePath = sourceFile.getFilePath();

  sourceFile.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.VariableDeclaration) return;

    const text = node.getText();
    const varName = text.split(/[=:]/)[0].trim();

    const isSecretName = SECRET_VAR_PATTERNS.some((p) => p.test(varName));
    if (!isSecretName) return;

    const stringLiterals = node.getDescendantsOfKind(SyntaxKind.StringLiteral);
    for (const literal of stringLiterals) {
      const value = literal.getLiteralValue();
      if (value.length < 8) continue;

      const isFalsePositive = falsePositiveValues.some((fp) =>
        value.toLowerCase().includes(fp.toLowerCase()),
      );
      if (isFalsePositive) continue;

      const line = node.getStartLineNumber();
      findings.push({
        id: generateComponentId('finding', filePath, `hardcoded-secret-${line}`),
        ruleId: 'idd-sec-004',
        severity: 'critical',
        title: 'Hardcoded secret detected',
        description: `Variable "${varName}" appears to contain a hardcoded secret at line ${line}`,
        filePath,
        startLine: line,
        endLine: node.getEndLineNumber(),
        snippet: `${varName} = "${value.substring(0, 4)}${'*'.repeat(Math.min(value.length - 4, 20))}"`,
        recommendation: 'Move secrets to environment variables or a secrets manager. Never commit secrets to source control.',
        cweId: 'CWE-798',
        owaspCategory: 'A07:2021-Identification and Authentication Failures',
      });
    }
  });

  return findings;
}

export const hardcodedSecretsRule: SecurityRuleDefinition = {
  id: 'idd-sec-004',
  name: 'Hardcoded Secrets',
  description: 'API keys, passwords, or tokens hardcoded in source code',
  severity: 'critical',
  cweId: 'CWE-798',
  owaspCategory: 'A07:2021-Identification and Authentication Failures',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    return checkSecrets(sourceFile, DEFAULT_FALSE_POSITIVE_VALUES);
  },

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const customPatterns = context.securityConfig.falsePositivePatterns ?? [];
    const allFalsePositives = [...DEFAULT_FALSE_POSITIVE_VALUES, ...customPatterns];
    return checkSecrets(sourceFile, allFalsePositives);
  },
};
