import { 
  StepId, 
  StepStatus, 
  CurrentStepInfo, 
  RawTranscript, 
  TranscriptProcessedData,
  GenericAnalysisState,
  P2SPhaseData
} from '../../../types'
import {
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_6_REPORT,
  STEP_ORDER_PART_7_CAUSAL_MODELING
} from '../../../constants'
import { stepIdToDataKeyPrefix, isGlobalStep } from '../../utils/stepIdToDataKeyPrefix'
import { IEnhancedPipelineNavigationService, NavigationResult, ProcessNextStepResult } from './types'

/**
 * Enhanced Pipeline Navigation Service
 * 
 * This service encapsulates the complex navigation logic extracted from pipelineStore.
 * It determines the next step in the pipeline based on current state, transcript data,
 * and processing context.
 */
export class EnhancedPipelineNavigationService implements IEnhancedPipelineNavigationService {
  
  /**
   * Determines the next step details based on current state
   */
  getNextStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: GenericAnalysisState
  ): NavigationResult | null {
    const { rawTranscripts, processedData } = transcriptData
    
    const currentTranscriptId = rawTranscripts[activeTranscriptIndex]?.id
    const currentTData = currentTranscriptId ? processedData.get(currentTranscriptId) : undefined
    
    if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0) {
      return { nextStepId: STEP_ORDER_PART_NEG1[0], nextTranscriptIndex: 0 }
    }
    
    // Handle Part -1 steps
    const currentPartNeg1StepIndex = STEP_ORDER_PART_NEG1.indexOf(currentStepInfo.stepId)
    if (currentPartNeg1StepIndex !== -1) {
      const pNeg1DoneThisTranscript = currentTData?.p_neg1_1_output || currentTData?.p_neg1_1_error
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || pNeg1DoneThisTranscript) {
        if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_NEG1[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
        const allVarIdDone = rawTranscripts.every(rt => processedData.get(rt.id)?.p_neg1_1_output || processedData.get(rt.id)?.p_neg1_1_error)
        if (allVarIdDone) return { nextStepId: STEP_ORDER_PART_0[0], nextTranscriptIndex: 0 }
      }
    }
    
    // Handle Part 0 steps
    const currentPart0StepIndex = STEP_ORDER_PART_0.indexOf(currentStepInfo.stepId)
    if (currentPart0StepIndex !== -1) {
      const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof TranscriptProcessedData
      const part0OutputExists = key && (currentTData?.[key] || currentTData?.[`${key.replace('_output', '_error')}` as keyof TranscriptProcessedData])
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || part0OutputExists) {
        if (currentPart0StepIndex < STEP_ORDER_PART_0.length - 1) return { nextStepId: STEP_ORDER_PART_0[currentPart0StepIndex + 1], nextTranscriptIndex: activeTranscriptIndex }
        if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_0[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
        if (rawTranscripts.every(rt => STEP_ORDER_PART_0.every(s => { 
          const k = stepIdToDataKeyPrefix[s] as keyof TranscriptProcessedData
          return k && (processedData.get(rt.id)?.[k] || processedData.get(rt.id)?.[`${k.replace('_output','_error')}` as keyof TranscriptProcessedData])
        }))) {
          return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: 0 }
        }
      }
    }
    
    // Handle Part 1 steps
    const currentPart1StepIndex = STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.indexOf(currentStepInfo.stepId)
    if (currentPart1StepIndex !== -1) {
      const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof TranscriptProcessedData
      const part1OutputExists = key && (currentTData?.[key] || currentTData?.[`${key.replace('_output', '_error')}` as keyof TranscriptProcessedData])
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || part1OutputExists) {
        if (currentPart1StepIndex < STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.length - 1) {
          return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[currentPart1StepIndex + 1], nextTranscriptIndex: activeTranscriptIndex }
        }
        if (currentStepInfo.stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && currentTData?.isFullyProcessedSpecificDiachronic) {
          if ((currentTData?.phases_for_p2s_processing?.length || 0) > 0 && !currentTData?.isFullyProcessedSpecificSynchronic) {
            return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], nextTranscriptIndex: activeTranscriptIndex }
          }
          if (activeTranscriptIndex < rawTranscripts.length - 1) {
            return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
          }
          if (rawTranscripts.every(rt => processedData.get(rt.id)?.isFullyProcessedSpecificDiachronic) && 
              rawTranscripts.every(rt => { 
                const d = processedData.get(rt.id)
                return !d || (!d.phases_for_p2s_processing?.length || d.isFullyProcessedSpecificSynchronic)
              })) {
            return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], nextTranscriptIndex: 0 }
          }
        }
      }
    }
    
    // Handle Part 2 steps
    const currentP2SStepIndex = STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.indexOf(currentStepInfo.stepId)
    if (currentP2SStepIndex !== -1 && currentTData) {
      const phaseDone = currentStepInfo.currentPhaseForP2S
      let p2sOutputForCurrentPhaseAndStepExists = false
      if (phaseDone) {
        const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof P2SPhaseData
        if (key) {
          const pData = currentTData.p2s_outputs_by_phase?.[phaseDone]
          p2sOutputForCurrentPhaseAndStepExists = !!(pData?.[key] || pData?.[`${key.replace('_output', '_error')}` as keyof P2SPhaseData])
        }
      } else if (currentTData.isFullyProcessedSpecificSynchronic && !currentTData.phases_for_p2s_processing?.length) {
        p2sOutputForCurrentPhaseAndStepExists = true
      }
      
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || p2sOutputForCurrentPhaseAndStepExists) {
        if (currentP2SStepIndex < STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length - 1) {
          return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[currentP2SStepIndex + 1], nextTranscriptIndex: activeTranscriptIndex }
        }
        if (currentStepInfo.stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
          const totalPhases = currentTData.phases_for_p2s_processing || []
          const processedPhases = currentTData.processed_phases_for_p2s || []
          const allPhasesProcessed = totalPhases.length > 0 && totalPhases.every(phase => processedPhases.includes(phase))
          
          if (!allPhasesProcessed && totalPhases.length > 0) {
            return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], nextTranscriptIndex: activeTranscriptIndex }
          } else {
            if (activeTranscriptIndex < rawTranscripts.length - 1) {
              return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
            } else {
              return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], nextTranscriptIndex: 0 }
            }
          }
        }
      }
    }
    
    // Handle Part 3 steps
    const currentPart3StepIndex = STEP_ORDER_PART_3_GENERIC_DIACHRONIC.indexOf(currentStepInfo.stepId)
    if (currentPart3StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isFullyProcessedGenericDiachronic)) {
      if (genericAnalysisState.isFullyProcessedGenericDiachronic) {
        if ((genericAnalysisState.core_gdus_for_sync_analysis?.length || 0) > 0 && !genericAnalysisState.isFullyProcessedGenericSynchronic) {
          return { nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, nextTranscriptIndex: 0 }
        }
        if (STEP_ORDER_PART_5_REFINEMENT.length > 0 && !genericAnalysisState.isRefinementDone) {
          return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 }
        }
        if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0 && !genericAnalysisState.isCausalModelingDone) {
          return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 }
        }
        return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
      }
      if (currentPart3StepIndex < STEP_ORDER_PART_3_GENERIC_DIACHRONIC.length - 1) {
        return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[currentPart3StepIndex + 1], nextTranscriptIndex: 0 }
      }
    }
    
    // Handle Part 4 steps
    const currentP4SStepIndex = STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.indexOf(currentStepInfo.stepId)
    if (currentP4SStepIndex !== -1) {
      const stepErrorExists = currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES ? genericAnalysisState.p4s_1_a_error : genericAnalysisState.p4s_1_b_error
      const gduContextIsDone = (
        currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_outputs_by_gdu?.[currentStepInfo.currentGduForP4S || '']
      ) || (
        currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.processed_gdus_for_p4s?.includes(currentStepInfo.currentGduForP4S || '')
      )
      
      if (currentStepInfo.status === StepStatus.Success || (currentStepInfo.status === StepStatus.Error && stepErrorExists) || gduContextIsDone) {
        if (currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
          return { nextStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, nextTranscriptIndex: 0 }
        } else if (currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
          if (genericAnalysisState.isFullyProcessedGenericSynchronic) {
            if (STEP_ORDER_PART_5_REFINEMENT.length > 0) return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 }
            if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0) return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 }
            return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
          } else {
            return { nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, nextTranscriptIndex: 0 }
          }
        }
      }
    }
    
    // Handle Part 5 steps
    const currentPart5StepIndex = STEP_ORDER_PART_5_REFINEMENT.indexOf(currentStepInfo.stepId)
    if (currentPart5StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isRefinementDone)) {
      if (genericAnalysisState.isRefinementDone) {
        if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0 && !genericAnalysisState.isCausalModelingDone) {
          return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 }
        }
        if (STEP_ORDER_PART_6_REPORT.length > 0 && !genericAnalysisState.isReportGenerated) {
          return { nextStepId: STEP_ORDER_PART_6_REPORT[0], nextTranscriptIndex: 0 }
        }
        return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
      }
      if (currentPart5StepIndex < STEP_ORDER_PART_5_REFINEMENT.length - 1) {
        return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[currentPart5StepIndex + 1], nextTranscriptIndex: 0 }
      }
    }
    
    // Handle Part 7 steps
    const currentPart7StepIndex = STEP_ORDER_PART_7_CAUSAL_MODELING.indexOf(currentStepInfo.stepId)
    if (currentPart7StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isCausalModelingDone)) {
      if (genericAnalysisState.isCausalModelingDone) {
        if (STEP_ORDER_PART_6_REPORT.length > 0 && !genericAnalysisState.isReportGenerated) {
          return { nextStepId: STEP_ORDER_PART_6_REPORT[0], nextTranscriptIndex: 0 }
        }
        return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
      }
      if (currentPart7StepIndex < STEP_ORDER_PART_7_CAUSAL_MODELING.length - 1) {
        return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[currentPart7StepIndex + 1], nextTranscriptIndex: 0 }
      }
    }
    
    // Handle Part 6 steps
    const currentPart6StepIndex = STEP_ORDER_PART_6_REPORT.indexOf(currentStepInfo.stepId)
    if (currentPart6StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isReportGenerated)) {
      if (genericAnalysisState.isReportGenerated) return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
      if (currentPart6StepIndex < STEP_ORDER_PART_6_REPORT.length - 1) {
        return { nextStepId: STEP_ORDER_PART_6_REPORT[currentPart6StepIndex + 1], nextTranscriptIndex: 0 }
      }
    }
    
    if (currentStepInfo.stepId === StepId.COMPLETE) return null
    return null
  }
  
  /**
   * Process the next step and return step execution details
   */
  processNextStep(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: GenericAnalysisState
  ): ProcessNextStepResult | null {
    const { rawTranscripts } = transcriptData
    const details = this.getNextStepDetails(currentStepInfo, activeTranscriptIndex, transcriptData, genericAnalysisState)
    
    if (!details) {
      if (currentStepInfo.stepId !== StepId.COMPLETE && genericAnalysisState.isReportGenerated) {
        const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All processing complete."
        return {
          stepId: StepId.COMPLETE,
          transcriptIndex: 0,
          isComplete: true,
          report
        }
      }
      return null
    }
    
    if (details.nextStepId === StepId.COMPLETE) {
      const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete."
      return {
        stepId: StepId.COMPLETE,
        transcriptIndex: details.nextTranscriptIndex,
        isComplete: true,
        report
      }
    } else {
      const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId)
      const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id
      return {
        stepId: details.nextStepId,
        transcriptIndex: details.nextTranscriptIndex,
        transcriptId: nextTxId,
        isComplete: false
      }
    }
  }
}