/**
 * Intent: Clone git repositories for remote analysis.
 * Guarantees: Cloned to a temp directory, caller responsible for cleanup.
 */

import { simpleGit } from 'simple-git';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger.js';

/**
 * Clone a git repository to a temporary directory.
 *
 * Intent: Support analyzing remote repositories by cloning them locally.
 * Guarantees: Returns the path to the cloned repo. Throws on clone failure.
 */
export async function cloneRepo(repoUrl: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'idd-'));
  logger.info(`Cloning ${repoUrl} to ${tempDir}`);

  const git = simpleGit();
  await git.clone(repoUrl, tempDir, ['--depth', '1']);

  logger.info(`Clone complete: ${tempDir}`);
  return tempDir;
}
