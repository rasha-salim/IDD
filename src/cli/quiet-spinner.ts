/**
 * Intent: Provide a spinner utility that respects quiet mode and piped output.
 * When running in a pipe or with --quiet, spinners are suppressed so only
 * clean JSON reaches stdout.
 *
 * Guarantees: shouldBeQuiet returns true if --quiet is set OR stdout is not a TTY.
 * createSpinner returns a real ora spinner or a no-op object with the same interface.
 */

import ora, { type Ora } from 'ora';

/**
 * Determine whether output should be quiet (no spinners/progress).
 *
 * Intent: Auto-detect piped output so agents get clean JSON without --quiet flag.
 * Guarantees: Returns true if explicit --quiet OR stdout is not a TTY.
 */
export function shouldBeQuiet(explicitQuiet?: boolean): boolean {
  if (explicitQuiet) return true;
  return !process.stdout.isTTY;
}

/**
 * No-op spinner interface for quiet mode.
 * Matches the subset of Ora methods used in CMIW commands.
 */
interface QuietSpinner {
  start(): QuietSpinner;
  succeed(text?: string): QuietSpinner;
  fail(text?: string): QuietSpinner;
  stop(): QuietSpinner;
}

const noopSpinner: QuietSpinner = {
  start() { return this; },
  succeed() { return this; },
  fail() { return this; },
  stop() { return this; },
};

/**
 * Create a spinner that respects quiet mode.
 *
 * Intent: Centralize the decision of whether to show progress indicators.
 * Guarantees: In quiet mode returns a no-op. In TTY mode returns a real ora spinner.
 */
export function createSpinner(text: string, quiet: boolean): Ora | QuietSpinner {
  if (quiet) {
    return noopSpinner;
  }
  return ora(text);
}
