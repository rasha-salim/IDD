/**
 * Intent: CLI handler for `idd decide <task>`.
 * Runs Phase 3 of the IDD methodology: decision summary.
 *
 * Guarantees: Outputs DecideResult as JSON or formatted markdown.
 * Accepts optional --options flag for chaining from Phase 2.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runDecide } from '../../llm/design.js';
import { formatDecide } from '../../output/design-formatter.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import type { OptionsResult, DecideResult } from '../../types/design.js';

export interface DecideOptions {
  format: 'json' | 'markdown';
  output?: string;
  verbose: boolean;
  quiet: boolean;
  options?: string;
}

export async function runDecideCommand(
  task: string,
  options: DecideOptions,
): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);

  let previousOptions: OptionsResult | undefined;
  if (options.options) {
    previousOptions = JSON.parse(options.options) as OptionsResult;
  }

  const spinner = createSpinner('Making decisions...', quiet);
  spinner.start();

  const result: DecideResult = await runDecide(task, previousOptions);

  spinner.succeed(`Made ${result.decisions.length} decisions`);

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else {
    output = formatDecide(result);
  }

  if (options.output) {
    await writeFile(resolve(options.output), output, 'utf-8');
    console.error(`Output written to: ${resolve(options.output)}`);
  } else {
    console.log(output);
  }
}
