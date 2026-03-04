/**
 * Intent: CLI handler for `idd diagram <task>`.
 * Runs Phase 3.5 of the IDD methodology: system architecture diagram.
 *
 * Guarantees: Outputs DiagramResult as JSON or formatted markdown.
 * Accepts optional --decisions flag for chaining from Phase 3.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runDiagram } from '../../llm/design.js';
import { formatDiagram } from '../../output/design-formatter.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import type { DecideResult, DiagramResult } from '../../types/design.js';

export interface DiagramOptions {
  format: 'json' | 'markdown';
  output?: string;
  verbose: boolean;
  quiet: boolean;
  decisions?: string;
}

export async function runDiagramCommand(
  task: string,
  options: DiagramOptions,
): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);

  let previousDecisions: DecideResult | undefined;
  if (options.decisions) {
    previousDecisions = JSON.parse(options.decisions) as DecideResult;
  }

  const spinner = createSpinner('Generating diagram...', quiet);
  spinner.start();

  const result: DiagramResult = await runDiagram(task, previousDecisions);

  spinner.succeed('System diagram generated');

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else {
    output = formatDiagram(result);
  }

  if (options.output) {
    await writeFile(resolve(options.output), output, 'utf-8');
    console.error(`Output written to: ${resolve(options.output)}`);
  } else {
    console.log(output);
  }
}
