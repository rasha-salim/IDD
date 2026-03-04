---
name: idd-security
description: Run IDD security analysis on a project, parse findings, and offer to fix them. Use when the user wants to scan a codebase for security vulnerabilities.
---

# IDD Security Scan

Run a security scan on the target project using IDD and act on the results.

## Arguments

The user may provide a path as an argument. If no path is provided, use the current working directory (`.`).

## Steps

### 1. Run the security scan

Run the IDD security scanner on the target path:

```
idd security <path> --quiet 2>/dev/null
```

Capture both the JSON output and the exit code.

- **Exit 0**: No security findings. Report that the project is clean and stop.
- **Exit 1**: Error running IDD. Report the error from stderr and stop.
- **Exit 2**: Security findings detected. Continue to step 2.

### 2. Parse and present findings

Parse the JSON output (which is a `SecurityPosture` object) and present findings grouped by severity in descending order (critical first, then high, medium, low, info).

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
3. Apply the recommended fix (use parameterized queries for SQL injection, sanitize input, use path validation, etc.)
4. Do NOT introduce new issues while fixing

### 5. Re-scan

After applying fixes, run the security scan again to verify:

```
idd security <path> --quiet 2>/dev/null
```

Report the updated score/grade and any remaining findings.

## Important

- Always read the actual source file before attempting a fix. The snippet in the finding may not have full context.
- Never suppress or hide findings. If a finding cannot be fixed automatically, explain why and provide manual guidance.
- Do not disable security rules as a "fix". The goal is to fix the underlying vulnerability.
- If IDD is not installed, tell the user to install it: `npm install -g idd-cli`
