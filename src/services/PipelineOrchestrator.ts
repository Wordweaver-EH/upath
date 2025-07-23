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

    // Handle initial state with resume support
    if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0) {
      // Check if we have a resume checkpoint from an explicit pause
      if (processState.resumeCheckpoint) {
        const { partIndex, stepIndex, iterationContext } = processState.resumeCheckpoint
        
        const part = this.pipelineStructure[partIndex]
        if (part && stepIndex < part.steps.length) {
          return {
            nextStepId: part.steps[stepIndex],
            nextTranscriptIndex: iterationContext.transcriptIndex ?? 0,
            iterationType: part.iteration
          }
        }
      }
      
      // NEW LOGIC: If no checkpoint, check the main processState to find the *last completed step*
      // and then calculate the *next* step from there. This handles resuming after a page reload.
      if (processState.currentPartIndex > -1 && processState.currentStepIndex > -1) {
        const lastPart = this.pipelineStructure[processState.currentPartIndex];
        if (lastPart) {
          const lastStepId = lastPart.steps[processState.currentStepIndex];
          const lastPosition = {
            partIndex: processState.currentPartIndex,
            stepIndex: processState.currentStepIndex,
            part: lastPart
          };
          
          // Use the persisted iteration context to determine the correct transcript index to resume from.
          const resumeTranscriptIndex = processState.iterationContext.transcriptIndex ?? activeTranscriptIndex;
          
          // Now, we can find the next step as if the last step just completed.
          return this.getNextIteration(lastPosition, dataState, resumeTranscriptIndex);
        }
      }
      
      // No checkpoint and no progress in processState, start from beginning
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
    
    console.log('[Orchestrator] isIterationComplete check:', {
      stepId: currentStepInfo.stepId,
      status: currentStepInfo.status,
      hasOutput,
      statusIsSuccess: currentStepInfo.status === StepStatus.Success,
      statusIsError: currentStepInfo.status === StepStatus.Error
    });
    
    // For P2S steps, only P2S_3 completing means the iteration is done
    if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(currentStepInfo.stepId)) {
      // Only the last P2S step (P2S_3) completing means we're done with this DU
      const isLastP2SStep = currentStepInfo.stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE
      return isLastP2SStep && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error)
    }
    
    // For non-P2S steps, use regular logic
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
    console.log('[Orchestrator] stepHasOutput check:', {
      stepId,
      key,
      hasKey: !!key
    });
    if (!key) return false

    if (isGlobalStep(stepId)) {
      // Check generic state
      const outputKey = key as keyof GenericAnalysisState
      const errorKey = `${key.toString().replace('_output', '_error')}` as keyof GenericAnalysisState
      return !!(dataState.genericAnalysisState[outputKey] || dataState.genericAnalysisState[errorKey])
    } else {
      // Check transcript-specific state
      const transcriptId = dataState.rawTranscripts[activeTranscriptIndex]?.id
      console.log('[Orchestrator] stepHasOutput transcript check:', {
        activeTranscriptIndex,
        transcriptId,
        hasTranscript: !!transcriptId
      });
      if (!transcriptId) return false
      
      const tData = dataState.processedData.get(transcriptId)
      console.log('[Orchestrator] stepHasOutput data check:', {
        hasData: !!tData,
        dataKeys: tData ? Object.keys(tData) : []
      });
      if (!tData) return false

      if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
        // Check the current DU being processed
        const currentDu = tData.current_du_for_p2s_processing
        const p2sOutputs = tData.p2s_outputs_by_du
        
        // If no current DU or no outputs structure, no output exists
        if (!currentDu || !p2sOutputs) return false
        
        // Check if the current DU has output for this step
        const duData = p2sOutputs[currentDu]
        if (!duData) return false
        
        const outputKey = key as keyof typeof duData
        const errorKey = `${key.toString().replace('_output', '_error')}` as keyof typeof duData
        const hasOutput = !!(duData[outputKey] || duData[errorKey])
        
        console.log('[Orchestrator] stepHasOutput P2S result:', {
          stepId,
          currentDu,
          hasOutputData: !!duData[outputKey],
          hasErrorData: !!duData[errorKey],
          finalResult: hasOutput
        });
        
        return hasOutput
      } else {
        // Regular transcript output
        const outputKey = key as keyof TranscriptProcessedData
        const errorKey = `${key.toString().replace('_output', '_error')}` as keyof TranscriptProcessedData
        const hasOutput = !!(tData[outputKey] || tData[errorKey])
        console.log('[Orchestrator] stepHasOutput result:', {
          outputKey,
          errorKey,
          hasOutputData: !!tData[outputKey],
          hasErrorData: !!tData[errorKey],
          finalResult: hasOutput
        });
        return hasOutput
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

    // Special handling for P2S - check if we need to repeat for next DU
    console.log('[Orchestrator P2S Debug] Checking P2S iteration:', {
      currentStep: currentPosition.part.steps[stepIndex],
      stepIndex,
      partSteps: currentPosition.part.steps,
      activeTranscriptIndex
    });
    if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(currentPosition.part.steps[stepIndex])) {
      const { rawTranscripts, processedData } = dataState
      const transcriptId = rawTranscripts[activeTranscriptIndex]?.id
      if (transcriptId) {
        const tData = processedData.get(transcriptId)
        if (tData) {
          const dus = tData.dus_for_p2s_processing || []
          const currentDuIndex = dus.indexOf(tData.current_du_for_p2s_processing || '')
          
          // If we're at the last step of P2S and there are more DUs to process
          if (stepIndex === part.steps.length - 1 && currentDuIndex < dus.length - 1) {
            // Go back to first P2S step for next DU
            return {
              nextStepId: part.steps[0],
              nextTranscriptIndex: activeTranscriptIndex,
              nextDuIndex: currentDuIndex + 1,
              iterationType: 'per-du'
            }
          }
        }
      }
    }

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
      
      case 'per-du':
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

    const dus = tData.dus_for_p2s_processing || []
    const currentDuIndex = dus.indexOf(tData.current_du_for_p2s_processing || '')

    // Check if more DUs to process for current transcript
    if (currentDuIndex < dus.length - 1) {
      return {
        nextStepId: currentPart.steps[0],
        nextTranscriptIndex: activeTranscriptIndex,
        nextDuIndex: currentDuIndex + 1,
        iterationType: 'per-du'
      }
    }

    // All DUs processed for current transcript, check next transcript
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

    // All transcripts and DUs processed
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

      console.log('[Orchestrator Debug] Moving to next part:', {
        currentPartName: this.pipelineStructure[currentPartIndex].name,
        nextPartName: nextPart.name,
        nextStepId: nextPart.steps[0],
        nextTranscriptIndex: 0,
        iterationType: nextPart.iteration
      });
      
      // Check if we're transitioning from Part 2 to Part 3
      const isLeavingPart2 = this.pipelineStructure[currentPartIndex].name.includes("Part II: Specific Synchronic Analysis")
      const isEnteringPart3 = nextPart.name.includes("Part III: Generic Diachronic Analysis")
      
      return {
        nextStepId: nextPart.steps[0],
        nextTranscriptIndex: 0,
        iterationType: nextPart.iteration,
        shouldPause: isLeavingPart2 && isEnteringPart3
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
    iterationContext?: {
      transcriptIndex?: number
      phaseIndex?: number
      gduIndex?: number
    },
    error?: string
  ): ProcessState {
    const position = this.findCurrentPosition(currentStepId)
    if (!position) return currentState

    const newState: ProcessState = {
      ...currentState,
      currentPartIndex: position.partIndex,
      currentStepIndex: position.stepIndex,
      iterationContext: iterationContext ? { ...currentState.iterationContext, ...iterationContext } : currentState.iterationContext,
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

    // Clear resumeCheckpoint when starting fresh or completing
    if (currentStepId === StepId.P_NEG1_1_VARIABLE_IDENTIFICATION && status === StepStatus.Loading) {
      // Starting fresh from the beginning
      newState.resumeCheckpoint = undefined
    } else if (currentStepId === StepId.COMPLETE && status === StepStatus.Success) {
      // Pipeline completed
      newState.resumeCheckpoint = undefined
      newState.status = 'complete'
    }

    return newState
  }

  /**
   * Create a resume checkpoint
   */
  createResumeCheckpoint(processState: ProcessState, iterationContext?: {
      transcriptIndex?: number
      phaseIndex?: number
      gduIndex?: number
    }): ProcessState {
    const newContext = iterationContext ? { ...processState.iterationContext, ...iterationContext } : processState.iterationContext;
    return {
      ...processState,
      iterationContext: newContext,
      resumeCheckpoint: {
        partIndex: processState.currentPartIndex,
        stepIndex: processState.currentStepIndex,
        iterationContext: newContext
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