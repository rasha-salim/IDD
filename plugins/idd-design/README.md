# IDD Design Plugin for Claude Code

A Claude Code plugin that brings the Intent-Driven Development (IDD) methodology into your coding workflow. Forces structured design thinking before implementation -- decompose tasks, explore options, make decisions explicit, and generate architecture diagrams.

No external tools, CLI commands, or API keys required. All reasoning happens directly in the agent.

## Installation

### From the plugin marketplace

```
/plugin install idd-design
```

### Manual installation

Clone or copy the `plugins/idd-design/` directory into your Claude Code plugins location.

## Usage

### Slash command

```
/idd-design:idd "Add user authentication with OAuth2"
```

This runs the full 4-phase design workflow interactively.

### Auto-trigger

The plugin includes a skill that automatically detects when you are about to code a non-trivial task without designing first. It nudges you toward structured decomposition when it sees:
- Multi-component tasks (3+ distinct parts)
- Architectural decisions (choosing between patterns or libraries)
- Ambiguous requirements (implicit decisions that could go multiple ways)

## The 4 Phases

### Phase 1: Decompose

Breaks the task into components and surfaces hidden assumptions. Lists what is included, what is excluded, and what defaults the agent would choose without asking.

### Phase 2: Options

For each component where multiple valid approaches exist, presents concrete alternatives with specific pros and cons. Always includes a recommendation. Skips components with only one reasonable approach.

### Phase 3: Decide

Summarizes all decisions in a table. The user confirms or adjusts before any code is written. Changing one decision flags cascading impacts on other components.

### Phase 4: Diagram

Generates a Mermaid architecture diagram based on the confirmed decisions, showing components, relationships, and logical groupings.

After the diagram, the user can save the full design document, start implementing, or modify any phase and re-run.

## Why IDD

Every task has invisible decisions. IDD makes them visible before they become bugs, tech debt, or wrong assumptions baked into code.

- Prevents "build first, redesign later" cycles
- Catches scope misunderstandings before implementation
- Creates a decision record that explains why the code is the way it is
- Works for any language, framework, or project size

## Full IDD CLI

This plugin covers the design methodology. For static analysis features (component extraction, security scanning, knowledge graphs), see the full [IDD CLI repository](https://github.com/AshGw/idd).

## License

MIT
