/**
 * Tests for Python taint analysis via tree-sitter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import Parser from 'web-tree-sitter';
import { buildPythonTaintMap, isPythonExprTainted } from '../../../src/analyzers/python/taint-analysis.js';

let parser: Parser;

async function initParser(): Promise<void> {
  await Parser.init();
  parser = new Parser();
  const wasmPath = resolve(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', 'tree-sitter-python.wasm');
  const pythonLang = await Parser.Language.load(wasmPath);
  parser.setLanguage(pythonLang);
}

function getFunctionBody(source: string): Parser.SyntaxNode {
  const tree = parser.parse(source);
  const rootNode = tree.rootNode;
  for (const child of rootNode.children) {
    if (child.type === 'function_definition') {
      const body = child.childForFieldName('body');
      if (body) return body;
    }
    if (child.type === 'decorated_definition') {
      const def = child.childForFieldName('definition');
      if (def?.type === 'function_definition') {
        const body = def.childForFieldName('body');
        if (body) return body;
      }
    }
  }
  throw new Error('No function body found in source');
}

describe('Python Taint Analysis', () => {
  beforeAll(async () => {
    await initParser();
  });

  it('marks Flask request.args as tainted', () => {
    const body = getFunctionBody(`
def handler():
    name = request.args.get("name")
    return name
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.has('name')).toBe(true);
    expect(variables.get('name')!.isTainted).toBe(true);
  });

  it('marks Flask request.form as tainted', () => {
    const body = getFunctionBody(`
def handler():
    data = request.form
    name = data
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.has('data')).toBe(true);
    expect(variables.get('data')!.isTainted).toBe(true);
  });

  it('propagates taint through variable assignment', () => {
    const body = getFunctionBody(`
def handler():
    raw = request.args.get("input")
    processed = raw
    final = processed
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.get('raw')?.isTainted).toBe(true);
    expect(variables.get('processed')?.isTainted).toBe(true);
    expect(variables.get('final')?.isTainted).toBe(true);
  });

  it('does not taint string literals', () => {
    const body = getFunctionBody(`
def handler():
    name = "constant"
    query = "SELECT * FROM users"
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.has('name')).toBe(false);
    expect(variables.has('query')).toBe(false);
  });

  it('removes taint through sanitizer functions', () => {
    const body = getFunctionBody(`
def handler():
    raw = request.args.get("input")
    safe = int(raw)
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.get('raw')?.isTainted).toBe(true);
    // int() is a sanitizer, should remove taint
    expect(variables.has('safe')).toBe(false);
  });

  it('detects path validation', () => {
    const body = getFunctionBody(`
def handler():
    filename = request.args.get("file")
    safe = os.path.abspath(filename)
    content = open(safe).read()
`);
    const { hasPathValidation } = buildPythonTaintMap(body);
    expect(hasPathValidation).toBe(true);
  });

  it('isPythonExprTainted returns false for constants', () => {
    const body = getFunctionBody(`
def handler():
    x = request.args.get("q")
`);
    const { variables } = buildPythonTaintMap(body);

    const literal = isPythonExprTainted('"hello"', variables);
    expect(literal.isTainted).toBe(false);

    const num = isPythonExprTainted('42', variables);
    expect(num.isTainted).toBe(false);
  });

  it('isPythonExprTainted returns true for tainted vars', () => {
    const body = getFunctionBody(`
def handler():
    user_input = request.args.get("q")
`);
    const { variables } = buildPythonTaintMap(body);

    const result = isPythonExprTainted('user_input', variables);
    expect(result.isTainted).toBe(true);
  });

  it('tracks taint through f-string interpolation', () => {
    const body = getFunctionBody(`
def handler():
    name = request.args.get("name")
    query = f"SELECT * FROM users WHERE name = '{name}'"
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.get('query')?.isTainted).toBe(true);
  });

  it('supports custom taint sources', () => {
    const body = getFunctionBody(`
def handler():
    data = custom_source.get_input()
`);
    const { variables } = buildPythonTaintMap(body, ['custom_source.get_input()']);
    expect(variables.get('data')?.isTainted).toBe(true);
  });

  it('tracks Django request.POST as tainted', () => {
    const body = getFunctionBody(`
def handler():
    username = request.POST.get("username")
`);
    const { variables } = buildPythonTaintMap(body);
    expect(variables.get('username')?.isTainted).toBe(true);
  });
});
