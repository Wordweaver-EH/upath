/**
 * Pipeline Executor
 * Core engine for step execution, based on working prototype's processSingleStep pattern
 */

import { StepId } from '../../types';
import { getErrorMessage } from '../../types/errors';
import { 
  PipelineExecutor, 
  StepExecutionRequest, 
  StepExecutionResponse,
  StepInputParams,
  GeminiApiParams,
  GeminiApiResponse 
} from './interfaces';
import { stepRegistry } from './registry';

/**
 * Pipeline Executor Implementation
 * Orchestrates step execution exactly like the working prototype's processSingleStep
 */
export class PipelineExecutorImpl implements PipelineExecutor {
  private geminiService: any; // Will be injected

  constructor(geminiService?: any) {
    this.geminiService = geminiService;
  }

  /**
   * Execute a single pipeline step
   * Exactly matches the working prototype's processSingleStep flow:
   * 1. Get step configuration
   * 2. Prepare input data
   * 3. Generate prompt
   * 4. Call LLM API
   * 5. Parse output
   * 6. Return result
   */
  async executeStep(request: StepExecutionRequest): Promise<StepExecutionResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`[PipelineExecutor] Executing step: ${request.stepId}`);

      // 1. Get step configuration
      const step = stepRegistry.get(request.stepId);
      console.log(`[PipelineExecutor] Step config: ${step.config.title} (${step.config.part})`);

      // 2. Prepare input data using step's getInput function
      const inputParams = this.prepareStepInputParams(request);
      const inputResult = step.getInput(inputParams);

      if (inputResult.error) {
        console.error(`[PipelineExecutor] Input preparation failed for ${request.stepId}: ${inputResult.error}`);
        return {
          success: false,
          stepId: request.stepId,
          error: inputResult.error,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`[PipelineExecutor] Input prepared successfully for ${request.stepId}`);

      // 3. Generate prompt using step's generatePrompt function
      const prompt = step.generatePrompt(inputResult.data);
      console.log(`[PipelineExecutor] Generated prompt for ${request.stepId} (${prompt.length} characters)`);

      // 4. Call LLM API (only if we have a Gemini service)
      let llmResult: any;
      let estimatedInputTokens: number | undefined;
      let estimatedOutputTokens: number | undefined;

      if (this.geminiService) {
        const geminiParams: GeminiApiParams = {
          prompt,
          isJsonOutput: step.config.isJsonOutput,
          useGrounding: request.useGrounding || false,
          temperature: request.temperature || 0,
          ...(request.model && { model: request.model }),
          ...(request.overrideSeed !== undefined && { seed: request.overrideSeed }),
        };

        const geminiResponse: GeminiApiResponse = await this.geminiService.callGeminiAPI(geminiParams);

        if (geminiResponse.error) {
          console.error(`[PipelineExecutor] LLM call failed for ${request.stepId}: ${geminiResponse.error}`);
          return {
            success: false,
            stepId: request.stepId,
            error: `LLM call failed: ${geminiResponse.error}`,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          };
        }

        llmResult = step.config.isJsonOutput ? geminiResponse.parsedJson : geminiResponse.text;
        estimatedInputTokens = geminiResponse.estimatedInputTokens;
        estimatedOutputTokens = geminiResponse.estimatedOutputTokens;

        console.log(`[PipelineExecutor] LLM call successful for ${request.stepId}`);
      } else {
        // Mock response for testing when no Gemini service is available
        console.warn(`[PipelineExecutor] No Gemini service available, returning mock response for ${request.stepId}`);
        llmResult = step.config.isJsonOutput 
          ? { mock: true, stepId: request.stepId, timestamp: new Date().toISOString() }
          : `Mock text response for ${request.stepId}`;
      }

      // 5. Parse output using step's parseOutput function (if it exists)
      let finalOutput = llmResult;
      
      if (step.parseOutput) {
        try {
          finalOutput = step.parseOutput(llmResult);
          console.log(`[PipelineExecutor] Output parsed successfully for ${request.stepId}`);
        } catch (parseError: unknown) {
          console.error(`[PipelineExecutor] Output parsing failed for ${request.stepId}:`, parseError);
          return {
            success: false,
            stepId: request.stepId,
            error: `Output parsing failed: ${getErrorMessage(parseError)}`,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // 6. Validate and clean output (if step has validateAndClean function)
      if (step.validateAndClean) {
        try {
          finalOutput = step.validateAndClean(finalOutput);
          console.log(`[PipelineExecutor] Output validated and cleaned for ${request.stepId}`);
        } catch (validateError: unknown) {
          console.error(`[PipelineExecutor] Output validation failed for ${request.stepId}:`, validateError);
          return {
            success: false,
            stepId: request.stepId,
            error: `Output validation failed: ${getErrorMessage(validateError)}`,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          };
        }
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`[PipelineExecutor] Step ${request.stepId} completed successfully in ${executionTimeMs}ms`);

      // 7. Return successful result
      const successResult: StepExecutionResponse = {
        success: true,
        stepId: request.stepId,
        output: finalOutput,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      };
      
      // Add token counts only if they exist
      if (estimatedInputTokens !== undefined) {
        successResult.estimatedInputTokens = estimatedInputTokens;
      }
      if (estimatedOutputTokens !== undefined) {
        successResult.estimatedOutputTokens = estimatedOutputTokens;
      }
      
      return successResult;

    } catch (error: unknown) {
      const executionTimeMs = Date.now() - startTime;
      console.error(`[PipelineExecutor] Unexpected error executing ${request.stepId}:`, error);
      
      return {
        success: false,
        stepId: request.stepId,
        error: `Unexpected error: ${getErrorMessage(error)}`,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Prepare step input parameters from execution request
   * Converts the request format to the StepInputParams format expected by steps
   */
  private prepareStepInputParams(request: StepExecutionRequest): StepInputParams {
    // Convert serialized processedData back to Map
    const processedDataMap = new Map();
    for (const [key, value] of Object.entries(request.processedData)) {
      processedDataMap.set(key, value);
    }

    const params: StepInputParams = {
      currentTranscript: request.currentTranscript,
      allRawTranscripts: request.allRawTranscripts,
      processedData: processedDataMap,
      genericAnalysisState: request.genericAnalysisState,
      userDvFocus: request.userDvFocus,
      apiKeyPresent: true, // Backend always has API key
    };
    
    // Add optional phase/GDU context if available
    // TODO: Extract from request if needed in future
    
    return params;
  }

  /**
   * Set the Gemini service (for dependency injection)
   */
  setGeminiService(geminiService: any): void {
    this.geminiService = geminiService;
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    stepsExecuted: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
  } {
    // This would be implemented with proper metrics collection
    return {
      stepsExecuted: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
    };
  }

  /**
   * Validate step dependencies before execution
   */
  async validateDependencies(stepId: StepId, processedData: Map<string, any>): Promise<{ valid: boolean; missingDependencies: StepId[] }> {
    const step = stepRegistry.get(stepId);
    
    if (!step.config.dependencies || step.config.dependencies.length === 0) {
      return { valid: true, missingDependencies: [] };
    }

    const missingDependencies: StepId[] = [];
    
    for (const depStepId of step.config.dependencies) {
      // Check if dependency output exists in processed data
      // This is a simplified check - real implementation would be more sophisticated
      const hasDependencyOutput = Array.from(processedData.values()).some(
        (transcriptData: any) => transcriptData && transcriptData[depStepId]
      );
      
      if (!hasDependencyOutput) {
        missingDependencies.push(depStepId);
      }
    }

    return {
      valid: missingDependencies.length === 0,
      missingDependencies,
    };
  }

  /**
   * Execute multiple steps in sequence
   * Useful for pipeline execution with dependency resolution
   */
  async executeSteps(requests: StepExecutionRequest[]): Promise<StepExecutionResponse[]> {
    const results: StepExecutionResponse[] = [];
    
    for (const request of requests) {
      const result = await this.executeStep(request);
      results.push(result);
      
      // Stop on first failure
      if (!result.success) {
        console.error(`[PipelineExecutor] Step sequence failed at ${request.stepId}, stopping execution`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Health check for the executor
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    const registeredSteps = stepRegistry.getStepCount();
    const hasGeminiService = !!this.geminiService;
    
    return {
      healthy: registeredSteps > 0 && hasGeminiService,
      details: {
        registeredSteps,
        hasGeminiService,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Export singleton instance
export const pipelineExecutor = new PipelineExecutorImpl();