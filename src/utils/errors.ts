/**
 * Intent: Provide typed error classes for different failure domains.
 * Guarantees: All errors include a machine-readable code and human-readable message.
 */

export class IddError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'IddError';
    this.code = code;
  }
}

export class ProjectLoadError extends IddError {
  constructor(message: string, public readonly path: string) {
    super(message, 'PROJECT_LOAD_ERROR');
    this.name = 'ProjectLoadError';
  }
}

export class AnalysisError extends IddError {
  constructor(message: string, public readonly phase: string) {
    super(message, 'ANALYSIS_ERROR');
    this.name = 'AnalysisError';
  }
}

export class LlmError extends IddError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'LLM_ERROR');
    this.name = 'LlmError';
  }
}
