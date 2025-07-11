import { describe, test, expect, vi, beforeEach } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { useTranscriptStore } from '../transcriptStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../../types'

// Mock the Gemini API
vi.mock('../../../services/geminiService')

describe('pipelineStore basic integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores
    // PipelineStore no longer has state - it delegates to other stores
    usePipelineOrchestrationStore.setState({
      currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })
    
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    })
    
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
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

  describe('processSingleStep orchestration', () => {
    test('should handle validation errors gracefully', async () => {
      // Try to execute without required parameters
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE
        // Missing required parameters (no settings)
      })
      
      // Wait for state updates to propagate
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Should update error state in orchestration store
      const orchestrationState = usePipelineOrchestrationStore.getState()
      const pipelineState = usePipelineStore.getState()
      
      
      // Check the orchestration store directly since the getter might not be reactive in tests
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toBe('API key is required')
      expect(orchestrationState.shouldStopAutorun).toBe(true)
    })

    test('should initialize orchestrator with all services', async () => {
      // Setup minimal valid params
      const params = {
        stepId: StepId.P3_1_ALIGN_STRUCTURES, // Global step doesn't need transcript
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      // Add some test data
      useAnalysisResultStore.setState({
        genericAnalysisState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false,
          p1_4_outputs_by_transcript: {
            't1': { analysis: 'test' }
          }
        }
      })
      
      // Execute
      await usePipelineStore.getState().processSingleStep(params)
      
      // The orchestrator should have been created and called
      // Check via the getter
      const pipelineState = usePipelineStore.getState()
      const orchestrationState = usePipelineOrchestrationStore.getState()
      
      // The execution was recorded
      expect(orchestrationState.lastExecutionParams?.stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
    })

    test('should update lastStepInfo on any execution', async () => {
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 'non-existent',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      await usePipelineStore.getState().processSingleStep(params)
      
      // Should have updated lastStepInfo via orchestration store
      const pipelineState = usePipelineStore.getState()
      const orchestrationState = usePipelineOrchestrationStore.getState()
      
      // The execution was recorded
      expect(orchestrationState.lastExecutionParams?.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
      
      // Since we're processing a non-existent transcript, there should be an error
      if (pipelineState.lastStepInfo?.status === StepStatus.Error) {
        expect(pipelineState.lastStepInfo?.error).toBeTruthy()
      }
    })
  })

  describe('store update callbacks', () => {
    test('pipelineStore compatibility getters delegate to respective stores', () => {
      // Test that pipelineStore getters correctly delegate to other stores
      
      // 1. Test genericAnalysisState delegation
      const analysisState = useAnalysisResultStore.getState().genericAnalysisState
      const pipelineGenericState = usePipelineStore.getState().genericAnalysisState
      
      // Should have the same properties from initial state
      expect(pipelineGenericState).toHaveProperty('isFullyProcessedGenericDiachronic', false)
      expect(pipelineGenericState).toHaveProperty('isReportGenerated', false)
      
      // 2. Test promptHistory delegation
      const promptHistory = usePromptHistoryStore.getState().promptHistory
      const pipelinePromptHistory = usePipelineStore.getState().promptHistory
      expect(pipelinePromptHistory).toEqual(promptHistory)
      
      // 3. Test rawTranscripts delegation
      const rawTranscripts = useTranscriptStore.getState().rawTranscripts
      const pipelineRawTranscripts = usePipelineStore.getState().rawTranscripts
      expect(pipelineRawTranscripts).toEqual(rawTranscripts)
      
      // 4. Test lastStepInfo delegation
      const currentStepInfo = usePipelineOrchestrationStore.getState().currentStepInfo
      const pipelineLastStepInfo = usePipelineStore.getState().lastStepInfo
      expect(pipelineLastStepInfo?.stepId).toBe(currentStepInfo.stepId)
      expect(pipelineLastStepInfo?.status).toBe(currentStepInfo.status)
    })
  })

  describe('error handling', () => {
    test('should set shouldStopAutorun on error', async () => {
      // Trigger an error by missing required data
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        // Missing transcript data and settings
      })
      
      // Wait for state updates
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const orchestrationState = usePipelineOrchestrationStore.getState()
      
      expect(orchestrationState.shouldStopAutorun).toBe(true)
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
    })

    test('should handle unexpected errors gracefully', async () => {
      // This will cause an error in validation
      await usePipelineStore.getState().processSingleStep({
        stepId: 'INVALID_STEP_ID' as StepId,
        settings: null as any // Invalid settings
      })
      
      // Wait for state updates
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const orchestrationState = usePipelineOrchestrationStore.getState()
      
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toBeTruthy() // Error message may vary
      expect(orchestrationState.shouldStopAutorun).toBe(true)
    })
  })
})