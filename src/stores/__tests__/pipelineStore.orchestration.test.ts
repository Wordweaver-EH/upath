import { describe, test, expect, vi, beforeEach } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../../types'

describe('pipelineStore orchestration integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset stores
    usePipelineStore.setState({
      lastStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      shouldStopAutorun: false
    })
    
    usePipelineOrchestrationStore.setState({
      currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })
  })

  test('should update orchestration store when processSingleStep is called', async () => {
    const params = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      transcriptIdToProcess: 't1',
      settings: {
        apiKey: 'test-key',
        temperature: 0.7,
        userDvFocus: { dv_focus: [] }
      }
    }
    
    // Execute
    await usePipelineStore.getState().processSingleStep(params)
    
    // Verify orchestration store was updated
    const orchestrationState = usePipelineOrchestrationStore.getState()
    expect(orchestrationState.lastExecutionParams).toBeDefined()
    expect(orchestrationState.lastExecutionParams?.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
    expect(orchestrationState.lastExecutionParams?.transcriptId).toBe('t1')
  })

  test('should sync currentStepInfo between stores', async () => {
    const params = {
      stepId: StepId.P3_1_ALIGN_STRUCTURES,
      settings: {
        apiKey: 'test-key',
        temperature: 0.7,
        userDvFocus: { dv_focus: [] }
      }
    }
    
    // Execute
    await usePipelineStore.getState().processSingleStep(params)
    
    // Both stores should have updated step info
    const pipelineState = usePipelineStore.getState()
    const orchestrationState = usePipelineOrchestrationStore.getState()
    
    expect(pipelineState.lastStepInfo.stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
    expect(orchestrationState.currentStepInfo.stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
  })

  test('should sync shouldStopAutorun flag on error', async () => {
    const params = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      // Missing required data to trigger error
    }
    
    // Execute
    await usePipelineStore.getState().processSingleStep(params)
    
    // Both stores should have shouldStopAutorun set
    const pipelineState = usePipelineStore.getState()
    const orchestrationState = usePipelineOrchestrationStore.getState()
    
    expect(pipelineState.shouldStopAutorun).toBe(true)
    expect(orchestrationState.shouldStopAutorun).toBe(true)
  })

  test('should clear shouldStopAutorun flag in both stores', () => {
    // Set flag in both stores
    usePipelineStore.setState({ shouldStopAutorun: true })
    usePipelineOrchestrationStore.setState({ shouldStopAutorun: true })
    
    // Clear via pipelineStore
    usePipelineStore.getState().clearShouldStopAutorunFlag()
    
    // Both should be cleared
    expect(usePipelineStore.getState().shouldStopAutorun).toBe(false)
    expect(usePipelineOrchestrationStore.getState().shouldStopAutorun).toBe(false)
  })

  test('should clear HIL context in both stores', () => {
    const hilContext = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      description: 'Test HIL'
    }
    
    // Set HIL context
    usePipelineStore.setState({ lastHilContext: hilContext })
    usePipelineOrchestrationStore.setState({ lastHilContext: hilContext })
    
    // Clear via pipelineStore
    usePipelineStore.getState().clearLastHilContext()
    
    // Both should be cleared
    expect(usePipelineStore.getState().lastHilContext).toBeUndefined()
    expect(usePipelineOrchestrationStore.getState().lastHilContext).toBeUndefined()
  })
})