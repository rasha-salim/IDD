---
name: idd-analyze
description: Run full IDD codebase analysis with architecture overview, security posture, and knowledge graph stats. Use when the user wants a comprehensive project assessment.
---

# IDD Full Codebase Analysis

Run a comprehensive analysis on a project and present a structured overview covering components, architecture, security, and dependency graph.

## Arguments

The user may provide a path as an argument. If no path is provided, use the current working directory (`.`).

## Steps

### 1. Run the analysis

Run the full IDD analysis pipeline in static-only mode for speed:

```
REPORT=$(idd analyze <path> --skip-llm --format json -q 2>/dev/null)
```

Check the exit code:
- **Exit 0**: Analysis complete, no security findings. Continue to step 2.
- **Exit 1**: Error running IDD. Report the error from stderr and stop.
- **Exit 2**: Analysis complete, security findings detected. Continue to step 2.

### 2. Present the overview

Parse the JSON report and present a structured overview:

**Project Summary:**
- Total files analyzed and primary language
- Component count by type (classes, functions, interfaces, enums, type aliases)
- Relationship count by type (imports, extends, implements, calls)

**Graph Statistics:**
- Total nodes and edges
- Number of clusters (directory groupings)
- Circular dependencies (count and list if any)
- Top 5 hub components (most connections)

**Security Posture:**
- Grade and score (e.g., "Grade B - 85/100")
- Finding count by severity (critical, high, medium, low, info)
- Summary of most common finding categories

### 3. Offer deep dives

After presenting the overview, offer the user targeted follow-ups:

- **Security details** -- Hand off to `/idd-security` for interactive finding review and fixes
- **Dependency graph** -- Hand off to `/idd-graph` for graph exploration and circular dependency analysis
- **Architecture diagram** -- Hand off to `/idd-diagram` for visual system design
- **Export** -- Save the report in a specific format:
  - JSON: `idd analyze <path> --skip-llm --format json -o report.json -q 2>/dev/null`
  - SARIF: `idd analyze <path> --skip-llm --format sarif -o results.sarif -q 2>/dev/null`
  - Markdown: `idd analyze <path> --skip-llm --format markdown -o report.md -q 2>/dev/null`

### 4. Handle exports

If the user requests an export, run the appropriate command and confirm the output file was created.

### 5. Optional LLM enrichment

If the user wants deeper architectural analysis powered by AI, re-run without `--skip-llm`:

```
ENRICHED=$(idd analyze <path> --format json -q 2>/dev/null)
```

This requires `ANTHROPIC_API_KEY` to be set. The enriched report adds:
- Architecture layer identification (presentation, API, business logic, data access, infrastructure)
- Pattern detection (MVC, layered, microservices, etc.)
- Design decision documentation with rationale
- Contextual security assessment

## Important

- **Start with `--skip-llm`** for fast results. Only use LLM enrichment if the user explicitly wants it.
- **For large projects (100+ components)**, summarize by cluster rather than listing every component. Show cluster names, component counts, and cross-cluster relationships.
- If IDD is not installed, tell the user to install it: `npm install -g idd-cli`
