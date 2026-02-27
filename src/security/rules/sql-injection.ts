/**
 * Intent: Detect SQL injection vulnerabilities from string concatenation in SQL queries.
 * Only flags template literals/concatenation that are actually used in database contexts,
 * not arbitrary strings that happen to contain SQL-like words.
 *
 * Reduces false positives by requiring:
 * 1. The string looks like actual SQL (starts with a SQL command, not just contains one)
 * 2. OR the string is passed to a known database function (.query, .execute, .raw, etc.)
 * 3. OR the string is assigned to a variable with a SQL-related name
 */

import { type SourceFile, type Project, SyntaxKind, Node } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

// SQL commands that indicate the string IS a SQL statement (must appear at start of template)
const SQL_STATEMENT_STARTERS = /^\s*`?\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP|CREATE|ALTER|TRUNCATE)\b/i;

// Database sink functions where interpolated strings are dangerous
const DB_SINK_METHODS = ['query', 'execute', 'raw', 'rawQuery', 'exec', 'prepare', 'run'];

// Variable names that suggest SQL context
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
      // Check template literals with expressions
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

      // Check string concatenation passed to DB functions
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
};

/**
 * Check if a node is an argument to a database function call like db.query(...), pool.execute(...).
 */
function isPassedToDbFunction(node: Node): boolean {
  const parent = node.getParent();
  if (!parent) return false;

  // Direct argument: db.query(`SELECT...${id}`)
  if (Node.isCallExpression(parent)) {
    const callee = parent.getExpression().getText();
    return DB_SINK_METHODS.some((m) => callee.endsWith(`.${m}`));
  }

  // Variable assigned then passed: const q = `SELECT...`; db.query(q)
  // We check the variable name as a heuristic
  if (Node.isVariableDeclaration(parent)) {
    const varName = parent.getName();
    return SQL_VAR_PATTERNS.test(varName);
  }

  return false;
}

/**
 * Check if a node is assigned to a variable with a SQL-related name.
 */
function isAssignedToSqlVariable(node: Node): boolean {
  const parent = node.getParent();
  if (!parent) return false;

  if (Node.isVariableDeclaration(parent)) {
    return SQL_VAR_PATTERNS.test(parent.getName());
  }

  // Also check property assignment: this.query = `...`
  if (Node.isBinaryExpression(parent)) {
    const left = parent.getLeft().getText();
    return SQL_VAR_PATTERNS.test(left);
  }

  return false;
}
