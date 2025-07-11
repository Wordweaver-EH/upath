import { describe, test, expect, vi, beforeEach } from 'vitest'
import { PipelineOrchestrator } from '../PipelineOrchestrator'
import { StepId, StepStatus } from '../../../../types'
import { callGeminiAPI } from '../../../../services/geminiService'
import { useTranscriptStore } from '../../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../../stores/analysisResultStore'

// Import real services
import { StepParameterValidationService } from '../StepParameterValidationService'
import { StepContextPreparationService } from '../StepContextPreparationService'
import { StepInputPreparationService } from '../StepInputPreparationService'
import { StepExecutionService } from '../StepExecutionService'
import { PromptHistoryService } from '../PromptHistoryService'
import { StepErrorHandlingService } from '../StepErrorHandlingService'
import { StepSuccessHandlingService } from '../StepSuccessHandlingService'
import { StoreTransactionService } from '../StoreTransactionService'
import { usePromptHistoryStore } from '../../../stores/promptHistoryStore'
import { usePipelineOrchestrationStore } from '../../../stores/pipelineOrchestrationStore'

// Only mock external API
vi.mock('../../../../services/geminiService')

describe('PipelineOrchestrator Integration', () => {
  let orchestrator: PipelineOrchestrator
  let updateStoresSpy: ReturnType<typeof vi.fn>
  let addPromptEntrySpy: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset stores
    useTranscriptStore.setState({
      rawTranscripts: [],
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
    
    // Reset prompt history store
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
    
    // Reset orchestration store
    usePipelineOrchestrationStore.setState({
      currentStepInfo: {
        stepId: StepId.IDLE,
        status: StepStatus.Idle
      },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })
    
    // Create spies for store updates
    updateStoresSpy = vi.fn()
    addPromptEntrySpy = vi.fn()
    
    // Create transaction service with all required operations
    const transactionService = new StoreTransactionService({
      getTranscriptState: () => useTranscriptStore.getState(),
      getAnalysisState: () => useAnalysisResultStore.getState(),
      replaceProcessedData: (id, data) => useTranscriptStore.getState().replaceProcessedData(id, data),
      updateGenericState: (updates) => useAnalysisResultStore.getState().updateGenericState(updates),
      getPromptHistoryState: () => usePromptHistoryStore.getState(),
      getOrchestrationState: () => usePipelineOrchestrationStore.getState(),
      resetTranscripts: () => useTranscriptStore.getState().reset(),
      addTranscriptsSync: (transcripts) => useTranscriptStore.getState().addTranscriptsSync(transcripts),
      resetAnalysisState: () => useAnalysisResultStore.getState().reset(),
      resetPromptHistory: () => usePromptHistoryStore.getState().reset(),
      addPromptEntry: (entry) => usePromptHistoryStore.getState().addPromptEntry(entry),
      resetOrchestration: () => usePipelineOrchestrationStore.getState().reset(),
      setCurrentStepInfo: (info) => usePipelineOrchestrationStore.getState().setCurrentStepInfo(info),
      setActiveTranscriptIndex: (index) => usePipelineOrchestrationStore.getState().setActiveTranscriptIndex(index),
      setAutorunning: (value) => usePipelineOrchestrationStore.getState().setAutorunning(value),
      setShouldStopAutorun: (value) => usePipelineOrchestrationStore.getState().setShouldStopAutorun(value),
      setHilContext: (context) => usePipelineOrchestrationStore.getState().setHilContext(context)
    })
    
    // Create orchestrator with real services
    orchestrator = new PipelineOrchestrator(
      new StepParameterValidationService(() => useTranscriptStore.getState()),
      new StepContextPreparationService(),
      new StepInputPreparationService(),
      new StepExecutionService(),
      new PromptHistoryService(addPromptEntrySpy),
      new StepErrorHandlingService(),
      new StepSuccessHandlingService(),
      updateStoresSpy,
      addPromptEntrySpy,
      {
        getTranscriptState: () => useTranscriptStore.getState(),
        getAnalysisState: () => useAnalysisResultStore.getState(),
        replaceProcessedData: (id, data) => useTranscriptStore.getState().replaceProcessedData(id, data),
        updateGenericState: (updates) => useAnalysisResultStore.getState().updateGenericState(updates)
      },
      transactionService
    )
  })

  describe('Full Pipeline Flow', () => {
    test('should process step through all real services successfully', async () => {
      // Setup: Add transcript
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content for analysis',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name 
        }]])
      })
      
      // Mock successful API response
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { 
          adherence_score: 0.95,
          deviations: [],
          recommendations: ['Good transcription']
        },
        text: '{"adherence_score":0.95,"deviations":[],"recommendations":["Good transcription"]}',
        error: undefined,
        estimatedInputTokens: 150,
        estimatedOutputTokens: 75
      })
      
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          seed: 42,
          userDvFocus: { dv_focus: ['clarity', 'accuracy'] }
        }
      }
      
      // Act
      await orchestrator.processSingleStep(params)
      
      // Assert: Verify the complete flow
      // 1. Store updates called for start and success
      expect(updateStoresSpy).toHaveBeenCalledTimes(3)
      
      // First call: Loading state
      expect(updateStoresSpy).toHaveBeenNthCalledWith(1, {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        status: StepStatus.Loading,
        transcriptId: transcript.id
      })
      
      // Second call: After execution
      expect(updateStoresSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: transcript.id,
        output: expect.objectContaining({
          adherence_score: 0.95
        })
      }))
      
      // Third call: Success
      expect(updateStoresSpy).toHaveBeenNthCalledWith(3, expect.objectContaining({
        status: StepStatus.Success
      }))
      
      // 2. Prompt history entry created
      expect(addPromptEntrySpy).toHaveBeenCalledOnce()
      expect(addPromptEntrySpy).toHaveBeenCalledWith(expect.objectContaining({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: transcript.id,
        estimatedInputTokens: 150,
        estimatedOutputTokens: 75,
        responseParsed: expect.objectContaining({
          adherence_score: 0.95
        })
      }))
      
      // 3. API called with correct parameters
      expect(callGeminiAPI).toHaveBeenCalledWith(
        expect.any(Object), // prompt
        true, // isJsonOutput
        false, // useGrounding
        0.7, // temperature
        42, // seed
        1 // attempt
      )
    })

    test('should handle validation errors correctly', async () => {
      // Setup: No settings provided
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1'
        // Missing settings
      }
      
      // Act
      await orchestrator.processSingleStep(params)
      
      // Assert: Validation should fail
      expect(updateStoresSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'No settings provided to processSingleStep',
        status: StepStatus.Error
      }))
      
      // Should not proceed to execution
      expect(callGeminiAPI).not.toHaveBeenCalled()
      expect(addPromptEntrySpy).not.toHaveBeenCalled()
    })

    test('should handle API errors correctly', async () => {
      // Setup
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name 
        }]])
      })
      
      // Mock API error response
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: null,
        text: '',
        error: 'Rate limit exceeded',
        estimatedInputTokens: 100,
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
      await orchestrator.processSingleStep(params)
      
      // Assert: Error should be handled
      expect(updateStoresSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        status: StepStatus.Error,
        error: 'Rate limit exceeded'
      }))
      
      // Prompt history should still be created
      expect(addPromptEntrySpy).toHaveBeenCalled()
      
      // Transcript data should be updated with error
      const transcriptData = useTranscriptStore.getState().processedData.get(transcript.id)
      expect(transcriptData?.p0_1_error).toBe('Rate limit exceeded')
      expect(transcriptData?.p0_1_output).toBeUndefined()
    })

    test('should handle global steps correctly', async () => {
      // Setup: Add transcripts with required data for global step
      const transcripts = [
        { id: 't1', name: 'test1.txt', content: 'Content 1', uploadedAt: Date.now() },
        { id: 't2', name: 'test2.txt', content: 'Content 2', uploadedAt: Date.now() }
      ]
      
      const processedData = new Map(transcripts.map(t => [t.id, {
        id: t.id,
        filename: t.name,
        p1_4_output: {
          independent_variable_details: { var: 'test' },
          dependent_variable_focus: ['dv1'],
          specific_diachronic_structure: { phases: ['phase1'] }
        }
      }]))
      
      useTranscriptStore.setState({
        rawTranscripts: transcripts,
        processedData
      })
      
      // Mock successful API response for global step
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: {
          aligned_structures: ['structure1', 'structure2'],
          global_patterns: { pattern: 'test' }
        },
        text: '{"aligned_structures":["structure1","structure2"],"global_patterns":{"pattern":"test"}}',
        error: undefined,
        estimatedInputTokens: 300,
        estimatedOutputTokens: 150
      })
      
      const params = {
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        // No transcriptIdToProcess for global step
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      // Act
      await orchestrator.processSingleStep(params)
      
      // Assert: Global step processed correctly
      expect(updateStoresSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        status: StepStatus.Success
      }))
      
      // Analysis state should be updated
      const analysisState = useAnalysisResultStore.getState()
      expect(analysisState.genericAnalysisState.p3_1_output).toEqual({
        aligned_structures: ['structure1', 'structure2'],
        global_patterns: { pattern: 'test' }
      })
      
      // Prompt history created without transcript ID
      expect(addPromptEntrySpy).toHaveBeenCalledWith(expect.objectContaining({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        transcriptId: undefined,
        estimatedInputTokens: 300,
        estimatedOutputTokens: 150
      }))
    })

    test('should handle thrown errors during execution', async () => {
      // Setup: Add transcript
      const transcript = {
        id: 't1',
        name: 'test.txt',
        content: 'Test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name 
        }]])
      })
      
      // Mock API to throw an error
      vi.mocked(callGeminiAPI).mockRejectedValueOnce(new Error('Network error'))
      
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
      await orchestrator.processSingleStep(params)
      
      // Assert: Should handle thrown error
      expect(updateStoresSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        status: StepStatus.Error,
        error: 'Network error'
      }))
    })
  })

  describe('Service Integration', () => {
    test('should pass data correctly between services', async () => {
      // This test verifies that data flows correctly through all service layers
      const transcript = {
        id: 't1',
        name: 'integration.txt',
        content: 'Integration test content',
        uploadedAt: Date.now()
      }
      
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([[transcript.id, { 
          id: transcript.id, 
          filename: transcript.name,
          // Add some existing data to verify context preparation
          p_neg1_1_output: { existing: 'data' }
        }]])
      })
      
      // Mock API to echo back the prompt
      vi.mocked(callGeminiAPI).mockImplementation(async (prompt) => ({
        parsedJson: { echo: prompt },
        text: JSON.stringify({ echo: prompt }),
        error: undefined,
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      }))
      
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: transcript.id,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          seed: 123,
          userDvFocus: { dv_focus: ['integration', 'test'] }
        }
      }
      
      // Act
      await orchestrator.processSingleStep(params)
      
      // Assert: Verify the prompt includes expected elements
      const apiCall = vi.mocked(callGeminiAPI).mock.calls[0]
      const prompt = apiCall[0] as any
      
      // Should include transcript content
      expect(JSON.stringify(prompt)).toContain('Integration test content')
      
      // Temperature and seed should be passed
      expect(apiCall[2]).toBe(false) // useGrounding
      expect(apiCall[3]).toBe(0.7) // temperature
      expect(apiCall[4]).toBe(123) // seed
    })
  })
})