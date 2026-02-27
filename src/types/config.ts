/**
 * Intent: Define CLI and analysis configuration types.
 */

export type OutputFormat = 'json' | 'sarif' | 'markdown' | 'terminal';

export interface AnalyzeOptions {
  targetPath: string;
  outputPath?: string;
  format: OutputFormat;
  tsconfigPath?: string;
  skipLlm: boolean;
  verbose: boolean;
}
