/**
 * Intent: Run security analysis on a project and output SecurityPosture as JSON.
 * This is a granular subcommand for agents that need only the security assessment.
 *
 * Guarantees: Outputs SecurityPosture JSON to stdout.
 * Exit codes: 0 = no findings above threshold, 1 = error, 2 = findings found.
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { SubcommandOptions } from '../../types/config.js';
import { detectLanguage } from '../../core/language-detector.js';
import { createAnalyzer } from '../../core/language-analyzer.js';
import { loadSecurityConfig } from '../../core/config-loader.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import { CmiwError } from '../../utils/errors.js';

/**
 * Execute the security subcommand.
 *
 * Intent: Run security analysis only and output SecurityPosture JSON.
 * Guarantees: Exit code 2 if findings exist above severity threshold, enabling
 * agents to gate on security without parsing JSON.
 */
export async function runSecurity(options: SubcommandOptions): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const quiet = shouldBeQuiet(options.quiet);
  const targetPath = resolve(options.targetPath);

  if (!existsSync(targetPath)) {
    throw new CmiwError(`Target path does not exist: ${targetPath}`, 'INVALID_PATH');
  }

  const configSpinner = createSpinner('Loading security config...', quiet);
  configSpinner.start();
  const securityConfig = loadSecurityConfig({
    targetDir: targetPath,
    configPath: options.configPath,
    minSeverity: options.minSeverity,
    disableRules: options.disableRules,
  });
  configSpinner.succeed('Security config loaded');

  const langSpinner = createSpinner('Detecting language...', quiet);
  langSpinner.start();
  const language = detectLanguage(targetPath, options.language);
  langSpinner.succeed(`Detected language: ${language}`);

  const loadSpinner = createSpinner('Loading project...', quiet);
  loadSpinner.start();
  const analyzer = await createAnalyzer(language);
  await analyzer.loadProject(targetPath, { tsconfigPath: options.tsconfigPath });
  loadSpinner.succeed(`Loaded ${analyzer.getFileCount()} source files (${language})`);

  const secSpinner = createSpinner('Analyzing security...', quiet);
  secSpinner.start();
  const security = analyzer.analyzeSecurityPosture(securityConfig);
  secSpinner.succeed(`Security: ${security.grade} (${security.score}/100) - ${security.findings.length} findings`);

  console.log(JSON.stringify(security, null, 2));

  // Exit code 2 if findings exist above threshold
  if (security.findings.length > 0) {
    process.exitCode = 2;
  }
}
