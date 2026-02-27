import { describe, it, expect, beforeAll } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { buildTaintMap, isNodeTainted, buildFileTaintMaps, findEnclosingFunctionBody } from '../../../src/security/data-flow.js';

function createProjectWithCode(code: string): Project {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile('test.ts', code);
  return project;
}

describe('buildTaintMap', () => {
  it('should mark variables assigned from req.body as tainted', () => {
    const project = createProjectWithCode(`
      function handler(req: any, res: any) {
        const name = req.body.name;
        const age = req.body.age;
        res.send(name);
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile);

    expect(taintMap.has('name')).toBe(true);
    expect(taintMap.get('name')!.isTainted).toBe(true);
    expect(taintMap.get('name')!.source).toBe('req.body');

    expect(taintMap.has('age')).toBe(true);
    expect(taintMap.get('age')!.isTainted).toBe(true);
  });

  it('should propagate taint through variable assignments', () => {
    const project = createProjectWithCode(`
      function handler(req: any, res: any) {
        const input = req.query.search;
        const filter = input;
        res.send(filter);
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile);

    expect(taintMap.has('input')).toBe(true);
    expect(taintMap.get('input')!.isTainted).toBe(true);

    expect(taintMap.has('filter')).toBe(true);
    expect(taintMap.get('filter')!.isTainted).toBe(true);
    expect(taintMap.get('filter')!.source).toBe('req.query');
  });

  it('should track taint through destructuring', () => {
    const project = createProjectWithCode(`
      function handler(req: any, res: any) {
        const { name, email } = req.body;
        res.send(name);
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile);

    expect(taintMap.has('name')).toBe(true);
    expect(taintMap.get('name')!.isTainted).toBe(true);
    expect(taintMap.get('name')!.source).toBe('req.body');

    expect(taintMap.has('email')).toBe(true);
    expect(taintMap.get('email')!.isTainted).toBe(true);
  });

  it('should NOT mark constants as tainted', () => {
    const project = createProjectWithCode(`
      function getDefault() {
        const tableName = 'users';
        const limit = 100;
        return tableName;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile);

    expect(taintMap.has('tableName')).toBe(false);
    expect(taintMap.has('limit')).toBe(false);
  });

  it('should recognize custom taint sources', () => {
    const project = createProjectWithCode(`
      function handler(ctx: any) {
        const data = ctx.request.body;
        return data;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile, ['ctx.request.body']);

    expect(taintMap.has('data')).toBe(true);
    expect(taintMap.get('data')!.isTainted).toBe(true);
    expect(taintMap.get('data')!.source).toBe('ctx.request.body');
  });

  it('should track taint through property access of tainted variables', () => {
    const project = createProjectWithCode(`
      function handler(req: any, res: any) {
        const body = req.body;
        const name = body.name;
        res.send(name);
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile);

    expect(taintMap.has('body')).toBe(true);
    expect(taintMap.get('body')!.isTainted).toBe(true);

    expect(taintMap.has('name')).toBe(true);
    expect(taintMap.get('name')!.isTainted).toBe(true);
  });

  it('should track taint through template literal assignments', () => {
    const project = createProjectWithCode(`
      function handler(req: any) {
        const input = req.body.cmd;
        const cmd = \`ls \${input}\`;
        return cmd;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const funcBody = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.Block);
    const taintMap = buildTaintMap(funcBody, sourceFile);

    expect(taintMap.has('input')).toBe(true);
    expect(taintMap.has('cmd')).toBe(true);
    expect(taintMap.get('cmd')!.isTainted).toBe(true);
  });
});

describe('isNodeTainted', () => {
  it('should return isTainted=false for string literals', () => {
    const project = createProjectWithCode(`
      function handler() {
        const x = "hello";
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const stringLiteral = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.StringLiteral);
    const taintMap = new Map();

    const result = isNodeTainted(stringLiteral, taintMap);
    expect(result.isTainted).toBe(false);
  });

  it('should return isTainted=true for direct taint source expressions', () => {
    const project = createProjectWithCode(`
      function handler(req: any) {
        const x = req.body.name;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    // Find the req.body.name property access
    const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    const reqBodyName = propAccesses.find((p) => p.getText() === 'req.body.name');
    const taintMap = new Map();

    const result = isNodeTainted(reqBodyName!, taintMap);
    expect(result.isTainted).toBe(true);
    expect(result.source).toBe('req.body');
  });

  it('should return isTainted=true for tainted variables in the taint map', () => {
    const project = createProjectWithCode(`
      function handler(req: any) {
        const name = req.body.name;
        const x = name;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const taintMap = new Map([
      ['name', { isTainted: true, source: 'req.body', path: ['req.body', 'name'] }],
    ]);

    // Find the "name" identifier in "const x = name"
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
    const nameRef = identifiers.find((id) => {
      const parent = id.getParent();
      return id.getText() === 'name' && parent?.getKind() === SyntaxKind.VariableDeclaration
        && parent.getText().startsWith('x');
    });

    if (nameRef) {
      const result = isNodeTainted(nameRef, taintMap);
      expect(result.isTainted).toBe(true);
    }
  });
});

describe('buildFileTaintMaps', () => {
  it('should build taint maps for all function scopes in a file', () => {
    const project = createProjectWithCode(`
      function handler1(req: any) {
        const name = req.body.name;
      }
      function handler2(req: any) {
        const id = req.params.id;
      }
      function pureFunction() {
        const x = 42;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const fileMaps = buildFileTaintMaps(sourceFile);

    // Should have maps for all 3 functions
    expect(fileMaps.size).toBe(3);

    // Check that tainted variables exist in the right scopes
    let hasTaintedName = false;
    let hasTaintedId = false;
    for (const [_body, taintMap] of fileMaps) {
      if (taintMap.has('name')) hasTaintedName = true;
      if (taintMap.has('id')) hasTaintedId = true;
    }
    expect(hasTaintedName).toBe(true);
    expect(hasTaintedId).toBe(true);
  });
});

describe('findEnclosingFunctionBody', () => {
  it('should find the enclosing function body for a node', () => {
    const project = createProjectWithCode(`
      function handler(req: any) {
        const name = req.body.name;
        return name;
      }
    `);
    const sourceFile = project.getSourceFileOrThrow('test.ts');
    const identifier = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).find(
      (id) => id.getText() === 'name' && id.getStartLineNumber() === 4,
    );

    if (identifier) {
      const body = findEnclosingFunctionBody(identifier);
      expect(body).toBeDefined();
      expect(body!.getKind()).toBe(SyntaxKind.Block);
    }
  });
});
