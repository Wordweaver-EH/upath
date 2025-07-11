import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PipelineStateManagementService } from '../PipelineStateManagementService'
import { 
  SavedState, 
  StepId, 
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  PromptHistoryEntry
} from '../../../../types'
import { localForageStorage } from '../../../utils/storage'

// Mock the storage module
vi.mock('../../../utils/storage', () => ({
  localForageStorage: {
    removeItem: vi.fn()
  }
}))

describe('PipelineStateManagementService', () => {
  let service: PipelineStateManagementService
  let mockDependencies: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock dependencies
    mockDependencies = {
      transcriptStore: {
        reset: vi.fn(),
        addTranscriptsSync: vi.fn(),
        updateProcessedData: vi.fn(),
        getState: vi.fn().mockReturnValue({
          rawTranscripts: [],
          processedData: new Map()
        })
      },
      analysisResultStore: {
        updateGenericState: vi.fn(),
        getState: vi.fn().mockReturnValue({
          genericAnalysisState: {
            p3_1_output: undefined,
            p3_2_output: undefined,
            isFullyProcessedGenericDiachronic: false,
            core_gdus_for_sync_analysis: [],
            processed_gdus_for_p4s: [],
            isFullyProcessedGenericSynchronic: false
          }
        })
      },
      promptHistoryStore: {
        reset: vi.fn(),
        addPromptEntry: vi.fn(),
        getState: vi.fn().mockReturnValue({
          promptHistory: [],
          totalInputTokens: 0,
          totalOutputTokens: 0
        })
      },
      orchestrationStore: {
        setCurrentStepInfo: vi.fn(),
        setShouldStopAutorun: vi.fn()
      }
    }
    
    service = new PipelineStateManagementService(mockDependencies)
  })
  
  describe('loadState', () => {
    it('should load saved state into all stores correctly', () => {
      const mockTranscript: RawTranscript = {
        id: 'transcript-1',
        filename: 'test.txt',
        content: 'test content'
      }
      
      const mockProcessedData: TranscriptProcessedData = {
        filename: 'test.txt',
        p_neg1_1_output: { variables: [] },
        isFullyProcessedSpecificDiachronic: false,
        isFullyProcessedSpecificSynchronic: false
      }
      
      const mockPromptEntry: PromptHistoryEntry = {
        timestamp: new Date(),
        stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        transcriptId: 'transcript-1',
        requestPayload: { data: 'test' },
        response: 'test response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      }
      
      const savedState: SavedState = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        rawTranscripts: [mockTranscript],
        processedDataArray: [['transcript-1', mockProcessedData]],
        genericAnalysisState: {
          p3_1_output: { test: 'data' },
          isFullyProcessedGenericDiachronic: true
        } as GenericAnalysisState,
        promptHistory: [mockPromptEntry],
        activeTranscriptIndex: 0,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        userDvFocus: 'test focus',
        temperature: 0.7,
        seed: 12345,
        currentStepInfo: { stepId: StepId.P3_1_IDENTIFY_GDUS, status: StepStatus.Success }
      }
      
      service.loadState(savedState)
      
      // Verify transcript store operations
      expect(mockDependencies.transcriptStore.reset).toHaveBeenCalledOnce()
      expect(mockDependencies.transcriptStore.addTranscriptsSync).toHaveBeenCalledWith([mockTranscript])
      expect(mockDependencies.transcriptStore.updateProcessedData).toHaveBeenCalledWith('transcript-1', mockProcessedData)
      
      // Verify analysis result store operations
      expect(mockDependencies.analysisResultStore.updateGenericState).toHaveBeenCalledWith(savedState.genericAnalysisState)
      
      // Verify prompt history store operations
      expect(mockDependencies.promptHistoryStore.reset).toHaveBeenCalledOnce()
      expect(mockDependencies.promptHistoryStore.addPromptEntry).toHaveBeenCalledWith(mockPromptEntry)
    })
    
    it('should handle empty saved state', () => {
      const savedState: SavedState = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        rawTranscripts: [],
        processedDataArray: [],
        genericAnalysisState: {} as GenericAnalysisState,
        promptHistory: [],
        activeTranscriptIndex: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        userDvFocus: '',
        temperature: 0.7,
        seed: 0,
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle }
      }
      
      service.loadState(savedState)
      
      expect(mockDependencies.transcriptStore.reset).toHaveBeenCalledOnce()
      expect(mockDependencies.transcriptStore.addTranscriptsSync).toHaveBeenCalledWith([])
      expect(mockDependencies.analysisResultStore.updateGenericState).toHaveBeenCalledWith({})
      expect(mockDependencies.promptHistoryStore.reset).toHaveBeenCalledOnce()
    })
  })
  
  describe('getSaveState', () => {
    it('should extract current state from all stores', () => {
      const mockTranscript: RawTranscript = {
        id: 'transcript-1',
        filename: 'test.txt',
        content: 'test content'
      }
      
      const mockProcessedData = new Map([
        ['transcript-1', { filename: 'test.txt' } as TranscriptProcessedData]
      ])
      
      const mockPromptHistory: PromptHistoryEntry[] = [{
        timestamp: new Date(),
        stepId: StepId.P3_1_IDENTIFY_GDUS,
        requestPayload: { test: 'data' },
        response: 'test response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      }]
      
      mockDependencies.transcriptStore.getState.mockReturnValue({
        rawTranscripts: [mockTranscript],
        processedData: mockProcessedData
      })
      
      mockDependencies.analysisResultStore.getState.mockReturnValue({
        genericAnalysisState: {
          p3_1_output: { test: 'data' },
          isFullyProcessedGenericDiachronic: true
        }
      })
      
      mockDependencies.promptHistoryStore.getState.mockReturnValue({
        promptHistory: mockPromptHistory,
        totalInputTokens: 100,
        totalOutputTokens: 50
      })
      
      const settings = {
        userDvFocus: 'test focus',
        temperature: 0.7,
        seed: 12345
      }
      
      const currentStepInfo = { 
        stepId: StepId.P3_1_IDENTIFY_GDUS, 
        status: StepStatus.Success 
      }
      
      const result = service.getSaveState(0, currentStepInfo, settings)
      
      expect(result).toEqual({
        version: '1.0',
        savedAt: expect.any(String),
        rawTranscripts: [mockTranscript],
        processedDataArray: [['transcript-1', { filename: 'test.txt' }]],
        genericAnalysisState: {
          p3_1_output: { test: 'data' },
          isFullyProcessedGenericDiachronic: true
        },
        promptHistory: mockPromptHistory,
        activeTranscriptIndex: 0,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        userDvFocus: 'test focus',
        temperature: 0.7,
        seed: 12345,
        currentStepInfo: currentStepInfo
      })
    })
  })
  
  describe('resetPipeline', () => {
    it('should reset all pipeline-related state', () => {
      service.resetPipeline()
      
      // Verify analysis state is reset
      expect(mockDependencies.analysisResultStore.updateGenericState).toHaveBeenCalledWith({
        p3_1_output: undefined,
        p3_1_error: undefined,
        p3_2_output: undefined,
        p3_2_error: undefined,
        p3_3_output: undefined,
        p3_3_error: undefined,
        p3_3_mermaid_syntax: undefined,
        isFullyProcessedGenericDiachronic: false,
        core_gdus_for_sync_analysis: [],
        processed_gdus_for_p4s: [],
        current_gdu_for_p4s_processing: undefined,
        p4s_outputs_by_gdu: {},
        p4s_mermaid_syntax_by_gdu: {},
        p4s_1_a_outputs_by_gdu: {},
        p4s_1_a_error: undefined,
        p4s_1_b_error: undefined,
        isFullyProcessedGenericSynchronic: false,
        p5_1_output: undefined,
        p5_1_error: undefined,
        p5_2_output: undefined,
        p5_2_error: undefined,
        p5_3_output: undefined,
        p5_3_error: undefined,
        p5_3_mermaid_syntax: undefined,
        p6_1_output: undefined,
        p6_1_error: undefined,
        p7_1_output: undefined,
        p7_1_error: undefined,
        p7_1_mermaid_syntax: undefined
      })
      
      // Verify prompt history is reset
      expect(mockDependencies.promptHistoryStore.reset).toHaveBeenCalledOnce()
      
      // Verify UI state is reset
      expect(mockDependencies.orchestrationStore.setCurrentStepInfo).toHaveBeenCalledWith({
        stepId: StepId.IDLE,
        status: StepStatus.Idle
      })
      expect(mockDependencies.orchestrationStore.setShouldStopAutorun).toHaveBeenCalledWith(true)
    })
  })
  
  describe('clearAutosaveData', () => {
    it('should clear autosave data from storage', async () => {
      vi.mocked(localForageStorage.removeItem).mockResolvedValue(undefined)
      
      await service.clearAutosaveData()
      
      expect(localForageStorage.removeItem).toHaveBeenCalledWith('upath-autosave-session-v2-localforage')
    })
    
    it('should handle storage errors', async () => {
      const error = new Error('Storage error')
      vi.mocked(localForageStorage.removeItem).mockRejectedValue(error)
      
      await expect(service.clearAutosaveData()).rejects.toThrow('Storage error')
    })
  })
  
  describe('edge cases', () => {
    it('should handle malformed processedDataArray entries', () => {
      const savedState: SavedState = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        rawTranscripts: [],
        processedDataArray: [
          ['transcript-1', { filename: 'test.txt' } as TranscriptProcessedData],
          ['transcript-2', null as any], // Malformed entry
          [null as any, { filename: 'test2.txt' } as TranscriptProcessedData] // Invalid ID
        ],
        genericAnalysisState: {} as GenericAnalysisState,
        promptHistory: [],
        activeTranscriptIndex: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        userDvFocus: '',
        temperature: 0.7,
        seed: 0,
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle }
      }
      
      // Should not throw
      expect(() => service.loadState(savedState)).not.toThrow()
      
      // Should still call updateProcessedData for valid entries
      expect(mockDependencies.transcriptStore.updateProcessedData).toHaveBeenCalledWith(
        'transcript-1', 
        { filename: 'test.txt' }
      )
      expect(mockDependencies.transcriptStore.updateProcessedData).toHaveBeenCalledWith(
        'transcript-2',
        null
      )
      expect(mockDependencies.transcriptStore.updateProcessedData).toHaveBeenCalledWith(
        null,
        { filename: 'test2.txt' }
      )
    })
    
    it('should handle concurrent state operations', async () => {
      // Mock successful removal for concurrent operations test
      vi.mocked(localForageStorage.removeItem).mockResolvedValue(undefined)
      
      // Simulate concurrent operations
      const promises = [
        service.clearAutosaveData(),
        service.clearAutosaveData(),
        service.clearAutosaveData()
      ]
      
      await Promise.all(promises)
      
      // Should handle concurrent calls gracefully
      expect(localForageStorage.removeItem).toHaveBeenCalledTimes(3)
    })
  })
})