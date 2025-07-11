import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PipelineService } from '../PipelineService'
import { getPipelineService, resetPipelineService } from '../pipelineServiceFactory'
import { StepId, StepStatus } from '../../../../types'
import { useTranscriptStore } from '../../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../../stores/analysisResultStore'
import { usePromptHistoryStore } from '../../../stores/promptHistoryStore'
import { usePipelineOrchestrationStore } from '../../../stores/pipelineOrchestrationStore'
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

describe.sequential('PipelineOrchestrator E2E Transaction Tests', () => {
  let pipelineService: PipelineService
  
  const defaultSettings = {
    apiKey: 'test-key',
    temperature: 0.7,
    seed: undefined,
    userDvFocus: { dv_focus: ['test'] }  // Add a value to pass DV focus validation
  }
  
  beforeEach(() => {
    // Reset the pipeline service singleton
    resetPipelineService()
    
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
    
    // Get the pipeline service from the factory
    pipelineService = getPipelineService()
    
    // Setup test data
    useTranscriptStore.getState().addTranscriptsSync([{
      id: 't1',
      name: 'test.txt',
      content: 'Test transcript content',
      uploadedAt: Date.now()
    }])
    
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Atomic Transactions', () => {
    it('should handle API errors atomically across multiple stores', async () => {
      // Setup initial state in multiple stores
      useTranscriptStore.getState().updateProcessedData('t1', {
        id: 't1',
        filename: 'test.txt',
        p0_1_output: 'initial output',
        p0_2_output: 'initial p0_2'
      })
      useAnalysisResultStore.getState().updateGenericState({
        p3_1_output: 'initial p3_1'
      })
      
      // Mock API to fail
      vi.mocked(callGeminiAPI).mockRejectedValueOnce(new Error('Network failure'))
      
      // Get initial states
      const initialTranscriptData = useTranscriptStore.getState().processedData.get('t1')
      const initialAnalysisState = useAnalysisResultStore.getState().genericAnalysisState
      const initialPromptHistoryCount = usePromptHistoryStore.getState().promptHistory.length
      
      // Execute step that will fail
      await pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: defaultSettings
      })
      
      // Verify transaction rolled back - store state should be preserved
      const finalTranscriptData = useTranscriptStore.getState().processedData.get('t1')
      const finalAnalysisState = useAnalysisResultStore.getState().genericAnalysisState
      const finalPromptHistoryCount = usePromptHistoryStore.getState().promptHistory.length
      
      // Error should be recorded
      expect(finalTranscriptData?.p0_1_error).toBe('Network failure')
      // Original output should be unchanged
      expect(finalTranscriptData?.p0_1_output).toBe('initial output')
      expect(finalTranscriptData?.p0_2_output).toBe('initial p0_2')
      
      // Other stores should remain unchanged
      expect(finalAnalysisState.p3_1_output).toBe('initial p3_1')
      
      // No prompt history should be added on error
      expect(finalPromptHistoryCount).toBe(initialPromptHistoryCount)
      
      // Current step info should show error
      const currentStepInfo = usePipelineOrchestrationStore.getState().currentStepInfo
      expect(currentStepInfo.status).toBe(StepStatus.Error)
      expect(currentStepInfo.error).toBe('Network failure')
    })

    it('should commit all changes atomically on success', async () => {
      // Mock successful API response
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { 
          adherence_score: 0.95,
          deviations: [],
          recommendations: ['Well transcribed']
        },
        text: 'Success response',
        error: undefined,
        groundingSources: [],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      })
      
      // Execute step
      await pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: defaultSettings
      })
      
      // Verify all stores updated atomically
      const transcriptData = useTranscriptStore.getState().processedData.get('t1')
      expect(transcriptData?.p0_1_output).toEqual({
        adherence_score: 0.95,
        deviations: [],
        recommendations: ['Well transcribed']
      })
      expect(transcriptData?.p0_1_error).toBeUndefined()
      
      // Prompt history should be added
      const promptHistory = usePromptHistoryStore.getState().promptHistory
      expect(promptHistory).toHaveLength(1)
      expect(promptHistory[0].stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE)
      expect(promptHistory[0].transcriptId).toBe('t1')
      
      // Current step info should show success
      const currentStepInfo = usePipelineOrchestrationStore.getState().currentStepInfo
      expect(currentStepInfo.status).toBe(StepStatus.Success)
      expect(currentStepInfo.error).toBeUndefined()
    })

    it('should handle global step transactions correctly', async () => {
      // Set up required data for P3_1 - it needs P1_4 outputs from transcripts
      useTranscriptStore.getState().updateProcessedData('t1', {
        id: 't1',
        filename: 'test.txt',
        p1_4_output: {
          specific_diachronic_structure: {
            phases: ['Phase 1', 'Phase 2']
          }
        }
      })
      
      // Mock successful API response for global step
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: { 
          aligned_structures: ['Structure 1', 'Structure 2']
        },
        text: 'Global success',
        error: undefined,
        groundingSources: [],
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100
      })
      
      // Execute global step
      await pipelineService.processSingleStep({
        stepId: StepId.P3_1_ALIGN_STRUCTURES,
        settings: defaultSettings
      })
      
      // Verify global state updated
      const analysisState = useAnalysisResultStore.getState().genericAnalysisState
      expect(analysisState.p3_1_output).toEqual({
        aligned_structures: ['Structure 1', 'Structure 2']
      })
      expect(analysisState.p3_1_error).toBeUndefined()
      
      // Prompt history should be added for global step
      const promptHistory = usePromptHistoryStore.getState().promptHistory
      expect(promptHistory).toHaveLength(1)
      expect(promptHistory[0].stepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
      expect(promptHistory[0].transcriptId).toBeUndefined()
    })

    it('should maintain consistency when API returns error in output', async () => {
      // Mock API response with error in output
      vi.mocked(callGeminiAPI).mockResolvedValueOnce({
        parsedJson: null,
        text: 'Error response',
        error: 'Rate limit exceeded',
        groundingSources: [],
        estimatedInputTokens: 50,
        estimatedOutputTokens: 0
      })
      
      // Execute step
      await pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcriptIdToProcess: 't1',
        settings: defaultSettings
      })
      
      // Verify error handled correctly
      const transcriptData = useTranscriptStore.getState().processedData.get('t1')
      expect(transcriptData?.p0_1_error).toBe('Rate limit exceeded')
      expect(transcriptData?.p0_1_output).toBeUndefined()
      
      // Prompt history should still be added (contains the attempt)
      const promptHistory = usePromptHistoryStore.getState().promptHistory
      expect(promptHistory).toHaveLength(1)
      expect(promptHistory[0].responseParsed).toBeNull()
      expect(promptHistory[0].error).toBe('Rate limit exceeded')
    })

    it('should handle concurrent transactions without interference', async () => {
      // Add another transcript
      useTranscriptStore.getState().addTranscriptsSync([{
        id: 't2',
        name: 'test2.txt',
        content: 'Second transcript',
        uploadedAt: Date.now()
      }])
      
      // Mock different responses for concurrent calls
      vi.mocked(callGeminiAPI)
        .mockResolvedValueOnce({
          parsedJson: { adherence_score: 0.9 },
          text: 'First response',
          error: undefined,
          groundingSources: [],
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        })
        .mockResolvedValueOnce({
          parsedJson: { adherence_score: 0.85 },
          text: 'Second response',
          error: undefined,
          groundingSources: [],
          estimatedInputTokens: 110,
          estimatedOutputTokens: 55
        })
      
      // Execute steps concurrently
      const [result1, result2] = await Promise.all([
        pipelineService.processSingleStep({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptIdToProcess: 't1',
          settings: defaultSettings
        }),
        pipelineService.processSingleStep({
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          transcriptIdToProcess: 't2',
          settings: defaultSettings
        })
      ])
      
      // Verify both transactions completed independently
      const transcript1Data = useTranscriptStore.getState().processedData.get('t1')
      const transcript2Data = useTranscriptStore.getState().processedData.get('t2')
      
      expect(transcript1Data?.p0_1_output).toEqual({ adherence_score: 0.9 })
      expect(transcript2Data?.p0_1_output).toEqual({ adherence_score: 0.85 })
      
      // Prompt history should have both entries
      const promptHistory = usePromptHistoryStore.getState().promptHistory
      expect(promptHistory).toHaveLength(2)
    })
  })
})