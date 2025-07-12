/**
 * Error thrown when required input from previous step is missing or invalid
 */
export class MissingInputError extends Error {
  public readonly stepId: string;
  
  constructor(message: string, stepId?: string) {
    super(message);
    this.name = 'MissingInputError';
    this.stepId = stepId || 'unknown';
  }
}

/**
 * Error thrown when data validation fails
 */
export class ValidationError extends Error {
  public readonly validationType: string;
  
  constructor(message: string, validationType: string = 'general') {
    super(message);
    this.name = 'ValidationError';
    this.validationType = validationType;
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends Error {
  public readonly configKey: string;
  
  constructor(message: string, configKey?: string) {
    super(message);
    this.name = 'ConfigurationError';
    this.configKey = configKey || 'unknown';
  }
}

/**
 * Error thrown when node execution fails in a way that may be retryable
 */
export class RetryableExecutionError extends Error {
  public readonly attempt: number;
  public readonly maxAttempts: number;
  
  constructor(message: string, attempt: number, maxAttempts: number) {
    super(message);
    this.name = 'RetryableExecutionError';
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
  }
}