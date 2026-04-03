/**
 * Pipeline Orchestrator Service
 * 
 * Manages pipeline execution flow using declarative configuration
 * instead of complex if/else chains. Provides clear state transitions
 * and supports pause/resume functionality.
 */

import {
  StepId,
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  CurrentStepInfo
} from '../../types'

import {
  PIPELINE_STRUCTURE,
  ProcessState,
  NextStepInfo,
  PipelinePart,
  IterationType,
  stepIdToDataKeyPrefix,
  isGlobalStep,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC
} from '../config/pipelineDefinition'

export class PipelineOrchestrator {
  constructor(
    private pipelineStructure = PIPELINE_STRUCTURE
  ) {}

  /**
   * Initialize process state for a new pipeline run
   */
  initializeProcessState(): ProcessState {
    return {
      status: 'idle',
      currentPartIndex: -1,
      currentStepIndex: -1,
      iterationContext: {}
    }
  }

  /**
   * Get the next step based on current state and data
   */
  getNextStep(
    processState: ProcessState,
    currentStepInfo: CurrentStepInfo,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    },
    activeTranscriptIndex: number
  ): NextStepInfo | null {
    const { rawTranscripts, processedData, genericAnalysisState } = dataState

    // Handle initial state
    if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0) {
      return this.getFirstStep(rawTranscripts)
    }

    // Handle completion
    if (currentStepInfo.stepId === StepId.COMPLETE) {
      return null
    }

    // Find current position in pipeline
    const currentPosition = this.findCurrentPosition(currentStepInfo.stepId)
    if (!currentPosition) {
      console.error(`Step ${currentStepInfo.stepId} not found in pipeline structure`)
      return null
    }

    // Check if current iteration is complete
    const iterationComplete = this.isIterationComplete(
      currentPosition,
      currentStepInfo,
      dataState,
      activeTranscriptIndex
    )

    if (iterationComplete) {
      // Move to next iteration or next step
      return this.getNextIteration(
        currentPosition,
        dataState,
        activeTranscriptIndex
      )
    }

    return null
  }

  /**
   * Get the first step of the pipeline
   */
  private getFirstStep(rawTranscripts: RawTranscript[]): NextStepInfo {
    const firstPart = this.pipelineStructure[0]
    const firstStep = firstPart.steps[0]
    
    return {
      nextStepId: firstStep,
      nextTranscriptIndex: 0,
      iterationType: firstPart.iteration
    }
  }

  /**
   * Find the current position in the pipeline structure
   */
  private findCurrentPosition(stepId: StepId): { partIndex: number, stepIndex: number, part: PipelinePart } | null {
    for (let partIndex = 0; partIndex < this.pipelineStructure.length; partIndex++) {
      const part = this.pipelineStructure[partIndex]
      const stepIndex = part.steps.indexOf(stepId)
      if (stepIndex !== -1) {
        return { partIndex, stepIndex, part }
      }
    }
    return null
  }

  /**
   * Check if the current iteration is complete
   */
  private isIterationComplete(
    position: { partIndex: number, stepIndex: number, part: PipelinePart },
    currentStepInfo: CurrentStepInfo,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    },
    activeTranscriptIndex: number
  ): boolean {
    // Check if step has output or error
    const hasOutput = this.stepHasOutput(currentStepInfo.stepId, dataState, activeTranscriptIndex)
    
    return currentStepInfo.status === StepStatus.Success || 
           currentStepInfo.status === StepStatus.Error || 
           hasOutput
  }

  /**
   * Check if a step has output in the data state
   */
  private stepHasOutput(
    stepId: StepId,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    },
    activeTranscriptIndex: number
  ): boolean {
    const key = stepIdToDataKeyPrefix[stepId]
    if (!key) return false

    if (isGlobalStep(stepId)) {
      // Check generic state
      const outputKey = key as keyof GenericAnalysisState
      const errorKey = `${key.toString().replace('_output', '_error')}` as keyof GenericAnalysisState
      return !!(dataState.genericAnalysisState[outputKey] || dataState.genericAnalysisState[errorKey])
    } else {
      // Check transcript-specific state
      const transcriptId = dataState.rawTranscripts[activeTranscriptIndex]?.id
      if (!transcriptId) return false
      
      const tData = dataState.processedData.get(transcriptId)
      if (!tData) return false

      if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
        // Check phase-specific output
        const currentPhase = tData.current_phase_for_p2s_processing
        if (!currentPhase) return false
        
        const phaseData = tData.p2s_outputs_by_phase?.[currentPhase]
        if (!phaseData) return false
        
        const outputKey = key as keyof typeof phaseData
        const errorKey = `${key.toString().replace('_output', '_error')}` as keyof typeof phaseData
        return !!(phaseData[outputKey] || phaseData[errorKey])
      } else {
        // Regular transcript output
        const outputKey = key as keyof TranscriptProcessedData
        const errorKey = `${key.toString().replace('_output', '_error')}` as keyof TranscriptProcessedData
        return !!(tData[outputKey] || tData[errorKey])
      }
    }
  }

  /**
   * Get the next iteration or next step
   */
  private getNextIteration(
    currentPosition: { partIndex: number, stepIndex: number, part: PipelinePart },
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    },
    activeTranscriptIndex: number
  ): NextStepInfo | null {
    const { partIndex, stepIndex, part } = currentPosition

    // Check if we need to move to next step in same part
    if (stepIndex < part.steps.length - 1) {
      return {
        nextStepId: part.steps[stepIndex + 1],
        nextTranscriptIndex: activeTranscriptIndex,
        iterationType: part.iteration
      }
    }

    // Current part is complete, check iteration type
    switch (part.iteration) {
      case 'per-transcript':
        return this.getNextTranscriptIteration(partIndex, dataState, activeTranscriptIndex)
      
      case 'per-phase':
        return this.getNextPhaseIteration(partIndex, dataState, activeTranscriptIndex)
      
      case 'per-gdu':
        return this.getNextGduIteration(partIndex, dataState)
      
      case 'global':
        return this.getNextPart(partIndex, dataState)
    }
  }

  /**
   * Get next iteration for per-transcript parts
   */
  private getNextTranscriptIteration(
    currentPartIndex: number,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    },
    activeTranscriptIndex: number
  ): NextStepInfo | null {
    const { rawTranscripts } = dataState
    const currentPart = this.pipelineStructure[currentPartIndex]

    // Check if more transcripts to process
    if (activeTranscriptIndex < rawTranscripts.length - 1) {
      return {
        nextStepId: currentPart.steps[0],
        nextTranscriptIndex: activeTranscriptIndex + 1,
        iterationType: 'per-transcript'
      }
    }

    // All transcripts processed for this part
    return this.getNextPart(currentPartIndex, dataState)
  }

  /**
   * Get next iteration for per-phase parts
   */
  private getNextPhaseIteration(
    currentPartIndex: number,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    },
    activeTranscriptIndex: number
  ): NextStepInfo | null {
    const { rawTranscripts, processedData } = dataState
    const currentPart = this.pipelineStructure[currentPartIndex]
    const transcriptId = rawTranscripts[activeTranscriptIndex]?.id
    if (!transcriptId) return null

    const tData = processedData.get(transcriptId)
    if (!tData) return null

    const phases = tData.phases_for_p2s_processing || []
    const currentPhaseIndex = phases.indexOf(tData.current_phase_for_p2s_processing || '')

    // Check if more phases to process for current transcript
    if (currentPhaseIndex < phases.length - 1) {
      return {
        nextStepId: currentPart.steps[0],
        nextTranscriptIndex: activeTranscriptIndex,
        nextPhaseIndex: currentPhaseIndex + 1,
        iterationType: 'per-phase'
      }
    }

    // All phases processed for current transcript, check next transcript
    if (activeTranscriptIndex < rawTranscripts.length - 1) {
      // Move to Part 1 for next transcript
      const part1Index = this.pipelineStructure.findIndex(p => p.name.includes("Specific Diachronic"))
      if (part1Index !== -1) {
        return {
          nextStepId: this.pipelineStructure[part1Index].steps[0],
          nextTranscriptIndex: activeTranscriptIndex + 1,
          iterationType: 'per-transcript'
        }
      }
    }

    // All transcripts and phases processed
    return this.getNextPart(currentPartIndex, dataState)
  }

  /**
   * Get next iteration for per-gdu parts
   */
  private getNextGduIteration(
    currentPartIndex: number,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    }
  ): NextStepInfo | null {
    const { genericAnalysisState } = dataState
    const currentPart = this.pipelineStructure[currentPartIndex]

    // Check if more GDUs to process
    const gdus = genericAnalysisState.p3_2_output?.identified_gdus || []
    const currentGduIndex = gdus.findIndex(g => g.gdu_id === genericAnalysisState.current_gdu_for_p4s_processing)

    if (currentGduIndex < gdus.length - 1) {
      return {
        nextStepId: currentPart.steps[0],
        nextGduIndex: currentGduIndex + 1,
        iterationType: 'per-gdu'
      }
    }

    // All GDUs processed
    return this.getNextPart(currentPartIndex, dataState)
  }

  /**
   * Get the next part in the pipeline
   */
  private getNextPart(
    currentPartIndex: number,
    dataState: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>,
      genericAnalysisState: GenericAnalysisState
    }
  ): NextStepInfo | null {
    // Check if there are more parts
    if (currentPartIndex < this.pipelineStructure.length - 1) {
      const nextPart = this.pipelineStructure[currentPartIndex + 1]
      
      // Special handling for Part 4 (Generic Synchronic)
      if (nextPart.name.includes("Generic Synchronic") && 
          !dataState.genericAnalysisState.isFullyProcessedGenericDiachronic) {
        // Skip Part 4 if Part 3 not complete
        return this.getNextPart(currentPartIndex + 1, dataState)
      }

      return {
        nextStepId: nextPart.steps[0],
        nextTranscriptIndex: 0,
        iterationType: nextPart.iteration
      }
    }

    // Pipeline complete
    return {
      nextStepId: StepId.COMPLETE,
      nextTranscriptIndex: 0,
      iterationType: 'global'
    }
  }

  /**
   * Update process state based on current execution
   */
  updateProcessState(
    currentState: ProcessState,
    currentStepId: StepId,
    status: StepStatus,
    error?: string
  ): ProcessState {
    const position = this.findCurrentPosition(currentStepId)
    if (!position) return currentState

    const newState: ProcessState = {
      ...currentState,
      currentPartIndex: position.partIndex,
      currentStepIndex: position.stepIndex,
      status: status === StepStatus.Loading ? 'running' : 
              status === StepStatus.Error ? 'error' :
              status === StepStatus.Success ? 'running' : 'idle'
    }

    if (error) {
      newState.lastError = {
        stepId: currentStepId,
        error,
        timestamp: Date.now()
      }
    }

    return newState
  }

  /**
   * Create a resume checkpoint
   */
  createResumeCheckpoint(processState: ProcessState): ProcessState {
    return {
      ...processState,
      resumeCheckpoint: {
        partIndex: processState.currentPartIndex,
        stepIndex: processState.currentStepIndex,
        iterationContext: { ...processState.iterationContext }
      }
    }
  }

  /**
   * Check if pipeline can be paused at current state
   */
  canPause(processState: ProcessState): boolean {
    if (processState.currentPartIndex < 0) return false
    
    const currentPart = this.pipelineStructure[processState.currentPartIndex]
    return currentPart?.canPause ?? true
  }
}