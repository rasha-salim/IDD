/**
 * Intent: Detect Express/Fastify route handlers that lack authentication middleware.
 * Only flags actual HTTP route registrations, not arbitrary .get()/.post() method calls.
 *
 * Configurable via SecurityConfig:
 * - customRouterNames: additional object names to match as routers (e.g., "api", "v1")
 * - trustedMiddleware: additional middleware names that count as auth (e.g., "rateLimiter")
 *
 * Reduces false positives by requiring:
 * 1. The receiver object looks like a router (app, router, server, or configured names)
 * 2. The first argument is a string literal starting with '/' (a URL path)
 * 3. There are at least 2 arguments (path + handler)
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const DEFAULT_ROUTER_NAMES = ['app', 'router', 'server', 'route', 'api', 'express', 'fastify'];

const DEFAULT_AUTH_INDICATORS = [
  'auth', 'authenticate', 'authorize', 'isAuthenticated',
  'requireAuth', 'protect', 'guard', 'jwt', 'token', 'session',
  'passport', 'middleware', 'verify', 'checkAuth',
];

function buildRouterRegex(customNames: string[]): RegExp {
  const allNames = [...DEFAULT_ROUTER_NAMES, ...customNames];
  return new RegExp(`^(${allNames.join('|')})$`, 'i');
}

function buildAuthIndicators(trustedMiddleware: string[]): string[] {
  return [...DEFAULT_AUTH_INDICATORS, ...trustedMiddleware];
}

export const missingAuthRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-003',
  name: 'Missing Authentication',
  description: 'HTTP endpoint handlers without authentication middleware',
  severity: 'high',
  cweId: 'CWE-306',
  owaspCategory: 'A07:2021-Identification and Authentication Failures',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    return checkRoutes(sourceFile, /^(app|router|server|route|api|express|fastify)$/i, DEFAULT_AUTH_INDICATORS);
  },

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const customRouterNames = context.securityConfig.customRouterNames ?? [];
    const trustedMiddleware = context.securityConfig.trustedMiddleware ?? [];
    const routerRegex = buildRouterRegex(customRouterNames);
    const authIndicators = buildAuthIndicators(trustedMiddleware);
    return checkRoutes(sourceFile, routerRegex, authIndicators);
  },
};

function checkRoutes(
  sourceFile: SourceFile,
  routerNames: RegExp,
  authIndicators: string[],
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const filePath = sourceFile.getFilePath();

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return;

    const methodName = expression.getName().toLowerCase();
    if (!HTTP_METHODS.includes(methodName)) return;

    const receiver = expression.getExpression().getText();
    const receiverName = receiver.split('.').pop() ?? receiver;
    if (!routerNames.test(receiverName)) return;

    const args = node.getArguments();
    if (args.length < 2) return;

    const firstArg = args[0];
    if (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) return;

    const pathValue = firstArg.getText().replace(/['"` ]/g, '');
    if (!pathValue.startsWith('/')) return;

    const fullCallText = node.getText().toLowerCase();
    const hasAuthMiddleware = authIndicators.some((indicator) =>
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
}
