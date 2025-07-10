import { 
  IPipelineNavigationService,
  NavigationResult
} from './types'
import { 
  StepId, 
  StepStatus, 
  CurrentStepInfo, 
  RawTranscript, 
  TranscriptProcessedData 
} from '../../../types'
import {
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_6_REPORT
} from '../../../constants'

/**
 * Service responsible for determining next steps in the pipeline
 * 
 * This service encapsulates the complex navigation logic for determining
 * which step should be executed next based on the current state, transcript
 * data, and processing context.
 * 
 * @implements IPipelineNavigationService
 */
export class PipelineNavigationService implements IPipelineNavigationService {
  
  /**
   * Determines the next step to execute in the pipeline
   * 
   * @param currentStepInfo - Current step state information
   * @param currentTranscriptIndex - Index of the current transcript being processed
   * @param transcriptData - Raw transcripts and processed data
   * @param genericAnalysisState - Generic analysis state including phase/GDU info
   * @returns NavigationResult with next step details or null if no next step
   */
  getNextStepDetails(
    currentStepInfo: CurrentStepInfo,
    currentTranscriptIndex: number,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: any
  ): NavigationResult | null {
    // Don't proceed if current step is not complete or has error
    if (currentStepInfo.status !== StepStatus.Success && 
        currentStepInfo.status !== StepStatus.Idle) {
      return null
    }

    // No transcripts available
    if (transcriptData.rawTranscripts.length === 0) {
      return null
    }

    // Handle initial state
    if (currentStepInfo.stepId === StepId.IDLE) {
      return {
        nextStepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        nextTranscriptIndex: 0
      }
    }

    // Handle completion
    if (currentStepInfo.stepId === StepId.P6_1_REPORT && 
        genericAnalysisState.isReportGenerated) {
      return {
        nextStepId: StepId.COMPLETE,
        nextTranscriptIndex: 0
      }
    }

    // Find current step in order
    const currentStepIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(currentStepInfo.stepId)
    if (currentStepIndex === -1) {
      return null
    }

    // Check if this is a transcript-specific step
    const isTranscriptSpecific = this.isTranscriptSpecificStep(currentStepInfo.stepId)
    
    if (isTranscriptSpecific && currentStepInfo.transcriptId) {
      // Check if there are more transcripts to process for this step
      const hasMoreTranscripts = currentTranscriptIndex + 1 < transcriptData.rawTranscripts.length
      
      if (hasMoreTranscripts) {
        // Process next transcript with same step
        return {
          nextStepId: currentStepInfo.stepId,
          nextTranscriptIndex: currentTranscriptIndex + 1
        }
      }
    }

    // Handle P2S phase navigation
    if (this.isP2SStep(currentStepInfo.stepId)) {
      const nextP2SResult = this.getNextP2SStep(
        currentStepInfo,
        transcriptData,
        genericAnalysisState
      )
      if (nextP2SResult) {
        return nextP2SResult
      }
    }

    // Handle P4S GDU navigation
    if (this.isP4SStep(currentStepInfo.stepId)) {
      const nextP4SResult = this.getNextP4SStep(
        currentStepInfo,
        genericAnalysisState
      )
      if (nextP4SResult) {
        return nextP4SResult
      }
    }

    // Move to next step in order
    const nextStepIndex = currentStepIndex + 1
    if (nextStepIndex < ALL_PIPELINE_STEP_IDS_IN_ORDER.length) {
      return {
        nextStepId: ALL_PIPELINE_STEP_IDS_IN_ORDER[nextStepIndex],
        nextTranscriptIndex: 0
      }
    }

    // No next step available
    return null
  }

  /**
   * Checks if a step processes individual transcripts
   */
  private isTranscriptSpecificStep(stepId: StepId): boolean {
    return STEP_ORDER_PART_0.includes(stepId) ||
           STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepId) ||
           STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)
  }

  /**
   * Checks if a step is part of P2S (Part 2 Specific) processing
   */
  private isP2SStep(stepId: StepId): boolean {
    return STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)
  }

  /**
   * Checks if a step is part of P4S (Part 4 Specific) processing
   */
  private isP4SStep(stepId: StepId): boolean {
    return STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)
  }

  /**
   * Determines next P2S step based on phase processing
   */
  private getNextP2SStep(
    currentStepInfo: CurrentStepInfo,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: any
  ): NavigationResult | null {
    if (!currentStepInfo.transcriptId) {
      return null
    }

    const processedData = transcriptData.processedData.get(currentStepInfo.transcriptId)
    const p1_4_output = genericAnalysisState.p1_4_outputs_by_transcript?.[currentStepInfo.transcriptId]
    
    if (!p1_4_output?.phases_full_descriptions) {
      return null
    }

    const allPhases = Object.keys(p1_4_output.phases_full_descriptions)
    const processedPhases = processedData?.processed_phases_for_p2s || []
    
    // Check if there are unprocessed phases
    const unprocessedPhases = allPhases.filter(phase => !processedPhases.includes(phase))
    
    if (unprocessedPhases.length > 0) {
      // Continue with same step for next phase
      return {
        nextStepId: currentStepInfo.stepId,
        nextTranscriptIndex: 0
      }
    }

    // All phases processed, move to next P2S step
    const currentIndex = STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.indexOf(currentStepInfo.stepId)
    const nextIndex = currentIndex + 1
    
    if (nextIndex < STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length) {
      return {
        nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[nextIndex],
        nextTranscriptIndex: 0
      }
    }

    return null
  }

  /**
   * Determines next P4S step based on GDU processing
   */
  private getNextP4SStep(
    currentStepInfo: CurrentStepInfo,
    genericAnalysisState: any
  ): NavigationResult | null {
    const allGDUs = genericAnalysisState.p3_1_output?.gdus || []
    const processedGDUs = genericAnalysisState.processed_gdus_for_p4s || []
    
    // Check if there are unprocessed GDUs
    const unprocessedGDUs = allGDUs.filter((gdu: string) => !processedGDUs.includes(gdu))
    
    if (unprocessedGDUs.length > 0) {
      // Continue with same step for next GDU
      return {
        nextStepId: currentStepInfo.stepId,
        nextTranscriptIndex: 0
      }
    }

    // All GDUs processed for current step, move to next P4S step
    if (currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
      return {
        nextStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        nextTranscriptIndex: 0
      }
    }

    return null
  }
}