/**
 * Intent: Initialize a ts-morph Project from a filesystem path.
 * Guarantees: Returns a fully configured Project with resolved source files.
 * Throws ProjectLoadError if the path is invalid or tsconfig cannot be found.
 */

import { Project } from 'ts-morph';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
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

  const tsconfigCandidates = options.tsconfigPath
    ? [resolve(options.tsconfigPath)]
    : findTsConfigs(absolutePath);

  let project: Project | undefined;

  for (const tsconfigPath of tsconfigCandidates) {
    logger.info(`Trying tsconfig: ${tsconfigPath}`);
    const candidate = new Project({ tsConfigFilePath: tsconfigPath });
    const fileCount = candidate.getSourceFiles().length;

    if (fileCount > 0) {
      logger.info(`Loaded ${fileCount} source files from ${tsconfigPath}`);
      project = candidate;
      break;
    }

    logger.debug(`tsconfig ${tsconfigPath} yielded 0 source files, trying next candidate`);
  }

  if (!project) {
    logger.info(`No tsconfig yielded source files, loading files directly from: ${absolutePath}`);
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

/**
 * Find tsconfig files to try, in priority order.
 *
 * Intent: Handle project-reference setups where tsconfig.json has "files": []
 * and delegates to tsconfig.app.json, tsconfig.node.json, etc.
 * Guarantees: Returns referenced configs after the root if root uses project references.
 */
function findTsConfigs(dirPath: string): string[] {
  const candidates: string[] = [];

  const rootTsconfig = join(dirPath, 'tsconfig.json');
  if (existsSync(rootTsconfig)) {
    candidates.push(rootTsconfig);

    // If root tsconfig uses project references, add referenced configs
    try {
      const content = readFileSync(rootTsconfig, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.references)) {
        for (const ref of parsed.references) {
          if (ref.path) {
            let refPath = resolve(dirPath, ref.path);
            // If path points to a directory, append tsconfig.json
            if (!refPath.endsWith('.json')) {
              refPath = join(refPath, 'tsconfig.json');
            }
            // Also check if the path itself is a .json file
            if (existsSync(refPath)) {
              candidates.push(refPath);
            }
          }
        }
      }
    } catch {
      // JSON parse failed -- just use the root tsconfig
    }
  }

  // Also check common alternative tsconfig names
  const alternates = ['tsconfig.app.json', 'tsconfig.src.json'];
  for (const name of alternates) {
    const fullPath = join(dirPath, name);
    if (existsSync(fullPath) && !candidates.includes(fullPath)) {
      candidates.push(fullPath);
    }
  }

  return candidates;
}
