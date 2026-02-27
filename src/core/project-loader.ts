/**
 * Intent: Initialize a ts-morph Project from a filesystem path.
 * Guarantees: Returns a fully configured Project with resolved source files.
 * Throws ProjectLoadError if the path is invalid or tsconfig cannot be found.
 */

import { Project } from 'ts-morph';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ProjectLoadError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface LoadOptions {
  targetPath: string;
  tsconfigPath?: string;
}

/**
 * Load a ts-morph Project from the given path.
 *
 * Intent: Create a Project instance that can be used for AST analysis.
 * Guarantees: The returned Project has at least one source file, or throws.
 */
export function loadProject(options: LoadOptions): Project {
  const absolutePath = resolve(options.targetPath);

  if (!existsSync(absolutePath)) {
    throw new ProjectLoadError(`Path does not exist: ${absolutePath}`, absolutePath);
  }

  const tsconfigPath = options.tsconfigPath
    ? resolve(options.tsconfigPath)
    : findTsConfig(absolutePath);

  let project: Project;

  if (tsconfigPath) {
    logger.info(`Loading project with tsconfig: ${tsconfigPath}`);
    project = new Project({ tsConfigFilePath: tsconfigPath });
  } else {
    logger.info(`No tsconfig found, loading files directly from: ${absolutePath}`);
    project = new Project({
      compilerOptions: {
        allowJs: true,
        strict: true,
      },
    });
    project.addSourceFilesAtPaths([
      join(absolutePath, '**/*.ts'),
      join(absolutePath, '**/*.tsx'),
      join(absolutePath, '**/*.js'),
      join(absolutePath, '**/*.jsx'),
    ]);
  }

  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) {
    throw new ProjectLoadError(
      `No source files found in: ${absolutePath}`,
      absolutePath,
    );
  }

  logger.info(`Loaded ${sourceFiles.length} source files`);
  return project;
}

function findTsConfig(dirPath: string): string | undefined {
  const candidates = ['tsconfig.json', 'tsconfig.app.json'];
  for (const name of candidates) {
    const fullPath = join(dirPath, name);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}
