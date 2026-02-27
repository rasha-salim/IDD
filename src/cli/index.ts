/**
 * Intent: CLI entry point for CMIW.
 * Defines the commander.js program and all subcommands.
 */

import { Command } from 'commander';
import { runAnalyze } from './commands/analyze.js';
import type { OutputFormat } from '../types/config.js';
import type { Severity } from '../types/security.js';

const program = new Command();

program
  .name('cmiw')
  .description('Analyze TypeScript/JavaScript codebases to generate knowledge graphs, system design analysis, and security assessments')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze a TypeScript/JavaScript project')
  .argument('<path>', 'Path to the project directory or git URL')
  .option('-o, --output <path>', 'Output file path (defaults to stdout)')
  .option('-f, --format <format>', 'Output format: json, sarif, markdown, terminal', 'terminal')
  .option('--tsconfig <path>', 'Path to tsconfig.json (auto-detected if not specified)')
  .option('--skip-llm', 'Skip LLM enrichment (runs static analysis only)', false)
  .option('-v, --verbose', 'Enable verbose debug logging', false)
  .option('--config <path>', 'Path to .cmiwrc.json config file (auto-detected if not specified)')
  .option('--min-severity <level>', 'Minimum severity to report: critical, high, medium, low, info')
  .option('--disable-rules <ids>', 'Comma-separated list of rule IDs to disable (e.g., cmiw-sec-003,cmiw-sec-004)')
  .action(async (targetPath: string, opts: {
    output?: string;
    format: string;
    tsconfig?: string;
    skipLlm: boolean;
    verbose: boolean;
    config?: string;
    minSeverity?: string;
    disableRules?: string;
  }) => {
    try {
      await runAnalyze({
        targetPath,
        outputPath: opts.output,
        format: opts.format as OutputFormat,
        tsconfigPath: opts.tsconfig,
        skipLlm: opts.skipLlm,
        verbose: opts.verbose,
        configPath: opts.config,
        minSeverity: opts.minSeverity as Severity | undefined,
        disableRules: opts.disableRules ? opts.disableRules.split(',').map((s) => s.trim()) : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}`);
      process.exit(1);
    }
  });

program.parse();
