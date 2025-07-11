import { describe, test, expect, beforeEach, vi, afterEach, Mock } from 'vitest'
import { usePipelineStore } from '../stores/pipelineStore'
import { useTranscriptStore } from '../stores/transcriptStore'
import { usePromptHistoryStore } from '../stores/promptHistoryStore'
import { useAnalysisResultStore } from '../stores/analysisResultStore'
import { usePipelineOrchestrationStore } from '../stores/pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../types'
import { callGeminiAPI } from '../../services/geminiService'
import { STEP_ORDER_PART_NEG1, STEP_ORDER_PART_3_GENERIC_DIACHRONIC } from '../../constants'

// Minimal mocking - only external API
vi.mock('../../services/geminiService')

describe('Pipeline E2E Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores
    usePipelineOrchestrationStore.getState().reset()
    useTranscriptStore.getState().reset()
    usePromptHistoryStore.getState().reset()
    useAnalysisResultStore.getState().reset()
  })

  describe('Full Pipeline Execution with Errors', () => {
    test('should handle missing transcript ID gracefully throughout pipeline', async () => {
      // Setup: Add transcripts
      const transcripts = [
        { id: 't1', name: 'test1.txt', content: 'Content 1', uploadedAt: Date.now() },
        { id: 't2', name: 'test2.txt', content: 'Content 2', uploadedAt: Date.now() }
      ]
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData: new Map(transcripts.map(t => [t.id, { id: t.id, filename: t.name }]))
      })
      
      // Try to process with wrong transcript ID
      const pipelineStore = usePipelineStore.getState()
      
      await pipelineStore.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 'missing-transcript',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })
      
      // Should fail with proper error
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toContain('Transcript not found')
      
      // Should not corrupt other store data
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(2)
      expect(usePromptHistoryStore.getState().promptHistory).toHaveLength(0)
    })

    test('should handle empty API key throughout entire pipeline flow', async () => {
      // Setup: Add transcript
      const transcript = { id: 't1', name: 'test.txt', content: 'Content', uploadedAt: Date.now() }
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      const pipelineStore = usePipelineStore.getState()
      const steps = STEP_ORDER_PART_NEG1.slice(0, 3) // Test first few steps
      
      for (const stepId of steps) {
        await pipelineStore.processSingleStep({
          stepId,
          transcriptIdToProcess: transcript.id,
          settings: {
            apiKey: '', // Empty API key
            temperature: 0.7,
            userDvFocus: { dv_focus: ['test'] }
          }
        })
        
        // Each step should fail with API key error
        const state = usePipelineOrchestrationStore.getState()
        expect(state.currentStepInfo.status).toBe(StepStatus.Error)
        expect(state.currentStepInfo.error).toBe('API key is required')
      }
      
      // No API calls should have been made
      expect(callGeminiAPI).not.toHaveBeenCalled()
    })

    test('should recover from transient API errors with retry', async () => {
      // Setup
      const transcript = { id: 't1', name: 'test.txt', content: 'Content', uploadedAt: Date.now() }
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      // Mock API to fail once then succeed
      vi.mocked(callGeminiAPI)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          parsedJson: { result: 'success' },
          text: '{"result":"success"}',
          error: undefined,
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        })
      
      const pipelineStore = usePipelineStore.getState()
      
      // First attempt should fail
      await pipelineStore.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })
      
      let state = usePipelineOrchestrationStore.getState()
      expect(state.currentStepInfo.status).toBe(StepStatus.Error)
      
      // Retry with same parameters (simulating user retry)
      await pipelineStore.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })
      
      // Should succeed on retry
      state = usePipelineOrchestrationStore.getState()
      expect(state.currentStepInfo.status).toBe(StepStatus.Success)
      expect(callGeminiAPI).toHaveBeenCalledTimes(2)
    })

    test('should handle multiple pipeline resets without memory leaks', async () => {
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        userDvFocus: { dv_focus: ['test'] }
      }
      
      // Perform multiple cycles of operations and resets
      for (let cycle = 0; cycle < 5; cycle++) {
        // Add transcript
        const transcript = {
          id: `t${cycle}`,
          name: `test${cycle}.txt`,
          content: `Content ${cycle}`,
          uploadedAt: Date.now()
        }
        
        useTranscriptStore.setState({
          rawTranscripts: [transcript],
          processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
        })
        
        // Mock successful API
        vi.mocked(callGeminiAPI).mockResolvedValue({
          parsedJson: { cycle },
          text: JSON.stringify({ cycle }),
          error: undefined,
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        })
        
        // Process some steps
        const pipelineStore = usePipelineStore.getState()
        await pipelineStore.processSingleStep({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptIdToProcess: transcript.id,
          settings
        })
        
        // Add to prompt history
        const promptHistory = usePromptHistoryStore.getState()
        expect(promptHistory.promptHistory.length).toBeGreaterThan(0)
        
        // Reset everything
        pipelineStore.resetPipeline()
        
        // Wait for reset
        await new Promise(resolve => setTimeout(resolve, 10))
        
        // Verify clean state
        expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(0)
        expect(usePromptHistoryStore.getState().promptHistory).toHaveLength(0)
        expect(usePipelineOrchestrationStore.getState().currentStepInfo.stepId).toBe(StepId.IDLE)
      }
      
      // All cycles should complete without issues
      expect(true).toBe(true)
    })

    test('should handle invalid step IDs gracefully', async () => {
      const pipelineStore = usePipelineStore.getState()
      
      // Try to process with invalid step ID
      await pipelineStore.processSingleStep({
        stepId: 'INVALID_STEP_ID' as StepId,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })
      
      // Should fail with configuration error
      const state = usePipelineOrchestrationStore.getState()
      expect(state.currentStepInfo.status).toBe(StepStatus.Error)
      expect(state.currentStepInfo.error).toContain('No configuration found for stepId')
    })

    test('should maintain data integrity during concurrent error scenarios', async () => {
      // Setup multiple transcripts
      const transcripts = Array.from({ length: 3 }, (_, i) => ({
        id: `t${i}`,
        name: `test${i}.txt`,
        content: `Content ${i}`,
        uploadedAt: Date.now()
      }))
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData: new Map(transcripts.map(t => [t.id, { id: t.id, filename: t.name }]))
      })
      
      // Mock API to fail differently for each call
      vi.mocked(callGeminiAPI)
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValueOnce({
          parsedJson: null,
          text: '',
          error: 'Invalid response',
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0
        })
        .mockResolvedValueOnce({
          parsedJson: { success: true },
          text: '{"success":true}',
          error: undefined,
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        })
      
      const pipelineStore = usePipelineStore.getState()
      
      // Process all transcripts concurrently
      const promises = transcripts.map(t =>
        pipelineStore.processSingleStep({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptIdToProcess: t.id,
          settings: {
            apiKey: 'test-key',
            temperature: 0.7,
            userDvFocus: { dv_focus: ['test'] }
          }
        }).catch(() => {}) // Catch to prevent unhandled rejection
      )
      
      await Promise.all(promises)
      
      // Check transcript data integrity
      const transcriptStore = useTranscriptStore.getState()
      const t0Data = transcriptStore.processedData.get('t0')
      const t1Data = transcriptStore.processedData.get('t1')
      const t2Data = transcriptStore.processedData.get('t2')
      
      // First should have error from rejected promise
      expect(t0Data?.p0_1_error).toBe('Rate limit')
      expect(t0Data?.p0_1_output).toBeUndefined()
      
      // Second should have error from API response
      expect(t1Data?.p0_1_error).toBe('Invalid response')
      expect(t1Data?.p0_1_output).toBeUndefined()
      
      // Third should succeed
      expect(t2Data?.p0_1_error).toBeUndefined()
      expect(t2Data?.p0_1_output).toEqual({ success: true })
      
      // Prompt history should only have entries for successful executions
      // The first call throws an error before execution, so no prompt history
      const promptHistory = usePromptHistoryStore.getState()
      expect(promptHistory.promptHistory).toHaveLength(2)
    })

    test('should handle global step errors without transcript ID', async () => {
      // Setup: Need transcript data for global steps
      const transcripts = [
        { id: 't1', name: 'test1.txt', content: 'Content 1', uploadedAt: Date.now() },
        { id: 't2', name: 'test2.txt', content: 'Content 2', uploadedAt: Date.now() }
      ]
      
      const processedData = new Map(transcripts.map(t => [t.id, {
        id: t.id,
        filename: t.name,
        p1_4_output: { // Required for global steps
          independent_variable_details: { var: 'value' },
          dependent_variable_focus: ['dv1'],
          specific_diachronic_structure: { phases: ['phase1'] }
        }
      }]))
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData
      })
      
      // Mock API error for global step
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: null,
        text: '',
        error: 'Global analysis failed',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 0
      })
      
      const pipelineStore = usePipelineStore.getState()
      
      // Process global step
      await pipelineStore.processSingleStep({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })
      
      // Should handle error properly
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toBe('Global analysis failed')
      
      // Error should be in analysis state
      const analysisState = useAnalysisResultStore.getState()
      expect(analysisState.genericAnalysisState.p3_1_error).toBe('Global analysis failed')
      expect(analysisState.genericAnalysisState.p3_1_output).toBeUndefined()
    })
  })

  describe('Error Recovery and Rollback', () => {
    test('should rollback partial state changes on error', async () => {
      const transcript = { id: 't1', name: 'test.txt', content: 'Content', uploadedAt: Date.now() }
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name,
          existingData: 'should remain'
        }]])
      })
      
      // Save initial state
      const initialProcessedData = useTranscriptStore.getState().processedData.get(transcript.id)
      
      // Mock API to throw during processing
      vi.mocked(callGeminiAPI).mockImplementationOnce(() => {
        throw new Error('Processing failed mid-operation')
      })
      
      const pipelineStore = usePipelineStore.getState()
      
      await pipelineStore.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })
      
      // Existing data should remain intact
      const finalProcessedData = useTranscriptStore.getState().processedData.get(transcript.id)
      expect(finalProcessedData?.existingData).toBe('should remain')
      expect(finalProcessedData?.p0_1_error).toBe('Processing failed mid-operation')
    })

    test('should handle autorun stopping on validation errors', async () => {
      // Setup autorun state
      usePipelineOrchestrationStore.setState({
        isAutorunning: true,
        shouldStopAutorun: false,
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle }
      })
      
      const pipelineStore = usePipelineStore.getState()
      
      // Process with missing settings to trigger validation error
      await pipelineStore.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 'any-id'
        // Missing settings - will use fallback settings with empty API key
      })
      
      // Autorun should be stopped
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.shouldStopAutorun).toBe(true)
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toContain('API key is required')
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })
})