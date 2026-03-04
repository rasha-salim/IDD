import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  DecomposeResult,
  OptionsResult,
  DecideResult,
  DiagramResult,
  DesignDocument,
} from '../../src/types/design.js';
import {
  formatDecompose,
  formatOptions,
  formatDecide,
  formatDiagram,
  formatDesignDocument,
} from '../../src/output/design-formatter.js';

const sampleDecompose: DecomposeResult = {
  task: 'Build a REST API',
  components: [
    { name: 'Router', description: 'HTTP routing layer' },
    { name: 'Database', description: 'Data persistence layer' },
    { name: 'Auth Middleware', description: 'JWT validation' },
  ],
  assumptions: ['Using Express.js', 'PostgreSQL database', 'No rate limiting needed'],
};

const sampleOptions: OptionsResult = {
  task: 'Build a REST API',
  componentOptions: [
    {
      componentName: 'Database',
      options: [
        {
          name: 'Prisma ORM',
          description: 'Type-safe ORM with migrations',
          pros: ['Type safety', 'Auto-generated client'],
          cons: ['Heavy dependency', 'Learning curve'],
        },
        {
          name: 'Raw SQL with pg',
          description: 'Direct PostgreSQL queries',
          pros: ['Full control', 'No abstraction overhead'],
          cons: ['Manual type mapping', 'More boilerplate'],
        },
      ],
      recommendation: 'Prisma for type safety and migration support',
    },
  ],
};

const sampleDecide: DecideResult = {
  task: 'Build a REST API',
  decisions: [
    { component: 'Router', choice: 'Express.js', reason: 'Mature ecosystem and middleware support' },
    { component: 'Database', choice: 'Prisma ORM', reason: 'Type safety reduces runtime errors' },
    { component: 'Auth Middleware', choice: 'Passport.js', reason: 'Strategy pattern supports multiple auth methods' },
  ],
};

const sampleDiagram: DiagramResult = {
  task: 'Build a REST API',
  mermaidCode: 'graph TD\n    Client --> Router\n    Router --> Auth\n    Auth --> DB[(PostgreSQL)]',
  description: 'REST API request flow from client to database',
};

const sampleDoc: DesignDocument = {
  task: 'Build a REST API',
  decomposition: sampleDecompose,
  options: sampleOptions,
  decisions: sampleDecide,
  diagram: sampleDiagram,
};

describe('Design formatters produce valid markdown', () => {
  it('formatDecompose includes task, components, and assumptions', () => {
    const output = formatDecompose(sampleDecompose);

    expect(output).toContain('## Task: Build a REST API');
    expect(output).toContain('## Components');
    expect(output).toContain('**Router**');
    expect(output).toContain('**Database**');
    expect(output).toContain('**Auth Middleware**');
    expect(output).toContain('## Assumptions');
    expect(output).toContain('Using Express.js');
  });

  it('formatOptions includes component names, options, pros/cons, and recommendations', () => {
    const output = formatOptions(sampleOptions);

    expect(output).toContain('## Database');
    expect(output).toContain('### Prisma ORM');
    expect(output).toContain('### Raw SQL with pg');
    expect(output).toContain('+ Type safety');
    expect(output).toContain('- Heavy dependency');
    expect(output).toContain('**Recommendation:**');
  });

  it('formatDecide renders a markdown decision table', () => {
    const output = formatDecide(sampleDecide);

    expect(output).toContain('## Proposed approach');
    expect(output).toContain('| Component | Choice | Reason |');
    expect(output).toContain('| Router | Express.js |');
    expect(output).toContain('| Database | Prisma ORM |');
    expect(output).toContain('| Auth Middleware | Passport.js |');
  });

  it('formatDiagram wraps mermaid code in a fenced code block', () => {
    const output = formatDiagram(sampleDiagram);

    expect(output).toContain('## System Diagram');
    expect(output).toContain('```mermaid');
    expect(output).toContain('graph TD');
    expect(output).toContain('```');
    expect(output).toContain('REST API request flow');
  });

  it('formatDesignDocument combines all phases with section headers', () => {
    const output = formatDesignDocument(sampleDoc);

    expect(output).toContain('# IDD Design Document: Build a REST API');
    expect(output).toContain('## Phase 1: Decomposition');
    expect(output).toContain('## Phase 2: Options');
    expect(output).toContain('## Phase 3: Decisions');
    expect(output).toContain('## Phase 3.5: System Diagram');
    // Verify all phases are included
    expect(output).toContain('**Router**');
    expect(output).toContain('Prisma ORM');
    expect(output).toContain('```mermaid');
  });
});
