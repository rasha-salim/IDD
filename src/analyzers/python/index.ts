/**
 * Intent: Main PythonAnalyzer that implements LanguageAnalyzer for Python codebases.
 * Uses web-tree-sitter (WASM) to parse Python files without native compilation.
 *
 * Guarantees: Initializes tree-sitter once, parses all .py files, delegates to
 * component-extractor, relationship-builder, and security-rules.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import Parser from 'web-tree-sitter';
import type { LanguageAnalyzer } from '../../core/language-analyzer.js';
import type { CmiwComponent, CmiwRelationship } from '../../types/components.js';
import type { SecurityPosture, Severity } from '../../types/security.js';
import type { SecurityConfig } from '../../types/config.js';
import { extractPythonComponents, type ParsedPythonFile } from './component-extractor.js';
import { buildPythonRelationships } from './relationship-builder.js';
import { runPythonSecurityRules } from './security-rules.js';
import { logger } from '../../utils/logger.js';

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

export class PythonAnalyzer implements LanguageAnalyzer {
  readonly language = 'python' as const;
  private files: ParsedPythonFile[] = [];
  private parser: Parser | null = null;

  async loadProject(targetPath: string): Promise<void> {
    const absolutePath = resolve(targetPath);

    // Initialize tree-sitter
    await Parser.init();
    this.parser = new Parser();

    // Load Python grammar WASM
    const wasmPath = this.findPythonWasm();
    const pythonLang = await Parser.Language.load(wasmPath);
    this.parser.setLanguage(pythonLang);

    // Find and parse all .py files
    const pyFiles = this.findPythonFiles(absolutePath);
    logger.info(`Found ${pyFiles.length} Python files`);

    this.files = [];
    for (const filePath of pyFiles) {
      try {
        const source = readFileSync(filePath, 'utf-8');
        const tree = this.parser.parse(source);
        this.files.push({ filePath, source, tree });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to parse ${filePath}: ${message}`);
      }
    }

    logger.info(`Parsed ${this.files.length} Python files successfully`);
  }

  getFileCount(): number {
    return this.files.length;
  }

  extractComponents(): CmiwComponent[] {
    return extractPythonComponents(this.files);
  }

  buildRelationships(components: CmiwComponent[]): CmiwRelationship[] {
    return buildPythonRelationships(this.files, components);
  }

  analyzeSecurityPosture(config?: SecurityConfig): SecurityPosture {
    const { findings, rules } = runPythonSecurityRules(this.files, config);

    let deductions = 0;
    for (const finding of findings) {
      deductions += SEVERITY_WEIGHTS[finding.severity] ?? 0;
    }
    const score = Math.max(0, Math.min(100, 100 - deductions));
    const grade = scoreToGrade(score);

    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;
    const mediumCount = findings.filter((f) => f.severity === 'medium').length;
    const lowCount = findings.filter((f) => f.severity === 'low').length;

    const summary = findings.length === 0
      ? 'No security findings detected. Static analysis passed all Python rules.'
      : `Found ${findings.length} security issues: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low. Score: ${score}/100 (${grade}).`;

    logger.info(`Python security posture: ${grade} (${score}/100) with ${findings.length} findings`);

    return { score, grade, findings, rules, summary };
  }

  private findPythonWasm(): string {
    // Look for tree-sitter-python.wasm in tree-sitter-wasms package
    const candidates = [
      join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', 'tree-sitter-python.wasm'),
      // Also check relative to this file's location for installed packages
      resolve(__dirname, '..', '..', '..', 'node_modules', 'tree-sitter-wasms', 'out', 'tree-sitter-python.wasm'),
    ];

    for (const candidate of candidates) {
      try {
        statSync(candidate);
        return candidate;
      } catch {
        // Try next
      }
    }

    throw new Error(
      'tree-sitter-python.wasm not found. Ensure tree-sitter-wasms is installed: npm install tree-sitter-wasms',
    );
  }

  private findPythonFiles(dirPath: string): string[] {
    const files: string[] = [];
    const SKIP_DIRS = new Set([
      'node_modules', '.git', '__pycache__', '.venv', 'venv', 'env',
      'dist', '.tox', '.mypy_cache', '.pytest_cache', '.eggs', '*.egg-info',
    ]);

    const walk = (dir: string, depth: number): void => {
      if (depth > 15) return;

      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry)) continue;

        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath, depth + 1);
          } else if (stat.isFile() && extname(entry).toLowerCase() === '.py') {
            files.push(fullPath);
          }
        } catch {
          // Skip inaccessible files
        }
      }
    };

    walk(dirPath, 0);
    return files;
  }
}

function scoreToGrade(score: number): SecurityPosture['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
