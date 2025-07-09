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
    if (stepId === StepId.P1_1_INITIAL_SEGMENTATION) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_1_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_2_TOKEN_IDENTIFICATION) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_2_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_3_SYNTACTIC_ANALYSIS) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_3_error: apiError }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_4_SEMANTIC_ANALYSIS) {
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
    } else if (stepId === StepId.P3_1_IDENTIFY_GENERIC_DIACHRONIC_UNITS) {
      setStoreState(state => {
        state.genericAnalysisState.p3_1_error = apiError
      })
    } else if (stepId === StepId.P3_2_ASSIGN_RDUS_TO_GDUS) {
      setStoreState(state => {
        state.genericAnalysisState.p3_2_error = apiError
      })
    } else if (stepId === StepId.P3_3_MERMAID_VISUALIZATION) {
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
    } else if (stepId === StepId.P5_1_REFINEMENT_AND_ANALYSIS) {
      setStoreState(state => {
        state.genericAnalysisState.p5_1_error = apiError
      })
    } else if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
      setStoreState(state => {
        state.genericAnalysisState.p6_1_error = apiError
      })
    } else if (stepId === StepId.P7_1_IDENTIFY_CAUSAL_VARIABLES) {
      setStoreState(state => {
        state.genericAnalysisState.p7_1_error = apiError
      })
    } else if (stepId === StepId.P7_2_IDENTIFY_CAUSAL_RELATIONSHIPS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_2_error = apiError
      })
    } else if (stepId === StepId.P7_3_CAUSAL_NETWORK_ANALYSIS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_3_error = apiError
      })
    } else if (stepId === StepId.P7_3B_CAUSAL_NETWORK_ANALYSIS_ALTERNATE) {
      setStoreState(state => {
        state.genericAnalysisState.p7_3b_error = apiError
      })
    } else if (stepId === StepId.P7_4_IDENTIFY_FEEDBACK_LOOPS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_4_error = apiError
      })
    } else if (stepId === StepId.P7_5_EMERGENT_PROPERTIES) {
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