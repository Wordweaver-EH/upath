import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { useTranscriptStore } from '../transcriptStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { PipelineOrchestrator } from '../../services/pipeline/PipelineOrchestrator'
import { StepId, StepStatus } from '../../../types'

// Mock the PipelineOrchestrator
vi.mock('../../services/pipeline/PipelineOrchestrator')

// Mock other dependencies
vi.mock('../transcriptStore')
vi.mock('../promptHistoryStore')

describe('pipelineStore with services', () => {
  let mockOrchestrator: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock orchestrator
    mockOrchestrator = {
      processSingleStep: vi.fn()
    }
    
    ;(PipelineOrchestrator as Mock).mockImplementation(() => mockOrchestrator)
    
    // Setup transcript store mock
    ;(useTranscriptStore.getState as Mock).mockReturnValue({
      rawTranscripts: [],
      processedData: new Map(),
      setProcessedData: vi.fn()
    })
    
    // Setup prompt history store mock
    ;(usePromptHistoryStore.getState as Mock).mockReturnValue({
      promptHistory: [],
      addEntry: vi.fn(),
      reset: vi.fn()
    })
    
    // Reset pipeline store
    usePipelineStore.setState({
      genericAnalysisState: {},
      lastStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      shouldStopAutorun: false
    })
  })

  describe('processSingleStep delegation', () => {
    test('should delegate to PipelineOrchestrator', async () => {
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 'transcript-1',
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          seed: 123,
          userDvFocus: { dv_focus: ['test'] }
        }
      }
      
      await usePipelineStore.getState().processSingleStep(params)
      
      // Verify orchestrator was created with correct dependencies
      expect(PipelineOrchestrator).toHaveBeenCalled()
      
      // Verify processSingleStep was called with augmented params
      expect(mockOrchestrator.processSingleStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepId: params.stepId,
          transcriptIdToProcess: params.transcriptIdToProcess,
          settings: params.settings
        })
      )
    })

    test('should pass transcript data when provided', async () => {
      const mockTranscripts = [
        { id: 't1', name: 'test.txt', content: 'Test', uploadedAt: Date.now() }
      ]
      const mockProcessedData = new Map([['t1', { id: 't1', filename: 'test.txt' }]])
      
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        transcriptData: {
          rawTranscripts: mockTranscripts,
          processedData: mockProcessedData
        }
      }
      
      await usePipelineStore.getState().processSingleStep(params)
      
      // Verify orchestrator received the transcript data
      expect(mockOrchestrator.processSingleStep).toHaveBeenCalledWith(
        expect.objectContaining({
          transcriptData: {
            rawTranscripts: mockTranscripts,
            processedData: mockProcessedData
          }
        })
      )
    })

    test('should handle orchestrator errors gracefully', async () => {
      // Make orchestrator throw an error
      mockOrchestrator.processSingleStep.mockRejectedValueOnce(new Error('Orchestration failed'))
      
      const params = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE
      }
      
      await usePipelineStore.getState().processSingleStep(params)
      
      // Verify error was handled
      const state = usePipelineStore.getState()
      expect(state.lastStepInfo.status).toBe(StepStatus.Error)
      expect(state.lastStepInfo.error).toContain('Orchestration failed')
      expect(state.shouldStopAutorun).toBe(true)
    })
  })

  describe('store update callbacks', () => {
    test('should update stores when orchestrator calls updateStores', async () => {
      // Simulate orchestrator calling the updateStores callback
      let capturedUpdateStores: any
      ;(PipelineOrchestrator as Mock).mockImplementation((
        validationService: any,
        contextService: any,
        inputService: any,
        executionService: any,
        historyService: any,
        errorService: any,
        successService: any,
        updateStores: any,
        addPromptEntry: any
      ) => {
        capturedUpdateStores = updateStores
        return mockOrchestrator
      })
      
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE
      })
      
      // Simulate orchestrator updating stores
      capturedUpdateStores({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        status: StepStatus.Success,
        transcriptId: 't1'
      })
      
      // Verify store was updated
      const state = usePipelineStore.getState()
      expect(state.lastStepInfo.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
      expect(state.lastStepInfo.status).toBe(StepStatus.Success)
    })

    test('should add prompt history when orchestrator calls addPromptEntry', async () => {
      let capturedAddPromptEntry: any
      ;(PipelineOrchestrator as Mock).mockImplementation((
        validationService: any,
        contextService: any,
        inputService: any,
        executionService: any,
        historyService: any,
        errorService: any,
        successService: any,
        updateStores: any,
        addPromptEntry: any
      ) => {
        capturedAddPromptEntry = addPromptEntry
        return mockOrchestrator
      })
      
      const mockPromptHistoryStore = usePromptHistoryStore.getState() as any
      
      await usePipelineStore.getState().processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE
      })
      
      // Simulate orchestrator adding prompt entry
      const mockEntry = {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptId: 't1',
        timestamp: new Date().toISOString(),
        prompt: 'Test prompt'
      }
      
      capturedAddPromptEntry(mockEntry)
      
      // Verify prompt history was updated
      expect(mockPromptHistoryStore.addEntry).toHaveBeenCalledWith(mockEntry)
    })
  })
})