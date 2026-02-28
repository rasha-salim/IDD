/**
 * Tests for Python relationship building via tree-sitter.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import Parser from 'web-tree-sitter';
import { extractPythonComponents, type ParsedPythonFile } from '../../../src/analyzers/python/component-extractor.js';
import { buildPythonRelationships } from '../../../src/analyzers/python/relationship-builder.js';

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

describe('Python Relationship Builder', () => {
  beforeAll(async () => {
    await initParser();
  });

  it('builds import relationships between files', () => {
    const mainSource = `
from models import User
from utils import validate
`;
    const modelsSource = `
class User:
    pass
`;
    const utilsSource = `
def validate(x):
    pass
`;
    const files = [
      parseSource(mainSource, '/app/main.py'),
      parseSource(modelsSource, '/app/models.py'),
      parseSource(utilsSource, '/app/utils.py'),
    ];
    const components = extractPythonComponents(files);
    const relationships = buildPythonRelationships(files, components);

    const imports = relationships.filter((r) => r.type === 'imports');
    expect(imports.length).toBeGreaterThanOrEqual(1);
  });

  it('builds inheritance relationships', () => {
    const source = `
class Base:
    pass

class Child(Base):
    pass
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const relationships = buildPythonRelationships(files, components);

    const extends_ = relationships.filter((r) => r.type === 'extends');
    expect(extends_).toHaveLength(1);

    // Source should be Child, target should be Base
    const childComp = components.find((c) => c.name === 'Child');
    const baseComp = components.find((c) => c.name === 'Base');
    expect(extends_[0].source).toBe(childComp!.id);
    expect(extends_[0].target).toBe(baseComp!.id);
  });

  it('builds call relationships', () => {
    const source = `
def helper():
    return 42

def main():
    result = helper()
    return result
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const relationships = buildPythonRelationships(files, components);

    const calls = relationships.filter((r) => r.type === 'calls');
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const mainComp = components.find((c) => c.name === 'main');
    const helperComp = components.find((c) => c.name === 'helper');
    expect(calls.some((r) => r.source === mainComp!.id && r.target === helperComp!.id)).toBe(true);
  });

  it('builds relationships from real fixture files', () => {
    const fixtureDir = resolve(process.cwd(), 'tests/fixtures/python-project/app');
    const files = [
      parseFile(resolve(fixtureDir, 'models.py')),
      parseFile(resolve(fixtureDir, 'utils.py')),
      parseFile(resolve(fixtureDir, 'views.py')),
    ];
    const components = extractPythonComponents(files);
    const relationships = buildPythonRelationships(files, components);

    // Should find inheritance: User extends BaseModel, Product extends BaseModel
    const extends_ = relationships.filter((r) => r.type === 'extends');
    expect(extends_.length).toBeGreaterThanOrEqual(2);

    expect(relationships.length).toBeGreaterThan(0);
  });

  it('deduplicates relationships', () => {
    const source = `
def helper():
    return 1

def caller():
    helper()
    helper()
    helper()
`;
    const files = [parseSource(source)];
    const components = extractPythonComponents(files);
    const relationships = buildPythonRelationships(files, components);

    // Should have exactly 1 call relationship, not 3
    const calls = relationships.filter((r) => r.type === 'calls');
    expect(calls).toHaveLength(1);
  });
});
