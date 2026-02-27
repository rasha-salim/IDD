/**
 * Intent: Detect Express/Fastify route handlers that lack authentication middleware.
 * Looks for route definitions (app.get, router.post, etc.) without auth-related middleware.
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const AUTH_INDICATORS = ['auth', 'authenticate', 'authorize', 'isAuthenticated', 'requireAuth', 'protect', 'guard', 'jwt', 'token', 'session'];

export const missingAuthRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-003',
  name: 'Missing Authentication',
  description: 'HTTP endpoint handlers without authentication middleware',
  severity: 'high',
  cweId: 'CWE-306',
  owaspCategory: 'A07:2021-Identification and Authentication Failures',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const expression = node.getExpression();
      const exprText = expression.getText();

      // Match patterns like app.get, router.post, etc.
      const isRouteCall = HTTP_METHODS.some(
        (method) => exprText.endsWith(`.${method}`) || exprText.endsWith(`.${method.toUpperCase()}`),
      );

      if (!isRouteCall) return;

      const args = node.getArguments();
      if (args.length < 2) return;

      // First arg should be a route string
      const firstArg = args[0].getText();
      if (!firstArg.includes('/') && !firstArg.includes("'") && !firstArg.includes('"')) return;

      // Check if any middleware arguments reference auth
      const fullCallText = node.getText().toLowerCase();
      const hasAuthMiddleware = AUTH_INDICATORS.some((indicator) =>
        fullCallText.includes(indicator.toLowerCase()),
      );

      if (!hasAuthMiddleware) {
        const line = node.getStartLineNumber();
        findings.push({
          id: generateComponentId('finding', filePath, `missing-auth-${line}`),
          ruleId: 'cmiw-sec-003',
          severity: 'high',
          title: 'Route handler without authentication',
          description: `HTTP endpoint at line ${line} does not appear to have authentication middleware`,
          filePath,
          startLine: line,
          endLine: node.getEndLineNumber(),
          snippet: node.getText().substring(0, 200),
          recommendation: 'Add authentication middleware to protect this endpoint, or document why it should be public.',
          cweId: 'CWE-306',
          owaspCategory: 'A07:2021-Identification and Authentication Failures',
        });
      }
    });

    return findings;
  },
};
