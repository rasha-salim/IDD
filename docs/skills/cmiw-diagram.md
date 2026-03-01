---
name: cmiw-diagram
description: Generate a system design diagram from a codebase using CMIW analysis. Use when the user wants to visualize project architecture, component relationships, or system structure.
---

# CMIW System Design Diagram

Analyze a codebase with CMIW and generate a Mermaid system design diagram showing components, relationships, layers, and clusters.

## Arguments

The user may provide:
- A path as the first argument. If no path is provided, use the current working directory (`.`).
- An optional focus: "full", "imports", "classes", "security". Default is "full".

## Steps

### 1. Gather data

Run three CMIW commands to collect all the data needed for the diagram. Capture the JSON output of each:

```bash
COMPONENTS=$(cmiw components <path> --quiet 2>/dev/null)
GRAPH=$(cmiw graph <path> --quiet 2>/dev/null)
SECURITY=$(cmiw security <path> --quiet 2>/dev/null)
```

If any command fails (exit 1), report the error and stop. If CMIW is not installed, tell the user: `npm install -g cmiw-cli`.

### 2. Analyze the structure

From the JSON data, identify:

- **Clusters**: Group components by directory (from `graph.clusters`). These become subgraphs in the diagram.
- **Key components**: Classes, interfaces, and exported functions (from `components`). Filter out file-level components to reduce noise -- only include files that have no child class/function components.
- **Relationships**: Import edges, extends/implements edges, and call edges (from `graph.edges`). Prioritize `extends`, `implements`, and `imports` edges. Only include `calls` edges if the diagram would otherwise be sparse.
- **Circular dependencies**: From `graph.circularDependencies`. Highlight these in the diagram.
- **Security grade**: From `security.grade` and `security.score`. Show as annotation.

### 3. Generate the Mermaid diagram

Create a Mermaid diagram following these rules:

**Diagram type selection:**
- If the project has fewer than 20 key components: use `graph TD` (top-down flowchart)
- If the project has 20-50 key components: use `graph LR` (left-right flowchart)
- If the project has 50+ key components: use `graph LR` but only show classes, interfaces, and the most-connected functions. Add a note about omitted components.

**Subgraphs for clusters:**
```mermaid
subgraph services["Services Layer"]
    UserService["UserService (class)"]
    AuthService["AuthService (class)"]
end
```

**Node shapes by component type:**
- Classes: `["ClassName"]` (rectangle)
- Interfaces: `(("InterfaceName"))` (circle)
- Functions: `["functionName()"]` (rectangle)
- Enums: `{{"EnumName"}}` (hexagon)

**Edge styles by relationship type:**
- `imports`: `-->` solid arrow
- `extends`: `-->|extends|` labeled solid arrow
- `implements`: `-.->|implements|` labeled dashed arrow
- `calls`: `-->|calls|` labeled solid arrow (only if diagram is sparse)

**Circular dependencies:**
If circular dependencies exist, highlight them with `linkStyle` in red and add a note.

**Security annotation:**
Add the security grade as a note on the diagram:
```
note["Security: A (100/100)"]
```

### 4. Create the output file

Save the diagram as a Markdown file with the Mermaid code block:

- File name: `system-design.md` in the target project root
- Include a header with project path, component count, and generation date
- Include the Mermaid diagram in a ```mermaid code block
- Below the diagram, include a legend explaining node shapes and edge styles
- Include a "Key Metrics" section with:
  - Total components and relationships
  - Number of clusters
  - Circular dependencies (list them if any)
  - Security grade and score
  - Top 5 most-connected components (hub components)

### 5. Present to the user

After creating the file:
1. Tell the user where the file was saved
2. Show the Mermaid diagram inline so they can preview it
3. Mention that the diagram renders in GitHub, VS Code (with Mermaid extension), and other Markdown viewers
4. If circular dependencies were found, call them out explicitly as architectural concerns

## Diagram Quality Rules

- **Do not overcrowd**: If there are more than 30 nodes, prioritize classes and interfaces over functions. Show function count per cluster instead of individual function nodes.
- **Meaningful labels**: Use component names, not IDs. Add type annotations in parentheses: `UserService (class)`, `IAuth (interface)`.
- **Logical ordering**: Place infrastructure/utility clusters at the bottom, API/presentation at the top, business logic in the middle.
- **Keep edges readable**: If two clusters have more than 5 edges between them, collapse them into a single thick edge with a count label: `-->|"12 imports"|`.

## Important

- If CMIW is not installed, tell the user to install it: `npm install -g cmiw-cli`
- Do not invent components or relationships. Only use what CMIW reports.
- The diagram must be valid Mermaid syntax. Test by reviewing the output for syntax errors before saving.
- If the project is very small (fewer than 3 components), note that the diagram may not be very useful and suggest running on a larger project.
