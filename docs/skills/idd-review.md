---
name: idd-review
description: Run a combined code quality and architecture review using IDD analysis. Use when the user wants a health check covering circular dependencies, hub components, security posture, and code quality observations.
---

# IDD Code Quality and Architecture Review

Run a comprehensive review combining architecture health, code quality signals, and security assessment into a single structured report.

## Arguments

The user may provide a path as an argument. If no path is provided, use the current working directory (`.`).

## Steps

### 1. Gather data

Run three IDD commands in parallel to collect all data:

```bash
COMPONENTS=$(idd components <path> --quiet 2>/dev/null)
GRAPH=$(idd graph <path> --quiet 2>/dev/null)
SECURITY=$(idd security <path> --quiet 2>/dev/null)
```

If any command fails (exit 1), report the error and stop.

### 2. Analyze architecture health

From the graph data, assess:

**Circular dependencies:**
- List each cycle with full path (A -> B -> C -> A)
- Rate severity: 2-node cycles are high severity, 3+ node cycles are medium
- For each cycle, suggest specific refactoring approaches (extract interface, dependency injection, event-driven decoupling, extract shared module)

**Hub components:**
- Identify top 5 components by total connection count
- Break down inbound vs outbound connections for each
- Flag components with cross-cluster connections (coupling indicators)
- Flag potential god objects (10+ connections from a single component)

**Cluster analysis:**
- List all clusters with component counts
- Identify high-coupling cluster pairs (5+ edges between them)
- Identify orphan components (not in any cluster)

### 3. Analyze code quality

From the component data, identify:

- **Large classes**: Classes with 10+ methods (list name, method count, file path)
- **Large files**: Files with 300+ LOC (list name, LOC, file path)
- **Complex functions**: Functions with 5+ parameters (list name, param count, file path)

### 4. Security assessment

From the security data, provide:

- Overall grade and score
- Group findings by category (SQL injection, auth issues, input validation, etc.) rather than just severity
- Identify systemic patterns (e.g., "5 out of 8 findings are missing auth -- suggests a project-wide auth middleware gap")
- Prioritize action items: critical findings first, then systemic patterns, then individual fixes

### 5. Present the review

Structure the output as a professional review report:

**Summary paragraph:** One paragraph covering the overall health of the codebase.

**Architecture Issues** (if any):
- Circular dependencies with resolution suggestions
- Hub components that may violate SRP
- Cross-cluster coupling concerns

**Security Issues** (if any):
- Grade and systemic patterns
- Top priority findings with locations

**Code Quality Observations** (if any):
- Large classes, files, or complex functions
- Suggestions for improvement

**Positive Findings:**
- Clean areas (clusters with no issues)
- Good patterns observed (proper separation, no circular deps in key areas)
- Security strengths (rules with zero findings)

### 6. Offer follow-ups

After the review, offer targeted actions:

- **Fix security issues** -- Hand off to `/idd-security`
- **Generate architecture diagram** -- Hand off to `/idd-diagram`
- **Explore dependency graph** -- Hand off to `/idd-graph`
- **Export review** -- Save as markdown file

## Important

- **Always include positive findings.** A review that only lists problems is demoralizing and incomplete.
- **Be specific in suggestions.** "Consider refactoring" is useless. "Extract the database query logic from UserService into a UserRepository to break the circular dependency with AuthService" is actionable.
- **Read source files before recommending circular dependency fixes.** The graph shows the dependency exists, but you need to see the code to suggest the right resolution strategy.
- If IDD is not installed, tell the user to install it: `npm install -g idd-cli`
