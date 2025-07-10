import { StepId, TranscriptProcessedData, GenericAnalysisState, P2SPhaseData } from '../../../types'
import { stepIdToDataKeyPrefix, isGlobalStep } from '../../utils/stepIdToDataKeyPrefix'
import { 
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC
} from '../../../constants'

interface InvalidationResult {
  processedData: Map<string, TranscriptProcessedData>
  genericState: GenericAnalysisState
}

interface CascadeInvalidationResult {
  invalidatedProcessedData: Map<string, TranscriptProcessedData>
  invalidatedGenericState: GenericAnalysisState
}

export class PipelineInvalidationService {
  invalidateStep(
    stepId: StepId,
    transcriptId: string | undefined,
    processedData: Map<string, TranscriptProcessedData>,
    genericState: GenericAnalysisState
  ): InvalidationResult {
    const newProcessedData = new Map(processedData)
    const newGenericState = { ...genericState }
    
    const keyPrefix = stepIdToDataKeyPrefix[stepId]
    if (!keyPrefix) {
      return { processedData: newProcessedData, genericState: newGenericState }
    }
    
    const outputKey = keyPrefix
    const errorKey = `${keyPrefix.replace('_output', '_error')}`
    
    if (isGlobalStep(stepId)) {
      // Handle global step invalidation
      delete newGenericState[outputKey as keyof GenericAnalysisState]
      delete newGenericState[errorKey as keyof GenericAnalysisState]
    } else if (transcriptId) {
      // Handle transcript step invalidation
      const transcriptData = newProcessedData.get(transcriptId)
      if (transcriptData) {
        const updatedData = { ...transcriptData }
        delete updatedData[outputKey as keyof TranscriptProcessedData]
        delete updatedData[errorKey as keyof TranscriptProcessedData]
        newProcessedData.set(transcriptId, updatedData)
      }
    }
    
    return {
      processedData: newProcessedData,
      genericState: newGenericState
    }
  }
  
  getInvalidatedStates(
    startInvalidationFromStepId: StepId,
    currentActiveTxId: string | undefined,
    currentProcessedData: Map<string, TranscriptProcessedData>,
    currentGenericState: GenericAnalysisState
  ): CascadeInvalidationResult {
    let newProcessedData = new Map(currentProcessedData)
    let newGenericState = { ...currentGenericState }
    
    // Flag to track when per-transcript changes require global cascade
    let globalCascadeRequired = false
    
    const startIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(startInvalidationFromStepId)
    if (startIndex === -1) {
      return { 
        invalidatedProcessedData: newProcessedData, 
        invalidatedGenericState: newGenericState 
      }
    }
    
    for (let i = startIndex; i < ALL_PIPELINE_STEP_IDS_IN_ORDER.length; i++) {
      const stepToInvalidate = ALL_PIPELINE_STEP_IDS_IN_ORDER[i]
      if (stepToInvalidate === StepId.COMPLETE || stepToInvalidate === StepId.IDLE) continue
      
      const keyPrefix = stepIdToDataKeyPrefix[stepToInvalidate]
      if (!keyPrefix) continue
      
      const errorKey = `${String(keyPrefix).replace('_output', '_error')}`
      
      // Per-transcript invalidation logic
      if (currentActiveTxId && !isGlobalStep(stepToInvalidate)) {
        if (STEP_ORDER_PART_NEG1.includes(stepToInvalidate) || 
            STEP_ORDER_PART_0.includes(stepToInvalidate) || 
            STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepToInvalidate)) {
          const tData = newProcessedData.get(currentActiveTxId)
          if (tData) {
            let updatedTData = { ...tData }
            delete updatedTData[keyPrefix as keyof TranscriptProcessedData]
            delete updatedTData[errorKey as keyof TranscriptProcessedData]
            
            if (stepToInvalidate === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
              updatedTData = { 
                ...updatedTData, 
                isFullyProcessedSpecificDiachronic: false, 
                p1_4_mermaid_syntax: undefined, 
                phases_for_p2s_processing: [], 
                current_phase_for_p2s_processing: undefined, 
                processed_phases_for_p2s: [], 
                p2s_outputs_by_phase: {}, 
                isFullyProcessedSpecificSynchronic: false 
              }
            }
            newProcessedData.set(currentActiveTxId, updatedTData as TranscriptProcessedData)
          }
        } else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepToInvalidate)) {
          const tData = newProcessedData.get(currentActiveTxId)
          if (tData) {
            // Invalidation for P2S steps is scoped to the currently active phase
            const currentPhase = tData.current_phase_for_p2s_processing
            
            if (currentPhase && tData.p2s_outputs_by_phase?.[currentPhase]) {
              const keyPrefixToClear = stepIdToDataKeyPrefix[stepToInvalidate] as keyof P2SPhaseData
              if (keyPrefixToClear) {
                // Create a mutable copy of the data for the specific phase we are invalidating
                const phaseDataToUpdate = { ...tData.p2s_outputs_by_phase[currentPhase] }
                
                // Delete the output and error for this specific step
                delete phaseDataToUpdate[keyPrefixToClear]
                const errorKeyToClear = `${String(keyPrefixToClear).replace('_output', '_error')}` as keyof P2SPhaseData
                delete phaseDataToUpdate[errorKeyToClear]
                
                // Special handling for P2S.3 which also generates mermaid syntax
                if (stepToInvalidate === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
                  delete phaseDataToUpdate.p2s_3_mermaid_syntax
                }
                
                // Construct the new state for p2s_outputs_by_phase
                const updatedP2SOutputs = {
                  ...tData.p2s_outputs_by_phase,
                  [currentPhase]: phaseDataToUpdate,
                }
                
                // Since we are invalidating a step, this phase is no longer fully processed
                const newProcessedPhases = tData.processed_phases_for_p2s?.filter(p => p !== currentPhase) || []
                
                // Update the transcript data in the map
                newProcessedData.set(currentActiveTxId, {
                  ...tData,
                  p2s_outputs_by_phase: updatedP2SOutputs,
                  isFullyProcessedSpecificSynchronic: false,
                  processed_phases_for_p2s: newProcessedPhases,
                })
              }
            }
          }
        }
        globalCascadeRequired = true
      } else if (isGlobalStep(stepToInvalidate) || globalCascadeRequired) {
        // Invalidate global step if downstream OR if cascade required from per-transcript changes
        delete newGenericState[keyPrefix as keyof GenericAnalysisState]
        delete newGenericState[errorKey as keyof GenericAnalysisState]
        
        if (stepToInvalidate === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) {
          newGenericState.isFullyProcessedGenericDiachronic = false
          newGenericState.p3_3_mermaid_syntax = undefined
          newGenericState.core_gdus_for_sync_analysis = []
          newGenericState.p4s_1_a_outputs_by_gdu = {}
          newGenericState.p4s_1_a_error = undefined
          newGenericState.p4s_outputs_by_gdu = {}
          newGenericState.p4s_mermaid_syntax_by_gdu = {}
          newGenericState.p4s_1_b_error = undefined
          newGenericState.current_gdu_for_p4s_processing = undefined
          newGenericState.processed_gdus_for_p4s = []
          newGenericState.isFullyProcessedGenericSynchronic = false
        } else if (stepToInvalidate === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
          newGenericState.p4s_1_a_outputs_by_gdu = {}
          newGenericState.p4s_1_a_error = undefined
          newGenericState.p4s_outputs_by_gdu = {}
          newGenericState.p4s_mermaid_syntax_by_gdu = {}
          newGenericState.p4s_1_b_error = undefined
          newGenericState.processed_gdus_for_p4s = []
          newGenericState.isFullyProcessedGenericSynchronic = false
        } else if (stepToInvalidate === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
          newGenericState.p4s_outputs_by_gdu = {}
          newGenericState.p4s_mermaid_syntax_by_gdu = {}
          newGenericState.p4s_1_b_error = undefined
          newGenericState.processed_gdus_for_p4s = []
          newGenericState.isFullyProcessedGenericSynchronic = false
        } else if (stepToInvalidate === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) {
          newGenericState.p7_3_mermaid_syntax_dag = undefined
        } else if (stepToInvalidate === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) {
          newGenericState.p7_3b_mermaid_syntax_dag = undefined
        } else if (stepToInvalidate === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
          newGenericState.isReportGenerated = false
        }
      }
    }
    
    return {
      invalidatedProcessedData: newProcessedData,
      invalidatedGenericState: newGenericState
    }
  }
}