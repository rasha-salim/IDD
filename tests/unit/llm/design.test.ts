import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  DecomposeResult,
  OptionsResult,
  DecideResult,
  DiagramResult,
  DesignDocument,
} from '../../../src/types/design.js';

// Mock sendPrompt before importing design functions
vi.mock('../../../src/llm/client.js', () => ({
  sendPrompt: vi.fn(),
  getClient: vi.fn(),
  resetClient: vi.fn(),
}));

import { sendPrompt } from '../../../src/llm/client.js';
import {
  parseJsonResponse,
  runDecompose,
  runOptions,
  runDecide,
  runDiagram,
  runFullDesign,
} from '../../../src/llm/design.js';

const mockSendPrompt = vi.mocked(sendPrompt);

const sampleDecompose: DecomposeResult = {
  task: 'Build a login page',
  components: [
    { name: 'Auth Form', description: 'Renders email/password inputs' },
    { name: 'Session Manager', description: 'Handles JWT storage' },
  ],
  assumptions: ['Using JWT for auth', 'No SSO required'],
};

const sampleOptions: OptionsResult = {
  task: 'Build a login page',
  componentOptions: [
    {
      componentName: 'Auth Form',
      options: [
        {
          name: 'React Hook Form',
          description: 'Form library with validation',
          pros: ['Built-in validation', 'Small bundle'],
          cons: ['Learning curve'],
        },
        {
          name: 'Native forms',
          description: 'Plain HTML forms with state',
          pros: ['No dependencies'],
          cons: ['Manual validation'],
        },
      ],
      recommendation: 'React Hook Form for built-in validation',
    },
  ],
};

const sampleDecide: DecideResult = {
  task: 'Build a login page',
  decisions: [
    { component: 'Auth Form', choice: 'React Hook Form', reason: 'Built-in validation reduces boilerplate' },
    { component: 'Session Manager', choice: 'httpOnly cookie', reason: 'More secure than localStorage' },
  ],
};

const sampleDiagram: DiagramResult = {
  task: 'Build a login page',
  mermaidCode: 'graph TD\n    A[Login Form] --> B[Auth API]\n    B --> C[Session Store]',
  description: 'Login flow from form submission to session creation',
};

const sampleDesignDoc: DesignDocument = {
  task: 'Build a login page',
  decomposition: sampleDecompose,
  options: sampleOptions,
  decisions: sampleDecide,
  diagram: sampleDiagram,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseJsonResponse', () => {
  it('should parse valid JSON directly', () => {
    const input = JSON.stringify(sampleDecompose);
    const result = parseJsonResponse<DecomposeResult>(input);
    expect(result.task).toBe('Build a login page');
    expect(result.components).toHaveLength(2);
  });

  it('should parse JSON wrapped in markdown code block', () => {
    const input = '```json\n' + JSON.stringify(sampleDecompose) + '\n```';
    const result = parseJsonResponse<DecomposeResult>(input);
    expect(result.task).toBe('Build a login page');
    expect(result.components).toHaveLength(2);
  });

  it('should parse JSON wrapped in plain code block without json tag', () => {
    const input = '```\n' + JSON.stringify(sampleDecompose) + '\n```';
    const result = parseJsonResponse<DecomposeResult>(input);
    expect(result.task).toBe('Build a login page');
  });

  it('should handle whitespace around JSON', () => {
    const input = '  \n' + JSON.stringify(sampleDecompose) + '\n  ';
    const result = parseJsonResponse<DecomposeResult>(input);
    expect(result.task).toBe('Build a login page');
  });

  it('should throw LlmError for invalid JSON without code block', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow(
      'Response is not valid JSON and does not contain a JSON code block',
    );
  });

  it('should throw LlmError for invalid JSON inside code block', () => {
    expect(() => parseJsonResponse('```json\n{invalid json}\n```')).toThrow(
      'Failed to parse JSON from code block',
    );
  });
});

describe('runDecompose', () => {
  it('should call sendPrompt and return parsed DecomposeResult', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDecompose));

    const result = await runDecompose('Build a login page');

    expect(mockSendPrompt).toHaveBeenCalledOnce();
    expect(result.task).toBe('Build a login page');
    expect(result.components).toHaveLength(2);
    expect(result.assumptions).toHaveLength(2);
  });

  it('should include task in the user prompt', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDecompose));

    await runDecompose('Build a login page');

    const userPrompt = mockSendPrompt.mock.calls[0][1];
    expect(userPrompt).toContain('Build a login page');
  });
});

describe('runOptions', () => {
  it('should return parsed OptionsResult', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleOptions));

    const result = await runOptions('Build a login page');

    expect(result.task).toBe('Build a login page');
    expect(result.componentOptions).toHaveLength(1);
    expect(result.componentOptions[0].options).toHaveLength(2);
  });

  it('should include previous decomposition when chaining', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleOptions));

    await runOptions('Build a login page', sampleDecompose);

    const userPrompt = mockSendPrompt.mock.calls[0][1];
    expect(userPrompt).toContain('Previous decomposition');
    expect(userPrompt).toContain('Auth Form');
  });
});

describe('runDecide', () => {
  it('should return parsed DecideResult', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDecide));

    const result = await runDecide('Build a login page');

    expect(result.task).toBe('Build a login page');
    expect(result.decisions).toHaveLength(2);
    expect(result.decisions[0].component).toBe('Auth Form');
  });

  it('should include previous options when chaining', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDecide));

    await runDecide('Build a login page', sampleOptions);

    const userPrompt = mockSendPrompt.mock.calls[0][1];
    expect(userPrompt).toContain('Previous options analysis');
    expect(userPrompt).toContain('React Hook Form');
  });
});

describe('runDiagram', () => {
  it('should return parsed DiagramResult', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDiagram));

    const result = await runDiagram('Build a login page');

    expect(result.task).toBe('Build a login page');
    expect(result.mermaidCode).toContain('graph TD');
    expect(result.description).toBeTruthy();
  });

  it('should include previous decisions when chaining', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDiagram));

    await runDiagram('Build a login page', sampleDecide);

    const userPrompt = mockSendPrompt.mock.calls[0][1];
    expect(userPrompt).toContain('Design decisions');
    expect(userPrompt).toContain('httpOnly cookie');
  });
});

describe('runFullDesign', () => {
  it('should return parsed DesignDocument with all phases', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDesignDoc));

    const result = await runFullDesign('Build a login page');

    expect(result.task).toBe('Build a login page');
    expect(result.decomposition.components).toHaveLength(2);
    expect(result.options.componentOptions).toHaveLength(1);
    expect(result.decisions.decisions).toHaveLength(2);
    expect(result.diagram.mermaidCode).toContain('graph TD');
  });

  it('should request higher maxTokens for single-shot', async () => {
    mockSendPrompt.mockResolvedValue(JSON.stringify(sampleDesignDoc));

    await runFullDesign('Build a login page');

    const options = mockSendPrompt.mock.calls[0][2];
    expect(options).toEqual({ maxTokens: 8192 });
  });

  it('should handle markdown-wrapped response', async () => {
    const wrappedResponse = '```json\n' + JSON.stringify(sampleDesignDoc) + '\n```';
    mockSendPrompt.mockResolvedValue(wrappedResponse);

    const result = await runFullDesign('Build a login page');

    expect(result.task).toBe('Build a login page');
    expect(result.decomposition.components).toHaveLength(2);
  });
});
