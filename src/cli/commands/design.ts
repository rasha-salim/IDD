/**
 * Intent: CLI handler for `idd design <task>`.
 * Runs all IDD phases in a single call (single-shot design).
 *
 * Guarantees: Outputs DesignDocument as JSON or formatted markdown.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runFullDesign } from '../../llm/design.js';
import { formatDesignDocument } from '../../output/design-formatter.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import type { DesignDocument } from '../../types/design.js';

export interface DesignOptions {
  format: 'json' | 'markdown';
  output?: string;
  verbose: boolean;
  quiet: boolean;
}

export async function runDesignCommand(
  task: string,
  options: DesignOptions,
): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);

  const spinner = createSpinner('Running full IDD design...', quiet);
  spinner.start();

  const result: DesignDocument = await runFullDesign(task);

  spinner.succeed(
    `Design complete: ${result.decomposition.components.length} components, ` +
    `${result.decisions.decisions.length} decisions`,
  );

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(result, null, 2);
  } else {
    output = formatDesignDocument(result);
  }

  if (options.output) {
    await writeFile(resolve(options.output), output, 'utf-8');
    console.error(`Output written to: ${resolve(options.output)}`);
  } else {
    console.log(output);
  }
}
