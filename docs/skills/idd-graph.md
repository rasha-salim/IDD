---
name: idd-graph
description: Explore the knowledge graph of a codebase -- dependencies, clusters, circular deps, hub components, and structural patterns. Use when the user wants to understand how components connect.
---

# IDD Knowledge Graph Exploration

Build and explore the knowledge graph of a codebase, highlighting circular dependencies, hub components, cluster relationships, and structural patterns.

## Arguments

The user may provide a path as an argument. If no path is provided, use the current working directory (`.`).

## Steps

### 1. Build the graph

Run the IDD graph command:

```
GRAPH=$(idd graph <path> -q 2>/dev/null)
```

If the command fails (exit 1), report the error and stop.

### 2. Present the overview

Parse the JSON output and present:

- **Total nodes** and breakdown by type (class, function, interface, file, enum)
- **Total edges** and breakdown by type (imports, extends, implements, calls)
- **Clusters**: Count and names (directory groupings)

### 3. Highlight circular dependencies

If `circularDependencies` is non-empty:

For each cycle:
- Show the full cycle path: `A -> B -> C -> A`
- Explain the impact: why this cycle makes the code harder to change, test, or deploy independently
- Suggest resolution strategies specific to the cycle:
  - **Extract interface**: When classes depend on each other's concrete types
  - **Dependency injection**: When one class creates instances of another
  - **Event-driven decoupling**: When the dependency is for notifications or side effects
  - **Extract common module**: When both depend on shared logic that should be its own module

If no circular dependencies exist, state that the dependency graph is acyclic.

### 4. Identify hub components

Find the top 10 most-connected components:

For each hub:
- Name and type
- Total connections (inbound + outbound)
- Inbound count (other components depend on this)
- Outbound count (this depends on other components)
- Cross-cluster connections (connections to components in different clusters)

### 5. Analyze cluster relationships

For each pair of clusters that have edges between them:
- Count of edges between the pair
- Direction breakdown (A -> B vs B -> A)
- Flag high-coupling pairs (5+ edges between them)

Also identify:
- Isolated clusters (no edges to other clusters)
- One-way dependencies (cluster A depends on B but B never depends on A -- good layering)

### 6. Identify structural patterns

Based on the graph topology:

- **Layered architecture**: Clusters with one-way dependencies forming layers (presentation -> business -> data)
- **Star topology**: One central hub cluster with many satellite clusters depending on it
- **Island components**: Components with zero connections (dead code candidates)
- **Facade pattern**: Components with many inbound connections but few outbound (likely API surfaces)

### 7. Offer follow-ups

After the exploration, offer:

- **Deep dive into a specific cluster** -- List components within it and their internal relationships
- **Trace a dependency chain** -- Follow the path from component A to component B through the graph
- **Generate architecture diagram** -- Hand off to `/idd-diagram`
- **Fix circular dependencies** -- Read the source files involved and suggest concrete refactoring
- **Open interactive viewer** -- Run `idd viewer` to explore the graph visually in the browser

## Important

- **For projects with 200+ nodes**, summarize by cluster rather than listing every node. Show cluster-level statistics and only drill into specific clusters on request.
- **Distinguish utility hubs from orchestrator hubs.** A utility module (like `utils/` or `types/`) having many inbound connections is normal and expected. An orchestrator (like `AppController`) having 20+ outbound connections may indicate a Single Responsibility Principle violation.
- If IDD is not installed, tell the user to install it: `npm install -g idd-cli`
- Do not invent graph data. Only use what IDD reports.
