import { StepId, StepStatus } from '../../../types'
import type { 
  IStepSuccessHandlingService, 
  ServiceResult, 
  StoreState, 
  StepSuccessHandlingParams 
} from './types'

/**
 * Service for handling successful step execution
 * 
 * This service extracts the success handling logic from the monolithic
 * processSingleStep function. It handles:
 * - Updating step outputs in store state
 * - Managing progression through phases and GDUs
 * - Setting completion flags and UI synchronization
 * - Handling report generation completion
 */
export class StepSuccessHandlingService implements IStepSuccessHandlingService {
  
  handleSuccess(params: StepSuccessHandlingParams): ServiceResult<void> {
    const { 
      stepId, 
      transcriptIdToProcess, 
      output, 
      inputData, 
      groundingSources, 
      currentGDU, 
      currentPhase, 
      storeState, 
      setStoreState 
    } = params

    if (!storeState || !setStoreState) {
      return {
        success: false,
        error: 'Store state and setter are required for success handling'
      }
    }

    console.log(`✅ [StepSuccessHandlingService] Processing successful step: ${stepId}`)
    console.log(`- TranscriptId: ${transcriptIdToProcess || 'N/A (global)'}`)
    console.log(`- Has output: ${!!output}`)

    // Update pipeline state - App.tsx will handle UI updates
    setStoreState(state => ({
      ...state,
      lastStepInfo: { 
        stepId, 
        status: StepStatus.Success,
        transcriptId: transcriptIdToProcess
      }
    }))

    // Handle specific step success logic
    if (stepId === StepId.P0_1_TRANSCRIPTION_ADHERENCE) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        console.log(`[StepSuccessHandlingService] P0_1 - Found transcript data:`, tData ? 'yes' : 'no')
        console.log(`[StepSuccessHandlingService] P0_1 - Setting output:`, output)
        if (tData) {
          const updated = { ...tData, p0_1_output: output, p0_1_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P0_2_REFINE_DATA_TYPES) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p0_2_output: output, p0_2_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p0_3_output: output, p0_3_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_1_INITIAL_SEGMENTATION) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_1_output: output, p1_1_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_2_DIACHRONIC_UNIT_ID) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_2_output: output, p1_2_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_3_REFINE_DIACHRONIC_UNITS) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_3_output: output, p1_3_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p1_4_output: output, p1_4_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p2s_1_output: output, p2s_1_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS) {
      setStoreState(state => {
        const tData = state.processedData.get(transcriptIdToProcess!)
        if (tData) {
          const updated = { ...tData, p2s_2_output: output, p2s_2_error: undefined }
          state.processedData.set(transcriptIdToProcess!, updated)
        }
      })
    } else if (stepId === StepId.P3_1_ALIGN_STRUCTURES) {
      setStoreState(state => {
        console.log(`[StepSuccessHandlingService] Setting P3_1 output:`, output)
        state.genericAnalysisState.p3_1_output = output
        state.genericAnalysisState.p3_1_error = undefined
      })
    } else if (stepId === StepId.P3_2_IDENTIFY_GDUS) {
      setStoreState(state => {
        state.genericAnalysisState.p3_2_output = output
        state.genericAnalysisState.p3_2_error = undefined
      })
    } else if (stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) {
      setStoreState(state => {
        state.genericAnalysisState.p3_3_output = output
        state.genericAnalysisState.p3_3_error = undefined
        state.genericAnalysisState.p3_3_mermaid_syntax = output
      })
    } else if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
      setStoreState(state => {
        if (currentGDU) {
          state.genericAnalysisState.p4s_1_a_outputs_by_gdu[currentGDU] = output
        }
        state.genericAnalysisState.p4s_1_a_error = undefined
      })
    } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
      setStoreState(state => {
        if (currentGDU) {
          state.genericAnalysisState.p4s_outputs_by_gdu[currentGDU] = output
        }
        state.genericAnalysisState.p4s_1_b_error = undefined
      })
    } else if (stepId === StepId.P5_1_IV_COMPARATIVE_ANALYSIS) {
      setStoreState(state => {
        state.genericAnalysisState.p5_1_output = output
        state.genericAnalysisState.p5_1_error = undefined
        state.genericAnalysisState.isRefinementDone = true
      })
    } else if (stepId === StepId.P5_2_HOLISTIC_REFINEMENT) {
      setStoreState(state => {
        state.genericAnalysisState.p5_2_output = output
        state.genericAnalysisState.p5_2_error = undefined
      })
    } else if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
      setStoreState(state => {
        state.genericAnalysisState.p6_1_output = output
        state.genericAnalysisState.p6_1_error = undefined
        state.genericAnalysisState.isReportGenerated = true
      })
    } else if (stepId === StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION) {
      setStoreState(state => {
        state.genericAnalysisState.p7_1_output = output
        state.genericAnalysisState.p7_1_error = undefined
      })
    } else if (stepId === StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_2_output = output
        state.genericAnalysisState.p7_2_error = undefined
      })
    } else if (stepId === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) {
      setStoreState(state => {
        state.genericAnalysisState.p7_3_output = output
        state.genericAnalysisState.p7_3_error = undefined
        state.genericAnalysisState.p7_3_mermaid_syntax_dag = output
      })
    } else if (stepId === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) {
      setStoreState(state => {
        state.genericAnalysisState.p7_3b_output = output
        state.genericAnalysisState.p7_3b_error = undefined
        state.genericAnalysisState.p7_3b_mermaid_syntax_dag = output
      })
    } else if (stepId === StepId.P7_4_ANALYZE_PATHS_AND_BIASES) {
      setStoreState(state => {
        state.genericAnalysisState.p7_4_output = output
        state.genericAnalysisState.p7_4_error = undefined
      })
    } else if (stepId === StepId.P7_5_GENERATE_FORMAL_HYPOTHESES) {
      setStoreState(state => {
        state.genericAnalysisState.p7_5_output = output
        state.genericAnalysisState.p7_5_error = undefined
        state.genericAnalysisState.isCausalModelingDone = true
      })
    }

    return {
      success: true,
      data: undefined
    }
  }
}