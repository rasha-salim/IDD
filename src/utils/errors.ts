/**
 * Intent: Provide typed error classes for different failure domains.
 * Guarantees: All errors include a machine-readable code and human-readable message.
 */

export class CmiwError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CmiwError';
    this.code = code;
  }
}

export class ProjectLoadError extends CmiwError {
  constructor(message: string, public readonly path: string) {
    super(message, 'PROJECT_LOAD_ERROR');
    this.name = 'ProjectLoadError';
  }
}

export class AnalysisError extends CmiwError {
  constructor(message: string, public readonly phase: string) {
    super(message, 'ANALYSIS_ERROR');
    this.name = 'AnalysisError';
  }
}

export class LlmError extends CmiwError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'LLM_ERROR');
    this.name = 'LlmError';
  }
}
