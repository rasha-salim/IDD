/**
 * Intent: Find and parse .cmiwrc.json configuration files.
 * Searches target directory and parents, validates structure, merges with CLI overrides.
 *
 * Guarantees: Always returns a valid SecurityConfig (defaults if no file found).
 * Invalid config files produce diagnostics, not silent failures.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import type { SecurityConfig } from '../types/config.js';
import type { Severity } from '../types/security.js';
import { logger } from '../utils/logger.js';

const CONFIG_FILENAME = '.cmiwrc.json';

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const DEFAULT_CONFIG: SecurityConfig = {
  rules: {},
  minSeverity: undefined,
  customSources: [],
  customSinks: {},
  customRouterNames: [],
  trustedMiddleware: [],
  falsePositivePatterns: [],
};

/**
 * Search for .cmiwrc.json starting from targetDir, walking up to filesystem root.
 *
 * Intent: Find the nearest config file applicable to the analysis target.
 * Guarantees: Returns the absolute path if found, undefined otherwise.
 */
function findConfigFile(targetDir: string): string | undefined {
  let current = resolve(targetDir);
  const root = dirname(current) === current ? current : undefined;

  while (true) {
    const candidate = join(current, CONFIG_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}

/**
 * Validate the structure of a parsed config object.
 *
 * Intent: Reject malformed config early with clear error messages.
 * Guarantees: Returns an array of validation errors (empty = valid).
 */
function validateConfig(raw: unknown): string[] {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push('Config must be a JSON object');
    return errors;
  }

  const config = raw as Record<string, unknown>;

  // Check for unexpected top-level key (only "security" is valid at top level)
  // But we also support flat config (security properties at top level)
  const securityBlock = config['security'] as Record<string, unknown> | undefined;
  const effective = securityBlock ?? config;

  if (effective['minSeverity'] !== undefined) {
    if (!VALID_SEVERITIES.includes(effective['minSeverity'] as Severity)) {
      errors.push(`Invalid minSeverity: "${effective['minSeverity']}". Must be one of: ${VALID_SEVERITIES.join(', ')}`);
    }
  }

  if (effective['rules'] !== undefined) {
    if (typeof effective['rules'] !== 'object' || effective['rules'] === null || Array.isArray(effective['rules'])) {
      errors.push('"rules" must be an object mapping rule IDs to RuleConfig');
    } else {
      const rules = effective['rules'] as Record<string, unknown>;
      for (const [ruleId, ruleConfig] of Object.entries(rules)) {
        if (typeof ruleConfig !== 'object' || ruleConfig === null) {
          errors.push(`Rule "${ruleId}" config must be an object`);
          continue;
        }
        const rc = ruleConfig as Record<string, unknown>;
        if (rc['enabled'] !== undefined && typeof rc['enabled'] !== 'boolean') {
          errors.push(`Rule "${ruleId}": "enabled" must be a boolean`);
        }
        if (rc['severity'] !== undefined && !VALID_SEVERITIES.includes(rc['severity'] as Severity)) {
          errors.push(`Rule "${ruleId}": invalid severity "${rc['severity']}"`);
        }
      }
    }
  }

  if (effective['customSources'] !== undefined) {
    if (!Array.isArray(effective['customSources'])) {
      errors.push('"customSources" must be an array of strings');
    }
  }

  if (effective['customSinks'] !== undefined) {
    if (typeof effective['customSinks'] !== 'object' || effective['customSinks'] === null || Array.isArray(effective['customSinks'])) {
      errors.push('"customSinks" must be an object mapping categories to string arrays');
    }
  }

  if (effective['customRouterNames'] !== undefined) {
    if (!Array.isArray(effective['customRouterNames'])) {
      errors.push('"customRouterNames" must be an array of strings');
    }
  }

  if (effective['trustedMiddleware'] !== undefined) {
    if (!Array.isArray(effective['trustedMiddleware'])) {
      errors.push('"trustedMiddleware" must be an array of strings');
    }
  }

  if (effective['falsePositivePatterns'] !== undefined) {
    if (!Array.isArray(effective['falsePositivePatterns'])) {
      errors.push('"falsePositivePatterns" must be an array of strings');
    }
  }

  return errors;
}

/**
 * Parse a raw config object into a SecurityConfig.
 *
 * Intent: Extract security-related settings from the parsed JSON.
 * Supports both { security: { ... } } wrapper and flat format.
 */
function parseConfig(raw: Record<string, unknown>): SecurityConfig {
  const securityBlock = raw['security'] as Record<string, unknown> | undefined;
  const effective = securityBlock ?? raw;

  return {
    rules: (effective['rules'] as SecurityConfig['rules']) ?? {},
    minSeverity: effective['minSeverity'] as Severity | undefined,
    customSources: (effective['customSources'] as string[]) ?? [],
    customSinks: (effective['customSinks'] as Record<string, string[]>) ?? {},
    customRouterNames: (effective['customRouterNames'] as string[]) ?? [],
    trustedMiddleware: (effective['trustedMiddleware'] as string[]) ?? [],
    falsePositivePatterns: (effective['falsePositivePatterns'] as string[]) ?? [],
  };
}

/**
 * Load security configuration from .cmiwrc.json and CLI overrides.
 *
 * Intent: Produce the merged SecurityConfig used throughout the analysis pipeline.
 * Guarantees: CLI overrides always win over file config. File config wins over defaults.
 *
 * Error strategy:
 * - Missing config file: return defaults (not an error)
 * - Invalid JSON: throw with file path and parse error
 * - Invalid structure: throw with specific validation messages
 */
export function loadSecurityConfig(options: {
  targetDir: string;
  configPath?: string;
  minSeverity?: Severity;
  disableRules?: string[];
}): SecurityConfig {
  let fileConfig: SecurityConfig = { ...DEFAULT_CONFIG };

  // Find config file
  const configPath = options.configPath
    ? resolve(options.configPath)
    : findConfigFile(options.targetDir);

  if (configPath) {
    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    logger.info(`Loading config from: ${configPath}`);

    let rawJson: string;
    try {
      rawJson = readFileSync(configPath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read config file ${configPath}: ${message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid JSON in ${configPath}: ${message}`);
    }

    const validationErrors = validateConfig(parsed);
    if (validationErrors.length > 0) {
      throw new Error(
        `Invalid config in ${configPath}:\n  - ${validationErrors.join('\n  - ')}`,
      );
    }

    fileConfig = parseConfig(parsed as Record<string, unknown>);
  } else {
    logger.debug('No .cmiwrc.json found, using defaults');
  }

  // Apply CLI overrides
  if (options.minSeverity) {
    fileConfig.minSeverity = options.minSeverity;
  }

  if (options.disableRules && options.disableRules.length > 0) {
    const rules = fileConfig.rules ?? {};
    for (const ruleId of options.disableRules) {
      rules[ruleId] = { ...rules[ruleId], enabled: false };
    }
    fileConfig.rules = rules;
  }

  return fileConfig;
}
