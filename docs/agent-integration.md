# IDD Agent Integration Guide

This document explains how coding agents (Claude Code, Cursor, Copilot, custom MCP agents, CI/CD bots) can use IDD as a tool. IDD was designed so that every subcommand produces structured, machine-readable output that agents can parse without ambiguity.

## Quick Reference

| Command | What it returns | Output | Exit codes |
|---|---|---|---|
| `idd components <path>` | Components extracted from source | `IddComponent[]` JSON | 0 success, 1 error |
| `idd graph <path>` | Knowledge graph with nodes/edges | `KnowledgeGraph` JSON | 0 success, 1 error |
| `idd security <path>` | Security posture with findings | `SecurityPosture` JSON | 0 clean, 1 error, 2 findings |
| `idd analyze <path>` | Full report (all of the above) | `IddReport` JSON/SARIF/MD | 0 clean, 1 error, 2 findings |
| `idd schema <type>` | JSON Schema for an output type | JSON Schema draft-07 | 0 success, 1 invalid type |

## How It Works for Agents

### Auto-Quiet on Pipe

When stdout is not a TTY (piped to another program, captured by an agent), IDD automatically suppresses all spinner/progress output. Only clean JSON reaches stdout. No `--quiet` flag needed, though you can pass it explicitly.

```bash
# These are equivalent when run by an agent:
idd components ./project
idd components ./project --quiet
```

Spinners and progress messages are written to stderr, so they never contaminate JSON output even in TTY mode for `components`, `graph`, and `security` subcommands.

### Always JSON

The `components`, `graph`, and `security` subcommands always output JSON. There is no `--format` flag on these commands. This eliminates a class of agent errors where the wrong format is requested or parsed.

Only `analyze` has `--format` because it supports terminal, JSON, SARIF, and Markdown output. When agents use `analyze`, pass `--format json`.

### Schema Introspection

Before calling a subcommand, an agent can discover the exact output shape:

```bash
# What fields does a IddComponent have?
idd schema components

# What does SecurityPosture look like?
idd schema security

# Full report structure?
idd schema report
```

This returns a JSON Schema (draft-07) object describing every field, type, and enum value. Agents can use this to validate output or generate typed parsers without hardcoding assumptions about the schema.

### Exit Code Semantics

IDD uses exit codes to communicate results without requiring JSON parsing:

| Code | Meaning |
|---|---|
| 0 | Success. For `security` and `analyze`: no findings above the severity threshold. |
| 1 | Error. The path was invalid, parsing failed, or a runtime error occurred. |
| 2 | Security findings exist above the configured severity threshold. JSON is still valid on stdout. |

This allows agents to gate on security with a simple check:

```bash
idd security ./project --quiet
if [ $? -eq 2 ]; then
  echo "Security issues found"
fi
```

---

## Subcommand Details

### `idd components <path>`

Runs: language detection -> project loading -> component extraction.

Returns a JSON array of `IddComponent` objects.

**Example output (truncated):**

```json
[
  {
    "id": "file-src/index.ts",
    "name": "index.ts",
    "type": "file",
    "filePath": "/absolute/path/src/index.ts",
    "startLine": 1,
    "endLine": 42,
    "metadata": {
      "loc": 42,
      "isExported": false,
      "isDefault": false
    }
  },
  {
    "id": "class-UserService",
    "name": "UserService",
    "type": "class",
    "filePath": "/absolute/path/src/services/user.ts",
    "startLine": 5,
    "endLine": 48,
    "metadata": {
      "loc": 44,
      "isExported": true,
      "isDefault": false,
      "methods": [
        {
          "name": "findById",
          "parameters": [{ "name": "id", "type": "string", "isOptional": false }],
          "returnType": "Promise<User>",
          "visibility": "public",
          "isStatic": false,
          "isAsync": true
        }
      ],
      "properties": [
        {
          "name": "db",
          "type": "Database",
          "visibility": "private",
          "isStatic": false,
          "isReadonly": true
        }
      ]
    }
  }
]
```

**Component types:** `file`, `class`, `function`, `interface`, `type-alias`, `enum`, `module`, `decorator`.

**Common agent tasks:**

```bash
# List all class names
idd components ./project | jq '[.[] | select(.type == "class") | .name]'

# Find exported functions
idd components ./project | jq '[.[] | select(.type == "function" and .metadata.isExported) | .name]'

# Get LOC per file
idd components ./project | jq '[.[] | select(.type == "file") | {name, loc: .metadata.loc}]'

# Find classes with more than 5 methods
idd components ./project | jq '[.[] | select(.type == "class" and (.metadata.methods | length) > 5) | .name]'

# Count components by type
idd components ./project | jq 'group_by(.type) | map({type: .[0].type, count: length})'
```

### `idd graph <path>`

Runs: language detection -> project loading -> component extraction -> relationship building -> graph construction.

Returns a `KnowledgeGraph` JSON object.

**Example output (truncated):**

```json
{
  "nodes": [
    {
      "id": "class-UserService",
      "label": "UserService",
      "type": "class",
      "group": "services",
      "size": 4.2,
      "metadata": {
        "filePath": "/absolute/path/src/services/user.ts",
        "startLine": 5,
        "endLine": 48,
        "loc": 44,
        "isExported": true
      }
    }
  ],
  "edges": [
    {
      "id": "rel-imports-index-user",
      "source": "file-src/index.ts",
      "target": "file-src/services/user.ts",
      "type": "imports",
      "weight": 2,
      "metadata": {
        "importSpecifiers": ["UserService"]
      }
    }
  ],
  "clusters": [
    {
      "id": "cluster-services",
      "label": "services",
      "nodeIds": ["class-UserService", "file-src/services/user.ts"]
    }
  ],
  "circularDependencies": []
}
```

**Edge types:** `imports`, `exports`, `extends`, `implements`, `calls`, `uses-type`, `contains`, `depends-on`.

**Common agent tasks:**

```bash
# Check for circular dependencies
idd graph ./project | jq '.circularDependencies'

# Count nodes and edges
idd graph ./project | jq '{nodes: (.nodes | length), edges: (.edges | length)}'

# Find the most connected nodes (hub components)
idd graph ./project | jq '
  .edges as $edges |
  .nodes | map({
    name: .label,
    connections: ([$edges[] | select(.source == .id or .target == .id)] | length)
  }) | sort_by(-.connections) | .[0:5]'

# List all import relationships
idd graph ./project | jq '[.edges[] | select(.type == "imports") | {from: .source, to: .target}]'

# Get all clusters (directory groupings)
idd graph ./project | jq '[.clusters[] | {dir: .label, count: (.nodeIds | length)}]'
```

### `idd security <path>`

Runs: language detection -> project loading -> security analysis.

Returns a `SecurityPosture` JSON object.

**Example output (truncated):**

```json
{
  "score": 25,
  "grade": "F",
  "findings": [
    {
      "id": "finding-idd-sec-002-server.ts-15",
      "ruleId": "idd-sec-002",
      "severity": "critical",
      "title": "SQL Injection",
      "description": "Template literal used in SQL query with potentially tainted input",
      "filePath": "/absolute/path/src/server.ts",
      "startLine": 15,
      "endLine": 15,
      "snippet": "db.query(`SELECT * FROM users WHERE id = ${req.params.id}`)",
      "recommendation": "Use parameterized queries instead of string interpolation",
      "cweId": "CWE-89",
      "owaspCategory": "A03:2021"
    }
  ],
  "rules": [
    {
      "id": "idd-sec-002",
      "name": "SQL Injection",
      "description": "Detects potential SQL injection via template literals or string concatenation",
      "severity": "critical",
      "cweId": "CWE-89",
      "owaspCategory": "A03:2021"
    }
  ],
  "summary": "Security analysis found 8 issues (3 critical, 2 high, 3 medium)"
}
```

**Exit codes:** 0 = clean (no findings), 1 = error, 2 = findings found above threshold.

**Common agent tasks:**

```bash
# Simple pass/fail gate
idd security ./project --quiet
echo "Exit code: $?"

# Get just the grade
idd security ./project | jq '.grade'

# List critical findings with locations
idd security ./project | jq '[.findings[] | select(.severity == "critical") | {title, file: .filePath, line: .startLine}]'

# Get findings grouped by rule
idd security ./project | jq '.findings | group_by(.ruleId) | map({rule: .[0].ruleId, count: length, severity: .[0].severity})'

# Filter to high severity and above
idd security ./project --min-severity high | jq '.findings | length'

# Disable noisy rules
idd security ./project --disable-rules idd-sec-003,idd-sec-004 | jq '.grade'

# Get actionable fix list: file, line, what to fix
idd security ./project | jq '[.findings[] | {file: .filePath, line: .startLine, issue: .title, fix: .recommendation}]'
```

### `idd schema <type>`

Returns a JSON Schema (draft-07) describing the output shape of a subcommand. No project path needed.

**Valid types:** `components`, `graph`, `security`, `report`.

```bash
# Get component schema
idd schema components

# Get all field names for SecurityPosture
idd schema security | jq '.properties | keys'

# Get all severity enum values
idd schema security | jq '.properties.findings.items.properties.severity.enum'

# Get the full report schema including all nested types
idd schema report
```

### `idd analyze <path>`

Full analysis pipeline. For agent use, always pass `--format json` and `--skip-llm` (unless you specifically want AI enrichment and have `ANTHROPIC_API_KEY` set).

```bash
# Full static analysis as JSON
idd analyze ./project --skip-llm --format json

# Extract specific sections
idd analyze ./project --skip-llm --format json | jq '.security'
idd analyze ./project --skip-llm --format json | jq '.graph'
idd analyze ./project --skip-llm --format json | jq '.components'
```

For most agent workflows, prefer the granular subcommands (`components`, `graph`, `security`) over `analyze`. They run faster because they skip unused pipeline phases, and their output is the exact type you need rather than a nested report.

---

## Integration Patterns

### Pattern 1: Security Gate in CI/CD

Use `idd security` as a CI step that fails the build when findings exist.

```yaml
# GitHub Actions example
- name: Security scan
  run: |
    npx idd security . --min-severity high --quiet
    if [ $? -eq 2 ]; then
      echo "::error::IDD found high/critical security issues"
      npx idd security . --min-severity high | jq '.findings[] | "::error file=\(.filePath),line=\(.startLine)::\(.title): \(.description)"' -r
      exit 1
    fi
```

### Pattern 2: Pre-Commit Security Check

```bash
#!/bin/bash
# .git/hooks/pre-commit
idd security . --min-severity critical --quiet 2>/dev/null
if [ $? -eq 2 ]; then
  echo "Blocked: critical security findings detected"
  idd security . --min-severity critical 2>/dev/null | jq '.findings[] | "\(.severity): \(.title) at \(.filePath):\(.startLine)"' -r
  exit 1
fi
```

### Pattern 3: Codebase Understanding for an Agent

When an agent needs to understand a project before making changes:

```bash
# Step 1: Get the component inventory
COMPONENTS=$(idd components ./project)

# Step 2: Check for circular dependencies
CYCLES=$(idd graph ./project | jq '.circularDependencies')

# Step 3: Get security posture
SECURITY=$(idd security ./project)
GRADE=$(echo "$SECURITY" | jq -r '.grade')

# Step 4: Use the data to inform decisions
echo "Components: $(echo "$COMPONENTS" | jq 'length')"
echo "Circular deps: $(echo "$CYCLES" | jq 'length')"
echo "Security grade: $GRADE"
```

### Pattern 4: SARIF Upload to GitHub Code Scanning

```yaml
- name: IDD Security Scan
  run: idd analyze . --skip-llm --format sarif -o results.sarif --quiet
  continue-on-error: true

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

### Pattern 5: Monitoring Component Growth

Track component counts over time to detect codebase bloat:

```bash
# Record snapshot
DATE=$(date +%Y-%m-%d)
COUNTS=$(idd components ./project | jq '{
  total: length,
  files: [.[] | select(.type == "file")] | length,
  classes: [.[] | select(.type == "class")] | length,
  functions: [.[] | select(.type == "function")] | length
}')
echo "$DATE $COUNTS" >> metrics.jsonl
```

### Pattern 6: Comparing Security Between Branches

```bash
# Scan main
git stash
MAIN_SCORE=$(idd security . | jq '.score')

# Scan current changes
git stash pop
BRANCH_SCORE=$(idd security . | jq '.score')

if [ "$BRANCH_SCORE" -lt "$MAIN_SCORE" ]; then
  echo "Security score decreased: $MAIN_SCORE -> $BRANCH_SCORE"
fi
```

---

## Claude Code Skills

IDD ships with two ready-to-use [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code) that turn the CLI into interactive agent workflows. Skills are slash commands that Claude Code executes with full context awareness -- they run IDD, parse the structured output, and act on it.

### Installing the Skills

Copy the skill directories to your Claude Code skills folder:

```bash
# User-level (available in all projects)
mkdir -p ~/.claude/skills/idd-security
mkdir -p ~/.claude/skills/idd-diagram
cp docs/skills/idd-security.md ~/.claude/skills/idd-security/SKILL.md
cp docs/skills/idd-diagram.md ~/.claude/skills/idd-diagram/SKILL.md
```

Or create them manually using the examples below.

### Skill 1: `/idd-security` -- Scan, Report, Fix

Invocation: `/idd-security ./path/to/project`

This skill runs a full security scan, presents findings grouped by severity, and offers to fix them. After applying fixes, it re-scans to verify the issues are resolved.

**Workflow:**
1. Runs `idd security <path> --quiet`
2. Checks exit code (0 = clean, 2 = findings)
3. Parses `SecurityPosture` JSON and presents findings by severity
4. Asks user which findings to fix (all, critical/high only, specific ones, or skip)
5. Reads source files, applies fixes based on CWE and recommendation
6. Re-scans to verify the fixes

**Full SKILL.md:**

```yaml
---
name: idd-security
description: Run IDD security analysis on a project, parse findings, and offer
  to fix them. Use when the user wants to scan a codebase for security vulnerabilities.
---
```

```markdown
# IDD Security Scan

Run a security scan on the target project using IDD and act on the results.

## Arguments

The user may provide a path as an argument. If no path is provided, use the
current working directory (`.`).

## Steps

### 1. Run the security scan

Run the IDD security scanner on the target path:

    idd security <path> --quiet 2>/dev/null

Capture both the JSON output and the exit code.

- **Exit 0**: No security findings. Report that the project is clean and stop.
- **Exit 1**: Error running IDD. Report the error from stderr and stop.
- **Exit 2**: Security findings detected. Continue to step 2.

### 2. Parse and present findings

Parse the JSON output (which is a `SecurityPosture` object) and present findings
grouped by severity in descending order (critical first, then high, medium, low,
info).

For each finding, show:
- Severity and title
- File path and line number
- Code snippet
- CWE ID if available
- Recommendation

Also show the overall score and grade at the top.

### 3. Offer to fix

After presenting findings, ask the user which findings they want to fix. Options:
- Fix all findings
- Fix only critical/high severity
- Fix specific findings by number
- Skip (just report)

### 4. Apply fixes

For each finding the user wants fixed:
1. Read the file at the specified path and line
2. Understand the vulnerability from the finding description and CWE
3. Apply the recommended fix (use parameterized queries for SQL injection,
   sanitize input, use path validation, etc.)
4. Do NOT introduce new issues while fixing

### 5. Re-scan

After applying fixes, run the security scan again to verify:

    idd security <path> --quiet 2>/dev/null

Report the updated score/grade and any remaining findings.

## Important

- Always read the actual source file before attempting a fix.
- Never suppress or hide findings.
- Do not disable security rules as a "fix".
- If IDD is not installed, tell the user to install it: `npm install -g idd-cli`
```

### Skill 2: `/idd-diagram` -- System Design Visualization

Invocation: `/idd-diagram ./path/to/project`

This skill analyzes a codebase and generates a Mermaid system design diagram with components grouped into layers, relationship edges, circular dependency highlights, and a security grade annotation.

**Workflow:**
1. Runs `idd components`, `idd graph`, and `idd security` in parallel
2. Groups components into subgraphs by directory cluster
3. Selects diagram layout based on project size (TD for small, LR for large)
4. Generates Mermaid syntax with typed node shapes and labeled edges
5. Saves as `system-design.md` with metrics and legend

**Node shapes by type:**

| Component Type | Mermaid Shape | Example |
|---|---|---|
| Class | `["Name"]` rectangle | `UserService["UserService (class)"]` |
| Interface | `(("Name"))` circle | `IAuth(("IAuth (interface)"))` |
| Function | `["name()"]` rectangle | `handleRequest["handleRequest()"]` |
| Enum | `{{"Name"}}` hexagon | `Status{{"Status (enum)"}}` |

**Edge styles by relationship:**

| Relationship | Mermaid Syntax |
|---|---|
| imports | `-->` solid arrow |
| extends | `-->\|extends\|` labeled solid |
| implements | `-.->\|implements\|` labeled dashed |
| calls | `-->\|calls\|` labeled solid |

**Full SKILL.md:**

```yaml
---
name: idd-diagram
description: Generate a system design diagram from a codebase using IDD analysis.
  Use when the user wants to visualize project architecture, component relationships,
  or system structure.
---
```

```markdown
# IDD System Design Diagram

Analyze a codebase with IDD and generate a Mermaid system design diagram showing
components, relationships, layers, and clusters.

## Arguments

The user may provide:
- A path as the first argument. If no path is provided, use `.`.
- An optional focus: "full", "imports", "classes", "security". Default is "full".

## Steps

### 1. Gather data

Run three IDD commands to collect all the data needed:

    COMPONENTS=$(idd components <path> --quiet 2>/dev/null)
    GRAPH=$(idd graph <path> --quiet 2>/dev/null)
    SECURITY=$(idd security <path> --quiet 2>/dev/null)

If any command fails (exit 1), report the error and stop.

### 2. Analyze the structure

From the JSON data, identify:
- **Clusters**: Group by directory (from graph.clusters) -> subgraphs
- **Key components**: Classes, interfaces, exported functions. Filter out
  file-level components to reduce noise.
- **Relationships**: Prioritize extends/implements/imports. Only include calls
  if the diagram would otherwise be sparse.
- **Circular dependencies**: Highlight in red.
- **Security grade**: Annotate on diagram.

### 3. Generate the Mermaid diagram

- Fewer than 20 components: `graph TD`
- 20-50 components: `graph LR`
- 50+ components: `graph LR` with only classes/interfaces and most-connected
  functions

### 4. Create the output file

Save as `system-design.md` in the target project root with:
- Header with project path, component count, date
- Mermaid diagram in a fenced code block
- Legend explaining node shapes and edge styles
- Key metrics: components, relationships, clusters, circular deps, security
  grade, top 5 hub components

### 5. Present to the user

Show the diagram inline, mention it renders in GitHub and VS Code, and call out
any circular dependencies as architectural concerns.

## Diagram Quality Rules

- Max 30 visible nodes. Beyond that, show function counts per cluster.
- Use component names, not IDs.
- Place infrastructure at bottom, API at top, business logic in middle.
- Collapse 5+ edges between clusters into a single counted edge.

## Important

- If IDD is not installed, tell the user: `npm install -g idd-cli`
- Do not invent components or relationships. Only use what IDD reports.
- The diagram must be valid Mermaid syntax.
```

### Writing Your Own Skills

Any agent workflow that consumes IDD JSON output can be wrapped as a skill. The pattern is:

1. Run a IDD subcommand with `--quiet` to get clean JSON
2. Parse the JSON output (the agent does this natively)
3. Act on the structured data (fix code, generate docs, create diagrams, etc.)

The `idd schema <type>` command is useful here -- an agent can call it to learn the output shape before writing parsing logic.

**Skill ideas:**
- `/idd-refactor` -- Find the most complex components and suggest refactoring
- `/idd-docs` -- Generate API documentation from extracted components
- `/idd-review` -- Run security + graph analysis as part of a PR review
- `/idd-onboard` -- Generate a "new developer guide" from graph clusters and component descriptions

---

## TypeScript/Node.js Library API

For agents that run in a Node.js process, IDD exports its full analysis pipeline as a library:

```typescript
import {
  detectLanguage,
  createAnalyzer,
  buildGraph,
  loadSecurityConfig,
} from 'idd-cli';

// Components only
const language = detectLanguage('./project');
const analyzer = await createAnalyzer(language);
await analyzer.loadProject('./project');
const components = analyzer.extractComponents();

// Graph
const relationships = analyzer.buildRelationships(components);
const graph = buildGraph(components, relationships);

// Security
const config = loadSecurityConfig({ targetDir: './project' });
const security = analyzer.analyzeSecurityPosture(config);
```

Each function returns typed objects (`IddComponent[]`, `KnowledgeGraph`, `SecurityPosture`) that match the JSON output of the CLI subcommands exactly.

---

## Security Rule Reference

### TypeScript/JavaScript Rules

| Rule ID | Name | Severity | CWE | Detects |
|---|---|---|---|---|
| idd-sec-001 | Unsanitized Input | High | CWE-79 | `req.body`/`req.query` flowing to `innerHTML`, `.query()` |
| idd-sec-002 | SQL Injection | Critical | CWE-89 | Template literals building SQL queries |
| idd-sec-003 | Missing Auth | High | CWE-306 | Route handlers without auth middleware |
| idd-sec-004 | Hardcoded Secrets | Critical | CWE-798 | API keys, passwords as string literals |
| idd-sec-005 | Unsafe Eval | Critical | CWE-95 | `eval()`, `Function()`, `innerHTML`, `document.write()` |
| idd-sec-006 | Command Injection | Critical | CWE-78 | Dynamic input in `exec()`, `execSync()`, `spawn()` |
| idd-sec-007 | Path Traversal | High | CWE-22 | User input in `readFile()`, `writeFile()` |

### Python Rules

| Rule ID | Name | Severity | CWE | Detects |
|---|---|---|---|---|
| idd-py-001 | SQL Injection | High | CWE-89 | f-strings in `cursor.execute()`, `db.execute()` |
| idd-py-002 | Command Injection | Critical | CWE-78 | Input in `os.system()`, `subprocess`, `eval()` |
| idd-py-003 | Path Traversal | High | CWE-22 | Input in `open()`, `os.path.join()` |
| idd-py-004 | Hardcoded Secrets | Medium | CWE-798 | Passwords, API keys as string literals |
| idd-py-005 | Unsafe Deserialization | Critical | CWE-502 | `pickle.loads()`, `yaml.load()` without SafeLoader |
| idd-py-006 | Missing Auth | Medium | CWE-862 | Flask/Django routes without `@login_required` |

### Severity Scoring

| Severity | Score Deduction |
|---|---|
| Critical | -25 |
| High | -15 |
| Medium | -8 |
| Low | -3 |
| Info | 0 |

Grades: A (90-100), B (80-89), C (70-79), D (60-69), F (<60).

---

## Configuration for Agents

Agents can control IDD behavior through CLI flags or a `.iddrc.json` file placed in the target project directory.

### CLI Flags (Recommended for Agents)

CLI flags are deterministic and do not depend on file system state:

```bash
# Only report critical and high findings
idd security ./project --min-severity high

# Disable specific rules
idd security ./project --disable-rules idd-sec-003,idd-sec-004

# Explicit language (skip auto-detection)
idd components ./project --language python

# Custom config file
idd security ./project --config /path/to/.iddrc.json
```

### .iddrc.json (For Project-Level Defaults)

Place this in the project root for persistent configuration:

```json
{
  "security": {
    "minSeverity": "medium",
    "rules": {
      "idd-sec-003": { "enabled": false }
    },
    "customSources": ["ctx.request.body"],
    "trustedMiddleware": ["rateLimiter"],
    "falsePositivePatterns": ["DEMO_KEY"]
  }
}
```

CLI flags always override `.iddrc.json` values.

---

## Error Handling

When IDD exits with code 1, stderr contains a human-readable error message. Common errors:

| Error | Cause | Fix |
|---|---|---|
| `Target path does not exist: /path` | Invalid path argument | Verify the path exists before calling |
| `Config file not found: /path` | Explicit `--config` points to missing file | Check config path or remove the flag |
| `Invalid JSON in /path/.iddrc.json` | Malformed config file | Validate the JSON syntax |
| `Unsupported language: xyz` | Invalid `--language` value | Use `typescript`, `python`, or `auto` |

Agents should check the exit code first, then parse stdout only on exit 0 or 2. Exit 1 means stdout may be empty or incomplete.

---

## Limitations

Things IDD does not do that agents should be aware of:

- **No runtime analysis**: IDD is static analysis only. It cannot detect issues that depend on runtime state, environment variables, or dynamic imports.
- **Intra-procedural taint only**: Data flow is tracked within a single function body. Taint across function calls, class fields, or callbacks is not tracked.
- **No dependency scanning**: IDD analyzes your source code, not your `node_modules` or `pip` packages. Use tools like `npm audit` or `safety` for dependency vulnerabilities.
- **No auto-fix**: IDD reports findings but does not generate patches. Agents must interpret findings and write fixes.
- **Python type inference**: Python is dynamically typed. Type annotations are extracted if present, otherwise reported as "unknown".
- **Single-language projects**: Each analysis run handles one language. For monorepos with both TS and Python, run IDD separately on each subtree.
