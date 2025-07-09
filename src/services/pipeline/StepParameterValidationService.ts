import { STEP_CONFIGS } from '../../../constants'
import { StepId } from '../../../types'
import type { 
  IStepParameterValidationService, 
  StepExecutionParams, 
  ValidationResult, 
  ServiceResult 
} from './types'

/**
 * Service for validating and normalizing step execution parameters
 * 
 * This service extracts the parameter validation logic from the monolithic
 * processSingleStep function. It validates:
 * - Settings presence and validity
 * - API key presence
 * - DV focus requirements
 * - Step configuration availability
 */
export class StepParameterValidationService implements IStepParameterValidationService {
  
  validate(params: StepExecutionParams): ServiceResult<ValidationResult> {
    const { stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt, settings } = params

    // Validate settings presence
    if (!settings) {
      return {
        success: false,
        error: 'No settings provided to processSingleStep'
      }
    }

    // Validate API key
    const apiKeyPresent = !!settings.apiKey
    if (!apiKeyPresent) {
      return {
        success: false,
        error: 'API key is required'
      }
    }

    // Validate DV focus
    const dvFocusError = !settings.userDvFocus?.dv_focus?.length ? 'DV focus is required' : undefined
    if (dvFocusError) {
      return {
        success: false,
        error: dvFocusError
      }
    }

    // Validate step configuration
    const config = STEP_CONFIGS[stepId]
    if (!config) {
      return {
        success: false,
        error: `No configuration found for stepId: ${stepId}`
      }
    }

    // Return validated parameters
    const validationResult: ValidationResult = {
      isValid: true,
      stepId,
      transcriptIdToProcess,
      overrideSeed,
      hilMetaPrompt,
      settings
    }

    return {
      success: true,
      data: validationResult
    }
  }
}