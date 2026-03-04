/**
 * Tests for Python security rules.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import Parser from 'web-tree-sitter';
import { runPythonSecurityRules } from '../../../src/analyzers/python/security-rules.js';
import type { ParsedPythonFile } from '../../../src/analyzers/python/component-extractor.js';

let parser: Parser;

async function initParser(): Promise<void> {
  await Parser.init();
  parser = new Parser();
  const wasmPath = resolve(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', 'tree-sitter-python.wasm');
  const pythonLang = await Parser.Language.load(wasmPath);
  parser.setLanguage(pythonLang);
}

function parseSource(source: string, filePath = '/test.py'): ParsedPythonFile {
  const tree = parser.parse(source);
  return { filePath, source, tree };
}

function parseFile(filePath: string): ParsedPythonFile {
  const source = readFileSync(filePath, 'utf-8');
  const tree = parser.parse(source);
  return { filePath, source, tree };
}

describe('Python Security Rules', () => {
  beforeAll(async () => {
    await initParser();
  });

  describe('idd-py-001: SQL Injection', () => {
    it('detects f-string SQL in cursor.execute()', () => {
      const source = `
from flask import request
def search():
    name = request.args.get("name")
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const sqlFindings = findings.filter((f) => f.ruleId === 'idd-py-001');
      expect(sqlFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag parameterized queries', () => {
      const source = `
from flask import request
def search():
    name = request.args.get("name")
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const sqlFindings = findings.filter((f) => f.ruleId === 'idd-py-001');
      expect(sqlFindings).toHaveLength(0);
    });
  });

  describe('idd-py-002: Command Injection', () => {
    it('detects os.system with user input', () => {
      const source = `
from flask import request
def run():
    cmd = request.args.get("cmd")
    os.system(f"echo {cmd}")
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const cmdFindings = findings.filter((f) => f.ruleId === 'idd-py-002');
      expect(cmdFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('detects eval with user input', () => {
      const source = `
from flask import request
def compute():
    expr = request.args.get("expr")
    eval(expr)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const cmdFindings = findings.filter((f) => f.ruleId === 'idd-py-002');
      expect(cmdFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag os.system with string literal', () => {
      const source = `
def run():
    os.system("echo hello")
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const cmdFindings = findings.filter((f) => f.ruleId === 'idd-py-002');
      expect(cmdFindings).toHaveLength(0);
    });
  });

  describe('idd-py-003: Path Traversal', () => {
    it('detects open() with user input', () => {
      const source = `
from flask import request
def read():
    filename = request.args.get("name")
    open(filename)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const pathFindings = findings.filter((f) => f.ruleId === 'idd-py-003');
      expect(pathFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag open() with string literal', () => {
      const source = `
def read():
    open("config.txt")
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const pathFindings = findings.filter((f) => f.ruleId === 'idd-py-003');
      expect(pathFindings).toHaveLength(0);
    });
  });

  describe('idd-py-004: Hardcoded Secrets', () => {
    it('detects hardcoded password', () => {
      const source = `
db_password = "production_password_123"
SECRET_KEY = "super-secret-key-12345"
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const secretFindings = findings.filter((f) => f.ruleId === 'idd-py-004');
      expect(secretFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag env variable lookups', () => {
      const source = `
password = os.environ.get("DB_PASSWORD")
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const secretFindings = findings.filter((f) => f.ruleId === 'idd-py-004');
      expect(secretFindings).toHaveLength(0);
    });
  });

  describe('idd-py-005: Unsafe Deserialization', () => {
    it('detects pickle.loads', () => {
      const source = `
import pickle
def load():
    data = pickle.loads(raw_data)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const deserFindings = findings.filter((f) => f.ruleId === 'idd-py-005');
      expect(deserFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('detects yaml.load without SafeLoader', () => {
      const source = `
import yaml
def load():
    config = yaml.load(raw_data)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const deserFindings = findings.filter((f) => f.ruleId === 'idd-py-005');
      expect(deserFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag yaml.load with SafeLoader', () => {
      const source = `
import yaml
def load():
    config = yaml.load(raw_data, Loader=yaml.SafeLoader)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const deserFindings = findings.filter((f) => f.ruleId === 'idd-py-005');
      expect(deserFindings).toHaveLength(0);
    });
  });

  describe('idd-py-006: Missing Auth', () => {
    it('detects route without login_required', () => {
      const source = `
from flask import Flask
app = Flask(__name__)

@app.route("/admin/dashboard")
def admin_dashboard():
    return "admin"
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const authFindings = findings.filter((f) => f.ruleId === 'idd-py-006');
      expect(authFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag route with login_required', () => {
      const source = `
from flask import Flask
app = Flask(__name__)

@app.route("/admin")
@login_required
def admin():
    return "admin"
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const authFindings = findings.filter((f) => f.ruleId === 'idd-py-006');
      expect(authFindings).toHaveLength(0);
    });

    it('does not flag public endpoints like /health', () => {
      const source = `
from flask import Flask
app = Flask(__name__)

@app.route("/health")
def health():
    return "ok"
`;
      const { findings } = runPythonSecurityRules([parseSource(source)]);
      const authFindings = findings.filter((f) => f.ruleId === 'idd-py-006');
      expect(authFindings).toHaveLength(0);
    });
  });

  describe('Fixture-based tests', () => {
    it('finds vulnerabilities in python-vulnerable fixture', () => {
      const fixtureDir = resolve(process.cwd(), 'tests/fixtures/python-vulnerable/app');
      const files = [
        parseFile(resolve(fixtureDir, 'server.py')),
        parseFile(resolve(fixtureDir, 'auth.py')),
        parseFile(resolve(fixtureDir, 'data.py')),
      ];
      const { findings } = runPythonSecurityRules(files);

      // Should find: SQL injection, command injection (2), path traversal,
      // hardcoded secrets (3), unsafe deserialization (2), missing auth (2)
      expect(findings.length).toBeGreaterThanOrEqual(5);

      const ruleIds = new Set(findings.map((f) => f.ruleId));
      expect(ruleIds.has('idd-py-002')).toBe(true); // command injection
      expect(ruleIds.has('idd-py-004')).toBe(true); // hardcoded secrets
      expect(ruleIds.has('idd-py-005')).toBe(true); // unsafe deserialization
    });

    it('finds no issues in clean python-project fixture', () => {
      const fixtureDir = resolve(process.cwd(), 'tests/fixtures/python-project/app');
      const files = [
        parseFile(resolve(fixtureDir, 'models.py')),
        parseFile(resolve(fixtureDir, 'utils.py')),
        parseFile(resolve(fixtureDir, 'views.py')),
        parseFile(resolve(fixtureDir, 'routes.py')),
      ];
      const { findings } = runPythonSecurityRules(files);

      // Clean project should have very few or zero findings
      // views.py has login_required on protected routes, /health is public
      expect(findings.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Config-based filtering', () => {
    it('disables specific rules via config', () => {
      const source = `
db_password = "secret123"
pickle.loads(data)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)], {
        rules: { 'idd-py-004': { enabled: false } },
      });
      const secretFindings = findings.filter((f) => f.ruleId === 'idd-py-004');
      expect(secretFindings).toHaveLength(0);
    });

    it('filters by minSeverity', () => {
      const source = `
db_password = "secret123"
pickle.loads(data)
`;
      const { findings } = runPythonSecurityRules([parseSource(source)], {
        minSeverity: 'critical',
      });
      // Only critical severity should remain (pickle.loads is critical, hardcoded secret is medium)
      for (const f of findings) {
        expect(f.severity).toBe('critical');
      }
    });
  });
});
