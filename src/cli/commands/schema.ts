/**
 * Intent: Output JSON schema descriptions for IDD output types.
 * Agents call this to learn the output shape before calling actual subcommands.
 *
 * Guarantees: Outputs a valid JSON Schema (draft-07) for the requested type.
 * No project path needed -- this is purely a reference command.
 */

/**
 * JSON Schema for IddComponent[].
 */
const componentsSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'IddComponent[]',
  description: 'Array of components extracted from source code by idd components',
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'name', 'type', 'filePath', 'startLine', 'endLine', 'metadata'],
    properties: {
      id: { type: 'string', description: 'Unique component identifier' },
      name: { type: 'string', description: 'Component name (class, function, file, etc.)' },
      type: {
        type: 'string',
        enum: ['file', 'class', 'function', 'interface', 'type-alias', 'enum', 'module', 'decorator'],
        description: 'Component type',
      },
      filePath: { type: 'string', description: 'Absolute path to the source file' },
      startLine: { type: 'number', description: 'Start line number (1-based)' },
      endLine: { type: 'number', description: 'End line number (1-based)' },
      metadata: {
        type: 'object',
        required: ['loc', 'isExported', 'isDefault'],
        properties: {
          loc: { type: 'number', description: 'Lines of code' },
          isExported: { type: 'boolean' },
          isDefault: { type: 'boolean' },
          decorators: { type: 'array', items: { type: 'string' } },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                isOptional: { type: 'boolean' },
              },
            },
          },
          returnType: { type: 'string' },
          properties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                visibility: { type: 'string', enum: ['public', 'protected', 'private'] },
                isStatic: { type: 'boolean' },
                isReadonly: { type: 'boolean' },
              },
            },
          },
          methods: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                returnType: { type: 'string' },
                visibility: { type: 'string', enum: ['public', 'protected', 'private'] },
                isStatic: { type: 'boolean' },
                isAsync: { type: 'boolean' },
              },
            },
          },
          extends: { type: 'string' },
          implements: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

/**
 * JSON Schema for KnowledgeGraph.
 */
const graphSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'KnowledgeGraph',
  description: 'Knowledge graph produced by idd graph',
  type: 'object',
  required: ['nodes', 'edges', 'clusters', 'circularDependencies'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'type', 'group', 'size', 'metadata'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string' },
          group: { type: 'string', description: 'Directory-based grouping' },
          size: { type: 'number', description: 'Visual size based on LOC + connections' },
          metadata: { type: 'object' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'source', 'target', 'type', 'weight', 'metadata'],
        properties: {
          id: { type: 'string' },
          source: { type: 'string', description: 'Source node ID' },
          target: { type: 'string', description: 'Target node ID' },
          type: {
            type: 'string',
            enum: ['imports', 'exports', 'extends', 'implements', 'calls', 'uses-type', 'contains', 'depends-on'],
          },
          weight: { type: 'number' },
          metadata: { type: 'object' },
        },
      },
    },
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'nodeIds'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          nodeIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    circularDependencies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'severity'],
        properties: {
          path: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['warning', 'error'] },
        },
      },
    },
  },
};

/**
 * JSON Schema for SecurityPosture.
 */
const securitySchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'SecurityPosture',
  description: 'Security analysis results produced by idd security',
  type: 'object',
  required: ['score', 'grade', 'findings', 'rules', 'summary'],
  properties: {
    score: { type: 'number', minimum: 0, maximum: 100, description: 'Security score (100 = no findings)' },
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'], description: 'Letter grade' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'ruleId', 'severity', 'title', 'description', 'filePath', 'startLine', 'endLine', 'snippet', 'recommendation'],
        properties: {
          id: { type: 'string' },
          ruleId: { type: 'string', description: 'Rule that triggered this finding (e.g. idd-sec-001)' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          title: { type: 'string' },
          description: { type: 'string' },
          filePath: { type: 'string' },
          startLine: { type: 'number' },
          endLine: { type: 'number' },
          snippet: { type: 'string', description: 'Source code snippet containing the finding' },
          recommendation: { type: 'string' },
          cweId: { type: 'string' },
          owaspCategory: { type: 'string' },
        },
      },
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'description', 'severity'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          cweId: { type: 'string' },
          owaspCategory: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
    llmAssessment: { type: 'string', description: 'Optional LLM-generated security assessment' },
  },
};

/**
 * JSON Schema for IddReport (full analyze output).
 */
const reportSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'IddReport',
  description: 'Full analysis report produced by idd analyze --format json',
  type: 'object',
  required: ['metadata', 'components', 'relationships', 'graph', 'architecture', 'security'],
  properties: {
    metadata: {
      type: 'object',
      required: ['version', 'timestamp', 'analyzedPath', 'totalFiles', 'totalComponents', 'totalRelationships', 'analysisTimeMs', 'llmEnriched'],
      properties: {
        version: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        analyzedPath: { type: 'string' },
        totalFiles: { type: 'number' },
        totalComponents: { type: 'number' },
        totalRelationships: { type: 'number' },
        analysisTimeMs: { type: 'number' },
        llmEnriched: { type: 'boolean' },
      },
    },
    components: { $ref: '#/definitions/components' },
    relationships: { type: 'array', items: { type: 'object' } },
    graph: { $ref: '#/definitions/graph' },
    architecture: {
      type: 'object',
      required: ['layers', 'patterns', 'decisions', 'summary'],
      properties: {
        layers: { type: 'array' },
        patterns: { type: 'array' },
        decisions: { type: 'array' },
        summary: { type: 'string' },
        llmAnalysis: { type: 'string' },
      },
    },
    security: { $ref: '#/definitions/security' },
  },
  definitions: {
    components: componentsSchema,
    graph: graphSchema,
    security: securitySchema,
  },
};

const SCHEMAS: Record<string, unknown> = {
  components: componentsSchema,
  graph: graphSchema,
  security: securitySchema,
  report: reportSchema,
};

const VALID_TYPES = Object.keys(SCHEMAS);

/**
 * Execute the schema subcommand.
 *
 * Intent: Let agents discover output shapes before calling actual subcommands.
 * Guarantees: Outputs valid JSON Schema for the requested type.
 */
export function runSchema(typeName: string): void {
  if (!VALID_TYPES.includes(typeName)) {
    console.error(`Unknown schema type: "${typeName}". Valid types: ${VALID_TYPES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(SCHEMAS[typeName], null, 2));
}
