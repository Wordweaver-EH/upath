import { GraphState, ExecutionContext, NodeExecutionResult, StepId } from '../types';
import { NodeExecutionError } from '../types/errors';

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'exponential' | 'linear';
  initialDelayMs?: number;
}

export abstract class BaseNode {
  abstract id: StepId | string;
  
  retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelayMs: 100
  };

  /**
   * Execute the node's logic
   * Must be implemented by subclasses
   */
  abstract execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>>;

  /**
   * Execute with retry logic and error handling
   */
  async executeWithRetry(state: GraphState, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Validate input state first
    try {
      this.validateInputOrThrow(state);
    } catch (error: any) {
      return {
        success: false,
        error: {
          stepId: this.id,
          message: error.message,
          timestamp: Date.now(),
          recoverable: false
        }
      };
    }

    const { maxAttempts, backoff, initialDelayMs = 100 } = this.retryPolicy;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Log execution start
        context.logger.info('Executing node', { 
          nodeId: this.id, 
          attempt,
          sessionId: state.sessionId 
        });

        const startTime = Date.now();
        const result = await this.execute(state, context);
        const duration = Date.now() - startTime;

        // Log successful completion
        context.logger.info('Node execution completed', {
          nodeId: this.id,
          duration,
          sessionId: state.sessionId
        });

        return {
          success: true,
          state: result
        };
      } catch (error: any) {
        lastError = error;
        
        // Log the error
        context.logger.error(`Node execution failed (attempt ${attempt}/${maxAttempts})`, {
          nodeId: this.id,
          error: error.message,
          attempt
        });

        // If this wasn't the last attempt, wait before retrying
        if (attempt < maxAttempts) {
          const delay = this.calculateBackoffDelay(attempt, backoff, initialDelayMs);
          
          context.logger.info('Retrying node after delay', {
            nodeId: this.id,
            attempt: attempt + 1,
            delayMs: delay
          });

          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: {
        stepId: this.id,
        message: lastError?.message || 'Unknown error',
        timestamp: Date.now(),
        recoverable: this.isRecoverable(lastError!)
      }
    };
  }

  /**
   * Validate the input state
   * Can be overridden by subclasses for specific validation
   */
  protected validateInput(state: GraphState): boolean {
    return (
      state !== null &&
      state !== undefined &&
      state.sessionId !== undefined &&
      state.transcripts !== undefined &&
      state.stepOutputs !== undefined &&
      state.errors !== undefined &&
      state.metadata !== undefined
    );
  }

  /**
   * Validate input and throw if invalid
   * Can be overridden by subclasses for specific validation
   */
  protected validateInputOrThrow(state: GraphState): void {
    if (!state || !state.sessionId) {
      throw new Error('Invalid state: missing sessionId');
    }
    if (!state.transcripts) {
      throw new Error('Invalid state: missing transcripts');
    }
    if (!state.stepOutputs) {
      throw new Error('Invalid state: missing stepOutputs');
    }
    if (!state.errors) {
      throw new Error('Invalid state: missing errors');
    }
    if (!state.metadata) {
      throw new Error('Invalid state: missing metadata');
    }
  }

  /**
   * Determine if an error is recoverable
   * Can be overridden by subclasses
   */
  protected isRecoverable(error: Error): boolean {
    // Non-recoverable error patterns
    const nonRecoverablePatterns = [
      /validation failed/i,
      /invalid input/i,
      /missing required/i,
      /type error/i
    ];

    const errorMessage = error.message.toLowerCase();
    return !nonRecoverablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Calculate backoff delay for retries
   */
  protected calculateBackoffDelay(
    attempt: number, 
    backoff: 'exponential' | 'linear',
    initialDelayMs: number
  ): number {
    if (backoff === 'exponential') {
      return initialDelayMs * Math.pow(2, attempt - 1);
    } else {
      // Linear backoff: delay increases linearly with attempt number
      return initialDelayMs * attempt;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}