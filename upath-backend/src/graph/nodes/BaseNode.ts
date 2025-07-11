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
      return initialDelayMs;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate progress percentage based on current step
   */
  calculateProgress(currentStep: StepId | string): number {
    // Order of all steps
    const stepOrder = [
      StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
      StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      StepId.P0_2_REFINE_DATA_TYPES,
      StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
      StepId.P1_1_INITIAL_SEGMENTATION,
      StepId.P1_2_DIACHRONIC_UNIT_ID,
      StepId.P1_3_REFINE_DIACHRONIC_UNITS,
      StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
      StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
      StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
      StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
      StepId.P3_1_ALIGN_STRUCTURES,
      StepId.P3_2_IDENTIFY_GDUS,
      StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
      StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
      StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
      StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
      StepId.P5_2_HOLISTIC_REFINEMENT,
      StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
      StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
      StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
      StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
      StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
      StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
      StepId.P6_1_GENERATE_MARKDOWN_REPORT,
      StepId.COMPLETE
    ];

    if (currentStep === StepId.COMPLETE) {
      return 100;
    }

    const currentIndex = stepOrder.indexOf(currentStep as StepId);
    if (currentIndex === -1) {
      return 0;
    }

    return Math.round(((currentIndex + 1) / stepOrder.length) * 100);
  }
}