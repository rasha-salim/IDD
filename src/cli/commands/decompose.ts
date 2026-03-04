/**
 * Intent: CLI handler for `idd decompose <task>`.
 * Runs Phase 1 of the IDD methodology: task decomposition.
 *
 * Guarantees: Outputs DecomposeResult as JSON or formatted markdown.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runDecompose } from '../../llm/design.js';
import { formatDecompose } from '../../output/design-formatter.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import type { DecomposeResult } from '../../types/design.js';

export interface DecomposeOptions {
  format: 'json' | 'markdown';
  output?: string;
  verbose: boolean;
  quiet: boolean;
}

export async function runDecomposeCommand(
  task: string,
  options: DecomposeOptions,
): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);

  const spinner = createSpinner('Decomposing task...', quiet);
  spinner.start();

  const result: DecomposeResult = await runDecompose(task);

  spinner.succeed(`Decomposed into ${result.components.length} components`);

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else {
    output = formatDecompose(result);
  }

  if (options.output) {
    await writeFile(resolve(options.output), output, 'utf-8');
    console.error(`Output written to: ${resolve(options.output)}`);
  } else {
    console.log(output);
  }
}
