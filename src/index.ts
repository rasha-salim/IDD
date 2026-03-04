/**
 * IDD - Intent-Driven Development CLI.
 * Design solutions first (IDD phases), then analyze and assess code.
 *
 * Intent: Public library API for programmatic usage.
 * Re-exports core analysis functions, design functions, and types.
 */

export * from './types/index.js';
export { loadProject } from './core/project-loader.js';
export { extractComponents } from './core/component-extractor.js';
export { buildRelationships } from './core/relationship-builder.js';
export { buildGraph } from './core/graph-builder.js';
export { analyzeSecurityPosture } from './core/security-analyzer.js';
export { assembleReport } from './core/report-assembler.js';
export { detectLanguage } from './core/language-detector.js';
export { createAnalyzer } from './core/language-analyzer.js';
export type { LanguageAnalyzer } from './core/language-analyzer.js';
export { formatJson } from './output/json-formatter.js';
export { formatSarif } from './output/sarif-formatter.js';
export { formatMarkdown } from './output/markdown-formatter.js';
export { formatTerminal } from './output/terminal-formatter.js';
export {
  formatDecompose,
  formatOptions,
  formatDecide,
  formatDiagram,
  formatDesignDocument,
} from './output/design-formatter.js';
export {
  runDecompose,
  runOptions,
  runDecide,
  runDiagram,
  runFullDesign,
  parseJsonResponse,
} from './llm/design.js';
