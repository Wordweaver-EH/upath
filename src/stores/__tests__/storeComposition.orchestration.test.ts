import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useStoreComposition } from '../storeComposition'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { useUIStore } from '../uiStore'
// Removed pipelineStore import
import { StepId, StepStatus } from '../../../types'

describe('Store Composition - Orchestration Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores to initial state
    usePipelineOrchestrationStore.setState({
      currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false,
      lastExecutionParams: undefined,
      lastHilContext: undefined
    })
    
    useUIStore.setState({
      isAutorunning: false
    })
  })
  
  describe('resetPipeline', () => {
    test('should reset pipeline orchestration store', () => {
      // Set some state
      usePipelineOrchestrationStore.setState({
        currentStepInfo: { stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE, status: StepStatus.Success },
        activeTranscriptIndex: 2,
        isAutorunning: true,
        shouldStopAutorun: true
      })
      
      // Get composition and reset
      const composition = useStoreComposition()
      composition.resetPipeline()
      
      // Check orchestration store was reset
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo).toEqual({ stepId: StepId.IDLE, status: StepStatus.Idle })
      expect(orchestrationState.activeTranscriptIndex).toBe(0)
      expect(orchestrationState.isAutorunning).toBe(false)
      expect(orchestrationState.shouldStopAutorun).toBe(false)
    })
  })
  
  describe('getOrchestrationState', () => {
    test('should return current orchestration state', () => {
      // Set up test state
      const testState = {
        currentStepInfo: { stepId: StepId.P3_1_ALIGN_STRUCTURES, status: StepStatus.Processing },
        activeTranscriptIndex: 1,
        isAutorunning: true,
        shouldStopAutorun: false,
        lastExecutionParams: {
          stepId: StepId.P3_1_ALIGN_STRUCTURES,
          timestamp: Date.now()
        },
        lastHilContext: {
          stepId: StepId.P3_1_ALIGN_STRUCTURES,
          description: 'Test HIL'
        }
      }
      
      usePipelineOrchestrationStore.setState(testState)
      
      // Get state through composition
      const composition = useStoreComposition()
      const state = composition.getOrchestrationState()
      
      expect(state.currentStepInfo).toEqual(testState.currentStepInfo)
      expect(state.activeTranscriptIndex).toBe(testState.activeTranscriptIndex)
      expect(state.isAutorunning).toBe(testState.isAutorunning)
      expect(state.shouldStopAutorun).toBe(testState.shouldStopAutorun)
      expect(state.lastExecutionParams).toEqual(testState.lastExecutionParams)
      expect(state.lastHilContext).toEqual(testState.lastHilContext)
    })
  })
  
  describe('setAutorunning', () => {
    test('should update both orchestration and UI stores', () => {
      const composition = useStoreComposition()
      
      // Set autorun to true
      composition.setAutorunning(true)
      
      // Check both stores
      const orchestrationState = usePipelineOrchestrationStore.getState()
      const uiState = useUIStore.getState()
      
      expect(orchestrationState.isAutorunning).toBe(true)
      expect(uiState.isAutorunning).toBe(true)
      
      // Set autorun to false
      composition.setAutorunning(false)
      
      expect(usePipelineOrchestrationStore.getState().isAutorunning).toBe(false)
      expect(useUIStore.getState().isAutorunning).toBe(false)
    })
  })
  
  describe('clearHilContext', () => {
    test('should clear HIL context through orchestration store', () => {
      // Set HIL context
      const hilContext = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        description: 'Test HIL'
      }
      usePipelineOrchestrationStore.setState({ lastHilContext: hilContext })
      
      // Clear through composition
      const composition = useStoreComposition()
      composition.clearHilContext()
      
      // Verify HIL context was cleared
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.lastHilContext).toBeUndefined()
    })
  })
})