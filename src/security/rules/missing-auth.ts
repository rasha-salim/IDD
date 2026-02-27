/**
 * Intent: Detect Express/Fastify route handlers that lack authentication middleware.
 * Only flags actual HTTP route registrations, not arbitrary .get()/.post() method calls.
 *
 * Reduces false positives by requiring:
 * 1. The receiver object looks like a router (app, router, server, or typed as Express/Fastify)
 * 2. The first argument is a string literal starting with '/' (a URL path)
 * 3. There are at least 2 arguments (path + handler)
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Object names that indicate an HTTP router/server
const ROUTER_NAMES = /^(app|router|server|route|api|express|fastify)$/i;

const AUTH_INDICATORS = [
  'auth', 'authenticate', 'authorize', 'isAuthenticated',
  'requireAuth', 'protect', 'guard', 'jwt', 'token', 'session',
  'passport', 'middleware', 'verify', 'checkAuth',
];

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
      if (!Node.isPropertyAccessExpression(expression)) return;

      const methodName = expression.getName().toLowerCase();
      if (!HTTP_METHODS.includes(methodName)) return;

      // Get the receiver object name (the part before .get/.post/etc)
      const receiver = expression.getExpression().getText();

      // Must be a known router-like object name
      // Extract just the last identifier for chained calls like express().get
      const receiverName = receiver.split('.').pop() ?? receiver;
      if (!ROUTER_NAMES.test(receiverName)) return;

      const args = node.getArguments();
      if (args.length < 2) return;

      // First argument must be a string literal that looks like a URL path
      const firstArg = args[0];
      if (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) return;

      const pathValue = firstArg.getText().replace(/['"` ]/g, '');
      if (!pathValue.startsWith('/')) return;

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
