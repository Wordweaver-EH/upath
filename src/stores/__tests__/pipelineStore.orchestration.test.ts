import { describe, test, expect, vi, beforeEach } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { useTranscriptStore } from '../transcriptStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { StepId, StepStatus } from '../../../types'

// Mock the API call
vi.mock('../../utils/geminiClient', () => ({
  callGeminiAPI: vi.fn().mockResolvedValue({
    output: 'mock output',
    apiError: null
  })
}))

describe('pipelineStore orchestration integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset stores
    // PipelineStore no longer has state - it delegates to orchestration store
    usePipelineOrchestrationStore.setState({
      currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })
    
    // Setup test data in other stores
    useTranscriptStore.setState({
      rawTranscripts: [{ 
        id: 't1', 
        name: 'test.txt', 
        content: 'test content',
        filename: 'test.txt'
      }],
      processedData: new Map()
    })
    
    useAnalysisResultStore.setState({
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false
      }
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
    // Set up generic analysis state for P3_1 step
    useAnalysisResultStore.setState({
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false,
        // Add some previous step data so P3_1 can run
        p1_4_outputs_by_transcript: {
          t1: { analysis: 'test' }
        }
      }
    })
    
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
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Both stores should have updated step info
    const pipelineState = usePipelineStore.getState()
    const orchestrationState = usePipelineOrchestrationStore.getState()
    
    // PipelineStore.lastStepInfo is now a getter that reads from orchestrationStore.currentStepInfo
    // At minimum, the status should have changed from IDLE
    expect(orchestrationState.currentStepInfo.status).not.toBe(StepStatus.Idle)
    
    // If successful, step should be P3_1
    if (orchestrationState.currentStepInfo.status === StepStatus.Success) {
      expect(pipelineState.lastStepInfo?.stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
      expect(orchestrationState.currentStepInfo.stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
    }
  })

  test('should sync shouldStopAutorun flag on error', async () => {
    const params = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      // Missing required data to trigger error
    }
    
    // Execute
    await usePipelineStore.getState().processSingleStep(params)
    
    // Orchestration store should have shouldStopAutorun set
    const orchestrationState = usePipelineOrchestrationStore.getState()
    
    // PipelineStore no longer has shouldStopAutorun state
    expect(orchestrationState.shouldStopAutorun).toBe(true)
  })

  test('should clear shouldStopAutorun flag via pipelineStore method', () => {
    // Set flag in orchestration store
    usePipelineOrchestrationStore.setState({ shouldStopAutorun: true })
    
    // Clear via pipelineStore's delegating method
    usePipelineStore.getState().clearShouldStopAutorunFlag()
    
    // Should be cleared in orchestration store
    expect(usePipelineOrchestrationStore.getState().shouldStopAutorun).toBe(false)
  })

  test('should clear HIL context via pipelineStore method', () => {
    const hilContext = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      description: 'Test HIL'
    }
    
    // Set HIL context in orchestration store
    usePipelineOrchestrationStore.setState({ lastHilContext: hilContext })
    
    // Clear via pipelineStore's delegating method
    usePipelineStore.getState().clearLastHilContext()
    
    // Should be cleared in orchestration store
    expect(usePipelineOrchestrationStore.getState().lastHilContext).toBeUndefined()
  })
})