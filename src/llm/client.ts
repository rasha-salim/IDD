/**
 * Intent: Wrap the Anthropic SDK for CMIW-specific LLM calls.
 * Guarantees: Returns typed responses. Handles API errors with LlmError.
 * Never silently swallows errors -- if the LLM is unavailable, caller sees why.
 */

import Anthropic from '@anthropic-ai/sdk';
import { LlmError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

let clientInstance: Anthropic | null = null;

/**
 * Get or create the Anthropic client.
 *
 * Intent: Lazy initialization so the client is only created when needed.
 * Guarantees: Throws LlmError if ANTHROPIC_API_KEY is not set.
 */
export function getClient(): Anthropic {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new LlmError(
      'ANTHROPIC_API_KEY environment variable is not set. ' +
      'Set it or use --skip-llm to run without LLM enrichment.',
    );
  }

  clientInstance = new Anthropic({ apiKey });
  return clientInstance;
}

/**
 * Send a prompt to Claude and get a text response.
 *
 * Intent: Simple text-in/text-out interface for analysis prompts.
 * Guarantees: Returns the response text. Throws LlmError on failure with status code.
 */
export async function sendPrompt(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number },
): Promise<string> {
  const client = getClient();
  const maxTokens = options?.maxTokens ?? 4096;

  logger.debug('Sending prompt to Claude API', { systemPromptLength: systemPrompt.length, userPromptLength: userPrompt.length });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new LlmError('No text content in Claude response');
    }

    logger.debug('Received response from Claude API', { responseLength: textBlock.text.length });
    return textBlock.text;
  } catch (error) {
    if (error instanceof LlmError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    const statusCode = (error as any)?.status;
    throw new LlmError(`Claude API call failed: ${message}`, statusCode);
  }
}

/**
 * Reset the client instance (for testing).
 */
export function resetClient(): void {
  clientInstance = null;
}
