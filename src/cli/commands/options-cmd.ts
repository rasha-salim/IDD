/**
 * Intent: CLI handler for `idd options <task>`.
 * Runs Phase 2 of the IDD methodology: options analysis.
 *
 * Guarantees: Outputs OptionsResult as JSON or formatted markdown.
 * Accepts optional --decomposition flag for chaining from Phase 1.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runOptions } from '../../llm/design.js';
import { formatOptions } from '../../output/design-formatter.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import type { DecomposeResult, OptionsResult } from '../../types/design.js';

export interface OptionsCmdOptions {
  format: 'json' | 'markdown';
  output?: string;
  verbose: boolean;
  quiet: boolean;
  decomposition?: string;
}

export async function runOptionsCommand(
  task: string,
  options: OptionsCmdOptions,
): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);

  let decomposition: DecomposeResult | undefined;
  if (options.decomposition) {
    decomposition = JSON.parse(options.decomposition) as DecomposeResult;
  }

  const spinner = createSpinner('Analyzing options...', quiet);
  spinner.start();

  const result: OptionsResult = await runOptions(task, decomposition);

  spinner.succeed(`Generated options for ${result.componentOptions.length} components`);

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else {
    output = formatOptions(result);
  }

  if (options.output) {
    await writeFile(resolve(options.output), output, 'utf-8');
    console.error(`Output written to: ${resolve(options.output)}`);
  } else {
    console.log(output);
  }
}
