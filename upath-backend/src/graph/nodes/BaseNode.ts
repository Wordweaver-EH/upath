import { GraphState, ExecutionContext, NodeExecutionResult, StepId } from '../types';
import { NodeExecutionError } from '../types/errors';
import { LLMResponseError } from '../errors/LLMResponseError';
import { MissingInputError, ValidationError, ConfigurationError, RetryableExecutionError } from '../errors/CommonErrors';
import { GenerativeModel } from '@google/generative-ai';

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
        recoverable: lastError ? this.isRecoverable(lastError) : false
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
    // Specific error types with known recoverability
    if (error instanceof LLMResponseError) {
      return true; // LLM errors are typically recoverable
    }
    
    if (error instanceof RetryableExecutionError) {
      return true; // Explicitly marked as retryable
    }
    
    if (error instanceof MissingInputError || 
        error instanceof ValidationError || 
        error instanceof ConfigurationError) {
      return false; // Data/config errors are not recoverable
    }

    // Fallback to pattern matching for generic Error instances
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
   * Call LLM, parse JSON response, and validate structure
   * Centralizes common LLM interaction logic across all nodes
   */
  protected async callLLMAndParseJSON<T>(
    model: GenerativeModel,
    prompt: string,
    nodeId: string,
    validator?: (result: any) => T
  ): Promise<T> {
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText);
        
        // Apply validation if provided
        if (validator) {
          return validator(parsed);
        }
        
        return parsed as T;
      } catch (parseError) {
        // Note: Logger not available in this context, but error will be logged by calling node
        throw new LLMResponseError(
          `Failed to parse ${nodeId} response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`${nodeId} LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  /**
   * Build HIL-enhanced prompt by integrating user guidance
   * This method should be used by all nodes to ensure consistent HIL integration
   */
  protected buildHilEnhancedPrompt(originalPrompt: string, context: ExecutionContext): string {
    const { hilMetaPrompt } = context.settings;
    
    if (!hilMetaPrompt || !hilMetaPrompt.trim()) {
      return originalPrompt;
    }
    
    // Integrate HIL guidance into the prompt
    const enhancedPrompt = `${originalPrompt}

## HUMAN-IN-THE-LOOP CORRECTION GUIDANCE ##
The previous response to this prompt required correction. Please follow this user guidance carefully:

${hilMetaPrompt}

## INSTRUCTIONS ##
- Address the specific feedback provided above
- Maintain the same output format and structure requirements
- Ensure your corrected response fully resolves the issues mentioned in the guidance
- Do not reference this correction guidance in your response - produce the corrected content directly

Please provide the corrected response now:`;

    return enhancedPrompt;
  }

}