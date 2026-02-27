/**
 * Intent: Generate deterministic, unique IDs for components and relationships.
 * Guarantees: Same inputs always produce the same ID.
 * IDs are URL-safe and human-readable.
 */

import { createHash } from 'node:crypto';

/**
 * Generate a deterministic component ID from its type, file path, and name.
 *
 * Intent: Ensure the same component always gets the same ID across runs.
 * Guarantees: Output is a lowercase alphanumeric string with hyphens. Same inputs = same output.
 */
export function generateComponentId(type: string, filePath: string, name: string): string {
  const normalized = `${type}:${filePath}:${name}`.toLowerCase();
  const hash = createHash('sha256').update(normalized).digest('hex').substring(0, 8);
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  return `${type}-${safeName}-${hash}`;
}

/**
 * Generate a deterministic relationship ID from source, target, and type.
 *
 * Intent: Deduplicate relationships by ensuring same connection = same ID.
 * Guarantees: Output is a lowercase alphanumeric string with hyphens.
 */
export function generateRelationshipId(sourceId: string, targetId: string, type: string): string {
  const normalized = `${sourceId}:${targetId}:${type}`;
  const hash = createHash('sha256').update(normalized).digest('hex').substring(0, 8);
  return `rel-${type}-${hash}`;
}
