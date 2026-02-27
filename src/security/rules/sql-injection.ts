/**
 * Intent: Detect SQL injection vulnerabilities from string concatenation in SQL queries.
 * Looks for template literals or string concatenation containing SQL keywords mixed with variables.
 */

import { type SourceFile, type Project, SyntaxKind } from 'ts-morph';
import type { SecurityFinding } from '../../types/security.js';
import type { SecurityRuleDefinition } from './index.js';
import { generateComponentId } from '../../utils/id-generator.js';

const SQL_KEYWORDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'WHERE'];

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

    // Check template literals for SQL keywords with expressions
    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.TemplateExpression) {
        const text = node.getText();
        const hasSql = SQL_KEYWORDS.some((kw) => text.toUpperCase().includes(kw));
        const hasExpression = text.includes('${');

        if (hasSql && hasExpression) {
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

      // Also check string concatenation with SQL keywords
      if (node.getKind() === SyntaxKind.BinaryExpression) {
        const text = node.getText();
        const hasSql = SQL_KEYWORDS.some((kw) => text.toUpperCase().includes(kw));
        const hasConcat = text.includes('+');

        if (hasSql && hasConcat && (text.includes('req.') || text.includes('params') || text.includes('input'))) {
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
