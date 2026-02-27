# CMIW

A CLI tool and library that analyzes TypeScript/JavaScript codebases to generate knowledge graphs, system design analysis, and security assessments.

## What It Does

- **Component Extraction** -- Parses your codebase with ts-morph to identify classes, functions, interfaces, types, enums, and their metadata
- **Relationship Mapping** -- Traces imports, class inheritance, interface implementations, and function calls across files
- **Knowledge Graph** -- Builds a graph of nodes (components) and edges (relationships) with cluster detection and circular dependency analysis
- **Security Scanning** -- Runs 7 static analysis rules mapped to CWE/OWASP standards, producing a scored security posture
- **AI Enrichment** -- Optionally uses Claude to analyze architecture patterns and provide security assessment context
- **Multiple Output Formats** -- Terminal (colored), JSON, SARIF 2.1.0, and Markdown

## Requirements

- Node.js >= 18.0.0
- `ANTHROPIC_API_KEY` environment variable (only if using LLM enrichment)

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Install globally (makes 'cmiw' available everywhere)
npm link
```

To uninstall the global command later: `npm unlink -g cmiw`

## Usage

### CLI

```bash
# Analyze a local project (terminal output, no LLM)
cmiw analyze ./my-project --skip-llm

# JSON output to file
cmiw analyze ./my-project --skip-llm --format json -o report.json

# SARIF output for CI/CD integration
cmiw analyze ./my-project --skip-llm --format sarif -o results.sarif

# Markdown report
cmiw analyze ./my-project --format markdown -o report.md

# Analyze a remote git repository
cmiw analyze https://github.com/user/repo --skip-llm

# With LLM enrichment (requires ANTHROPIC_API_KEY)
cmiw analyze ./my-project

# Verbose debug logging
cmiw analyze ./my-project --skip-llm --verbose
```

### CLI Options

| Option | Description | Default |
|---|---|---|
| `<path>` | Project directory or git URL (required) | -- |
| `-o, --output <path>` | Write output to file instead of stdout | stdout |
| `-f, --format <format>` | Output format: `terminal`, `json`, `sarif`, `markdown` | `terminal` |
| `--tsconfig <path>` | Path to tsconfig.json | Auto-detected |
| `--skip-llm` | Skip Claude AI enrichment | `false` |
| `-v, --verbose` | Enable debug logging | `false` |

### Library API

All analysis functions are available for programmatic use:

```typescript
import {
  loadProject,
  extractComponents,
  buildRelationships,
  buildGraph,
  analyzeSecurityPosture,
  assembleReport,
  formatJson,
  formatSarif,
  formatMarkdown,
  formatTerminal,
} from 'cmiw';

const project = loadProject({ targetPath: './my-project' });
const components = extractComponents(project);
const relationships = buildRelationships(project, components);
const graph = buildGraph(components, relationships);
const security = analyzeSecurityPosture(project);

const report = assembleReport({
  analyzedPath: './my-project',
  components,
  relationships,
  graph,
  architecture: { layers: [], patterns: [], decisions: [], summary: 'Static only' },
  security,
  startTime: Date.now(),
  llmEnriched: false,
});

console.log(formatJson(report));
```

## Analysis Pipeline

The `analyze` command runs 8 phases in sequence:

1. **Git Resolution** -- Clones the repo if a URL is provided
2. **Project Loading** -- Initializes ts-morph from tsconfig.json or file globs
3. **Component Extraction** -- Walks the AST to extract files, classes, functions, interfaces, type aliases, enums
4. **Relationship Building** -- Resolves imports, class hierarchy (extends/implements), and call expressions
5. **Graph Construction** -- Transforms components into graph nodes, relationships into edges, groups by directory, detects circular dependencies
6. **Security Analysis** -- Executes all 7 rules against every source file, calculates a posture score (0-100) and grade (A-F)
7. **LLM Enrichment** (optional) -- Sends structured summaries (not raw code) to Claude for architecture pattern analysis and security assessment
8. **Report Assembly** -- Combines all results into a typed `CmiwReport` and formats the output

## Security Rules

| Rule ID | Name | Severity | CWE | OWASP | What It Detects |
|---|---|---|---|---|---|
| cmiw-sec-001 | Unsanitized Input | High | CWE-79 | A03:2021 | `req.body`/`req.query` flowing directly into `innerHTML`, `.query()`, etc. |
| cmiw-sec-002 | SQL Injection | Critical | CWE-89 | A03:2021 | Template literals or string concatenation building SQL queries |
| cmiw-sec-003 | Missing Authentication | High | CWE-306 | A07:2021 | Express/Fastify route handlers without auth middleware |
| cmiw-sec-004 | Hardcoded Secrets | Critical | CWE-798 | A07:2021 | API keys, passwords, tokens assigned as string literals |
| cmiw-sec-005 | Unsafe Eval | Critical/High | CWE-95 | A03:2021 | `eval()`, `Function()`, `innerHTML` assignment, `document.write()` |
| cmiw-sec-006 | Command Injection | Critical | CWE-78 | A03:2021 | Dynamic input passed to `exec()`, `execSync()`, `spawn()` |
| cmiw-sec-007 | Path Traversal | High | CWE-22 | A01:2021 | User input used in `readFile()`, `writeFile()`, and other fs operations |

### Scoring

Each finding deducts from a base score of 100:

- Critical: -25 points
- High: -15 points
- Medium: -8 points
- Low: -3 points

Grades: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

## Output Formats

### Terminal

Colored output with severity-based highlighting. Critical/high findings in red, medium in yellow, low in blue. Includes summary metrics, architecture overview, security findings with file locations, and graph statistics.

### JSON

Complete `CmiwReport` object with all metadata, components, relationships, graph, architecture, and security data. Pretty-printed with 2-space indentation.

### SARIF 2.1.0

Industry-standard Static Analysis Results Interchange Format. Integrates with GitHub Code Scanning, VS Code SARIF Viewer, and other security tools. Maps findings to SARIF results with rule definitions and severity levels.

### Markdown

Human-readable document with tables and lists. Suitable for documentation, pull request descriptions, or sharing with non-technical stakeholders.

## LLM Enrichment

When `--skip-llm` is not set and `ANTHROPIC_API_KEY` is configured, CMIW sends structured analysis summaries to Claude for two enrichments:

1. **Architecture Analysis** -- Identifies layers (presentation, API, business logic, data access, infrastructure), detects patterns (MVC, layered, microservices, etc.), and documents design decisions with rationale
2. **Security Assessment** -- Provides contextual interpretation of findings, prioritized recommendations, and identification of systemic issues

The LLM receives component/relationship summaries and graph statistics, not raw source code. If the API call fails, the report explicitly states the failure reason rather than silently falling back.

## Component Types

| Type | Description |
|---|---|
| `file` | Source files (.ts, .tsx, .js, .jsx) |
| `class` | Class declarations with methods, properties, decorators |
| `function` | Top-level function declarations with parameters and return types |
| `interface` | TypeScript interfaces with property definitions |
| `type-alias` | TypeScript type alias declarations |
| `enum` | Enum declarations |

## Relationship Types

| Type | Description |
|---|---|
| `imports` | File-level import statements with named specifiers |
| `extends` | Class inheritance |
| `implements` | Interface implementation |
| `calls` | Function/method call expressions resolved to declarations |
| `uses-type` | Type references across files |
| `contains` | Parent-child containment |
| `depends-on` | General dependency |

## Project Structure

```
src/
  cli/
    index.ts                    # Commander.js program setup
    commands/
      analyze.ts                # Analysis pipeline orchestration
  core/
    project-loader.ts           # ts-morph Project initialization
    component-extractor.ts      # AST walking, component extraction
    relationship-builder.ts     # Import/call/hierarchy resolution
    graph-builder.ts            # Knowledge graph construction
    security-analyzer.ts        # Security rule orchestration, scoring
    report-assembler.ts         # Final report assembly
  security/
    rules/
      index.ts                  # Rule interface, registry, runner
      unsanitized-input.ts      # cmiw-sec-001
      sql-injection.ts          # cmiw-sec-002
      missing-auth.ts           # cmiw-sec-003
      hardcoded-secrets.ts      # cmiw-sec-004
      unsafe-eval.ts            # cmiw-sec-005
      command-injection.ts      # cmiw-sec-006
      path-traversal.ts         # cmiw-sec-007
  llm/
    client.ts                   # Anthropic SDK wrapper
    prompts.ts                  # Prompt templates for Claude
    enrichment.ts               # LLM enrichment orchestrator
  output/
    json-formatter.ts           # JSON output
    sarif-formatter.ts          # SARIF 2.1.0 output
    markdown-formatter.ts       # Markdown output
    terminal-formatter.ts       # Chalk-colored terminal output
  types/
    components.ts               # Component/relationship types and enums
    graph.ts                    # Graph node/edge/cluster types
    security.ts                 # Finding/rule/posture types
    architecture.ts             # Layer/pattern/decision types
    report.ts                   # CmiwReport top-level schema
    config.ts                   # CLI configuration types
    index.ts                    # Re-exports
  utils/
    logger.ts                   # Structured logging (debug/info/warn/error)
    id-generator.ts             # Deterministic component/relationship IDs
    errors.ts                   # CmiwError, ProjectLoadError, AnalysisError, LlmError
    git.ts                      # Git clone wrapper (simple-git)
  index.ts                      # Library API exports
bin/
  cmiw.js                       # CLI entry point (shebang wrapper)
tests/
  fixtures/
    simple-project/             # Known TS project for positive tests
    security-vulnerable/        # Intentionally vulnerable code for security tests
  unit/
    core/                       # Component extractor, relationship builder, graph builder
    security/                   # Security rule tests
    llm/                        # Prompt construction tests
    output/                     # Formatter tests
    utils/                      # ID generator tests
  integration/
    analyze-command.test.ts     # Full pipeline tests
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for distribution
npm run build
```

## Configuration

Copy `.env.example` to `.env` and set your API key:

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

## Dependencies

| Package | Purpose | Origin |
|---|---|---|
| ts-morph | TypeScript AST parsing | Canada |
| commander | CLI framework | Canada |
| @anthropic-ai/sdk | Claude API client | US |
| chalk | Terminal colors | Thailand |
| ora | Terminal spinners | Thailand |
| simple-git | Git operations | UK |
| node-sarif-builder | SARIF output | France |
