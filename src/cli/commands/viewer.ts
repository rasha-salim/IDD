/**
 * Intent: CLI handler for `idd viewer`.
 * Opens the bundled Mermaid system design viewer in the default browser.
 *
 * Guarantees: Cross-platform browser launch (Linux/WSL/macOS/Windows).
 * Falls back to printing the file path if the browser cannot be launched.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { platform } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve path to the bundled system-design.html asset.
 * Works from both src/ (dev via tsx) and dist/ (built).
 */
function resolveAssetPath(): string {
  // From dist/cli/commands/viewer.js -> ../../.. -> project root -> assets/
  // From src/cli/commands/viewer.ts -> ../../.. -> project root -> assets/
  const projectRoot = resolve(__dirname, '..', '..', '..');
  const assetPath = resolve(projectRoot, 'assets', 'system-design.html');

  if (!existsSync(assetPath)) {
    throw new Error(
      `Viewer asset not found at ${assetPath}. ` +
      'Ensure the assets/ directory is included in the package.',
    );
  }

  return assetPath;
}

/**
 * Open a file path in the default browser, cross-platform.
 */
function openInBrowser(filePath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const os = platform();
    let command: string;
    let args: string[];

    // Detect WSL by checking for Microsoft in the kernel version
    const isWSL = existsSync('/proc/version') &&
      readFileSync('/proc/version', 'utf-8').includes('microsoft');

    if (isWSL) {
      command = 'wslview';
      args = [filePath];
    } else if (os === 'darwin') {
      command = 'open';
      args = [filePath];
    } else if (os === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '', filePath];
    } else {
      // Linux (non-WSL)
      command = 'xdg-open';
      args = [filePath];
    }

    execFile(command, args, (error) => {
      if (error) {
        reject(error);
      } else {
        resolvePromise();
      }
    });
  });
}

export async function runViewerCommand(): Promise<void> {
  const assetPath = resolveAssetPath();

  try {
    await openInBrowser(assetPath);
    console.log(`Opened viewer: ${assetPath}`);
  } catch {
    console.log(`Could not open browser automatically.`);
    console.log(`Open this file manually in your browser:`);
    console.log(`  ${assetPath}`);
  }
}
