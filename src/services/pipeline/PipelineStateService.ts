import { StepId, StepStatus, TranscriptProcessedData, GenericAnalysisState, P2SPhaseData, P4SGduData } from '../../../types'
import { stepIdToDataKeyPrefix, isGlobalStep } from '../../utils/stepIdToDataKeyPrefix'

export class PipelineStateService {
  getStepStatus(
    stepId: StepId,
    transcriptId: string | undefined,
    processedData: Map<string, TranscriptProcessedData>,
    genericState: GenericAnalysisState,
    phaseId?: string,
    gduId?: string
  ): StepStatus {
    const keyPrefix = stepIdToDataKeyPrefix[stepId]
    if (!keyPrefix) return StepStatus.Idle
    
    const outputKey = keyPrefix
    const errorKey = `${keyPrefix.replace('_output', '_error')}`
    
    // Handle global steps
    if (isGlobalStep(stepId)) {
      if (genericState[errorKey as keyof GenericAnalysisState]) {
        return StepStatus.Error
      }
      if (genericState[outputKey as keyof GenericAnalysisState]) {
        return StepStatus.Success
      }
      return StepStatus.Idle
    }
    
    // Handle transcript-specific steps
    if (transcriptId) {
      const transcriptData = processedData.get(transcriptId)
      if (!transcriptData) return StepStatus.Idle
      
      // Handle P2S phase-specific steps
      if (stepId.startsWith('P2S_') && phaseId) {
        const phaseData = transcriptData.p2s_outputs_by_phase?.[phaseId]
        if (!phaseData) return StepStatus.Idle
        
        if (phaseData[errorKey as keyof P2SPhaseData]) {
          return StepStatus.Error
        }
        if (phaseData[outputKey as keyof P2SPhaseData]) {
          return StepStatus.Success
        }
        return StepStatus.Idle
      }
      
      // Handle regular transcript steps
      if (transcriptData[errorKey as keyof TranscriptProcessedData]) {
        return StepStatus.Error
      }
      if (transcriptData[outputKey as keyof TranscriptProcessedData]) {
        return StepStatus.Success
      }
    }
    
    // Handle P4S GDU-specific steps
    if (stepId.startsWith('P4S_') && gduId) {
      const gduData = genericState.p4s_outputs_by_gdu?.[gduId]
      if (!gduData) return StepStatus.Idle
      
      if (gduData[errorKey as keyof P4SGduData]) {
        return StepStatus.Error
      }
      if (gduData[outputKey as keyof P4SGduData]) {
        return StepStatus.Success
      }
      return StepStatus.Idle
    }
    
    return StepStatus.Idle
  }
}