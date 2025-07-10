import { describe, test, expect, beforeEach } from 'vitest'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../../types'

describe('PipelineOrchestrationStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePipelineOrchestrationStore.setState({
      currentStepInfo: {
        stepId: StepId.IDLE,
        status: StepStatus.Idle
      },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })
  })

  test('should initialize with default state', () => {
    const state = usePipelineOrchestrationStore.getState()
    
    expect(state.currentStepInfo).toEqual({
      stepId: StepId.IDLE,
      status: StepStatus.Idle
    })
    expect(state.activeTranscriptIndex).toBe(0)
    expect(state.isAutorunning).toBe(false)
    expect(state.shouldStopAutorun).toBe(false)
    expect(state.lastHilContext).toBeUndefined()
    expect(state.lastExecutionParams).toBeUndefined()
  })

  test('should update current step info', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    store.setCurrentStepInfo({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      status: StepStatus.Loading,
      transcriptId: 't1'
    })
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.currentStepInfo).toEqual({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      status: StepStatus.Loading,
      transcriptId: 't1'
    })
  })

  test('should update active transcript index', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    store.setActiveTranscriptIndex(2)
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.activeTranscriptIndex).toBe(2)
  })

  test('should update autorun state', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    store.setAutorunning(true)
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.isAutorunning).toBe(true)
  })

  test('should set stop autorun flag', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    store.setShouldStopAutorun(true)
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.shouldStopAutorun).toBe(true)
  })

  test('should update HIL context', () => {
    const store = usePipelineOrchestrationStore.getState()
    const hilContext = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      description: 'Test HIL context'
    }
    
    store.setHilContext(hilContext)
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.lastHilContext).toEqual(hilContext)
  })

  test('should record execution params', () => {
    const store = usePipelineOrchestrationStore.getState()
    const now = Date.now()
    
    store.recordExecution({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      transcriptId: 't1'
    })
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.lastExecutionParams).toBeDefined()
    expect(state.lastExecutionParams?.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
    expect(state.lastExecutionParams?.transcriptId).toBe('t1')
    expect(state.lastExecutionParams?.timestamp).toBeGreaterThanOrEqual(now)
  })

  test('should clear HIL context', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    // First set a context
    store.setHilContext({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      description: 'Test'
    })
    
    // Then clear it
    store.clearHilContext()
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.lastHilContext).toBeUndefined()
  })

  test('should clear stop autorun flag', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    // First set the flag
    store.setShouldStopAutorun(true)
    
    // Then clear it
    store.clearShouldStopAutorun()
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.shouldStopAutorun).toBe(false)
  })

  test('should reset orchestration state', () => {
    const store = usePipelineOrchestrationStore.getState()
    
    // Modify various state properties
    store.setCurrentStepInfo({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      status: StepStatus.Success
    })
    store.setActiveTranscriptIndex(3)
    store.setAutorunning(true)
    store.setShouldStopAutorun(true)
    store.setHilContext({ stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE, description: 'Test' })
    store.recordExecution({ stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE })
    
    // Reset
    store.reset()
    
    const state = usePipelineOrchestrationStore.getState()
    expect(state.currentStepInfo).toEqual({
      stepId: StepId.IDLE,
      status: StepStatus.Idle
    })
    expect(state.activeTranscriptIndex).toBe(0)
    expect(state.isAutorunning).toBe(false)
    expect(state.shouldStopAutorun).toBe(false)
    expect(state.lastHilContext).toBeUndefined()
    expect(state.lastExecutionParams).toBeUndefined()
  })
})