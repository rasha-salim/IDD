/**
 * Intent: Python-specific security rules that detect common vulnerabilities.
 *
 * Rules:
 * - idd-py-001: SQL Injection (f-strings/format in DB calls)
 * - idd-py-002: Command Injection (user input in os.system/subprocess)
 * - idd-py-003: Path Traversal (user input in open/os.path without validation)
 * - idd-py-004: Hardcoded Secrets (passwords/tokens as string literals)
 * - idd-py-005: Unsafe Deserialization (pickle.loads, yaml.load without SafeLoader)
 * - idd-py-006: Missing Auth (Flask/Django routes without @login_required)
 *
 * Guarantees: Each rule produces SecurityFinding[] with file path, line, snippet, CWE.
 * Rules use taint analysis when available to reduce false positives.
 */

import type Parser from 'web-tree-sitter';
import type { SecurityFinding, SecurityRule, Severity } from '../../types/security.js';
import type { SecurityConfig } from '../../types/config.js';
import { generateComponentId } from '../../utils/id-generator.js';
import { logger } from '../../utils/logger.js';
import type { ParsedPythonFile } from './component-extractor.js';
import { walkDescendants } from './component-extractor.js';
import { buildPythonFileTaintMaps, isPythonExprTainted, type PythonTaintMap } from './taint-analysis.js';

interface PythonRuleContext {
  file: ParsedPythonFile;
  taintMaps: Map<Parser.SyntaxNode, PythonTaintMap>;
  config: SecurityConfig;
}

interface PythonSecurityRule extends SecurityRule {
  check(ctx: PythonRuleContext): SecurityFinding[];
}

const SQL_SINKS = new Set([
  'execute', 'executemany', 'raw', 'rawQuery', 'executescript',
]);

const SQL_STARTERS = /^\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b/i;

const CMD_SINKS = new Set([
  'os.system', 'os.popen', 'subprocess.call', 'subprocess.run',
  'subprocess.Popen', 'subprocess.check_output', 'subprocess.check_call',
  'eval', 'exec', 'compile',
]);

const PATH_SINKS = new Set(['open', 'os.path.join', 'pathlib.Path']);

const SECRET_PATTERNS = /\b(password|passwd|secret|api_key|apikey|token|auth_token|private_key|access_key|secret_key)\b/i;

const DESERIALIZE_SINKS = new Set([
  'pickle.loads', 'pickle.load', 'yaml.load',
  'marshal.loads', 'marshal.load', 'shelve.open',
]);

// ---------- Rule implementations ----------

const sqlInjectionRule: PythonSecurityRule = {
  id: 'idd-py-001',
  name: 'SQL Injection',
  description: 'User input interpolated into SQL queries via f-strings, .format(), or % formatting',
  severity: 'high',
  cweId: 'CWE-89',
  owaspCategory: 'A03:2021-Injection',

  check(ctx: PythonRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const { file, taintMaps } = ctx;

    walkDescendants(file.tree.rootNode, (node) => {
      if (node.type !== 'call') return;

      const funcRef = node.childForFieldName('function');
      if (!funcRef) return;

      // Check if it's a SQL sink (cursor.execute, db.execute, etc.)
      let isSqlSink = false;
      if (funcRef.type === 'attribute') {
        const method = funcRef.childForFieldName('attribute');
        if (method && SQL_SINKS.has(method.text)) {
          isSqlSink = true;
        }
      }
      if (!isSqlSink) return;

      // Check arguments for tainted SQL
      const args = node.childForFieldName('arguments');
      if (!args) return;

      const firstArg = args.namedChildren[0];
      if (!firstArg) return;

      // If second argument is a tuple/list (parameterized query), skip
      const secondArg = args.namedChildren[1];
      if (secondArg && (secondArg.type === 'tuple' || secondArg.type === 'list')) {
        return;
      }

      const argText = firstArg.text;

      // Check if the SQL contains interpolation (f-string, .format, %)
      const hasInterpolation = argText.includes('{') || argText.includes('%s') || argText.includes('%d');
      const looksLikeSql = SQL_STARTERS.test(argText);

      if (!hasInterpolation && !looksLikeSql) return;

      // Taint check
      const taintMap = findTaintMapForNode(node, taintMaps);
      if (taintMap) {
        const taint = isPythonExprTainted(argText, taintMap.variables, ctx.config.customSources);
        if (!taint.isTainted) return;
      }

      const line = node.startPosition.row + 1;
      findings.push({
        id: generateComponentId('finding', file.filePath, `py-sql-injection-${line}`),
        ruleId: 'idd-py-001',
        severity: 'high',
        title: 'SQL injection via string interpolation',
        description: `SQL query at line ${line} uses string interpolation with potentially tainted input`,
        filePath: file.filePath,
        startLine: line,
        endLine: node.endPosition.row + 1,
        snippet: node.text.substring(0, 200),
        recommendation: 'Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))',
        cweId: 'CWE-89',
        owaspCategory: 'A03:2021-Injection',
      });
    });

    return findings;
  },
};

const commandInjectionRule: PythonSecurityRule = {
  id: 'idd-py-002',
  name: 'Command Injection',
  description: 'User input flows to os.system(), subprocess, eval(), or exec()',
  severity: 'critical',
  cweId: 'CWE-78',
  owaspCategory: 'A03:2021-Injection',

  check(ctx: PythonRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const { file, taintMaps } = ctx;

    walkDescendants(file.tree.rootNode, (node) => {
      if (node.type !== 'call') return;

      const funcRef = node.childForFieldName('function');
      if (!funcRef) return;

      const funcText = funcRef.text;
      if (!CMD_SINKS.has(funcText)) return;

      // For subprocess with shell=True check
      if (funcText.startsWith('subprocess.')) {
        const args = node.childForFieldName('arguments');
        if (args) {
          let hasShellTrue = false;
          for (const arg of args.namedChildren) {
            if (arg.type === 'keyword_argument') {
              const nameNode = arg.childForFieldName('name');
              const valueNode = arg.childForFieldName('value');
              if (nameNode?.text === 'shell' && valueNode?.text === 'True') {
                hasShellTrue = true;
              }
            }
          }
          // subprocess without shell=True is generally safe for command injection
          if (!hasShellTrue && funcText !== 'subprocess.call') {
            return;
          }
        }
      }

      // Check if arguments are tainted
      const args = node.childForFieldName('arguments');
      if (!args) return;

      const firstArg = args.namedChildren[0];
      if (!firstArg) return;

      // String literals without interpolation are not dangerous
      if (firstArg.type === 'string' && !firstArg.text.startsWith('f')) {
        return;
      }

      const taintMap = findTaintMapForNode(node, taintMaps);
      if (taintMap) {
        const taint = isPythonExprTainted(firstArg.text, taintMap.variables, ctx.config.customSources);
        if (!taint.isTainted) return;
      }

      const line = node.startPosition.row + 1;
      findings.push({
        id: generateComponentId('finding', file.filePath, `py-cmd-injection-${line}`),
        ruleId: 'idd-py-002',
        severity: 'critical',
        title: `Command injection via ${funcText}()`,
        description: `User input may flow to ${funcText}() at line ${line}`,
        filePath: file.filePath,
        startLine: line,
        endLine: node.endPosition.row + 1,
        snippet: node.text.substring(0, 200),
        recommendation: 'Use subprocess.run() with a list of arguments instead of shell=True. Avoid os.system(), eval(), and exec() with user input.',
        cweId: 'CWE-78',
        owaspCategory: 'A03:2021-Injection',
      });
    });

    return findings;
  },
};

const pathTraversalRule: PythonSecurityRule = {
  id: 'idd-py-003',
  name: 'Path Traversal',
  description: 'User input used in file path operations without validation',
  severity: 'high',
  cweId: 'CWE-22',
  owaspCategory: 'A01:2021-Broken Access Control',

  check(ctx: PythonRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const { file, taintMaps } = ctx;

    walkDescendants(file.tree.rootNode, (node) => {
      if (node.type !== 'call') return;

      const funcRef = node.childForFieldName('function');
      if (!funcRef) return;

      const funcText = funcRef.text;
      if (!PATH_SINKS.has(funcText)) return;

      const args = node.childForFieldName('arguments');
      if (!args) return;

      const firstArg = args.namedChildren[0];
      if (!firstArg) return;

      // String literals are not dangerous
      if (firstArg.type === 'string' && !firstArg.text.startsWith('f')) {
        return;
      }

      const taintMap = findTaintMapForNode(node, taintMaps);
      if (taintMap) {
        // If path validation exists in the function, skip
        if (taintMap.hasPathValidation) return;

        const taint = isPythonExprTainted(firstArg.text, taintMap.variables, ctx.config.customSources);
        if (!taint.isTainted) return;
      }

      const line = node.startPosition.row + 1;
      findings.push({
        id: generateComponentId('finding', file.filePath, `py-path-traversal-${line}`),
        ruleId: 'idd-py-003',
        severity: 'high',
        title: `Path traversal via ${funcText}()`,
        description: `User input used in ${funcText}() at line ${line} without path validation`,
        filePath: file.filePath,
        startLine: line,
        endLine: node.endPosition.row + 1,
        snippet: node.text.substring(0, 200),
        recommendation: 'Validate paths with os.path.abspath() or os.path.realpath() and check they remain within the allowed directory.',
        cweId: 'CWE-22',
        owaspCategory: 'A01:2021-Broken Access Control',
      });
    });

    return findings;
  },
};

const hardcodedSecretsRule: PythonSecurityRule = {
  id: 'idd-py-004',
  name: 'Hardcoded Secrets',
  description: 'Passwords, API keys, or tokens stored as string literals in source code',
  severity: 'medium',
  cweId: 'CWE-798',
  owaspCategory: 'A07:2021-Identification and Authentication Failures',

  check(ctx: PythonRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const { file } = ctx;
    const falsePositivePatterns = ctx.config.falsePositivePatterns ?? [];

    walkDescendants(file.tree.rootNode, (node) => {
      if (node.type !== 'assignment') return;

      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      if (!left || !right) return;

      const varName = left.text;
      if (!SECRET_PATTERNS.test(varName)) return;

      // Must be a string literal (not env lookup)
      if (right.type !== 'string') return;

      const value = right.text;

      // Skip empty strings, single chars, and placeholder values
      if (value.length <= 4) return;
      if (value.includes('os.environ') || value.includes('os.getenv')) return;
      if (/^['"](<.*?>|\*+|x+|\.\.\.|\$\{.*?\})['"]$/.test(value)) return;

      // Check false positive patterns
      if (falsePositivePatterns.some((p) => new RegExp(p).test(varName))) return;

      const line = node.startPosition.row + 1;
      findings.push({
        id: generateComponentId('finding', file.filePath, `py-hardcoded-secret-${line}`),
        ruleId: 'idd-py-004',
        severity: 'medium',
        title: 'Hardcoded secret detected',
        description: `Variable "${varName}" at line ${line} contains a hardcoded secret`,
        filePath: file.filePath,
        startLine: line,
        endLine: node.endPosition.row + 1,
        snippet: `${varName} = ${value.substring(0, 20)}...`,
        recommendation: 'Use environment variables: os.environ.get("SECRET_KEY") or a secrets manager.',
        cweId: 'CWE-798',
        owaspCategory: 'A07:2021-Identification and Authentication Failures',
      });
    });

    return findings;
  },
};

const unsafeDeserializationRule: PythonSecurityRule = {
  id: 'idd-py-005',
  name: 'Unsafe Deserialization',
  description: 'Use of pickle, marshal, or yaml.load() without SafeLoader on potentially untrusted data',
  severity: 'critical',
  cweId: 'CWE-502',
  owaspCategory: 'A08:2021-Software and Data Integrity Failures',

  check(ctx: PythonRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const { file } = ctx;

    walkDescendants(file.tree.rootNode, (node) => {
      if (node.type !== 'call') return;

      const funcRef = node.childForFieldName('function');
      if (!funcRef) return;

      const funcText = funcRef.text;
      if (!DESERIALIZE_SINKS.has(funcText)) return;

      // For yaml.load, check for Loader=SafeLoader
      if (funcText === 'yaml.load') {
        const args = node.childForFieldName('arguments');
        if (args) {
          for (const arg of args.namedChildren) {
            if (arg.type === 'keyword_argument') {
              const nameNode = arg.childForFieldName('name');
              const valueNode = arg.childForFieldName('value');
              if (nameNode?.text === 'Loader' && valueNode?.text?.includes('SafeLoader')) {
                return; // Safe usage
              }
            }
          }
        }
      }

      const line = node.startPosition.row + 1;
      findings.push({
        id: generateComponentId('finding', file.filePath, `py-unsafe-deser-${line}`),
        ruleId: 'idd-py-005',
        severity: 'critical',
        title: `Unsafe deserialization via ${funcText}()`,
        description: `${funcText}() at line ${line} can execute arbitrary code if input is untrusted`,
        filePath: file.filePath,
        startLine: line,
        endLine: node.endPosition.row + 1,
        snippet: node.text.substring(0, 200),
        recommendation: funcText === 'yaml.load'
          ? 'Use yaml.safe_load() or yaml.load(data, Loader=yaml.SafeLoader)'
          : 'Avoid pickle/marshal for untrusted data. Use JSON or a safe serialization format.',
        cweId: 'CWE-502',
        owaspCategory: 'A08:2021-Software and Data Integrity Failures',
      });
    });

    return findings;
  },
};

const missingAuthRule: PythonSecurityRule = {
  id: 'idd-py-006',
  name: 'Missing Authentication',
  description: 'Flask/Django route handlers without authentication decorators',
  severity: 'medium',
  cweId: 'CWE-862',
  owaspCategory: 'A01:2021-Broken Access Control',

  check(ctx: PythonRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const { file, config } = ctx;
    const trustedMiddleware = config.trustedMiddleware ?? [];

    const authDecorators = new Set([
      'login_required',
      'permission_required',
      'user_passes_test',
      'auth_required',
      'jwt_required',
      'requires_auth',
      'authenticated',
      ...trustedMiddleware,
    ]);

    // Patterns that indicate public routes (no auth needed)
    const publicPatterns = ['/health', '/ping', '/status', '/login', '/register', '/signup', '/public', '/static', '/favicon'];

    const rootNode = file.tree.rootNode;
    for (const node of rootNode.children) {
      if (node.type !== 'decorated_definition') continue;

      const definition = node.childForFieldName('definition');
      if (!definition || definition.type !== 'function_definition') continue;

      // Check if it has a route decorator
      let hasRouteDecorator = false;
      let routePath = '';
      let hasAuthDecorator = false;

      for (const child of node.children) {
        if (child.type !== 'decorator') continue;

        const decoratorText = child.text.replace(/^@/, '').trim();

        // Check for route decorators
        if (decoratorText.includes('.route(') || decoratorText.includes('.get(') ||
            decoratorText.includes('.post(') || decoratorText.includes('.put(') ||
            decoratorText.includes('.delete(') || decoratorText.includes('.patch(')) {
          hasRouteDecorator = true;
          // Extract route path
          const pathMatch = decoratorText.match(/\(['"]([^'"]*)['"]/);
          if (pathMatch) routePath = pathMatch[1];
        }

        // Check for auth decorators
        for (const authDec of authDecorators) {
          if (decoratorText === authDec || decoratorText.startsWith(authDec + '(')) {
            hasAuthDecorator = true;
            break;
          }
        }
      }

      if (!hasRouteDecorator || hasAuthDecorator) continue;

      // Check if route is a public endpoint
      if (publicPatterns.some((p) => routePath.includes(p))) continue;

      const funcNameNode = definition.childForFieldName('name');
      const funcName = funcNameNode?.text ?? 'unknown';

      const line = node.startPosition.row + 1;
      findings.push({
        id: generateComponentId('finding', file.filePath, `py-missing-auth-${line}`),
        ruleId: 'idd-py-006',
        severity: 'medium',
        title: `Route handler "${funcName}" missing authentication`,
        description: `Route handler at line ${line} for "${routePath || 'unknown path'}" has no authentication decorator`,
        filePath: file.filePath,
        startLine: line,
        endLine: node.endPosition.row + 1,
        snippet: node.text.substring(0, 200),
        recommendation: 'Add @login_required or equivalent auth decorator to protect this route.',
        cweId: 'CWE-862',
        owaspCategory: 'A01:2021-Broken Access Control',
      });
    }

    return findings;
  },
};

// ---------- Rule registry ----------

const ALL_PYTHON_RULES: PythonSecurityRule[] = [
  sqlInjectionRule,
  commandInjectionRule,
  pathTraversalRule,
  hardcodedSecretsRule,
  unsafeDeserializationRule,
  missingAuthRule,
];

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * Run all Python security rules against parsed files.
 *
 * Intent: Perform static security analysis on Python codebases.
 * Guarantees: All enabled rules are run. Findings filtered by config.
 */
export function runPythonSecurityRules(
  files: ParsedPythonFile[],
  config?: SecurityConfig,
): {
  findings: SecurityFinding[];
  rules: SecurityRule[];
} {
  const effectiveConfig = config ?? {};
  const findings: SecurityFinding[] = [];

  for (const file of files) {
    const taintMaps = buildPythonFileTaintMaps(file.tree.rootNode, effectiveConfig.customSources);

    for (const rule of ALL_PYTHON_RULES) {
      // Check if rule is disabled
      const ruleConfig = effectiveConfig.rules?.[rule.id];
      if (ruleConfig?.enabled === false) {
        logger.debug(`Rule ${rule.id} disabled by config, skipping`);
        continue;
      }

      try {
        let ruleFindings = rule.check({
          file,
          taintMaps,
          config: effectiveConfig,
        });

        // Apply severity override
        if (ruleConfig?.severity) {
          ruleFindings = ruleFindings.map((f) => ({
            ...f,
            severity: ruleConfig.severity!,
          }));
        }

        findings.push(...ruleFindings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Rule ${rule.id} failed on ${file.filePath}: ${message}`);
      }
    }
  }

  // Filter by minSeverity
  let filteredFindings = findings;
  if (effectiveConfig.minSeverity) {
    const minLevel = SEVERITY_ORDER[effectiveConfig.minSeverity];
    filteredFindings = findings.filter(
      (f) => SEVERITY_ORDER[f.severity] >= minLevel,
    );
  }

  logger.info(`Python security scan: ${filteredFindings.length} findings from ${ALL_PYTHON_RULES.length} rules`);

  return {
    findings: filteredFindings,
    rules: ALL_PYTHON_RULES.map(({ id, name, description, severity, cweId, owaspCategory }) => ({
      id, name, description, severity, cweId, owaspCategory,
    })),
  };
}

/**
 * Find the taint map for the function containing a given node.
 */
function findTaintMapForNode(
  node: Parser.SyntaxNode,
  taintMaps: Map<Parser.SyntaxNode, PythonTaintMap>,
): PythonTaintMap | undefined {
  let current: Parser.SyntaxNode | null = node;
  while (current) {
    if (current.type === 'function_definition') {
      return taintMaps.get(current);
    }
    current = current.parent;
  }
  return undefined;
}
