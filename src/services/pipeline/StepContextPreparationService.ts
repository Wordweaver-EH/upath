import { 
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, 
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC 
} from '../../../constants'
import { StepId } from '../../../types'
import type { 
  IStepContextPreparationService, 
  StoreState, 
  ExecutionContext, 
  ServiceResult 
} from './types'

/**
 * Service for preparing execution context for different step types
 * 
 * This service extracts the context preparation logic from the monolithic
 * processSingleStep function. It handles:
 * - Finding current transcript
 * - Managing P2S phase context
 * - Managing P4S GDU context
 * - Determining if step is a report step
 * - Preparing temporary generic state
 */
export class StepContextPreparationService implements IStepContextPreparationService {
  
  prepareContext(
    stepId: StepId,
    transcriptIdToProcess?: string,
    storeState?: StoreState
  ): ServiceResult<ExecutionContext> {
    if (!storeState) {
      return {
        success: false,
        error: 'Store state is required for context preparation'
      }
    }

    const { rawTranscripts, processedData, genericAnalysisState } = storeState

    // Prepare context variables
    const currentTranscript = transcriptIdToProcess 
      ? rawTranscripts.find(t => t.id === transcriptIdToProcess) 
      : undefined

    let currentPhase: string | undefined = undefined
    let currentGDU: string | undefined = undefined
    let tempGenericState = { ...genericAnalysisState }

    // Handle P2S phase context
    if (transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
      const tData = processedData.get(transcriptIdToProcess)
      if (tData) {
        currentPhase = tData.current_phase_for_p2s_processing
        
        // Set first phase if no current phase but phases exist
        if (!currentPhase && stepId === STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0] && (tData.phases_for_p2s_processing?.length || 0) > 0) {
          currentPhase = tData.phases_for_p2s_processing?.[0]
          
          // Update the store state
          const updatedTData = {
            ...tData,
            current_phase_for_p2s_processing: currentPhase
          }
          processedData.set(transcriptIdToProcess, updatedTData)
        }
        
        // Check if phase processing requirements are met
        if (!currentPhase && (tData.phases_for_p2s_processing?.length || 0) === 0 && !tData.isFullyProcessedSpecificSynchronic) {
          return {
            success: false,
            error: 'Phase processing requirements not met'
          }
        }
      }
    }

    // Handle P4S GDU context
    if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
      currentGDU = tempGenericState.current_gdu_for_p4s_processing
      
      // Set first GDU if no current GDU but GDUs exist
      if (!currentGDU && stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && (tempGenericState.core_gdus_for_sync_analysis?.length || 0) > 0) {
        const firstNonProcessed = tempGenericState.core_gdus_for_sync_analysis?.find(g => 
          !(tempGenericState.processed_gdus_for_p4s || []).includes(g)
        )
        
        if (firstNonProcessed) {
          currentGDU = firstNonProcessed
          tempGenericState = { 
            ...tempGenericState, 
            current_gdu_for_p4s_processing: firstNonProcessed, 
            p4s_1_a_error: undefined, 
            p4s_1_b_error: undefined 
          }
          
          // Update the store state
          storeState.genericAnalysisState.current_gdu_for_p4s_processing = firstNonProcessed
          storeState.genericAnalysisState.p4s_1_a_error = undefined
          storeState.genericAnalysisState.p4s_1_b_error = undefined
        } else if (!tempGenericState.isFullyProcessedGenericSynchronic) {
          return {
            success: false,
            error: 'Generic synchronic processing not complete'
          }
        }
      }
      
      // Check if GDU processing requirements are met
      if (!currentGDU && (tempGenericState.core_gdus_for_sync_analysis || []).length === 0 && !tempGenericState.isFullyProcessedGenericSynchronic) {
        return {
          success: false,
          error: 'GDU processing requirements not met'
        }
      }
    }

    // Determine if this is a report step
    const isReportStep = stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT

    // Create execution context
    const executionContext: ExecutionContext = {
      currentTranscript,
      currentPhase,
      currentGDU,
      tempGenericState,
      isReportStep
    }

    return {
      success: true,
      data: executionContext
    }
  }
}