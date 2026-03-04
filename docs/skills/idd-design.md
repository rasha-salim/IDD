---
name: idd-design
description: Run the full IDD methodology interactively -- decompose a task, explore options, decide on approach, generate architecture diagram. Use when the user wants to design a solution before writing code.
---

# IDD Interactive Design Workflow

Walk the user through the full Intent-Driven Development design methodology, phase by phase. Each phase builds on the previous one. The user reviews and confirms before moving to the next phase.

## Arguments

The user provides a task description as the argument. Example: `/idd-design "Add user authentication with OAuth2"`

## Steps

### 1. Decompose (Phase 1)

Run the IDD decompose command to break the task into components and surface assumptions:

```
DECOMPOSITION=$(idd decompose "<task>" -q -f json 2>/dev/null)
```

Present the result to the user:
- List each component with its name and description
- List all assumptions being made
- Ask the user to confirm, modify components, or correct assumptions

Wait for the user to confirm before proceeding.

### 2. Options (Phase 2)

Run the IDD options command, passing the confirmed decomposition:

```
OPTIONS=$(idd options "<task>" -q -f json --decomposition '<confirmed_decomposition_json>' 2>/dev/null)
```

Present the result to the user:
- For each component that has options, show:
  - Option name and description
  - Pros (concrete advantages)
  - Cons (concrete disadvantages)
  - Recommendation with reasoning
- Ask the user to confirm the recommendations or choose differently

Wait for the user to confirm before proceeding.

### 3. Decide (Phase 3)

Run the IDD decide command, passing the confirmed options:

```
DECISIONS=$(idd decide "<task>" -q -f json --options '<confirmed_options_json>' 2>/dev/null)
```

Present the result to the user:
- Show a decision table: Component | Choice | Reason
- Highlight any cascading impacts between decisions
- Ask the user to confirm the approach

Wait for the user to confirm before proceeding.

### 4. Diagram (Phase 3.5)

Run the IDD diagram command, passing the confirmed decisions:

```
DIAGRAM=$(idd diagram "<task>" -q -f json --decisions '<confirmed_decisions_json>' 2>/dev/null)
```

Present the Mermaid diagram inline so the user can see the architecture visually.

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

- **Requires ANTHROPIC_API_KEY** to be set. If not set, tell the user to configure it.
- **Do not skip phases.** Each phase builds on the previous one. The user MUST review each phase before proceeding.
- **Never generate code during the design phase.** The purpose is to make decisions explicit before implementation.
- **For single-shot design** (no interaction needed), use: `idd design "<task>" -q -f json`
- If IDD is not installed, tell the user to install it: `npm install -g idd-cli`
- If any command fails (exit 1), report the error from stderr and stop.
