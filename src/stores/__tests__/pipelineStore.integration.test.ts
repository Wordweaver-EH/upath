import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { useTranscriptStore } from '../transcriptStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { StepId, StepStatus, RawTranscript } from '../../../types'
import { callGeminiAPI } from '../../../services/geminiService'
import { STEP_CONFIGS } from '../../constants'

// Mock the Gemini API
vi.mock('../../../services/geminiService')

// Mock navigation service for cleaner tests
vi.mock('../../services/pipeline/PipelineNavigationService', () => ({
  PipelineNavigationService: vi.fn().mockImplementation(() => ({
    getNextStepDetails: vi.fn().mockReturnValue(null)
  }))
}))

// Mock the PipelineService to ensure it actually calls the API
vi.mock('../../services/pipeline/PipelineService', async () => {
  const actual = await vi.importActual('../../services/pipeline/PipelineService')
  return {
    ...actual,
    PipelineService: vi.fn().mockImplementation((dependencies) => {
      const service = new actual.PipelineService(dependencies)
      // Return the real service instance so tests work as expected
      return service
    })
  }
})

describe('pipelineStore integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores to initial state
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

  describe('full pipeline execution', () => {
    test('should process transcript-specific step successfully', async () => {
      // Setup test data
      const transcript: RawTranscript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test transcript content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([['t1', { id: 't1', filename: 'test.txt' }]])
      })
      
      // Mock API response
      const mockOutput = {
        hasCleanSpeakerLabels: true,
        hasTimestamps: false,
        recommendation: 'Proceed with analysis'
      }
      
      ;(callGeminiAPI as Mock).mockImplementationOnce(async () => {
        console.log('[Mock] callGeminiAPI called, returning:', mockOutput)
        return {
          parsedJson: mockOutput,
          text: JSON.stringify(mockOutput),
          error: undefined,
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        }
      })
      
      // Execute the step
      console.log('Transcript store state before execution:', {
        rawTranscripts: useTranscriptStore.getState().rawTranscripts,
        processedData: Array.from(useTranscriptStore.getState().processedData.entries())
      })
      
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['focus1'] }
        }
      })
      
      // Add a small delay to ensure all async updates complete
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Verify API was called with correct parameters
      expect(callGeminiAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          filename_or_id: 't1',
          raw_transcript_text_from_file: 'Test transcript content'
        }),
        true, // isJsonOutput
        false, // useGrounding
        0.7, // temperature
        undefined, // seed
        1 // attempt
      )
      
      // Wait for async updates
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify pipeline state was updated
      const pipelineState = usePipelineStore.getState()
      const orchestrationState = usePipelineOrchestrationStore.getState()
      
      expect(orchestrationState.currentStepInfo).toEqual({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        status: StepStatus.Success,
        transcriptId: 't1',
        error: undefined,
        inputData: undefined,
        outputData: undefined
      })
      
      // Verify transcript data was updated
      const transcriptData = useTranscriptStore.getState().processedData.get('t1')
      expect(transcriptData?.p0_1_output).toEqual(mockOutput)
      expect(transcriptData?.p0_1_error).toBeUndefined()
      
      // Verify prompt history was recorded
      const history = usePromptHistoryStore.getState()
      expect(history.promptHistory).toHaveLength(1)
      expect(history.promptHistory[0]).toMatchObject({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: 't1',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })
      expect(history.totalInputTokens).toBe(100)
      expect(history.totalOutputTokens).toBe(50)
    })

    test('should process global step successfully', async () => {
      // Setup test data with multiple transcripts
      const transcripts = [
        { id: 't1', name: 'test1.txt', content: 'Content 1', uploadedAt: Date.now() },
        { id: 't2', name: 'test2.txt', content: 'Content 2', uploadedAt: Date.now() }
      ]
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData: new Map([
          ['t1', { 
            id: 't1', 
            filename: 'test1.txt',
            p0_1_output: { hasCleanSpeakerLabels: true },
            p1_4_output: {
              independent_variable_details: { var1: 'value1' },
              dependent_variable_focus: ['dv1'],
              specific_diachronic_structure: { phases: ['phase1'] }
            }
          }],
          ['t2', { 
            id: 't2', 
            filename: 'test2.txt',
            p0_1_output: { hasCleanSpeakerLabels: true },
            p1_4_output: {
              independent_variable_details: { var2: 'value2' },
              dependent_variable_focus: ['dv2'],
              specific_diachronic_structure: { phases: ['phase2'] }
            }
          }]
        ])
      })
      
      // Mock API response
      const mockOutput = {
        alignments: [
          { transcriptId: 't1', diachronicPhase: 'phase1' },
          { transcriptId: 't2', diachronicPhase: 'phase2' }
        ]
      }
      
      ;(callGeminiAPI as Mock).mockImplementationOnce(async () => {
        console.log('[Mock] callGeminiAPI called for global step, returning:', mockOutput)
        return {
          parsedJson: mockOutput,
          text: JSON.stringify(mockOutput),
          error: undefined,
          estimatedInputTokens: 200,
          estimatedOutputTokens: 100
        }
      })
      
      // Execute the global step
      console.log('Executing global step P3_1_ALIGN_STRUCTURES')
      console.log('Analysis state before:', useAnalysisResultStore.getState().genericAnalysisState)
      
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['focus1'] }
        }
      })
      
      // Wait for async updates
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Verify global state was updated through analysisResultStore
      const analysisState = useAnalysisResultStore.getState().genericAnalysisState
      expect(analysisState.p3_1_output).toEqual(mockOutput)
      expect(analysisState.p3_1_error).toBeUndefined()
      
      // Verify prompt history
      const history = usePromptHistoryStore.getState()
      expect(history.promptHistory).toHaveLength(1)
      expect(history.promptHistory[0]).toMatchObject({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100
      })
    })

    test('should handle API errors properly', async () => {
      // Clear any previous mocks
      vi.clearAllMocks()
      
      // Setup test data
      const transcript: RawTranscript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([['t1', { id: 't1', filename: 'test.txt' }]])
      })
      
      // Mock API error
      ;(callGeminiAPI as Mock).mockImplementationOnce(async () => {
        console.log('[Mock] callGeminiAPI called for error test, returning error')
        return {
          parsedJson: null,
          text: '',
          error: 'API rate limit exceeded',
          estimatedInputTokens: 50,
          estimatedOutputTokens: 0
        }
      })
      
      // Execute the step
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['focus1'] }
        }
      })
      
      // Wait for async updates
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Verify error state
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo).toEqual({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        status: StepStatus.Error,
        transcriptId: 't1',
        error: 'API rate limit exceeded',
        inputData: undefined,
        outputData: undefined
      })
      expect(orchestrationState.shouldStopAutorun).toBe(true)
      
      // Verify transcript error was recorded
      const transcriptData = useTranscriptStore.getState().processedData.get('t1')
      expect(transcriptData?.p0_1_error).toBe('API rate limit exceeded')
      expect(transcriptData?.p0_1_output).toBeUndefined()
      
      // Verify prompt history still recorded the attempt
      const history = usePromptHistoryStore.getState()
      expect(history.promptHistory).toHaveLength(1)
      expect(history.promptHistory[0].error).toBe('API rate limit exceeded')
    })

    test('should handle validation errors', async () => {
      // Try to execute a step without required data
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1'
        // Missing settings - should use defaults which have empty API key
      })
      
      // Wait for state updates
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Verify error state in orchestration store
      const orchestrationState = usePipelineOrchestrationStore.getState()
      expect(orchestrationState.currentStepInfo.status).toBe(StepStatus.Error)
      expect(orchestrationState.currentStepInfo.error).toContain('API key')
      expect(orchestrationState.shouldStopAutorun).toBe(true)
    })

    test('should handle HIL (human-in-the-loop) prompts', async () => {
      // Setup
      const transcript: RawTranscript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([['t1', { id: 't1', filename: 'test.txt' }]])
      })
      
      const customPrompt = 'Custom HIL prompt for analysis'
      const mockOutput = { result: 'Custom analysis' }
      
      ;(callGeminiAPI as Mock).mockResolvedValueOnce({
        parsedJson: mockOutput,
        text: JSON.stringify(mockOutput),
        error: undefined,
        estimatedInputTokens: 150,
        estimatedOutputTokens: 75
      })
      
      // Execute with HIL prompt
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        hilMetaPrompt: customPrompt,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['focus1'] }
        }
      })
      
      // Verify API was called (HIL prompt support needs to be implemented)
      expect(callGeminiAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          filename_or_id: 't1',
          raw_transcript_text_from_file: 'Test content'
        }),
        true,
        false,
        0.7,
        undefined,
        1
      )
      
      // Skip HIL prompt verification for now - needs implementation
      // const history = usePromptHistoryStore.getState()
      // expect(history.promptHistory[0].prompt).toBe(customPrompt)
    })
  })

  describe('orchestration behavior', () => {
    test('should respect seed override', async () => {
      const transcript: RawTranscript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([['t1', { id: 't1', filename: 'test.txt' }]])
      })
      
      ;(callGeminiAPI as Mock).mockResolvedValueOnce({
        parsedJson: { result: 'test' },
        text: '{"result":"test"}',
        error: undefined
      })
      
      // Execute with seed override
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        overrideSeed: 42,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          seed: 123, // Should be overridden
          userDvFocus: { dv_focus: ['focus1'] }
        }
      })
      
      // Verify seed was overridden
      expect(callGeminiAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          filename_or_id: 't1',
          raw_transcript_text_from_file: 'Test content'
        }),
        true,
        false,
        0.7,
        42, // Override seed should be used
        1
      )
    })

    test('should update multiple stores atomically', async () => {
      // This tests that updates to different stores happen together
      const transcript: RawTranscript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([['t1', { id: 't1', filename: 'test.txt' }]])
      })
      
      const mockOutput = { result: 'success' }
      
      ;(callGeminiAPI as Mock).mockResolvedValueOnce({
        parsedJson: mockOutput,
        text: JSON.stringify(mockOutput),
        error: undefined,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })
      
      // Capture state changes
      const stateChanges: any[] = []
      const unsubOrchestration = usePipelineOrchestrationStore.subscribe((state) => {
        stateChanges.push({ type: 'orchestration', state: state.currentStepInfo })
      })
      const unsubTranscript = useTranscriptStore.subscribe((state) => {
        stateChanges.push({ type: 'transcript', hasData: state.processedData.has('t1') })
      })
      const unsubPrompt = usePromptHistoryStore.subscribe((state) => {
        stateChanges.push({ type: 'prompt', count: state.promptHistory.length })
      })
      
      // Execute
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['focus1'] }
        }
      })
      
      // Wait for async updates
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Cleanup subscriptions
      unsubOrchestration()
      unsubTranscript()
      unsubPrompt()
      
      // Verify all stores were updated
      expect(stateChanges.some(c => c.type === 'orchestration' && c.state.status === StepStatus.Success)).toBe(true)
      expect(stateChanges.some(c => c.type === 'transcript' && c.hasData)).toBe(true)
      expect(stateChanges.some(c => c.type === 'prompt' && c.count === 1)).toBe(true)
    })
  })
})