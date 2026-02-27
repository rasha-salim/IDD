/**
 * Intent: Format CmiwReport as pretty-printed JSON.
 * Guarantees: Output is valid, parseable JSON with 2-space indentation.
 */

import type { CmiwReport } from '../types/report.js';

/**
 * Format a CMIW report as JSON string.
 *
 * Intent: Produce machine-readable output for tooling consumption.
 * Guarantees: Valid JSON, 2-space indentation.
 */
export function formatJson(report: CmiwReport): string {
  return JSON.stringify(report, null, 2);
}
