/**
 * Intent: Define CLI and analysis configuration types.
 * Includes security rule configuration for tuning false positives/negatives.
 */

import type { SourceFile, Project, Node } from 'ts-morph';
import type { Severity, SecurityFinding } from './security.js';

export type OutputFormat = 'json' | 'sarif' | 'markdown' | 'terminal';

export interface AnalyzeOptions {
  targetPath: string;
  outputPath?: string;
  format: OutputFormat;
  tsconfigPath?: string;
  skipLlm: boolean;
  verbose: boolean;
  configPath?: string;
  minSeverity?: Severity;
  disableRules?: string[];
}

/**
 * Intent: Per-rule configuration for enabling/disabling and severity overrides.
 */
export interface RuleConfig {
  enabled: boolean;
  severity?: Severity;
  options?: Record<string, unknown>;
}

/**
 * Intent: Top-level security configuration loaded from .cmiwrc.json and CLI flags.
 * Controls which rules run, custom taint sources/sinks, and framework-specific settings.
 */
export interface SecurityConfig {
  rules?: Record<string, RuleConfig>;
  minSeverity?: Severity;
  customSources?: string[];
  customSinks?: Record<string, string[]>;
  customRouterNames?: string[];
  trustedMiddleware?: string[];
  falsePositivePatterns?: string[];
}

/**
 * Intent: Context passed to rules that support data-flow-aware analysis.
 * Provides taint checking and per-rule config.
 */
export interface TaintResult {
  isTainted: boolean;
  source?: string;
  path: string[];
}

export interface RuleContext {
  config: RuleConfig;
  securityConfig: SecurityConfig;
  isNodeTainted: (node: Node) => TaintResult;
}
