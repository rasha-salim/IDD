/**
 * Intent: CLI entry point for IDD.
 * Defines the commander.js program and all subcommands.
 * Design commands: design, decompose, options, decide, diagram, viewer.
 * Analysis commands: analyze, components, graph, security, schema.
 */

import { Command } from 'commander';
import { runAnalyze } from './commands/analyze.js';
import { runComponents } from './commands/components.js';
import { runGraph } from './commands/graph.js';
import { runSecurity } from './commands/security.js';
import { runSchema } from './commands/schema.js';
import { runDesignCommand } from './commands/design.js';
import { runDecomposeCommand } from './commands/decompose.js';
import { runOptionsCommand } from './commands/options-cmd.js';
import { runDecideCommand } from './commands/decide.js';
import { runDiagramCommand } from './commands/diagram.js';
import { runViewerCommand } from './commands/viewer.js';
import type { OutputFormat, Language, SubcommandOptions } from '../types/config.js';
import type { Severity } from '../types/security.js';

const program = new Command();

program
  .name('idd')
  .description('Intent-Driven Development CLI: design solutions first, then analyze and assess code')
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
    .option('--config <path>', 'Path to .iddrc.json config file (auto-detected if not specified)')
    .option('--min-severity <level>', 'Minimum severity to report: critical, high, medium, low, info')
    .option('--disable-rules <ids>', 'Comma-separated list of rule IDs to disable (e.g., idd-sec-003,idd-sec-004)');
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
  .description('Extract components from a project -> JSON array of IddComponent')
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
  .description('Output JSON Schema for an IDD output type (components, graph, security, report)')
  .argument('<type>', 'Type to describe: components, graph, security, report')
  .action((typeName: string) => {
    runSchema(typeName);
  });

// --- design (single-shot full IDD design) ---
function addDesignOptions(cmd: Command): Command {
  return cmd
    .option('-f, --format <format>', 'Output format: json, markdown', 'markdown')
    .option('-v, --verbose', 'Enable verbose debug logging', false)
    .option('-q, --quiet', 'Suppress progress output', false)
    .option('-o, --output <path>', 'Output file path (defaults to stdout)');
}

const designCmd = program
  .command('design')
  .description('Single-shot IDD design: decompose, options, decide, and diagram in one call')
  .argument('<task>', 'Task description to design a solution for');

addDesignOptions(designCmd);

designCmd.action(async (task: string, opts: Record<string, unknown>) => {
  try {
    await runDesignCommand(task, {
      format: (opts['format'] as 'json' | 'markdown') ?? 'markdown',
      output: opts['output'] as string | undefined,
      verbose: opts['verbose'] as boolean,
      quiet: opts['quiet'] as boolean,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- decompose (Phase 1) ---
const decomposeCmd = program
  .command('decompose')
  .description('Phase 1: Decompose a task into components and assumptions')
  .argument('<task>', 'Task description to decompose');

addDesignOptions(decomposeCmd);

decomposeCmd.action(async (task: string, opts: Record<string, unknown>) => {
  try {
    await runDecomposeCommand(task, {
      format: (opts['format'] as 'json' | 'markdown') ?? 'markdown',
      output: opts['output'] as string | undefined,
      verbose: opts['verbose'] as boolean,
      quiet: opts['quiet'] as boolean,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- options (Phase 2) ---
const optionsCmd = program
  .command('options')
  .description('Phase 2: Generate implementation options with pros/cons for each component')
  .argument('<task>', 'Task description to analyze options for');

addDesignOptions(optionsCmd);
optionsCmd.option('--decomposition <json>', 'JSON output from decompose phase (for chaining)');

optionsCmd.action(async (task: string, opts: Record<string, unknown>) => {
  try {
    await runOptionsCommand(task, {
      format: (opts['format'] as 'json' | 'markdown') ?? 'markdown',
      output: opts['output'] as string | undefined,
      verbose: opts['verbose'] as boolean,
      quiet: opts['quiet'] as boolean,
      decomposition: opts['decomposition'] as string | undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- decide (Phase 3) ---
const decideCmd = program
  .command('decide')
  .description('Phase 3: Make decisions for each component based on options analysis')
  .argument('<task>', 'Task description to make decisions for');

addDesignOptions(decideCmd);
decideCmd.option('--options <json>', 'JSON output from options phase (for chaining)');

decideCmd.action(async (task: string, opts: Record<string, unknown>) => {
  try {
    await runDecideCommand(task, {
      format: (opts['format'] as 'json' | 'markdown') ?? 'markdown',
      output: opts['output'] as string | undefined,
      verbose: opts['verbose'] as boolean,
      quiet: opts['quiet'] as boolean,
      options: opts['options'] as string | undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- diagram (Phase 3.5) ---
const diagramCmd = program
  .command('diagram')
  .description('Phase 3.5: Generate Mermaid system architecture diagram from decisions')
  .argument('<task>', 'Task description to diagram');

addDesignOptions(diagramCmd);
diagramCmd.option('--decisions <json>', 'JSON output from decide phase (for chaining)');

diagramCmd.action(async (task: string, opts: Record<string, unknown>) => {
  try {
    await runDiagramCommand(task, {
      format: (opts['format'] as 'json' | 'markdown') ?? 'markdown',
      output: opts['output'] as string | undefined,
      verbose: opts['verbose'] as boolean,
      quiet: opts['quiet'] as boolean,
      decisions: opts['decisions'] as string | undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
});

// --- viewer (open Mermaid diagram viewer) ---
program
  .command('viewer')
  .description('Open the bundled Mermaid system design viewer in the browser')
  .action(async () => {
    try {
      await runViewerCommand();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}`);
      process.exit(1);
    }
  });

program.parse();
