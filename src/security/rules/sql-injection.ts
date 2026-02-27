/**
 * Intent: Detect SQL injection vulnerabilities from string concatenation in SQL queries.
 * Uses data-flow analysis to verify that interpolated values actually originate from user input,
 * reducing false positives from template literals used for UI strings, logs, or config.
 *
 * Detection strategy:
 * 1. Find template literals/concatenation that look like SQL (starts with SQL command or is in DB sink)
 * 2. With data-flow: verify interpolated expressions are tainted by user input
 * 3. Without data-flow (fallback): use original heuristic matching
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { RuleContext } from '../../types/config.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const SQL_STATEMENT_STARTERS = /^\s*`?\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP|CREATE|ALTER|TRUNCATE)\b/i;

const DB_SINK_METHODS = ['query', 'execute', 'raw', 'rawQuery', 'exec', 'prepare', 'run'];

const SQL_VAR_PATTERNS = /\b(sql|query|stmt|statement|command)\b/i;

export const sqlInjectionRule: SecurityRuleDefinition = {
  id: 'cmiw-sec-002',
  name: 'SQL Injection',
  description: 'String concatenation or template literals used to build SQL queries with dynamic values',
  severity: 'critical',
  cweId: 'CWE-89',
  owaspCategory: 'A03:2021-Injection',

  check(sourceFile: SourceFile, _project: Project): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.TemplateExpression) {
        const text = node.getText();
        if (!text.includes('${')) return;

        const isSqlStatement = SQL_STATEMENT_STARTERS.test(text);
        const isInDbSink = isPassedToDbFunction(node);
        const isAssignedToSqlVar = isAssignedToSqlVariable(node);

        if (isSqlStatement || isInDbSink || isAssignedToSqlVar) {
          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `sql-injection-${line}`),
            ruleId: 'cmiw-sec-002',
            severity: 'critical',
            title: 'Potential SQL injection via template literal',
            description: `SQL query built with template literal containing dynamic expressions at line ${line}`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: 'Use parameterized queries or a query builder instead of string interpolation for SQL statements.',
            cweId: 'CWE-89',
            owaspCategory: 'A03:2021-Injection',
          });
        }
      }

      if (node.getKind() === SyntaxKind.BinaryExpression) {
        const text = node.getText();
        if (!text.includes('+')) return;

        const isSqlStatement = SQL_STATEMENT_STARTERS.test(text);
        const isInDbSink = isPassedToDbFunction(node);

        if ((isSqlStatement || isInDbSink) && (text.includes('req.') || text.includes('params') || text.includes('input'))) {
          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `sql-concat-${line}`),
            ruleId: 'cmiw-sec-002',
            severity: 'critical',
            title: 'Potential SQL injection via string concatenation',
            description: `SQL query built with string concatenation at line ${line}`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: 'Use parameterized queries instead of string concatenation for SQL statements.',
            cweId: 'CWE-89',
            owaspCategory: 'A03:2021-Injection',
          });
        }
      }
    });

    return findings;
  },

  checkWithContext(sourceFile: SourceFile, _project: Project, context: RuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const filePath = sourceFile.getFilePath();
    const customSqlSinks = context.securityConfig.customSinks?.['sql'] ?? [];
    const allSinkMethods = [...DB_SINK_METHODS, ...customSqlSinks];

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.TemplateExpression) {
        const text = node.getText();
        if (!text.includes('${')) return;

        const isSqlStatement = SQL_STATEMENT_STARTERS.test(text);
        const isInDbSink = isPassedToDbFunctionExtended(node, allSinkMethods);
        const isAssignedToSqlVar = isAssignedToSqlVariable(node);

        if (isSqlStatement || isInDbSink || isAssignedToSqlVar) {
          // Data-flow check: verify that interpolated expressions are tainted
          const templateSpans = node.getDescendantsOfKind(SyntaxKind.TemplateSpan);
          let hasTaintedExpr = false;
          for (const span of templateSpans) {
            const expr = span.getFirstChild();
            if (expr) {
              const taintResult = context.isNodeTainted(expr);
              if (taintResult.isTainted) {
                hasTaintedExpr = true;
                break;
              }
            }
          }

          if (!hasTaintedExpr) return;

          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `sql-injection-${line}`),
            ruleId: 'cmiw-sec-002',
            severity: 'critical',
            title: 'SQL injection via tainted template literal',
            description: `SQL query at line ${line} interpolates user input`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: 'Use parameterized queries or a query builder instead of string interpolation for SQL statements.',
            cweId: 'CWE-89',
            owaspCategory: 'A03:2021-Injection',
          });
        }
      }

      if (node.getKind() === SyntaxKind.BinaryExpression) {
        const text = node.getText();
        if (!text.includes('+')) return;

        const isSqlStatement = SQL_STATEMENT_STARTERS.test(text);
        const isInDbSink = isPassedToDbFunctionExtended(node, allSinkMethods);

        if (isSqlStatement || isInDbSink) {
          const taintResult = context.isNodeTainted(node);
          if (!taintResult.isTainted) return;

          const line = node.getStartLineNumber();
          findings.push({
            id: generateComponentId('finding', filePath, `sql-concat-${line}`),
            ruleId: 'cmiw-sec-002',
            severity: 'critical',
            title: 'SQL injection via tainted string concatenation',
            description: `SQL query at line ${line} concatenates user input`,
            filePath,
            startLine: line,
            endLine: node.getEndLineNumber(),
            snippet: node.getText().substring(0, 200),
            recommendation: 'Use parameterized queries instead of string concatenation for SQL statements.',
            cweId: 'CWE-89',
            owaspCategory: 'A03:2021-Injection',
          });
        }
      }
    });

    return findings;
  },
};

function isPassedToDbFunction(node: Node): boolean {
  const parent = node.getParent();
  if (!parent) return false;

  if (Node.isCallExpression(parent)) {
    const callee = parent.getExpression().getText();
    return DB_SINK_METHODS.some((m) => callee.endsWith(`.${m}`));
  }

  if (Node.isVariableDeclaration(parent)) {
    const varName = parent.getName();
    return SQL_VAR_PATTERNS.test(varName);
  }

  return false;
}

function isPassedToDbFunctionExtended(node: Node, sinkMethods: string[]): boolean {
  const parent = node.getParent();
  if (!parent) return false;

  if (Node.isCallExpression(parent)) {
    const callee = parent.getExpression().getText();
    return sinkMethods.some((m) => callee.endsWith(`.${m}`) || callee === m);
  }

  if (Node.isVariableDeclaration(parent)) {
    const varName = parent.getName();
    return SQL_VAR_PATTERNS.test(varName);
  }

  return false;
}

function isAssignedToSqlVariable(node: Node): boolean {
  const parent = node.getParent();
  if (!parent) return false;

  if (Node.isVariableDeclaration(parent)) {
    return SQL_VAR_PATTERNS.test(parent.getName());
  }

  if (Node.isBinaryExpression(parent)) {
    const left = parent.getLeft().getText();
    return SQL_VAR_PATTERNS.test(left);
  }

  return false;
}
