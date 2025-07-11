import { StepId, StepStatus } from '../../../types'
import type { 
  IStepErrorHandlingService, 
  ServiceResult, 
  StoreState, 
  StepErrorHandlingParams 
} from './types'

/**
 * Service for handling step execution errors
 * 
 * This service extracts the error handling logic from the monolithic
 * processSingleStep function. It handles:
 * - Setting error states for specific steps
 * - Updating store state with error information
 * - Creating last step info for UI synchronization
 * - Setting shouldStopAutorun flag
 */
export class StepErrorHandlingService implements IStepErrorHandlingService {
  
  handleError(params: StepErrorHandlingParams): ServiceResult<void> {
    const { 
      stepId, 
      transcriptIdToProcess, 
      apiError, 
      storeState, 
      setStoreState 
    } = params

    if (!storeState || !setStoreState) {
      return {
        success: false,
        error: 'Store state and setter are required for error handling'
      }
    }

    console.log(`🔴 [StepErrorHandlingService] Setting lastStepInfo to Error for failed step: ${stepId}`)
    console.log(`- TranscriptId: ${transcriptIdToProcess || 'N/A (global)'}`)
    console.log(`- Error: ${apiError}`)
    
    // Update pipeline state - App.tsx will handle UI updates
    setStoreState(state => ({
      ...state,
      lastStepInfo: { 
        stepId, 
        status: StepStatus.Error,
        error: apiError,
        transcriptId: transcriptIdToProcess
      },
      lastError: apiError
    }))

    // Set specific step error fields based on step type
    if (stepId === StepId.P0_1_TRANSCRIPTION_ADHERENCE) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        console.log(`[StepErrorHandlingService] Found transcript data:`, tData ? 'yes' : 'no')
        if (tData) {
          const updated = { ...tData, p0_1_error: apiError }
          console.log(`[StepErrorHandlingService] Setting p0_1_error to:`, apiError)
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P0_2_ILP_DETECTION) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p0_2_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p0_3_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_1_INITIAL_SEGMENTATION) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_1_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_2_DIACHRONIC_UNIT_ID) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_2_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_3_REFINE_DIACHRONIC_UNITS) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_3_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_4_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p2s_1_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p2s_2_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P3_1_ALIGN_STRUCTURES) {
      setStoreState(state => {
        state.genericAnalysisState.p3_1_error = apiError
      })
    } else if (stepId === StepId.P3_2_IDENTIFY_GDUS) {
      setStoreState(state => {
        state.genericAnalysisState.p3_2_error = apiError
      })
    } else if (stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) {
      setStoreState(state => {
        state.genericAnalysisState.p3_3_error = apiError
      })
    } else if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
      setStoreState(state => {
        state.genericAnalysisState.p4s_1_a_error = apiError
      })
    } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
      setStoreState(state => {
        state.genericAnalysisState.p4s_1_b_error = apiError
      })
    } else if (stepId === StepId.P5_1_IV_COMPARATIVE_ANALYSIS) {
      setStoreState(state => {
        state.genericAnalysisState.p5_1_error = apiError
      })
    } else if (stepId === StepId.P5_2_HOLISTIC_REFINEMENT) {
      setStoreState(state => {
        state.genericAnalysisState.p5_2_error = apiError
      })
    } else if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
      setStoreState(state => {
        state.genericAnalysisState.p6_1_error = apiError
      })
    } else if (stepId === StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION) {
      setStoreState(state => {
        state.genericAnalysisState.p7_1_error = apiError
      })
    } else if (stepId === StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_2_error = apiError
      })
    } else if (stepId === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_3_error = apiError
      })
    } else if (stepId === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) {
      setStoreState(state => {
        state.genericAnalysisState.p7_3b_error = apiError
      })
    } else if (stepId === StepId.P7_4_ANALYZE_PATHS_AND_BIASES) {
      setStoreState(state => {
        state.genericAnalysisState.p7_4_error = apiError
      })
    } else if (stepId === StepId.P7_5_GENERATE_FORMAL_HYPOTHESES) {
      setStoreState(state => {
        state.genericAnalysisState.p7_5_error = apiError
      })
    }

    return {
      success: true,
      data: undefined
    }
  }
}