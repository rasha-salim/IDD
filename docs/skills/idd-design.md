---
name: idd-design
description: Run the full IDD methodology interactively -- decompose a task, explore options, decide on approach, generate architecture diagram. Use when the user wants to design a solution before writing code.
---

# IDD Interactive Design Workflow

Walk the user through the full Intent-Driven Development design methodology, phase by phase. Each phase builds on the previous one. The user reviews and confirms before moving to the next phase.

No API keys or external tools are required. You perform all reasoning directly.

## Arguments

The user provides a task description as the argument. Example: `/idd-design "Add user authentication with OAuth2"`

## Steps

### 1. Decompose (Phase 1)

Break the task into components and surface hidden assumptions.

Present to the user:

```
## Task: [restate what the user wants in one sentence]

## Components
1. [Component name] -- [what it does]
2. [Component name] -- [what it does]
3. ...

## Assumptions I'm making (correct me if wrong)
- [anything you're inferring that wasn't explicitly stated]
- [default behaviors you'd choose without asking]
- [scope boundaries: what you think is included vs excluded]
```

Rules:
- If the task is a single component with no meaningful choices, say so and skip to Phase 4
- Never hide assumptions. If you're choosing between two reasonable interpretations, surface it
- List assumptions as falsifiable statements the human can correct

Ask the user to confirm, modify components, or correct assumptions. Wait for confirmation before proceeding.

### 2. Options (Phase 2)

For each component where multiple valid approaches exist, present options. Not every component needs this -- only where the choice materially affects the result.

Present to the user:

```
## [Component name]

### Option A: [name]
How: [1-2 sentence description]
+ [concrete advantage specific to this task]
+ [concrete advantage specific to this task]
- [concrete disadvantage specific to this task]
- [concrete disadvantage specific to this task]

### Option B: [name]
How: [1-2 sentence description]
+ ...
- ...

### Recommendation: [which and why, in one sentence]
```

Rules:
- Maximum 3 options per component. Pre-filter to the most relevant
- Pros and cons must be concrete and specific. "Scales better" is useless. "Handles 10k+ orders without memory issues" is useful
- Always include a recommendation. Do not artificially balance options to seem neutral
- Consider: dependencies, complexity, maintenance burden, security implications, performance

Ask the user to confirm recommendations or choose differently. Wait for confirmation before proceeding.

### 3. Decide (Phase 3)

Summarize all decisions in a table.

Present to the user:

```
## Proposed approach

| Component | Choice | Reason |
|-----------|--------|--------|
| Auth | Session-based | Personal app, simplicity wins |
| Storage | SQLite | Single user, no server needed |
| ... | ... | ... |

Anything you'd change before I start building?
```

Rules:
- If the user changes a choice, check whether it affects other components. Flag cascading impacts
- If the user says "just go with your recommendations," proceed

Wait for confirmation before proceeding.

### 4. Diagram (Phase 3.5)

Generate a Mermaid architecture diagram based on the confirmed decisions.

The diagram should show:
- Components as nodes (use appropriate shapes: rectangles for services, circles for interfaces, hexagons for data stores)
- Relationships between components as labeled edges
- Grouping into subgraphs where logical (e.g., frontend/backend/database layers)

Present the Mermaid diagram inline.

### 5. Save and next steps

Offer the user these options:
- Save the full design document as a markdown file (combine all phases into one document)
- Start implementing based on the design decisions
- Modify any phase and re-run from that point

If saving, write a markdown file that includes:
- Task description
- Components and assumptions
- Options analysis
- Decision table
- Architecture diagram

## Important

- **No API keys or CLI tools required.** You perform all design reasoning directly.
- **Do not skip phases.** Each phase builds on the previous one. The user MUST review each phase before proceeding.
- **Never generate code during the design phase.** The purpose is to make decisions explicit before implementation.
- **Do not present false choices.** If one option is clearly wrong for the use case, do not list it to seem balanced.
- **Do not add features that were not discussed.** If the user asked for authentication, do not add rate limiting and audit logging unless it is a security necessity you should flag.
- For standalone CLI usage (outside an agent), users can run `idd design "<task>"` which requires ANTHROPIC_API_KEY.
