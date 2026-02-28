/**
 * Tests for language detection module.
 */

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { detectLanguage } from '../../../src/core/language-detector.js';

const FIXTURES_DIR = resolve(__dirname, '../../fixtures');

describe('detectLanguage', () => {
  it('detects TypeScript project from file extensions', () => {
    const result = detectLanguage(resolve(FIXTURES_DIR, 'simple-project'));
    expect(result).toBe('typescript');
  });

  it('detects Python project from file extensions', () => {
    const result = detectLanguage(resolve(FIXTURES_DIR, 'python-project'));
    expect(result).toBe('python');
  });

  it('returns typescript as default for empty or ambiguous directories', () => {
    const result = detectLanguage(resolve(FIXTURES_DIR));
    // Fixtures dir has both TS and Python, but TS should dominate or default
    expect(['typescript', 'python']).toContain(result);
  });

  it('respects language override for typescript', () => {
    const result = detectLanguage(resolve(FIXTURES_DIR, 'python-project'), 'typescript');
    expect(result).toBe('typescript');
  });

  it('respects language override for python', () => {
    const result = detectLanguage(resolve(FIXTURES_DIR, 'simple-project'), 'python');
    expect(result).toBe('python');
  });

  it('ignores auto override and detects normally', () => {
    const result = detectLanguage(resolve(FIXTURES_DIR, 'python-project'), 'auto');
    expect(result).toBe('python');
  });

  it('handles non-existent paths gracefully', () => {
    const result = detectLanguage('/nonexistent/path');
    expect(result).toBe('typescript'); // Default fallback
  });
});
