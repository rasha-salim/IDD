/**
 * Intent: Auto-detect the programming language of a project by scanning file extensions.
 * Guarantees: Returns a resolved language ('typescript' | 'python'), never 'auto'.
 * Falls back to 'typescript' if detection is ambiguous.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { Language } from '../types/config.js';
import { logger } from '../utils/logger.js';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const PYTHON_EXTENSIONS = new Set(['.py', '.pyw']);

/**
 * Detect the language of a project at the given path.
 *
 * Intent: Determine whether a codebase is TypeScript/JS or Python by counting file extensions.
 * Guarantees: Returns 'typescript' or 'python'. If override is set and not 'auto', returns it directly.
 */
export function detectLanguage(targetPath: string, override?: Language): 'typescript' | 'python' {
  if (override && override !== 'auto') {
    logger.info(`Language override: ${override}`);
    return override;
  }

  let tsCount = 0;
  let pyCount = 0;

  countFiles(targetPath, (ext) => {
    if (TS_EXTENSIONS.has(ext)) tsCount++;
    if (PYTHON_EXTENSIONS.has(ext)) pyCount++;
  });

  logger.info(`Language detection: ${tsCount} TS/JS files, ${pyCount} Python files`);

  if (pyCount > 0 && tsCount === 0) {
    return 'python';
  }

  if (tsCount > 0 && pyCount === 0) {
    return 'typescript';
  }

  if (pyCount > tsCount) {
    logger.warn('Mixed project detected (more Python files). Using Python.');
    return 'python';
  }

  if (tsCount > 0 && pyCount > 0) {
    logger.warn('Mixed project detected (more TS/JS files). Using TypeScript.');
  }

  return 'typescript';
}

/**
 * Recursively count files by extension.
 * Skips node_modules, .git, __pycache__, .venv, venv, dist directories.
 */
function countFiles(dirPath: string, callback: (ext: string) => void, depth = 0): void {
  if (depth > 10) return;

  const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', '.tox', '.mypy_cache']);

  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(dirPath, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        countFiles(fullPath, callback, depth + 1);
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        callback(ext);
      }
    } catch {
      // Skip inaccessible files
    }
  }
}
