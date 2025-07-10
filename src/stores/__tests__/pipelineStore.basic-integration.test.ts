import { describe, test, expect, vi, beforeEach } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { useTranscriptStore } from '../transcriptStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { StepId, StepStatus } from '../../../types'

describe('pipelineStore basic integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores
    usePipelineStore.setState({
      lastStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      shouldStopAutorun: false
    })
    
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    })
    
    usePromptHistoryStore.setState({
      promptHistory: [],
      tokenStats: { totalInputTokens: 0, totalOutputTokens: 0 }
    })
    
    useAnalysisResultStore.setState({
      genericAnalysisState: {}
    })
  })

  describe('processSingleStep orchestration', () => {
    test('should handle validation errors gracefully', async () => {
      // Try to execute without required parameters
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE
        // Missing required parameters
      })
      
      // Should update error state
      const state = usePipelineStore.getState()
      expect(state.lastStepInfo.status).toBe(StepStatus.Error)
      expect(state.shouldStopAutorun).toBe(true)
    })

    test('should initialize orchestrator with all services', async () => {
      // Setup minimal valid params
      const params = {
        stepId: StepId.P3_1_ALIGN_STRUCTURES, // Global step doesn't need transcript
        transcriptData: {
          rawTranscripts: [],
          processedData: new Map()
        },
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      // Execute
      await usePipelineStore.getState().processSingleStep(params)
      
      // The orchestrator should have been created and called
      // Even if validation fails, the error should be handled
      const state = usePipelineStore.getState()
      expect(state.lastStepInfo.stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
    })

    test('should update lastStepInfo on any execution', async () => {
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 'non-existent',
        transcriptData: {
          rawTranscripts: [],
          processedData: new Map()
        },
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      await usePipelineStore.getState().processSingleStep(params)
      
      // Should have updated lastStepInfo
      const state = usePipelineStore.getState()
      expect(state.lastStepInfo.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
      expect(state.lastStepInfo.status).toBe(StepStatus.Error)
      expect(state.lastStepInfo.error).toBeTruthy()
    })
  })

  describe('store update callbacks', () => {
    test('should delegate generic state updates to analysisResultStore', () => {
      // Start with empty state
      expect(useAnalysisResultStore.getState().genericAnalysisState).toEqual({})
      
      // Access through pipelineStore should delegate
      const pipelineStore = usePipelineStore.getState()
      
      // Update through pipelineStore
      pipelineStore.updateGenericState({ p3_1_output: { test: 'data' } })
      
      // Should be reflected in analysisResultStore
      expect(useAnalysisResultStore.getState().genericAnalysisState.p3_1_output).toEqual({ test: 'data' })
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
      
      const state = usePipelineStore.getState()
      expect(state.shouldStopAutorun).toBe(true)
      expect(state.lastStepInfo.status).toBe(StepStatus.Error)
    })

    test('should handle unexpected errors gracefully', async () => {
      // This will cause an error in validation
      await usePipelineStore.getState().processSingleStep({
        stepId: 'INVALID_STEP_ID' as StepId,
        settings: null as any // Invalid settings
      })
      
      const state = usePipelineStore.getState()
      expect(state.lastStepInfo.status).toBe(StepStatus.Error)
      expect(state.lastStepInfo.error).toBeTruthy() // Error message may vary
      expect(state.shouldStopAutorun).toBe(true)
    })
  })
})