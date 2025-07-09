import { STEP_CONFIGS } from '../../../constants'
import { StepId } from '../../../types'
import type { 
  IStepInputPreparationService, 
  ExecutionContext, 
  StoreState, 
  SettingsData, 
  StepInput, 
  ServiceResult 
} from './types'

/**
 * Service for preparing input data for step execution
 * 
 * This service extracts the input preparation logic from the monolithic
 * processSingleStep function. It handles:
 * - Step configuration lookup
 * - Input data generation using config.getInput
 * - Error handling for input preparation
 * - Parameter marshalling for getInput calls
 */
export class StepInputPreparationService implements IStepInputPreparationService {
  
  prepareInput(
    stepId: StepId,
    context: ExecutionContext,
    storeState: StoreState,
    settings: SettingsData
  ): ServiceResult<StepInput> {
    // Get step configuration
    const config = STEP_CONFIGS[stepId]
    if (!config) {
      return {
        success: false,
        error: `No configuration found for stepId: ${stepId}`
      }
    }

    // Check API key presence
    const apiKeyPresent = !!settings.apiKey

    // Call getInput with proper parameters
    let inputResult = config.getInput(
      context.currentTranscript,
      storeState.processedData,
      context.tempGenericState,
      apiKeyPresent,
      settings.userDvFocus,
      storeState.rawTranscripts,
      context.currentPhase,
      context.currentGDU
    )

    // Handle input errors
    if (inputResult === null || inputResult?.error) {
      const errText = `Input error for ${stepId}: ${inputResult?.error || 'Input null'}`
      return {
        success: false,
        error: errText
      }
    }

    // Return successful input data
    return {
      success: true,
      data: {
        data: inputResult.data,
        error: undefined
      }
    }
  }
}