/**
 * Intent: Define a language-agnostic interface for code analysis.
 * This abstraction allows the pipeline to work with any language (TS, Python, etc.)
 * without coupling to a specific parser like ts-morph.
 *
 * Guarantees: createAnalyzer returns a valid analyzer for supported languages.
 * Throws for unsupported languages.
 */

import type { IddComponent, IddRelationship } from '../types/components.js';
import type { SecurityPosture } from '../types/security.js';
import type { SecurityConfig } from '../types/config.js';

export interface LanguageAnalyzer {
  readonly language: 'typescript' | 'python';

  /** Load and parse source files from the target path */
  loadProject(targetPath: string, options?: Record<string, unknown>): Promise<void> | void;

  /** Get count of loaded source files */
  getFileCount(): number;

  /** Extract all components (classes, functions, modules, etc.) */
  extractComponents(): IddComponent[];

  /** Build relationships between extracted components */
  buildRelationships(components: IddComponent[]): IddRelationship[];

  /** Run security analysis and return findings */
  analyzeSecurityPosture(config?: SecurityConfig): SecurityPosture;
}

/**
 * Factory: create the right analyzer based on language.
 *
 * Intent: Encapsulate the decision of which analyzer to instantiate.
 * Guarantees: Returns a valid LanguageAnalyzer or throws for unsupported languages.
 */
export async function createAnalyzer(language: 'typescript' | 'python'): Promise<LanguageAnalyzer> {
  switch (language) {
    case 'typescript': {
      const { TypeScriptAnalyzer } = await import('../analyzers/typescript/index.js');
      return new TypeScriptAnalyzer();
    }
    case 'python': {
      const { PythonAnalyzer } = await import('../analyzers/python/index.js');
      return new PythonAnalyzer();
    }
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
