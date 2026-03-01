/**
 * Intent: Build a knowledge graph from a project and output as JSON.
 * This is a granular subcommand for agents that need the graph structure.
 *
 * Guarantees: Outputs KnowledgeGraph (nodes, edges, clusters, circularDependencies) as JSON to stdout.
 * Exit 0 on success, exit 1 on error.
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { SubcommandOptions } from '../../types/config.js';
import { detectLanguage } from '../../core/language-detector.js';
import { createAnalyzer } from '../../core/language-analyzer.js';
import { buildGraph } from '../../core/graph-builder.js';
import { shouldBeQuiet, createSpinner } from '../quiet-spinner.js';
import { setLogLevel } from '../../utils/logger.js';
import { CmiwError } from '../../utils/errors.js';

/**
 * Execute the graph subcommand.
 *
 * Intent: Run component extraction + relationship building + graph construction, output JSON.
 * Guarantees: stdout contains only valid KnowledgeGraph JSON.
 */
export async function runGraph(options: SubcommandOptions): Promise<void> {
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

  const relSpinner = createSpinner('Building relationships...', quiet);
  relSpinner.start();
  const relationships = analyzer.buildRelationships(components);
  relSpinner.succeed(`Built ${relationships.length} relationships`);

  const graphSpinner = createSpinner('Building knowledge graph...', quiet);
  graphSpinner.start();
  const graph = buildGraph(components, relationships);
  graphSpinner.succeed(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  console.log(JSON.stringify(graph, null, 2));
}
