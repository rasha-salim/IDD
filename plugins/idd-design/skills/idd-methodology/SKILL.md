---
name: idd-methodology
description: Detects when the user is about to jump into coding a non-trivial task without designing first, and nudges them toward structured decomposition.
---

# IDD Methodology Auto-Detection

## When to activate

Activate this skill when you detect the user is about to write code for a task that meets ANY of these criteria:
- **Multi-component**: The task involves 3+ distinct parts (e.g., API + database + UI)
- **Architectural decisions**: The task requires choosing between patterns, libraries, or approaches
- **Ambiguous requirements**: The user's request has implicit decisions that could go multiple ways
- **Cross-cutting concerns**: The task touches auth, data storage, external APIs, or state management

Do NOT activate for:
- Simple bug fixes or typo corrections
- Single-function additions with clear requirements
- Tasks where the user has already provided detailed specifications
- Refactoring that preserves existing behavior

## What to do

When you detect a task that would benefit from design-first thinking, do the following:

1. **Pause before coding.** Do not start writing implementation code.

2. **Surface the hidden decisions.** Tell the user what implicit choices exist in their request. Be specific:
   - "This task has at least 3 components and 2 architectural choices worth discussing before coding."
   - "You're asking for X, which implies decisions about Y and Z that will affect the implementation."

3. **Offer the full design workflow.** Suggest running `/idd-design:idd "<their task>"` for a structured walkthrough covering:
   - **Decompose**: Break the task into components and surface assumptions
   - **Options**: Present concrete alternatives where choices exist
   - **Decide**: Confirm approach in a summary table
   - **Diagram**: Generate architecture visualization

4. **Or apply inline decomposition.** If the user prefers not to run the full command, apply a lighter version directly:
   - List the components you see in their task
   - State the assumptions you are making
   - Ask for confirmation before proceeding to code

## Key principles

- Never hide assumptions. If you are choosing between two reasonable interpretations, say so.
- Do not present false choices. If one approach is clearly better, recommend it directly.
- Do not add features that were not discussed.
- The goal is to make invisible decisions visible before they become bugs or tech debt.
