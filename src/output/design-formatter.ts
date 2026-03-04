/**
 * Intent: Format design phase results as readable markdown output.
 * Follows the IDD methodology output templates.
 *
 * Guarantees: Valid markdown output. Each phase has a distinct section.
 */

import type {
  DecomposeResult,
  OptionsResult,
  DecideResult,
  DiagramResult,
  DesignDocument,
} from '../types/design.js';

export function formatDecompose(result: DecomposeResult): string {
  const lines: string[] = [];

  lines.push(`## Task: ${result.task}`);
  lines.push('');
  lines.push('## Components');
  lines.push('');
  for (let i = 0; i < result.components.length; i++) {
    const c = result.components[i];
    lines.push(`${i + 1}. **${c.name}** -- ${c.description}`);
  }
  lines.push('');
  lines.push('## Assumptions (correct me if wrong)');
  lines.push('');
  for (const assumption of result.assumptions) {
    lines.push(`- ${assumption}`);
  }

  return lines.join('\n');
}

export function formatOptions(result: OptionsResult): string {
  const lines: string[] = [];

  lines.push(`## Task: ${result.task}`);
  lines.push('');

  for (const co of result.componentOptions) {
    lines.push(`## ${co.componentName}`);
    lines.push('');

    for (const opt of co.options) {
      lines.push(`### ${opt.name}`);
      lines.push(`How: ${opt.description}`);
      for (const pro of opt.pros) {
        lines.push(`+ ${pro}`);
      }
      for (const con of opt.cons) {
        lines.push(`- ${con}`);
      }
      lines.push('');
    }

    lines.push(`**Recommendation:** ${co.recommendation}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatDecide(result: DecideResult): string {
  const lines: string[] = [];

  lines.push(`## Proposed approach for: ${result.task}`);
  lines.push('');
  lines.push('| Component | Choice | Reason |');
  lines.push('|-----------|--------|--------|');

  for (const d of result.decisions) {
    lines.push(`| ${d.component} | ${d.choice} | ${d.reason} |`);
  }

  return lines.join('\n');
}

export function formatDiagram(result: DiagramResult): string {
  const lines: string[] = [];

  lines.push(`## System Diagram: ${result.task}`);
  lines.push('');
  lines.push(result.description);
  lines.push('');
  lines.push('```mermaid');
  lines.push(result.mermaidCode);
  lines.push('```');

  return lines.join('\n');
}

export function formatDesignDocument(doc: DesignDocument): string {
  const lines: string[] = [];

  lines.push(`# IDD Design Document: ${doc.task}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Phase 1: Decomposition');
  lines.push('');
  lines.push(formatDecompose(doc.decomposition));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Phase 2: Options');
  lines.push('');
  lines.push(formatOptions(doc.options));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Phase 3: Decisions');
  lines.push('');
  lines.push(formatDecide(doc.decisions));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Phase 3.5: System Diagram');
  lines.push('');
  lines.push(formatDiagram(doc.diagram));

  return lines.join('\n');
}
