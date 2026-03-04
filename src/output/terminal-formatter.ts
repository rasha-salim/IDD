/**
 * Intent: Format IddReport for colored terminal output.
 * Uses chalk for ANSI color codes.
 * Guarantees: Output is readable in a terminal with severity-based coloring.
 */

import chalk from 'chalk';
import type { IddReport } from '../types/report.js';
import type { Severity } from '../types/security.js';

const SEVERITY_COLORS: Record<Severity, (text: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
};

const GRADE_COLORS: Record<string, (text: string) => string> = {
  A: chalk.green.bold,
  B: chalk.green,
  C: chalk.yellow,
  D: chalk.red,
  F: chalk.red.bold,
};

/**
 * Format a IDD report for terminal display.
 *
 * Intent: Produce colored, scannable terminal output.
 * Guarantees: Critical/high items are prominently colored.
 */
export function formatTerminal(report: IddReport): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('  IDD Analysis Report'));
  lines.push(chalk.gray(`  ${report.metadata.analyzedPath}`));
  lines.push(chalk.gray(`  ${report.metadata.timestamp}`));
  lines.push('');

  // Summary bar
  lines.push(chalk.bold('  Summary'));
  lines.push(`  Files: ${chalk.white.bold(String(report.metadata.totalFiles))}  Components: ${chalk.white.bold(String(report.metadata.totalComponents))}  Relationships: ${chalk.white.bold(String(report.metadata.totalRelationships))}`);
  lines.push(`  Analysis time: ${report.metadata.analysisTimeMs}ms  LLM: ${report.metadata.llmEnriched ? chalk.green('enabled') : chalk.gray('skipped')}`);
  lines.push('');

  // Architecture
  lines.push(chalk.bold('  Architecture'));
  lines.push(`  ${report.architecture.summary}`);
  if (report.architecture.patterns.length > 0) {
    for (const pattern of report.architecture.patterns) {
      lines.push(`  - ${pattern.name} (${(pattern.confidence * 100).toFixed(0)}% confidence)`);
    }
  }
  lines.push('');

  // Security
  const gradeColor = GRADE_COLORS[report.security.grade] ?? chalk.white;
  lines.push(chalk.bold('  Security'));
  lines.push(`  Score: ${chalk.bold(String(report.security.score))}/100  Grade: ${gradeColor(report.security.grade)}`);
  lines.push('');

  if (report.security.findings.length > 0) {
    for (const finding of report.security.findings) {
      const severityColor = SEVERITY_COLORS[finding.severity];
      const severityLabel = severityColor(finding.severity.toUpperCase().padEnd(8));
      const location = chalk.gray(`${finding.filePath}:${finding.startLine}`);
      lines.push(`  ${severityLabel} ${finding.title}`);
      lines.push(`             ${location}`);
    }
    lines.push('');
  } else {
    lines.push(chalk.green('  No security findings detected.'));
    lines.push('');
  }

  // Graph
  lines.push(chalk.bold('  Knowledge Graph'));
  lines.push(`  Nodes: ${report.graph.nodes.length}  Edges: ${report.graph.edges.length}  Clusters: ${report.graph.clusters.length}`);

  if (report.graph.circularDependencies.length > 0) {
    lines.push(chalk.yellow(`  Circular dependencies: ${report.graph.circularDependencies.length}`));
    for (const cycle of report.graph.circularDependencies) {
      lines.push(chalk.yellow(`    ${cycle.path.join(' -> ')}`));
    }
  }

  lines.push('');

  return lines.join('\n');
}
