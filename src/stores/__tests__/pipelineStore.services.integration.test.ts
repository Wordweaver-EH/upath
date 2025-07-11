import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StepId, StepStatus } from '../../../types'
import { usePipelineStore } from '../pipelineStore'
import { useTranscriptStore } from '../transcriptStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { callGeminiAPI } from '../../../services/geminiService'

// Only mock the external API - everything else should be real
vi.mock('../../../services/geminiService')

describe('pipelineStore services integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores
    usePipelineOrchestrationStore.getState().reset()
    useTranscriptStore.getState().reset()
    usePromptHistoryStore.getState().reset()
    useAnalysisResultStore.getState().reset()
  })

  describe('processSingleStep with real PipelineService', () => {
    test('should process step through real service layers', async () => {
      // Setup: Add a transcript
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      // Mock successful API response
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { analysis: 'test result' },
        text: '{"analysis":"test result"}',
        error: undefined,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })
      
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          seed: 123,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      // Act: Process through real pipeline
      await usePipelineStore.getState().processSingleStep(params)
      
      // Assert: Verify all layers worked correctly
      // 1. Orchestration state updated
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Success)
      
      // 2. Transcript data updated
      const transcriptData = useTranscriptStore.getState().processedData.get(transcript.id)
      expect(transcriptData?.p0_1_output).toEqual({ analysis: 'test result' })
      
      // 3. Prompt history recorded
      const promptHistory = usePromptHistoryStore.getState()
      expect(promptHistory.promptHistory).toHaveLength(1)
      expect(promptHistory.promptHistory[0]).toMatchObject({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: transcript.id,
        responseParsed: { analysis: 'test result' }
      })
      
      // 4. Token counts updated
      expect(promptHistory.totalInputTokens).toBe(100)
      expect(promptHistory.totalOutputTokens).toBe(50)
    })

    test('should handle validation errors through real service layers', async () => {
      // Setup: Try with empty API key
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: '', // Empty API key triggers validation error
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      // Act
      await usePipelineStore.getState().processSingleStep(params)
      
      // Assert: Error handled properly through all layers
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toBe('API key is required')
      expect(orchestrationState.shouldStopAutorun).toBe(true)
    })
    
    test('should handle execution errors through real service layers', async () => {
      // Setup: Add transcript and mock API error
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { id: transcript.id, filename: transcript.name }]])
      })
      
      // Mock API to return error
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: null,
        text: '',
        error: 'API rate limit exceeded',
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0
      })
      
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      // Act
      await usePipelineStore.getState().processSingleStep(params)
      
      // Assert: API error handled properly
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toBe('API rate limit exceeded')
      
      // Error should be recorded in transcript data
      const transcriptData = useTranscriptStore.getState().processedData.get(transcript.id)
      expect(transcriptData?.p0_1_error).toBe('API rate limit exceeded')
      expect(transcriptData?.p0_1_output).toBeUndefined()
    })
  })

  describe('resetPipeline with real service', () => {
    test('should reset all stores through real service', async () => {
      // Setup: Add data to all stores
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name,
          p0_1_output: { result: 'data' }
        }]])
      })
      
      usePromptHistoryStore.getState().addPromptEntry({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: transcript.id,
        timestamp: new Date().toISOString(),
        prompt: 'test',
        requestPayload: {},
        responseRaw: 'test',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 5
      })
      
      useAnalysisResultStore.getState().updateGenericState({
        p3_1_output: { data: 'test' },
        isFullyProcessedGenericDiachronic: true
      })
      
      usePipelineOrchestrationStore.setState({
        currentStepInfo: { 
          stepId: StepId.P3_1_ALIGN_STRUCTURES, 
          status: StepStatus.Success 
        }
      })
      
      // Act: Reset through real service
      usePipelineStore.getState().resetPipeline()
      
      // Assert: All stores reset
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(0)
      expect(usePromptHistoryStore.getState().promptHistory).toHaveLength(0)
      expect(useAnalysisResultStore.getState().genericAnalysisState.p3_1_output).toBeUndefined()
      expect(useAnalysisResultStore.getState().genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(false)
      expect(usePipelineOrchestrationStore.getState().currentStepInfo.stepId).toBe(StepId.IDLE)
    })
  })

  describe('navigation with real service', () => {
    test('should get next step details through real navigation service', () => {
      // Setup: Add transcripts and set current step
      const transcripts = [
        { id: 't1', name: 'test1.txt', content: 'Content 1', uploadedAt: Date.now() },
        { id: 't2', name: 'test2.txt', content: 'Content 2', uploadedAt: Date.now() }
      ]
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData: new Map(transcripts.map(t => [t.id, { 
          id: t.id, 
          filename: t.name,
          p_neg1_1_output: { variables: ['var1'] }
        }]))
      })
      
      const currentStepInfo = {
        stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        status: StepStatus.Success,
        transcriptId: 't1'
      }
      
      // Act
      const nextStep = usePipelineStore.getState().getNextStepDetails(currentStepInfo, 0)
      
      // Assert
      expect(nextStep).toBeTruthy()
      expect(nextStep?.nextStepId).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION)
      expect(nextStep?.nextTranscriptIndex).toBe(1) // Move to next transcript
    })
  })

  describe('invalidation with real service', () => {
    test('should orchestrate invalidation through real service', () => {
      // Setup: Add data that will be invalidated
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name,
          p1_1_output: { segments: ['seg1'] },
          p1_2_output: { tokens: ['tok1'] },
          p1_3_output: { syntax: 'data' }
        }]])
      })
      
      // Act: Invalidate P1_1 (should cascade to P1_2 and P1_3)
      usePipelineStore.getState().orchestrateInvalidation(
        StepId.P1_1_INITIAL_SEGMENTATION,
        transcript.id
      )
      
      // Assert: Dependent steps invalidated
      const updatedData = useTranscriptStore.getState().processedData.get(transcript.id)
      expect(updatedData?.p1_1_output).toBeUndefined()
      expect(updatedData?.p1_2_output).toBeUndefined()
      expect(updatedData?.p1_3_output).toBeUndefined()
    })
  })

  describe('state management with real service', () => {
    test('should save and load state through real service', () => {
      // Setup: Create state to save
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name,
          p0_1_output: { result: 'data' }
        }]])
      })
      
      const promptEntry = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: transcript.id,
        timestamp: new Date().toISOString(),
        prompt: 'test prompt',
        requestPayload: { test: true },
        responseRaw: 'response',
        responseParsed: { result: 'data' },
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      }
      
      usePromptHistoryStore.getState().addPromptEntry(promptEntry)
      
      const currentStepInfo = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        status: StepStatus.Success
      }
      
      const settings = {
        userDvFocus: 'test focus',
        temperature: 0.7,
        seed: 123
      }
      
      // Act: Save state
      const savedState = usePipelineStore.getState().getSaveState(0, currentStepInfo, settings)
      
      // Assert: State saved correctly
      expect(savedState.rawTranscripts).toHaveLength(1)
      expect(savedState.processedDataArray).toHaveLength(1)
      expect(savedState.promptHistory).toHaveLength(1)
      expect(savedState.totalInputTokens).toBe(100)
      expect(savedState.totalOutputTokens).toBe(50)
      
      // Reset everything
      usePipelineStore.getState().resetPipeline()
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(0)
      
      // Load state back
      usePipelineStore.getState().loadState(savedState)
      
      // Assert: State restored
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(1)
      expect(useTranscriptStore.getState().processedData.get(transcript.id)?.p0_1_output).toEqual({ result: 'data' })
      expect(usePromptHistoryStore.getState().promptHistory).toHaveLength(1)
    })
  })
})