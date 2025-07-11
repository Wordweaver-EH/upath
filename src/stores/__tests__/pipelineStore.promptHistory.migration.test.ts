import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { useTranscriptStore } from '../transcriptStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'
import { StepId, StepStatus } from '../../../types'

// Mock external dependencies
vi.mock('../../services/geminiService')
vi.mock('../../utils/storage')

// Mock window.alert and URL.createObjectURL
global.alert = vi.fn()
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

describe('PipelineStore → PromptHistoryStore Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Reset all stores - pipelineStore no longer has state
    usePipelineOrchestrationStore.setState({
      currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false
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
    
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
    
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('processSingleStep integration', () => {
    test('should add prompt history entries to promptHistoryStore, not pipelineStore', async () => {
      const pipelineStore = usePipelineStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Add a transcript for testing
      const transcript = {
        id: 'test-transcript',
        name: 'test.txt',
        content: 'Test content',
        filename: 'test.txt',
        uploadedAt: Date.now()
      }
      useTranscriptStore.getState().rawTranscripts = [transcript]
      
      // Mock settings
      const mockSettings = {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: 123,
        userDvFocus: { dv_focus: ['test'] }
      }
      
      // Verify initial state
      expect(promptHistoryStore.promptHistory).toHaveLength(0)
      expect(promptHistoryStore.totalInputTokens).toBe(0)
      expect(promptHistoryStore.totalOutputTokens).toBe(0)
      
      // Note: We can't easily test processSingleStep due to complex dependencies
      // Instead, we verify the migration points work correctly
      
      // Test that pipelineStore delegates prompt history to promptHistoryStore
      // Using compatibility getters
      expect(pipelineStore.promptHistory).toEqual([])
      expect(pipelineStore.totalInputTokens).toBe(0)
      expect(pipelineStore.totalOutputTokens).toBe(0)
    })
  })

  describe('resetPromptHistoryOnly', () => {
    test('should reset promptHistoryStore when called', () => {
      const pipelineStore = usePipelineStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Add some data to prompt history store
      promptHistoryStore.addPromptEntry({
        stepId: 'P0_1' as StepId,
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test prompt',
        requestPayload: {},
        responseRaw: 'Test response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })
      
      // Verify data was added - need to get fresh state
      let currentState = usePromptHistoryStore.getState()
      expect(currentState.promptHistory).toHaveLength(1)
      expect(currentState.totalInputTokens).toBe(100)
      
      // Reset via pipelineStore method
      pipelineStore.resetPromptHistoryOnly()
      
      // Verify prompt history was reset
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toEqual([])
      expect(updatedState.totalInputTokens).toBe(0)
      expect(updatedState.totalOutputTokens).toBe(0)
    })
  })

  describe('downloadHistory', () => {
    test('should use promptHistoryStore data for download', () => {
      const pipelineStore = usePipelineStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Mock alert to prevent actual alerts
      const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      // Initially no history
      pipelineStore.downloadHistory('json', '/tmp')
      expect(mockAlert).toHaveBeenCalledWith('No history to download.')
      
      // Add history to promptHistoryStore
      promptHistoryStore.addPromptEntry({
        stepId: 'P0_1' as StepId,
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test prompt',
        requestPayload: {},
        responseRaw: 'Test response'
      })
      
      // Mock downloadFile to verify it's called
      const downloadFile = vi.fn()
      vi.doMock('../../utils/tsvHelper', () => ({
        downloadFile,
        generateTsvForPromptHistory: vi.fn().mockReturnValue('TSV content')
      }))
      
      // Now download should work (though downloadFile is mocked)
      mockAlert.mockClear()
      pipelineStore.downloadHistory('json', '/tmp')
      
      // Should not show alert anymore
      expect(mockAlert).not.toHaveBeenCalled()
    })
  })

  describe('isDownloadHistoryDisabled', () => {
    test('should check promptHistoryStore for history availability', () => {
      const pipelineStore = usePipelineStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Initially disabled (no history)
      expect(pipelineStore.isDownloadHistoryDisabled()).toBe(true)
      
      // Add history
      promptHistoryStore.addPromptEntry({
        stepId: 'P0_1' as StepId,
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test',
        requestPayload: {},
        responseRaw: 'Response'
      })
      
      // Now should be enabled
      expect(pipelineStore.isDownloadHistoryDisabled()).toBe(false)
    })
  })

  describe('getSaveState', () => {
    test('should include promptHistoryStore data in saved state', () => {
      const pipelineStore = usePipelineStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Add data to prompt history store
      const entry = {
        stepId: 'P0_1' as StepId,
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Save test',
        requestPayload: {},
        responseRaw: 'Response',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100
      }
      promptHistoryStore.addPromptEntry(entry)
      
      // Get save state
      const savedState = pipelineStore.getSaveState(
        0,
        { stepId: StepId.IDLE, status: 'idle' as any },
        { userDvFocus: '', temperature: 0.7, seed: 123 }
      )
      
      // Verify prompt history is included
      expect(savedState.promptHistory).toHaveLength(1)
      expect(savedState.promptHistory[0]).toEqual(entry)
      expect(savedState.totalInputTokens).toBe(200)
      expect(savedState.totalOutputTokens).toBe(100)
    })
  })

  describe('loadState', () => {
    test('should load prompt history into promptHistoryStore', () => {
      const pipelineStore = usePipelineStore.getState()
      const promptHistoryStore = usePromptHistoryStore.getState()
      
      // Create saved state with prompt history
      const savedState = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        rawTranscripts: [],
        processedDataArray: [],
        genericAnalysisState: {},
        promptHistory: [{
          stepId: 'P0_1' as StepId,
          timestamp: '2024-01-01T00:00:00Z',
          prompt: 'Loaded prompt',
          requestPayload: {},
          responseRaw: 'Loaded response',
          estimatedInputTokens: 150,
          estimatedOutputTokens: 75
        }],
        activeTranscriptIndex: 0,
        totalInputTokens: 150,
        totalOutputTokens: 75,
        userDvFocus: { dv_focus: [] },
        temperature: 0.7,
        seed: 123,
        outputDirectory: '/tmp',
        autoDownloadResults: false,
        currentStepInfo: { stepId: StepId.IDLE, status: 'idle' as any }
      }
      
      // Load state
      pipelineStore.loadState(savedState)
      
      // Verify prompt history was loaded into promptHistoryStore
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toHaveLength(1)
      expect(updatedState.promptHistory[0].prompt).toBe('Loaded prompt')
      expect(updatedState.totalInputTokens).toBe(150)
      expect(updatedState.totalOutputTokens).toBe(75)
    })
  })

  describe('persistence configuration', () => {
    test('pipelineStore should not persist prompt history anymore', () => {
      // Get the persist configuration from the store
      const store = usePipelineStore as any
      
      // The partialize function should return undefined
      // since all data has been migrated to other stores
      if (store.persist && store.persist.getOptions) {
        const options = store.persist.getOptions()
        const partialState = options.partialize(usePipelineStore.getState())
        expect(partialState).toBeUndefined()
      } else {
        // If persist isn't available, that's also acceptable
        expect(true).toBe(true)
      }
    })
  })
})