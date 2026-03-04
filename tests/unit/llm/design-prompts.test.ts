import { describe, it, expect } from 'vitest';
import {
  DECOMPOSE_SYSTEM_PROMPT,
  OPTIONS_SYSTEM_PROMPT,
  DECIDE_SYSTEM_PROMPT,
  DIAGRAM_SYSTEM_PROMPT,
  DESIGN_SYSTEM_PROMPT,
} from '../../../src/llm/design-prompts.js';

describe('IDD Design Prompts', () => {
  it('DECOMPOSE_SYSTEM_PROMPT requests JSON output with components and assumptions', () => {
    expect(DECOMPOSE_SYSTEM_PROMPT).toContain('JSON');
    expect(DECOMPOSE_SYSTEM_PROMPT).toContain('components');
    expect(DECOMPOSE_SYSTEM_PROMPT).toContain('assumptions');
    expect(DECOMPOSE_SYSTEM_PROMPT).toContain('task');
  });

  it('OPTIONS_SYSTEM_PROMPT requests JSON output with componentOptions', () => {
    expect(OPTIONS_SYSTEM_PROMPT).toContain('JSON');
    expect(OPTIONS_SYSTEM_PROMPT).toContain('componentOptions');
    expect(OPTIONS_SYSTEM_PROMPT).toContain('pros');
    expect(OPTIONS_SYSTEM_PROMPT).toContain('cons');
    expect(OPTIONS_SYSTEM_PROMPT).toContain('recommendation');
  });

  it('DECIDE_SYSTEM_PROMPT requests JSON output with decisions', () => {
    expect(DECIDE_SYSTEM_PROMPT).toContain('JSON');
    expect(DECIDE_SYSTEM_PROMPT).toContain('decisions');
    expect(DECIDE_SYSTEM_PROMPT).toContain('component');
    expect(DECIDE_SYSTEM_PROMPT).toContain('choice');
    expect(DECIDE_SYSTEM_PROMPT).toContain('reason');
  });

  it('DIAGRAM_SYSTEM_PROMPT requests JSON output with mermaidCode', () => {
    expect(DIAGRAM_SYSTEM_PROMPT).toContain('JSON');
    expect(DIAGRAM_SYSTEM_PROMPT).toContain('mermaidCode');
    expect(DIAGRAM_SYSTEM_PROMPT).toContain('Mermaid');
    expect(DIAGRAM_SYSTEM_PROMPT).toContain('description');
  });

  it('DESIGN_SYSTEM_PROMPT includes all four phases in single-shot', () => {
    expect(DESIGN_SYSTEM_PROMPT).toContain('JSON');
    expect(DESIGN_SYSTEM_PROMPT).toContain('decomposition');
    expect(DESIGN_SYSTEM_PROMPT).toContain('componentOptions');
    expect(DESIGN_SYSTEM_PROMPT).toContain('decisions');
    expect(DESIGN_SYSTEM_PROMPT).toContain('mermaidCode');
  });
});
