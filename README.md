# IDD

IDD is an analysis CLI for coding agents and humans who build products methodically. It extracts components, maps relationships, builds knowledge graphs, and scans for security vulnerabilities -- all with structured, machine-readable output.

The IDD methodology (decompose, options, decide, implement) lives in the `/idd-design` Claude Code skill, which uses agent reasoning directly rather than CLI commands.

## What It Does

### Analysis (Static Analysis)

- **Component Extraction** -- Parses your codebase with ts-morph (TypeScript/JS) or tree-sitter (Python) to identify classes, functions, interfaces, types, enums, and their metadata
- **Relationship Mapping** -- Traces imports, class inheritance, interface implementations, and function calls across files
- **Knowledge Graph** -- Builds a graph of nodes (components) and edges (relationships) with cluster detection and circular dependency analysis
- **Security Scanning** -- Runs 7 TS rules + 6 Python rules mapped to CWE/OWASP standards, producing a scored security posture
- **Multi-Language Support** -- Auto-detects language from file extensions, or use `--language` to override
- **AI Enrichment** -- Optionally uses Claude to analyze architecture patterns and provide security assessment context
- **Multiple Output Formats** -- Terminal (colored), JSON, SARIF 2.1.0, and Markdown

## Requirements

- Node.js >= 18.0.0
- `ANTHROPIC_API_KEY` environment variable (optional, only for LLM enrichment in `analyze`)

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Install globally (makes 'idd' available everywhere)
npm link
```

To uninstall the global command later: `npm unlink -g idd`

## Usage

### Commands

IDD provides 5 analysis commands:

```
idd analyze <path>       Full analysis pipeline (components + graph + security + architecture)
idd components <path>    Extract components only -> JSON array
idd graph <path>         Build knowledge graph -> JSON object
idd security <path>      Security analysis only -> JSON object
idd schema <type>        Output JSON Schema for a type (no project needed)
```

### CLI Examples

```bash
# Full analysis (terminal output, no LLM)
idd analyze ./my-project --skip-llm

# JSON output to file
idd analyze ./my-project --skip-llm --format json -o report.json

# SARIF output for CI/CD integration
idd analyze ./my-project --skip-llm --format sarif -o results.sarif

# Markdown report
idd analyze ./my-project --format markdown -o report.md

# Analyze a remote git repository
idd analyze https://github.com/user/repo --skip-llm

# With LLM enrichment (requires ANTHROPIC_API_KEY)
idd analyze ./my-project

# Extract only components (always JSON)
idd components ./my-project --quiet

# Build knowledge graph only
idd graph ./my-project --quiet

# Security scan with exit code (0=clean, 2=findings)
idd security ./my-project --quiet

# Discover output shapes before calling subcommands
idd schema components
idd schema graph
idd schema security
idd schema report
```

### CLI Options

**Shared options** (available on `analyze`, `components`, `graph`, `security`):

| Option | Description | Default |
|---|---|---|
| `<path>` | Project directory (or git URL for `analyze`) | required |
| `--tsconfig <path>` | Path to tsconfig.json | Auto-detected |
| `--language <lang>` | Language: `typescript`, `python`, `auto` | `auto` |
| `-v, --verbose` | Enable debug logging | `false` |
| `-q, --quiet` | Suppress progress output (auto-enabled when piped) | `false` |

**Analyze-specific options:**

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Write output to file instead of stdout | stdout |
| `-f, --format <format>` | Output format: `terminal`, `json`, `sarif`, `markdown` | `terminal` |
| `--skip-llm` | Skip Claude AI enrichment | `false` |

**Security options** (available on `analyze` and `security`):

| Option | Description | Default |
|---|---|---|
| `--config <path>` | Path to `.iddrc.json` config file | Auto-detected |
| `--min-severity <level>` | Minimum severity: `critical`, `high`, `medium`, `low`, `info` | all |
| `--disable-rules <ids>` | Comma-separated rule IDs to disable | none |

### Exit Codes

| Code | Meaning | Commands |
|---|---|---|
| 0 | Success (or no security findings above threshold) | all |
| 1 | Error (invalid path, parse failure, runtime error) | all |
| 2 | Security findings found above severity threshold | `analyze`, `security` |

Exit code 2 lets CI/CD pipelines and agents gate on security without parsing JSON.

## Agent Usage

> For the full agent integration guide with detailed examples, patterns, and error handling, see [docs/agent-integration.md](docs/agent-integration.md).

IDD is designed to be a first-class tool for coding agents (Claude Code, Cursor, custom MCP agents). The granular subcommands output structured JSON that agents can parse and act on directly.

### Key Design Choices for Agents

- **Auto-quiet on pipe**: When stdout is not a TTY (e.g., piped to `jq`), spinners are automatically suppressed. No `--quiet` flag needed.
- **Always JSON**: The `components`, `graph`, and `security` subcommands always output JSON. No `--format` flag needed.
- **Schema introspection**: Call `idd schema <type>` to discover the output shape before calling the actual subcommand. No documentation lookup needed.
- **Security exit codes**: `idd security` exits with code 2 if findings exist, enabling simple `if` checks without JSON parsing.

### Example Agent Workflows

**Get component names:**
```bash
idd components ./project | jq '.[].name'
```

**Check if project has security issues:**
```bash
idd security ./project --quiet
# $? == 0 -> clean, $? == 2 -> has findings
```

**Get security findings with severity filter:**
```bash
idd security ./project --min-severity high | jq '.findings[] | {title, severity, filePath, startLine}'
```

**Build graph and extract circular dependencies:**
```bash
idd graph ./project | jq '.circularDependencies'
```

**Discover output shape before calling:**
```bash
# Learn what fields IddComponent has
idd schema components | jq '.items.properties | keys'

# Then extract components
idd components ./project | jq '.[0]'
```

**Full analysis as JSON (auto-quiets in pipe):**
```bash
idd analyze ./project --skip-llm --format json | jq '.security.grade'
```

### Claude Code Skills

IDD includes 6 ready-to-use Claude Code skills for interactive agent workflows:

**Design skill:**

- **`/idd-design`** -- Walk through the full IDD methodology interactively using agent reasoning: decompose, options, decide, diagram. No CLI commands or API key required.
- **`/idd-diagram`** -- Generate a Mermaid system design diagram from codebase analysis

**Analysis skills:**

- **`/idd-analyze`** -- Run full codebase analysis with architecture overview, security posture, and graph stats
- **`/idd-security`** -- Scan a project, present findings, offer to fix them, re-scan to verify
- **`/idd-review`** -- Combined code quality and architecture review with actionable suggestions
- **`/idd-graph`** -- Explore the knowledge graph: dependencies, clusters, hubs, structural patterns

Install them by copying from `docs/skills/` to `~/.claude/skills/`. See [docs/agent-integration.md](docs/agent-integration.md#claude-code-skills) for full details and instructions for writing your own skills.

### Library API

All analysis functions are available for programmatic use:

```typescript
import {
  // Analysis functions
  loadProject,
  extractComponents,
  buildRelationships,
  buildGraph,
  analyzeSecurityPosture,
  assembleReport,
  detectLanguage,
  createAnalyzer,
  // Analysis formatters
  formatJson,
  formatSarif,
  formatMarkdown,
  formatTerminal,
} from 'idd-cli';
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
8. **Report Assembly** -- Combines all results into a typed `IddReport` and formats the output

## Security Rules

| Rule ID | Name | Severity | CWE | OWASP | What It Detects |
|---|---|---|---|---|---|
| idd-sec-001 | Unsanitized Input | High | CWE-79 | A03:2021 | `req.body`/`req.query` flowing directly into `innerHTML`, `.query()`, etc. |
| idd-sec-002 | SQL Injection | Critical | CWE-89 | A03:2021 | Template literals or string concatenation building SQL queries |
| idd-sec-003 | Missing Authentication | High | CWE-306 | A07:2021 | Express/Fastify route handlers without auth middleware |
| idd-sec-004 | Hardcoded Secrets | Critical | CWE-798 | A07:2021 | API keys, passwords, tokens assigned as string literals |
| idd-sec-005 | Unsafe Eval | Critical/High | CWE-95 | A03:2021 | `eval()`, `Function()`, `innerHTML` assignment, `document.write()` |
| idd-sec-006 | Command Injection | Critical | CWE-78 | A03:2021 | Dynamic input passed to `exec()`, `execSync()`, `spawn()` |
| idd-sec-007 | Path Traversal | High | CWE-22 | A01:2021 | User input used in `readFile()`, `writeFile()`, and other fs operations |

### Python Security Rules

| Rule ID | Name | Severity | CWE | OWASP | What It Detects |
|---|---|---|---|---|---|
| idd-py-001 | SQL Injection | High | CWE-89 | A03:2021 | f-strings or `.format()` in `cursor.execute()`, `db.execute()` |
| idd-py-002 | Command Injection | Critical | CWE-78 | A03:2021 | User input in `os.system()`, `subprocess`, `eval()`, `exec()` |
| idd-py-003 | Path Traversal | High | CWE-22 | A01:2021 | User input in `open()`, `os.path.join()` without validation |
| idd-py-004 | Hardcoded Secrets | Medium | CWE-798 | A07:2021 | Passwords, API keys, tokens as string literals |
| idd-py-005 | Unsafe Deserialization | Critical | CWE-502 | A08:2021 | `pickle.loads()`, `yaml.load()` without SafeLoader |
| idd-py-006 | Missing Auth | Medium | CWE-862 | A01:2021 | Flask/Django routes without `@login_required` |

**Supported Python frameworks:** Flask, Django, FastAPI

### Scoring

Each finding deducts from a base score of 100:

- Critical: -25 points
- High: -15 points
- Medium: -8 points
- Low: -3 points

Grades: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

### Data-Flow Analysis

Security rules use intra-procedural data-flow (taint) analysis to trace whether user input sources actually reach dangerous sinks. This reduces false positives from flagging constant strings or config values that happen to appear near SQL/exec/fs calls.

**How it works:**

1. For each function body, IDD walks variable declarations and assignments
2. Variables assigned from user input (e.g., `const name = req.body.name`) are marked as tainted
3. Taint propagates through reassignment (`const x = name`), destructuring (`const { id } = req.params`), and property access (`body.email`)
4. When a security rule finds a dangerous pattern (SQL template, exec call, fs read), it checks whether the arguments are tainted
5. If arguments are not tainted (constants, config values, internal variables), the finding is suppressed or downgraded

**Limitations:**

- Intra-procedural only: taint is tracked within one function body, not across function calls
- Does not model control flow: if/else branches are treated as both-taken
- Does not track through class fields, closures, or callbacks to other functions
- For cross-function taint tracking, consider supplementing with LLM-based analysis

### Rule Configuration

Create a `.iddrc.json` file in your project root to configure security rules. IDD searches the target directory and its parents for this file.

**Full config example:**

```json
{
  "security": {
    "minSeverity": "medium",
    "customSources": ["ctx.request.body", "event.data"],
    "customSinks": {
      "sql": ["prisma.$queryRaw", "knex.raw"],
      "command": ["shelljs.exec"]
    },
    "customRouterNames": ["api", "v1"],
    "trustedMiddleware": ["rateLimiter", "helmet"],
    "falsePositivePatterns": ["DEMO_KEY", "test_token"],
    "rules": {
      "idd-sec-003": { "enabled": false },
      "idd-sec-004": { "severity": "medium" }
    }
  }
}
```

**Config options:**

| Option | Type | Description |
|---|---|---|
| `minSeverity` | `string` | Filter out findings below this level (`critical`, `high`, `medium`, `low`, `info`) |
| `customSources` | `string[]` | Additional taint source patterns (e.g., `ctx.request.body` for Koa, `event.data` for Lambda) |
| `customSinks.sql` | `string[]` | Additional method names treated as SQL sinks (e.g., `prisma.$queryRaw`) |
| `customSinks.command` | `string[]` | Additional method names treated as command execution sinks |
| `customRouterNames` | `string[]` | Additional object names recognized as HTTP routers for missing-auth checks |
| `trustedMiddleware` | `string[]` | Additional middleware names that count as authentication (for missing-auth rule) |
| `falsePositivePatterns` | `string[]` | Additional strings that indicate a secret value is a placeholder (for hardcoded-secrets rule) |
| `rules.<id>.enabled` | `boolean` | Disable a specific rule by ID |
| `rules.<id>.severity` | `string` | Override the severity of all findings from a rule |

**CLI overrides always win** over file config. For example, `--min-severity critical --disable-rules idd-sec-003` overrides any `.iddrc.json` settings.

**Framework examples:**

Express (default -- works out of the box):
```json
{}
```

Koa:
```json
{
  "security": {
    "customSources": ["ctx.request.body", "ctx.query", "ctx.params"],
    "customRouterNames": ["koaRouter"]
  }
}
```

Fastify:
```json
{
  "security": {
    "customSources": ["request.body", "request.query", "request.params"],
    "customRouterNames": ["fastify"]
  }
}
```

Next.js API routes:
```json
{
  "security": {
    "customSources": ["req.body", "req.query"],
    "rules": {
      "idd-sec-003": { "enabled": false }
    }
  }
}
```

AWS Lambda:
```json
{
  "security": {
    "customSources": ["event.body", "event.queryStringParameters", "event.pathParameters"],
    "rules": {
      "idd-sec-003": { "enabled": false }
    }
  }
}
```

## Output Formats

### Terminal

Colored output with severity-based highlighting. Critical/high findings in red, medium in yellow, low in blue. Includes summary metrics, architecture overview, security findings with file locations, and graph statistics.

### JSON

Complete `IddReport` object with all metadata, components, relationships, graph, architecture, and security data. Pretty-printed with 2-space indentation.

### SARIF 2.1.0

Industry-standard Static Analysis Results Interchange Format. Integrates with GitHub Code Scanning, VS Code SARIF Viewer, and other security tools. Maps findings to SARIF results with rule definitions and severity levels.

### Markdown

Human-readable document with tables and lists. Suitable for documentation, pull request descriptions, or sharing with non-technical stakeholders.

## LLM Enrichment

When `--skip-llm` is not set and `ANTHROPIC_API_KEY` is configured, IDD sends structured analysis summaries to Claude for two enrichments:

1. **Architecture Analysis** -- Identifies layers (presentation, API, business logic, data access, infrastructure), detects patterns (MVC, layered, microservices, etc.), and documents design decisions with rationale
2. **Security Assessment** -- Provides contextual interpretation of findings, prioritized recommendations, and identification of systemic issues

The LLM receives component/relationship summaries and graph statistics, not raw source code. If the API call fails, the report explicitly states the failure reason rather than silently falling back.

## Component Types

| Type | Description |
|---|---|
| `file` | Source files (.ts, .tsx, .js, .jsx, .py) |
| `class` | Class declarations with methods, properties, decorators |
| `function` | Top-level function declarations with parameters and return types |
| `interface` | TypeScript interfaces with property definitions |
| `type-alias` | TypeScript type alias declarations |
| `enum` | Enum declarations |
| `decorator` | Python decorators extracted as first-class components |

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
    index.ts                    # Commander.js program setup + subcommand registration
    quiet-spinner.ts            # Spinner/quiet utility for pipe detection
    commands/
      analyze.ts                # Full analysis pipeline orchestration
      components.ts             # Extract components -> JSON
      graph.ts                  # Build knowledge graph -> JSON
      security.ts               # Security analysis -> JSON (exit code 2)
      schema.ts                 # Output JSON Schema for types
  analyzers/
    typescript/
      index.ts                  # TypeScriptAnalyzer (wraps ts-morph)
    python/
      index.ts                  # PythonAnalyzer (tree-sitter WASM)
      component-extractor.ts    # Python class/function extraction
      relationship-builder.ts   # Python import/call resolution
      security-rules.ts         # 6 Python-specific security rules
      taint-analysis.ts         # Python taint tracking
  core/
    project-loader.ts           # ts-morph Project initialization
    component-extractor.ts      # AST walking, component extraction
    relationship-builder.ts     # Import/call/hierarchy resolution
    graph-builder.ts            # Knowledge graph construction
    security-analyzer.ts        # Security rule orchestration, scoring
    report-assembler.ts         # Final report assembly
    config-loader.ts            # .iddrc.json finder, parser, merger
    language-analyzer.ts        # LanguageAnalyzer interface + factory
    language-detector.ts        # Auto-detect language from file extensions
  security/
    data-flow.ts                # Intra-procedural taint tracking
    rules/
      index.ts                  # Rule interface, registry, runner
      unsanitized-input.ts      # idd-sec-001
      sql-injection.ts          # idd-sec-002
      missing-auth.ts           # idd-sec-003
      hardcoded-secrets.ts      # idd-sec-004
      unsafe-eval.ts            # idd-sec-005
      command-injection.ts      # idd-sec-006
      path-traversal.ts         # idd-sec-007
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
    report.ts                   # IddReport top-level schema
    config.ts                   # CLI configuration types
    index.ts                    # Re-exports
  utils/
    logger.ts                   # Structured logging (debug/info/warn/error)
    id-generator.ts             # Deterministic component/relationship IDs
    errors.ts                   # IddError, ProjectLoadError, AnalysisError, LlmError
    git.ts                      # Git clone wrapper (simple-git)
  index.ts                      # Library API exports
bin/
  idd.js                       # CLI entry point (shebang wrapper)
tests/
  fixtures/
    simple-project/             # Known TS project for positive tests
    security-vulnerable/        # Intentionally vulnerable TS code for security tests
    python-project/             # Clean Python project for positive tests
    python-vulnerable/          # Intentionally vulnerable Python code for security tests
  unit/
    core/                       # Component extractor, relationship builder, graph builder
    security/                   # Security rule tests
    llm/                        # Prompt construction tests
    output/                     # Formatter tests
    utils/                      # ID generator tests
  integration/
    analyze-command.test.ts     # Full pipeline tests
    subcommands.test.ts         # Subcommand tests (components, graph, security, schema)
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

## Environment Setup

Copy `.env.example` to `.env` and set your API key (optional, only needed for LLM enrichment):

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
| web-tree-sitter | WASM tree-sitter bindings | US (GitHub/Zed team) |
| tree-sitter-wasms | Prebuilt language grammars | US |

## Python Support Limitations

- **No type inference**: Python is dynamically typed -- type annotations are extracted if present, otherwise "unknown"
- **No cross-module symbol resolution**: Unlike ts-morph with full type system access, Python import resolution is file-path based
- **Intra-procedural taint only**: Same limitation as TypeScript analysis
- **No virtual env analysis**: Does not inspect installed packages or their source
- **No runtime behavior**: Cannot detect monkey-patching, dynamic imports, or metaclasses

## Installation from npm

```bash
# Install globally
npm install -g idd-cli

# Or use with npx (no install)
npx idd-cli analyze ./my-project --skip-llm
npx idd-cli components ./my-project
npx idd-cli security ./my-project
```
