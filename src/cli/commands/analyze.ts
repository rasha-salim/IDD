/**
 * Intent: Orchestrate the full CMIW analysis pipeline.
 * This is the main command that ties all analysis phases together.
 * Guarantees: Each phase runs in order. Failures are reported with context.
 */

import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import ora from 'ora';
import type { AnalyzeOptions } from '../../types/config.js';
import type { Architecture } from '../../types/architecture.js';
import { loadProject } from '../../core/project-loader.js';
import { extractComponents } from '../../core/component-extractor.js';
import { buildRelationships } from '../../core/relationship-builder.js';
import { buildGraph } from '../../core/graph-builder.js';
import { analyzeSecurityPosture } from '../../core/security-analyzer.js';
import { assembleReport } from '../../core/report-assembler.js';
import { enrichWithLlm } from '../../llm/enrichment.js';
import { formatJson } from '../../output/json-formatter.js';
import { formatSarif } from '../../output/sarif-formatter.js';
import { formatMarkdown } from '../../output/markdown-formatter.js';
import { formatTerminal } from '../../output/terminal-formatter.js';
import { cloneRepo } from '../../utils/git.js';
import { setLogLevel } from '../../utils/logger.js';
import { CmiwError } from '../../utils/errors.js';

/**
 * Execute the analyze command.
 *
 * Intent: Run the full analysis pipeline from source loading to formatted output.
 * Guarantees: Output is written to file or stdout. Errors include diagnostic context.
 */
export async function runAnalyze(options: AnalyzeOptions): Promise<void> {
  if (options.verbose) {
    setLogLevel('debug');
  }

  const startTime = Date.now();
  let targetPath = options.targetPath;

  // Phase 0: Resolve target (git clone if URL)
  if (targetPath.startsWith('http://') || targetPath.startsWith('https://') || targetPath.startsWith('git@')) {
    const spinner = ora('Cloning repository...').start();
    try {
      targetPath = await cloneRepo(targetPath);
      spinner.succeed('Repository cloned');
    } catch (error) {
      spinner.fail('Failed to clone repository');
      throw error;
    }
  }

  targetPath = resolve(targetPath);
  if (!existsSync(targetPath)) {
    throw new CmiwError(`Target path does not exist: ${targetPath}`, 'INVALID_PATH');
  }

  // Phase 1: Load project
  const loadSpinner = ora('Loading project...').start();
  const project = loadProject({
    targetPath,
    tsconfigPath: options.tsconfigPath,
  });
  loadSpinner.succeed(`Loaded ${project.getSourceFiles().length} source files`);

  // Phase 2: Extract components
  const extractSpinner = ora('Extracting components...').start();
  const components = extractComponents(project);
  extractSpinner.succeed(`Extracted ${components.length} components`);

  // Phase 3: Build relationships
  const relSpinner = ora('Building relationships...').start();
  const relationships = buildRelationships(project, components);
  relSpinner.succeed(`Built ${relationships.length} relationships`);

  // Phase 4: Build knowledge graph
  const graphSpinner = ora('Building knowledge graph...').start();
  const graph = buildGraph(components, relationships);
  graphSpinner.succeed(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  // Phase 5: Security analysis
  const secSpinner = ora('Analyzing security...').start();
  const security = analyzeSecurityPosture(project);
  secSpinner.succeed(`Security: ${security.grade} (${security.score}/100) - ${security.findings.length} findings`);

  // Phase 6: LLM enrichment
  let architecture: Architecture;
  let llmEnriched = false;

  if (!options.skipLlm) {
    const llmSpinner = ora('Enriching with LLM...').start();
    try {
      const enrichment = await enrichWithLlm(components, relationships, graph, security);
      architecture = enrichment.architecture;
      if (enrichment.securityAssessment) {
        security.llmAssessment = enrichment.securityAssessment;
      }
      llmEnriched = true;
      llmSpinner.succeed('LLM enrichment complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      llmSpinner.fail(`LLM enrichment failed: ${message}`);
      architecture = {
        layers: [],
        patterns: [],
        decisions: [],
        summary: `LLM enrichment unavailable: ${message}`,
        llmAnalysis: `FAILED: ${message}`,
      };
    }
  } else {
    architecture = {
      layers: [],
      patterns: [],
      decisions: [],
      summary: 'LLM analysis skipped (--skip-llm flag). Run without this flag to get AI-powered architecture analysis.',
    };
  }

  // Phase 7: Assemble report
  const report = assembleReport({
    analyzedPath: targetPath,
    components,
    relationships,
    graph,
    architecture,
    security,
    startTime,
    llmEnriched,
  });

  // Phase 8: Format and output
  let output: string;
  switch (options.format) {
    case 'json':
      output = formatJson(report);
      break;
    case 'sarif':
      output = formatSarif(report);
      break;
    case 'markdown':
      output = formatMarkdown(report);
      break;
    case 'terminal':
      output = formatTerminal(report);
      break;
    default:
      output = formatJson(report);
  }

  if (options.outputPath) {
    await writeFile(resolve(options.outputPath), output, 'utf-8');
    console.error(`Report written to: ${resolve(options.outputPath)}`);
  } else {
    if (options.format === 'terminal') {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}
