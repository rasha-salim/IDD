/**
 * Intent: Execute IDD design phases by sending structured prompts to Claude.
 * Each function accepts a task string and optional previous-phase output for chaining.
 *
 * Guarantees: Returns typed results. Throws LlmError on API failure.
 * JSON parsing handles markdown-wrapped code blocks.
 */

import { sendPrompt } from './client.js';
import {
  DECOMPOSE_SYSTEM_PROMPT,
  OPTIONS_SYSTEM_PROMPT,
  DECIDE_SYSTEM_PROMPT,
  DIAGRAM_SYSTEM_PROMPT,
  DESIGN_SYSTEM_PROMPT,
} from './design-prompts.js';
import type {
  DecomposeResult,
  OptionsResult,
  DecideResult,
  DiagramResult,
  DesignDocument,
} from '../types/design.js';
import { LlmError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Parse a JSON response that may be wrapped in markdown code blocks.
 *
 * Intent: Handle Claude responses that wrap JSON in ```json ... ``` blocks.
 * Guarantees: Returns parsed object or throws with clear error message.
 */
export function parseJsonResponse<T>(response: string): T {
  // Try direct parse first
  const trimmed = response.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Try extracting from markdown code block
  }

  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new LlmError(`Failed to parse JSON from code block: ${message}`);
    }
  }

  throw new LlmError(
    `Response is not valid JSON and does not contain a JSON code block. Response starts with: ${trimmed.substring(0, 100)}`,
  );
}

/**
 * Run Phase 1: Decompose a task into components and assumptions.
 *
 * Intent: Break a task into its constituent parts before any implementation.
 * Guarantees: Returns DecomposeResult with task, components[], and assumptions[].
 */
export async function runDecompose(task: string): Promise<DecomposeResult> {
  logger.info('Running IDD Phase 1: Decompose');

  const userPrompt = `Decompose this task:\n\n${task}`;
  const response = await sendPrompt(DECOMPOSE_SYSTEM_PROMPT, userPrompt);
  const result = parseJsonResponse<DecomposeResult>(response);

  logger.info(`Decomposed into ${result.components.length} components with ${result.assumptions.length} assumptions`);
  return result;
}

/**
 * Run Phase 2: Generate options for each component.
 *
 * Intent: Present implementation choices where multiple valid approaches exist.
 * Guarantees: Returns OptionsResult with componentOptions[].
 */
export async function runOptions(
  task: string,
  decomposition?: DecomposeResult,
): Promise<OptionsResult> {
  logger.info('Running IDD Phase 2: Options');

  let userPrompt = `Analyze options for this task:\n\n${task}`;
  if (decomposition) {
    userPrompt += `\n\nPrevious decomposition:\n${JSON.stringify(decomposition, null, 2)}`;
  }

  const response = await sendPrompt(OPTIONS_SYSTEM_PROMPT, userPrompt);
  const result = parseJsonResponse<OptionsResult>(response);

  logger.info(`Generated options for ${result.componentOptions.length} components`);
  return result;
}

/**
 * Run Phase 3: Decide on approach for each component.
 *
 * Intent: Produce a clear decision table from options analysis.
 * Guarantees: Returns DecideResult with decisions[].
 */
export async function runDecide(
  task: string,
  options?: OptionsResult,
): Promise<DecideResult> {
  logger.info('Running IDD Phase 3: Decide');

  let userPrompt = `Make decisions for this task:\n\n${task}`;
  if (options) {
    userPrompt += `\n\nPrevious options analysis:\n${JSON.stringify(options, null, 2)}`;
  }

  const response = await sendPrompt(DECIDE_SYSTEM_PROMPT, userPrompt);
  const result = parseJsonResponse<DecideResult>(response);

  logger.info(`Made ${result.decisions.length} decisions`);
  return result;
}

/**
 * Run Phase 3.5: Generate a Mermaid system diagram from decisions.
 *
 * Intent: Visualize the decided architecture as a Mermaid diagram.
 * Guarantees: Returns DiagramResult with valid Mermaid code.
 */
export async function runDiagram(
  task: string,
  decisions?: DecideResult,
): Promise<DiagramResult> {
  logger.info('Running IDD Phase 3.5: Diagram');

  let userPrompt = `Create a system architecture diagram for this task:\n\n${task}`;
  if (decisions) {
    userPrompt += `\n\nDesign decisions:\n${JSON.stringify(decisions, null, 2)}`;
  }

  const response = await sendPrompt(DIAGRAM_SYSTEM_PROMPT, userPrompt);
  const result = parseJsonResponse<DiagramResult>(response);

  logger.info('Generated system diagram');
  return result;
}

/**
 * Run full design: all IDD phases in a single Claude call.
 *
 * Intent: Complete design analysis in one shot for simple/medium tasks.
 * Guarantees: Returns DesignDocument with all four phases populated.
 */
export async function runFullDesign(task: string): Promise<DesignDocument> {
  logger.info('Running IDD full design (single-shot)');

  const userPrompt = `Design a complete solution for this task:\n\n${task}`;
  const response = await sendPrompt(DESIGN_SYSTEM_PROMPT, userPrompt, {
    maxTokens: 8192,
  });
  const result = parseJsonResponse<DesignDocument>(response);

  logger.info(
    `Full design complete: ${result.decomposition.components.length} components, ` +
    `${result.decisions.decisions.length} decisions`,
  );
  return result;
}
