import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PipelineOrchestrator } from '../PipelineOrchestrator'
import { StoreTransactionService } from '../StoreTransactionService'
import { StepParameterValidationService } from '../StepParameterValidationService'
import { StepContextPreparationService } from '../StepContextPreparationService'
import { StepInputPreparationService } from '../StepInputPreparationService'
import { StepExecutionService } from '../StepExecutionService'
import { PromptHistoryService } from '../PromptHistoryService'
import { StepErrorHandlingService } from '../StepErrorHandlingService'
import { StepSuccessHandlingService } from '../StepSuccessHandlingService'
import { useTranscriptStore } from '../../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../../stores/analysisResultStore'
import { usePromptHistoryStore } from '../../../stores/promptHistoryStore'
import { usePipelineOrchestrationStore } from '../../../stores/pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../../../types'
import { callGeminiAPI } from '../../../../services/geminiService'

// Mock storage to avoid persistence during tests
vi.mock('../../../utils/storage', () => ({
  localForageStorage: {
    setItem: vi.fn(),
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn()
  }
}))

// Mock Gemini API
vi.mock('../../../../services/geminiService', () => ({
  callGeminiAPI: vi.fn()
}))

describe('PipelineOrchestrator Transaction Tests', () => {
  let orchestrator: PipelineOrchestrator
  let updateStoresMock: vi.Mock
  let addPromptEntryMock: vi.Mock
  let transactionService: StoreTransactionService

  beforeEach(() => {
    // Clear all stores
    useTranscriptStore.setState({ rawTranscripts: [], processedData: new Map() })
    useAnalysisResultStore.setState({ 
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false
      }
    })
    usePromptHistoryStore.setState({ 
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
    usePipelineOrchestrationStore.setState({
      currentStepInfo: {
        stepId: StepId.IDLE,
        status: StepStatus.Idle
      },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
    })

    // Setup mocks
    updateStoresMock = vi.fn()
    addPromptEntryMock = vi.fn()
    
    // Create transaction service with all required operations
    transactionService = new StoreTransactionService({
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
      new PromptHistoryService(addPromptEntryMock),
      new StepErrorHandlingService(),
      new StepSuccessHandlingService(),
      updateStoresMock,
      addPromptEntryMock,
      {
        getTranscriptState: () => useTranscriptStore.getState(),
        getAnalysisState: () => useAnalysisResultStore.getState(),
        replaceProcessedData: (id, data) => useTranscriptStore.getState().replaceProcessedData(id, data),
        updateGenericState: (updates) => useAnalysisResultStore.getState().updateGenericState(updates)
      },
      transactionService
    )

    // Setup test data
    useTranscriptStore.getState().addTranscriptsSync([{
      id: 't1',
      name: 'test.txt',
      content: 'Test transcript content',
      uploadedAt: Date.now()
    }])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Transaction Atomicity', () => {
    it('should handle API execution errors atomically', async () => {
      // Setup initial state
      useTranscriptStore.getState().updateProcessedData('t1', {
        p0_1_output: 'initial output'
      })
      useAnalysisResultStore.getState().updateGenericState({
        p2_1_meta_output: 'initial meta'
      })

      // Mock API to fail
      vi.mocked(callGeminiAPI).mockRejectedValueOnce(new Error('API Error'))

      // Execute step
      await orchestrator.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })

      // Verify error was handled atomically
      const transcriptState = useTranscriptStore.getState()
      const analysisState = useAnalysisResultStore.getState()
      
      // Error should be recorded in transcript data
      expect(transcriptState.processedData.get('t1')?.p0_1_error).toBe('API Error')
      // Output remains unchanged when there's an error during execution
      expect(transcriptState.processedData.get('t1')?.p0_1_output).toBe('initial output')
      
      // Other state should remain unchanged
      expect(analysisState.genericAnalysisState.p2_1_meta_output).toBe('initial meta')
      
      // Verify error was reported through updateStores
      expect(updateStoresMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StepStatus.Error,
          error: expect.stringContaining('API Error')
        })
      )
    })

    it('should commit all changes on successful execution', async () => {
      // Mock successful API response
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { adherence_score: 0.95, deviations: [] },
        error: undefined,
        groundingSources: [],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })

      // Execute step
      await orchestrator.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })

      // Verify all stores were updated atomically
      const transcriptState = useTranscriptStore.getState()
      expect(transcriptState.processedData.get('t1')?.p0_1_output).toEqual({
        adherence_score: 0.95,
        deviations: []
      })
      expect(transcriptState.processedData.get('t1')?.p0_1_error).toBeUndefined()
      
      // Verify prompt history was updated
      expect(addPromptEntryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptId: 't1'
        })
      )
      
      // Verify success status
      expect(updateStoresMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StepStatus.Success
        })
      )
    })

    it('should handle API error in output with atomic rollback', async () => {
      // Mock API response with error
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: undefined,
        error: 'Rate limit exceeded',
        groundingSources: [],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 0
      })

      // Setup initial state
      const initialProcessedData = new Map(useTranscriptStore.getState().processedData)

      // Execute step
      await orchestrator.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })

      // Verify prompt history was added despite error
      expect(addPromptEntryMock).toHaveBeenCalled()
      
      // Verify error handling was atomic
      const transcriptState = useTranscriptStore.getState()
      expect(transcriptState.processedData.get('t1')?.p0_1_error).toBe('Rate limit exceeded')
      // Output field remains unchanged when there's an API error (not cleared)
      expect(transcriptState.processedData.get('t1')?.p0_1_output).toBeUndefined()
      
      // Verify error status
      expect(updateStoresMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StepStatus.Error,
          error: 'Rate limit exceeded'
        })
      )
    })

    it('should handle global step transactions correctly', async () => {
      // Setup initial state for global analysis with required processed transcript data
      useTranscriptStore.getState().updateProcessedData('t1', {
        p1_1_output: { segments: [] },
        p1_2_output: { diachronic_units: [] },
        p1_3_output: { refined_units: [] },
        p1_4_output: { structure: {} },
        isFullyProcessedSpecificDiachronic: true,
        p2s_1_output: { groups: [] },
        p2s_2_output: { units: [] },
        p2s_3_output: { structure: {} },
        isFullyProcessedSpecificSynchronic: true
      })
      
      useAnalysisResultStore.getState().updateGenericState({
        p2_1_meta_output: 'meta analysis',
        p2_2_diachronic_output: 'diachronic results'
      })

      // Mock successful API response for global step
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { aligned_structures: ['struct1', 'struct2'] },
        error: undefined,
        groundingSources: [],
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100
      })

      // Execute global step
      await orchestrator.processSingleStep({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify global state was updated atomically
      const analysisState = useAnalysisResultStore.getState()
      expect(analysisState.genericAnalysisState.p3_1_output).toEqual({
        aligned_structures: ['struct1', 'struct2']
      })
      expect(analysisState.genericAnalysisState.p3_1_error).toBeUndefined()
      
      // Verify existing state wasn't lost
      expect(analysisState.genericAnalysisState.p2_1_meta_output).toBe('meta analysis')
      expect(analysisState.genericAnalysisState.p2_2_diachronic_output).toBe('diachronic results')
    })

    it('should maintain consistency across multiple stores during error', async () => {
      // Setup complex initial state
      useTranscriptStore.getState().updateProcessedData('t1', {
        p0_1_output: 'step1 output',
        p0_2_output: 'step2 output'
      })
      
      const initialPromptCount = usePromptHistoryStore.getState().promptHistory.length

      // Mock API to fail after some processing
      vi.mocked(callGeminiAPI).mockImplementationOnce(async () => {
        // Simulate some processing that might have side effects
        await new Promise(resolve => setTimeout(resolve, 10))
        throw new Error('Connection timeout')
      })

      // Execute step
      await orchestrator.processSingleStep({
        stepId: StepId.P0_3_CONTEXTUALIZATION,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })

      // Verify no partial updates occurred
      const transcriptState = useTranscriptStore.getState()
      expect(transcriptState.processedData.get('t1')?.p0_3_output).toBeUndefined()
      expect(transcriptState.processedData.get('t1')?.p0_3_error).toBeUndefined()
      
      // Verify existing data wasn't corrupted
      expect(transcriptState.processedData.get('t1')?.p0_1_output).toBe('step1 output')
      expect(transcriptState.processedData.get('t1')?.p0_2_output).toBe('step2 output')
      
      // Verify prompt history wasn't updated on execution error
      expect(usePromptHistoryStore.getState().promptHistory.length).toBe(initialPromptCount)
    })
  })

  describe('Transaction Logging', () => {
    it('should log transaction details for debugging', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      // Mock successful API response
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { test: 'output' },
        error: undefined,
        groundingSources: [],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })

      // Execute step
      await orchestrator.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: ['test'] }
        }
      })

      // Verify transaction logging
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[StoreTransaction\] Transaction tx_\d+_\d+ started/)
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[StoreTransaction\] Transaction tx_\d+_\d+ committed/)
      )

      consoleSpy.mockRestore()
    })
  })
})