import { describe, test, expect, beforeEach, vi, afterEach, Mock } from 'vitest'
import { useTranscriptStore } from '../stores/transcriptStore'
import { usePromptHistoryStore } from '../stores/promptHistoryStore'
import { useAnalysisResultStore } from '../stores/analysisResultStore'
import { usePipelineOrchestrationStore } from '../stores/pipelineOrchestrationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { getPipelineService, resetPipelineService } from '../services/pipeline/pipelineServiceFactory'
import { StepId, StepStatus } from '../../types'
import { callGeminiAPI } from '../../services/geminiService'
import { STEP_ORDER_PART_NEG1, STEP_ORDER_PART_III as STEP_ORDER_PART_3_GENERIC_DIACHRONIC } from '../config/pipelineConfig'

// Minimal mocking - only external API
vi.mock('../../services/geminiService')

describe('Pipeline E2E Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset pipeline service singleton to ensure clean state
    resetPipelineService()
    
    // Reset all stores
    usePipelineOrchestrationStore.getState().reset()
    useTranscriptStore.getState().reset()
    usePromptHistoryStore.getState().reset()
    useAnalysisResultStore.getState().reset()
    useSettingsStore.getState().reset()
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
      const pipelineService = getPipelineService()
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // This should handle the error gracefully
      await pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 'invalid-id',
        settings
      })
      
      // Should set error state
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
    })

    test('should handle invalid step IDs gracefully', async () => {
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // Try with invalid step ID
      await pipelineService.processSingleStep({
        stepId: 'INVALID_STEP' as StepId,
        settings
      })
      
      // Check the actual state
      const currentState = usePipelineOrchestrationStore.getState()
      console.log('Current orchestration state:', currentState.currentStepInfo)
      
      // Should handle gracefully
      expect(currentState.currentStepInfo.status).toBe(StepStatus.Error)
    })

    test('should handle empty API key throughout entire pipeline flow', async () => {
      // Setup transcripts
      const transcript = { id: 't1', name: 'test.txt', content: 'Test content', uploadedAt: Date.now() }
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      
      // Mock API to simulate no API key error
      vi.mocked(callGeminiAPI).mockRejectedValue(new Error('API key not configured'))
      
      // Try processing with empty API key
      const settings = {
        apiKey: '', // Empty API key
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // Try all transcript-specific steps
      for (const stepId of STEP_ORDER_PART_NEG1) {
        orchestrationStore.setActiveTranscriptIndex(0)
        await pipelineService.processSingleStep({
          stepId,
          transcriptIdToProcess: transcript.id,
          settings
        })
        
        // Each should fail with error status due to empty API key
        const currentState = usePipelineOrchestrationStore.getState()
        expect(currentState.currentStepInfo.status).toBe(StepStatus.Error)
        
        // Reset for next iteration
        orchestrationStore.reset()
      }
    })

    test('should handle global step errors without transcript ID', async () => {
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      const analysisStore = useAnalysisResultStore.getState()
      
      // Setup some prior state
      analysisStore.updateGenericState({
        p3_1_output: 'Some existing output'
      })
      
      // Mock API error
      vi.mocked(callGeminiAPI).mockRejectedValue(new Error('Network error'))
      
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // Try global step
      await pipelineService.processSingleStep({
        stepId: StepId.P3_2_IDENTIFY_GDUS,
        settings
      })
      
      // Should handle error
      const currentState = usePipelineOrchestrationStore.getState()
      expect(currentState.currentStepInfo.status).toBe(StepStatus.Error)
      
      // Existing state should be preserved (no partial updates)
      const finalAnalysisState = useAnalysisResultStore.getState()
      expect(finalAnalysisState.genericAnalysisState.p3_1_output).toBe('Some existing output')
    })

    test('should recover from transient API errors with retry', async () => {
      const transcript = { id: 't1', name: 'test.txt', content: 'Test content', uploadedAt: Date.now() }
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      
      // First call fails, second succeeds
      vi.mocked(callGeminiAPI)
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          text: 'Success response',
          parsedJson: { result: 'success' }
        } as any)
      
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: 123, // Using seed for retry
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // First attempt fails
      orchestrationStore.setActiveTranscriptIndex(0)
      await pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings
      })
      const errorState = usePipelineOrchestrationStore.getState()
      expect(errorState.currentStepInfo.status).toBe(StepStatus.Error)
      
      // Retry with seed
      await pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        overrideSeed: 456,
        settings
      })
      
      // Should succeed now
      const successState = usePipelineOrchestrationStore.getState()
      expect(successState.currentStepInfo.status).toBe(StepStatus.Success)
    })

    test('should handle multiple pipeline resets without memory leaks', () => {
      const pipelineService = getPipelineService()
      const transcriptStore = useTranscriptStore.getState()
      const analysisStore = useAnalysisResultStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Add data to all stores
      const transcriptsToAdd = []
      for (let i = 0; i < 5; i++) {
        transcriptsToAdd.push({
          id: `t${i}`,
          name: `file${i}.txt`,
          content: `Content ${i}`,
          uploadedAt: Date.now()
        })
        
        // Add valid fields to generic state
        if (i === 1) {
          analysisStore.updateGenericState({
            p3_1_output: { content: `Output ${i}` } as any
          })
        } else if (i === 2) {
          analysisStore.updateGenericState({
            p3_2_output: { content: `Output ${i}` } as any
          })
        }
        
        promptHistoryStore.addPromptEntry({
          stepId: `P0_${i}`,
          timestamp: new Date().toISOString(),
          prompt: `Prompt ${i}`,
          requestPayload: {},
          responseRaw: `Response ${i}`
        } as any)
      }
      
      // Add all transcripts at once
      transcriptStore.addTranscriptsSync(transcriptsToAdd)
      
      // Get fresh state after updates
      const updatedTranscriptState = useTranscriptStore.getState()
      const updatedAnalysisState = useAnalysisResultStore.getState()
      const updatedPromptState = usePromptHistoryStore.getState()
      
      // Verify data exists
      expect(updatedTranscriptState.rawTranscripts.length).toBeGreaterThan(0)
      expect(Object.keys(updatedAnalysisState.genericAnalysisState).length).toBeGreaterThan(2) // More than just the 2 boolean flags
      expect(updatedPromptState.promptHistory.length).toBeGreaterThan(0)
      
      // Reset multiple times
      for (let i = 0; i < 10; i++) {
        pipelineService.resetPipeline()
      }
      
      // Get fresh state after resets
      const finalTranscriptState = useTranscriptStore.getState()
      const finalAnalysisState = useAnalysisResultStore.getState()
      const finalPromptState = usePromptHistoryStore.getState()
      
      // All stores should be empty
      expect(finalTranscriptState.rawTranscripts).toHaveLength(0)
      expect(finalTranscriptState.processedData.size).toBe(0)
      // Check that all outputs were cleared
      expect(finalAnalysisState.genericAnalysisState.p3_1_output).toBeUndefined()
      expect(finalAnalysisState.genericAnalysisState.p3_2_output).toBeUndefined()
      expect(finalAnalysisState.genericAnalysisState.p3_3_output).toBeUndefined()
      expect(finalAnalysisState.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(false)
      expect(finalAnalysisState.genericAnalysisState.isFullyProcessedGenericSynchronic).toBe(false)
      expect(finalPromptState.promptHistory).toHaveLength(0)
      expect(finalPromptState.totalInputTokens).toBe(0)
      expect(finalPromptState.totalOutputTokens).toBe(0)
    })

    test('should maintain data integrity during concurrent error scenarios', async () => {
      // Setup multiple transcripts
      const transcripts = Array.from({ length: 3 }, (_, i) => ({
        id: `t${i}`,
        name: `file${i}.txt`,
        content: `Content ${i}`,
        uploadedAt: Date.now()
      }))
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData: new Map(transcripts.map(t => [t.id, { id: t.id, filename: t.name }]))
      })
      
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      
      // Mock API to fail on specific transcripts
      vi.mocked(callGeminiAPI).mockImplementation((prompt, isJsonOutput, useGrounding, temperature, seed) => {
        const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt)
        // Check for either filename or content
        if (promptStr.includes('file1.txt') || promptStr.includes('Content 1')) {
          return Promise.reject(new Error('Error for file1'))
        }
        return Promise.resolve({
          text: isJsonOutput ? JSON.stringify({ result: 'success' }) : 'Success',
          parsedJson: isJsonOutput ? { result: 'success' } : undefined
        } as any)
      })
      
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // Process all transcripts
      const results: boolean[] = []
      for (let i = 0; i < transcripts.length; i++) {
        orchestrationStore.setActiveTranscriptIndex(i)
        await pipelineService.processSingleStep({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptIdToProcess: transcripts[i].id,
          settings
        })
        const currentState = usePipelineOrchestrationStore.getState()
        results.push(currentState.currentStepInfo.status === StepStatus.Success)
      }
      
      // Should have mixed results
      expect(results).toContain(true)  // Some succeed
      expect(results).toContain(false) // Some fail
      
      // Data integrity check - successful transcripts should have data
      const processedData = useTranscriptStore.getState().processedData
      expect(processedData.get('t0')).toBeDefined()
      expect(processedData.get('t2')).toBeDefined()
      // Failed transcript might not have complete data
    })
  })

  describe('Error Recovery and Rollback', () => {
    test('should rollback partial state changes on error', async () => {
      const transcript = { id: 't1', name: 'test.txt', content: 'Test content', uploadedAt: Date.now() }
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      const transcriptStore = useTranscriptStore.getState()
      
      // Setup initial successful state
      transcriptStore.updateProcessedData(transcript.id, {
        id: transcript.id,
        filename: transcript.name,
        p0_1_output: 'Initial output'
      })
      
      // Mock API to fail after partial processing
      vi.mocked(callGeminiAPI).mockRejectedValue(new Error('Processing failed'))
      
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // Try to process next step
      orchestrationStore.setActiveTranscriptIndex(0)
      await pipelineService.processSingleStep({
        stepId: StepId.P0_2_REFINE_DATA_TYPES,
        transcriptIdToProcess: transcript.id,
        settings
      })
      
      // Should have error status
      const currentState = usePipelineOrchestrationStore.getState()
      expect(currentState.currentStepInfo.status).toBe(StepStatus.Error)
      
      // Previous successful state should remain - get fresh state
      const finalTranscriptState = useTranscriptStore.getState()
      const processedData = finalTranscriptState.processedData.get(transcript.id)
      expect(processedData?.p0_1_output).toBe('Initial output')
      // Failed step should not have partial data
      expect(processedData?.p0_2_output).toBeUndefined()
    })

    test('should handle autorun stopping on validation errors', async () => {
      const pipelineService = getPipelineService()
      const orchestrationStore = usePipelineOrchestrationStore.getState()
      
      // Start autorun
      orchestrationStore.setAutorunning(true)
      
      // Mock validation error
      vi.mocked(callGeminiAPI).mockRejectedValue(new Error('Validation failed'))
      
      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: ['test-dv'] }
      }
      
      // Process step during autorun
      await pipelineService.processSingleStep({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        settings
      })
      
      // Autorun should stop on error
      const finalState = usePipelineOrchestrationStore.getState()
      expect(finalState.isAutorunning).toBe(false)
      expect(finalState.currentStepInfo.status).toBe(StepStatus.Error)
    })
  })
})