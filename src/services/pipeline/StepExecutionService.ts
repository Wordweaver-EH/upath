import { 
  IStepExecutionService, 
  StepInput, 
  ExecutionContext, 
  SettingsData, 
  StepOutput,
  ServiceResult 
} from './types'
import { StepId } from '../../../types'
import { callGeminiAPI } from '../../../services/geminiService'
import { generateMarkdownReportProgrammatically } from '../../utils/reportHelper'
import { STEP_CONFIGS } from '../../../constants'

/**
 * Service responsible for executing pipeline steps
 * 
 * This service encapsulates the core execution logic for pipeline steps,
 * handling both API calls (via Gemini) and report generation.
 * 
 * @implements IStepExecutionService
 */
export class StepExecutionService implements IStepExecutionService {
  
  /**
   * Executes a single pipeline step
   * 
   * @param stepId - The ID of the step to execute
   * @param input - The prepared input data for the step
   * @param context - Execution context including transcript and state
   * @param settings - User settings including API key and model parameters
   * @returns ServiceResult containing the step output or error
   */
  async executeStep(
    stepId: StepId,
    input: StepInput,
    context: ExecutionContext,
    settings: SettingsData
  ): Promise<ServiceResult<StepOutput>> {
    try {
      // Handle input errors
      if (input.error) {
        return {
          success: true,
          data: {
            output: null,
            apiError: input.error,
            promptForHistory: this.generatePromptForHistory(stepId, input.data)
          }
        }
      }

      let output: any
      let apiError: string | undefined
      let groundingSources: any[] | undefined
      let estimatedInputTokens: number | undefined
      let estimatedOutputTokens: number | undefined

      if (context.isReportStep) {
        // Generate report
        try {
          output = generateMarkdownReportProgrammatically(input.data, context.tempGenericState)
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during report generation'
          }
        }
      } else {
        // Make API call
        try {
          const apiResult = await callGeminiAPI(
            input.data, // prompt
            true, // isJsonOutput - all pipeline steps expect JSON
            false, // useGrounding
            settings.temperature,
            settings.seed,
            1 // attempt
          )
          
          output = apiResult.parsedJson
          apiError = apiResult.error
          groundingSources = apiResult.groundingSources
          estimatedInputTokens = apiResult.estimatedInputTokens
          estimatedOutputTokens = apiResult.estimatedOutputTokens
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during API call'
          }
        }
      }

      return {
        success: true,
        data: {
          output,
          apiError,
          groundingSources,
          estimatedInputTokens,
          estimatedOutputTokens,
          promptForHistory: this.generatePromptForHistory(stepId, input.data)
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during step execution'
      }
    }
  }

  /**
   * Generates a prompt for the history log
   * 
   * Uses the step's generatePrompt function if available,
   * otherwise falls back to a default format.
   * 
   * @param stepId - The ID of the step
   * @param inputData - The input data used for the step
   * @returns The formatted prompt string for history logging
   */
  private generatePromptForHistory(stepId: StepId, inputData: any): string {
    const stepConfig = STEP_CONFIGS[stepId]
    
    // Check if step config has generatePrompt function
    if (stepConfig?.generatePrompt && typeof stepConfig.generatePrompt === 'function') {
      try {
        return stepConfig.generatePrompt(inputData)
      } catch (error) {
        // Fall back to default format if generatePrompt fails
      }
    }
    
    // Default format when no generatePrompt is available
    const promptTemplate = stepConfig?.prompt || 'Step execution'
    const inputStr = typeof inputData === 'string' 
      ? inputData 
      : JSON.stringify(inputData, null, 2)
    
    return `${promptTemplate}\n\nInput:\n${inputStr}`
  }
}