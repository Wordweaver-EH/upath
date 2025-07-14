// Error types for pipeline execution

export interface PipelineError {
  message: string;
  timestamp: number;
  recoverable: boolean;
  stack?: string;
}

export class StepExecutionError extends Error {
  constructor(
    public readonly stepId: string,
    public readonly originalError: Error,
    public readonly recoverable: boolean = true
  ) {
    super(`Step ${stepId} execution failed: ${originalError.message}`);
    this.name = 'StepExecutionError';
    this.stack = originalError.stack;
  }
}

export class ParseError extends Error {
  constructor(
    public readonly stepId: string,
    public readonly rawOutput: string,
    public readonly originalError: Error
  ) {
    super(`Parse error in step ${stepId}: ${originalError.message}`);
    this.name = 'ParseError';
    this.stack = originalError.stack;
  }
}

export class ValidationError extends Error {
  constructor(
    public readonly stepId: string,
    public readonly validationRules: string[],
    public readonly originalError: Error
  ) {
    super(`Validation error in step ${stepId}: ${originalError.message}`);
    this.name = 'ValidationError';
    this.stack = originalError.stack;
  }
}

// Helper function to check if error is known type
export function isKnownError(error: unknown): error is Error {
  return error instanceof Error;
}

// Helper function to safely get error message
export function getErrorMessage(error: unknown): string {
  if (isKnownError(error)) {
    return error.message;
  }
  return String(error);
}