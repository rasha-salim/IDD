/**
 * Intent: Format IddReport as pretty-printed JSON.
 * Guarantees: Output is valid, parseable JSON with 2-space indentation.
 */

import type { IddReport } from '../types/report.js';

/**
 * Format a IDD report as JSON string.
 *
 * Intent: Produce machine-readable output for tooling consumption.
 * Guarantees: Valid JSON, 2-space indentation.
 */
export function formatJson(report: IddReport): string {
  return JSON.stringify(report, null, 2);
}
