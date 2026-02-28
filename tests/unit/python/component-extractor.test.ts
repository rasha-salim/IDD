/**
 * Tests for Python component extraction via tree-sitter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import Parser from 'web-tree-sitter';
import { extractPythonComponents, type ParsedPythonFile } from '../../../src/analyzers/python/component-extractor.js';

let pythonLang: Parser.Language;
let parser: Parser;

async function initParser(): Promise<void> {
  await Parser.init();
  parser = new Parser();
  const wasmPath = resolve(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', 'tree-sitter-python.wasm');
  pythonLang = await Parser.Language.load(wasmPath);
  parser.setLanguage(pythonLang);
}

function parseFile(filePath: string): ParsedPythonFile {
  const source = readFileSync(filePath, 'utf-8');
  const tree = parser.parse(source);
  return { filePath, source, tree };
}

function parseSource(source: string, filePath = '/test.py'): ParsedPythonFile {
  const tree = parser.parse(source);
  return { filePath, source, tree };
}

describe('Python Component Extractor', () => {
  beforeAll(async () => {
    await initParser();
  });

  it('extracts file components from each .py file', () => {
    const files = [
      parseSource('x = 1', '/app/main.py'),
      parseSource('y = 2', '/app/utils.py'),
    ];
    const components = extractPythonComponents(files);
    const fileComponents = components.filter((c) => c.type === 'file');
    expect(fileComponents).toHaveLength(2);
    expect(fileComponents.map((c) => c.name)).toEqual(['main.py', 'utils.py']);
  });

  it('extracts classes with metadata', () => {
    const source = `
class User:
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

    def greet(self) -> str:
        return f"Hello {self.name}"
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const classComp = components.find((c) => c.name === 'User');

    expect(classComp).toBeDefined();
    expect(classComp!.type).toBe('class');
    expect(classComp!.metadata.methods).toBeDefined();
    expect(classComp!.metadata.methods!.length).toBeGreaterThanOrEqual(2);
    expect(classComp!.metadata.properties).toBeDefined();
    expect(classComp!.metadata.properties!.some((p) => p.name === 'name')).toBe(true);
    expect(classComp!.metadata.properties!.some((p) => p.name === 'email')).toBe(true);
  });

  it('extracts class inheritance', () => {
    const source = `
class Base:
    pass

class Child(Base):
    pass
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const child = components.find((c) => c.name === 'Child');

    expect(child).toBeDefined();
    expect(child!.metadata.extends).toBe('Base');
  });

  it('extracts top-level functions with parameters and return types', () => {
    const source = `
def add(a: int, b: int) -> int:
    return a + b

def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}"
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const addFunc = components.find((c) => c.name === 'add');
    const greetFunc = components.find((c) => c.name === 'greet');

    expect(addFunc).toBeDefined();
    expect(addFunc!.type).toBe('function');
    expect(addFunc!.metadata.parameters).toHaveLength(2);
    expect(addFunc!.metadata.parameters![0].type).toBe('int');
    expect(addFunc!.metadata.returnType).toBe('int');

    expect(greetFunc).toBeDefined();
    expect(greetFunc!.metadata.parameters).toHaveLength(2);
    expect(greetFunc!.metadata.parameters![1].isOptional).toBe(true);
  });

  it('extracts decorators on functions and classes', () => {
    const source = `
@app.route("/users")
@login_required
def list_users():
    pass
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const func = components.find((c) => c.name === 'list_users');

    expect(func).toBeDefined();
    expect(func!.metadata.decorators).toBeDefined();
    expect(func!.metadata.decorators!).toContain('login_required');
    expect(func!.metadata.decorators!.some((d) => d.includes('app.route'))).toBe(true);
  });

  it('identifies private methods by underscore convention', () => {
    const source = `
class MyClass:
    def public_method(self):
        pass

    def _private_method(self):
        pass

    def __very_private(self):
        pass

    def __init__(self):
        pass
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const cls = components.find((c) => c.name === 'MyClass');

    expect(cls).toBeDefined();
    const methods = cls!.metadata.methods!;

    const pub = methods.find((m) => m.name === 'public_method');
    expect(pub!.visibility).toBe('public');

    const priv = methods.find((m) => m.name === '_private_method');
    expect(priv!.visibility).toBe('private');

    const veryPriv = methods.find((m) => m.name === '__very_private');
    expect(veryPriv!.visibility).toBe('private');
  });

  it('extracts static and class methods', () => {
    const source = `
class MyClass:
    @staticmethod
    def static_method():
        pass

    @classmethod
    def class_method(cls):
        pass
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const cls = components.find((c) => c.name === 'MyClass');
    const methods = cls!.metadata.methods!;

    const staticM = methods.find((m) => m.name === 'static_method');
    expect(staticM!.isStatic).toBe(true);

    const classM = methods.find((m) => m.name === 'class_method');
    expect(classM!.isStatic).toBe(true);
    // cls should be filtered from parameters
    expect(classM!.parameters.some((p) => p.name === 'cls')).toBe(false);
  });

  it('extracts components from real fixture files', () => {
    const modelsPath = resolve(process.cwd(), 'tests/fixtures/python-project/app/models.py');
    const files = [parseFile(modelsPath)];
    const components = extractPythonComponents(files);

    const classNames = components.filter((c) => c.type === 'class').map((c) => c.name);
    expect(classNames).toContain('BaseModel');
    expect(classNames).toContain('User');
    expect(classNames).toContain('Product');

    const funcNames = components.filter((c) => c.type === 'function').map((c) => c.name);
    expect(funcNames).toContain('hash_password');
    expect(funcNames).toContain('verify_password');
  });
});
