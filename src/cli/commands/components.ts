/**
 * Intent: Extract components from a project and output as JSON.
 * This is a granular subcommand for agents that only need the component list.
 *
 * Guarantees: Outputs CmiwComponent[] as JSON to stdout.
 * Exit 0 on success, exit 1 on error.
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { SubcommandOptions } from '../../types/config.js';
import { detectLanguage } from '../../core/language-detector.js';
import { createAnalyzer } from '../../core/language-analyzer.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import { CmiwError } from '../../utils/errors.js';

/**
 * Execute the components subcommand.
 *
 * Intent: Run only the component extraction phase and output JSON.
 * Guarantees: stdout contains only valid JSON. Progress goes to stderr via spinner.
 */
export async function runComponents(options: SubcommandOptions): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);
  const targetPath = resolve(options.targetPath);

  if (!existsSync(targetPath)) {
    throw new CmiwError(`Target path does not exist: ${targetPath}`, 'INVALID_PATH');
  }

  const langSpinner = createSpinner('Detecting language...', quiet);
  langSpinner.start();
  const language = detectLanguage(targetPath, options.language);
  langSpinner.succeed(`Detected language: ${language}`);

  const loadSpinner = createSpinner('Loading project...', quiet);
  loadSpinner.start();
  const analyzer = await createAnalyzer(language);
  await analyzer.loadProject(targetPath, { tsconfigPath: options.tsconfigPath });
  loadSpinner.succeed(`Loaded ${analyzer.getFileCount()} source files (${language})`);

  const extractSpinner = createSpinner('Extracting components...', quiet);
  extractSpinner.start();
  const components = analyzer.extractComponents();
  extractSpinner.succeed(`Extracted ${components.length} components`);

  console.log(JSON.stringify(components, null, 2));
}
