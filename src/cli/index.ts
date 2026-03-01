/**
 * Intent: CLI entry point for CMIW.
 * Defines the commander.js program and all subcommands.
 * Subcommands: analyze (full pipeline), components, graph, security (granular), schema (reference).
 */

import { Command } from 'commander';
import { runAnalyze } from './commands/analyze.js';
import { runComponents } from './commands/components.js';
import { runGraph } from './commands/graph.js';
import { runSecurity } from './commands/security.js';
import { runSchema } from './commands/schema.js';
import type { OutputFormat, Language, SubcommandOptions } from '../types/config.js';
import type { Severity } from '../types/security.js';

const program = new Command();

program
  .name('cmiw')
  .description('Analyze codebases to generate knowledge graphs, system design analysis, and security assessments')
  .version('0.1.0');

/**
 * Intent: Define shared CLI options once and apply to multiple subcommands.
 * Avoids repeating --language, --tsconfig, --verbose, --quiet across every command.
 */
function addSharedOptions(cmd: Command): Command {
  return cmd
    .option('--tsconfig <path>', 'Path to tsconfig.json (auto-detected if not specified)')
    .option('--language <lang>', 'Language to analyze (typescript, python, auto)', 'auto')
    .option('-v, --verbose', 'Enable verbose debug logging', false)
    .option('-q, --quiet', 'Suppress progress output (auto-enabled when piped)', false);
}

/**
 * Intent: Define security-specific CLI options shared across security-aware subcommands.
 */
function addSecurityOptions(cmd: Command): Command {
  return cmd
    .option('--config <path>', 'Path to .cmiwrc.json config file (auto-detected if not specified)')
    .option('--min-severity <level>', 'Minimum severity to report: critical, high, medium, low, info')
    .option('--disable-rules <ids>', 'Comma-separated list of rule IDs to disable (e.g., cmiw-sec-003,cmiw-sec-004)');
}

/**
 * Parse raw CLI options into a typed SubcommandOptions object.
 */
function parseSubcommandOptions(targetPath: string, opts: Record<string, unknown>): SubcommandOptions {
  return {
    targetPath,
    language: (opts['language'] as Language) ?? 'auto',
    tsconfigPath: opts['tsconfig'] as string | undefined,
    verbose: opts['verbose'] as boolean,
    quiet: opts['quiet'] as boolean,
    configPath: opts['config'] as string | undefined,
    minSeverity: opts['minSeverity'] as Severity | undefined,
    disableRules: opts['disableRules']
      ? (opts['disableRules'] as string).split(',').map((s) => s.trim())
      : undefined,
  };
}

// --- analyze (full pipeline) ---
const analyzeCmd = program
  .command('analyze')
  .description('Full analysis pipeline: components, graph, security, architecture')
  .argument('<path>', 'Path to the project directory or git URL');

addSharedOptions(analyzeCmd);
addSecurityOptions(analyzeCmd);

analyzeCmd
  .option('-o, --output <path>', 'Output file path (defaults to stdout)')
  .option('-f, --format <format>', 'Output format: json, sarif, markdown, terminal', 'terminal')
  .option('--skip-llm', 'Skip LLM enrichment (runs static analysis only)', false)
  .action(async (targetPath: string, opts: Record<string, unknown>) => {
    try {
      await runAnalyze({
        targetPath,
        outputPath: opts['output'] as string | undefined,
        format: (opts['format'] as OutputFormat) ?? 'terminal',
        tsconfigPath: opts['tsconfig'] as string | undefined,
        skipLlm: opts['skipLlm'] as boolean,
        verbose: opts['verbose'] as boolean,
        quiet: opts['quiet'] as boolean,
        configPath: opts['config'] as string | undefined,
        minSeverity: opts['minSeverity'] as Severity | undefined,
        disableRules: opts['disableRules']
          ? (opts['disableRules'] as string).split(',').map((s) => s.trim())
          : undefined,
        language: (opts['language'] as Language) ?? 'auto',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}`);
      process.exit(1);
    }
  });

// --- components (extract only) ---
const componentsCmd = program
  .command('components')
  .description('Extract components from a project -> JSON array of CmiwComponent')
  .argument('<path>', 'Path to the project directory');

addSharedOptions(componentsCmd);

componentsCmd.action(async (targetPath: string, opts: Record<string, unknown>) => {
  try {
    await runComponents(parseSubcommandOptions(targetPath, opts));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- graph (build knowledge graph) ---
const graphCmd = program
  .command('graph')
  .description('Build knowledge graph from a project -> JSON KnowledgeGraph object')
  .argument('<path>', 'Path to the project directory');

addSharedOptions(graphCmd);

graphCmd.action(async (targetPath: string, opts: Record<string, unknown>) => {
  try {
    await runGraph(parseSubcommandOptions(targetPath, opts));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- security (security analysis only) ---
const securityCmd = program
  .command('security')
  .description('Run security analysis -> JSON SecurityPosture object (exit code 2 if findings)')
  .argument('<path>', 'Path to the project directory');

addSharedOptions(securityCmd);
addSecurityOptions(securityCmd);

securityCmd.action(async (targetPath: string, opts: Record<string, unknown>) => {
  try {
    await runSecurity(parseSubcommandOptions(targetPath, opts));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- schema (type reference) ---
program
  .command('schema')
  .description('Output JSON Schema for a CMIW output type (components, graph, security, report)')
  .argument('<type>', 'Type to describe: components, graph, security, report')
  .action((typeName: string) => {
    runSchema(typeName);
  });

program.parse();
