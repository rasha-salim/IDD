/**
 * Intent: Wrap existing ts-morph analysis code in the LanguageAnalyzer interface.
 * No changes to existing ts-morph logic -- this is a thin adapter.
 *
 * Guarantees: Delegates all work to existing core modules.
 * The existing analysis pipeline behavior is preserved exactly.
 */

import type { Project } from 'ts-morph';
import type { LanguageAnalyzer } from '../../core/language-analyzer.js';
import type { IddComponent, IddRelationship } from '../../types/components.js';
import type { SecurityPosture } from '../../types/security.js';
import type { SecurityConfig } from '../../types/config.js';
import { loadProject } from '../../core/project-loader.js';
import { extractComponents } from '../../core/component-extractor.js';
import { buildRelationships } from '../../core/relationship-builder.js';
import { analyzeSecurityPosture } from '../../core/security-analyzer.js';

export class TypeScriptAnalyzer implements LanguageAnalyzer {
  readonly language = 'typescript' as const;
  private project: Project | null = null;

  loadProject(targetPath: string, options?: Record<string, unknown>): void {
    this.project = loadProject({
      targetPath,
      tsconfigPath: options?.tsconfigPath as string | undefined,
    });
  }

  getFileCount(): number {
    this.ensureLoaded();
    return this.project!.getSourceFiles().length;
  }

  extractComponents(): IddComponent[] {
    this.ensureLoaded();
    return extractComponents(this.project!);
  }

  buildRelationships(components: IddComponent[]): IddRelationship[] {
    this.ensureLoaded();
    return buildRelationships(this.project!, components);
  }

  analyzeSecurityPosture(config?: SecurityConfig): SecurityPosture {
    this.ensureLoaded();
    return analyzeSecurityPosture(this.project!, config);
  }

  private ensureLoaded(): void {
    if (!this.project) {
      throw new Error('Project not loaded. Call loadProject() first.');
    }
  }
}
