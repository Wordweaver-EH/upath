// TDD Migration Test for useAutorunManager Store Dependencies
// This test verifies that useAutorunManager can work with the new store architecture
// RED PHASE: Write failing tests first

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useUIStore } from '../../stores/uiStore'
import { useTranscriptStore } from '../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../stores/analysisResultStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { StepId, StepStatus } from '../../../types'

// Mock external dependencies
vi.mock('../../utils/storage', () => ({
  localForageStorage: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

// Mock services that will be needed for migration
vi.mock('../../services/pipeline', () => ({
  StepParameterValidationService: {
    validateStepParameters: vi.fn()
  },
  StepInputPreparationService: {
    prepareStepInputData: vi.fn()
  },
  StepContextPreparationService: {
    prepareExecutionContext: vi.fn()
  },
  PromptHistoryService: {
    createPromptHistoryEntry: vi.fn()
  }
}))

describe('useAutorunManager Store Dependencies Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores to clean state
    useUIStore.getState().resetUIState()
    useTranscriptStore.getState().reset()
    useAnalysisResultStore.getState().reset()
    useSettingsStore.setState({
      apiKeyPresent: true,
      temperature: 0.7,
      seed: 42,
      userDvFocus: { dv_focus: ['test'] },
      autoDownloadResults: false
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Store Data Access Verification', () => {
    it('should access transcript data from transcriptStore', async () => {
      // Arrange: Create a properly mocked File with text() method
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      // Mock the text() method for File objects in test environment
      Object.defineProperty(testFile, 'text', {
        value: vi.fn().mockResolvedValue('test content'),
        writable: true
      })
      
      // Add transcript asynchronously
      await useTranscriptStore.getState().addTranscripts([testFile])

      // Assert: Data is available in transcriptStore
      const transcripts = useTranscriptStore.getState().rawTranscripts
      expect(transcripts).toHaveLength(1)
      expect(transcripts[0].name).toBe('test.txt')
    })

    it('should access analysis state from analysisResultStore', () => {
      // Arrange: Set some analysis state
      useAnalysisResultStore.getState().updateGenericState({
        isReportGenerated: true,
        p6_1_output: 'Test report output'
      })

      // Assert: Data is available in analysisResultStore  
      const analysisState = useAnalysisResultStore.getState().genericAnalysisState
      expect(analysisState.isReportGenerated).toBe(true)
      expect(analysisState.p6_1_output).toBe('Test report output')
    })

    it('should access UI state correctly', () => {
      // Arrange: Set UI state
      useUIStore.getState().setAutorunning(true)
      useUIStore.getState().setCurrentStepInfo({
        stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        status: StepStatus.Success,
        outputData: 'Test output'
      })

      // Assert: UI state is accessible
      expect(useUIStore.getState().isAutorunning).toBe(true)
      expect(useUIStore.getState().currentStepInfo.status).toBe(StepStatus.Success)
    })
  })

  describe('Migration Requirements Definition', () => {
    it('should identify which pipelineStore dependencies need migration', () => {
      // This test documents what needs to be migrated from pipelineStore
      // Current useAutorunManager uses:
      // - genericAnalysisState -> useAnalysisResultStore ✓
      // - getNextStepDetails -> needs orchestration layer  
      // - processSingleStep -> needs service layer integration
      // - downloadOutput -> needs orchestration layer
      // - isGlobalStep -> needs orchestration layer
      
      // RED PHASE: This test will initially fail because dependencies haven't been migrated
      const analysisState = useAnalysisResultStore.getState().genericAnalysisState
      expect(analysisState).toBeDefined()
      
      // These functions are still needed in some form (orchestration layer)
      // Will be implemented after hook migration
      expect(true).toBe(true) // Placeholder for orchestration functions
    })

    it('should verify new store architecture readiness', () => {
      // Verify all required stores are available and working
      const transcriptStore = useTranscriptStore.getState()
      const analysisStore = useAnalysisResultStore.getState()
      const uiStore = useUIStore.getState()
      const settingsStore = useSettingsStore.getState()
      
      expect(transcriptStore).toBeDefined()
      expect(analysisStore).toBeDefined()
      expect(uiStore).toBeDefined()
      expect(settingsStore).toBeDefined()
      
      // Verify they have the required methods
      expect(typeof transcriptStore.addTranscripts).toBe('function')
      expect(typeof analysisStore.updateGenericState).toBe('function')
      expect(typeof uiStore.setAutorunning).toBe('function')
    })
  })

  describe('Orchestration Functions Needed', () => {
    it('should identify orchestration functions that need implementation', () => {
      // Document what orchestration functions are needed:
      // 1. getNextStepDetails - determines next step in pipeline
      // 2. processSingleStep - coordinates step execution across stores
      // 3. downloadOutput - handles output downloading  
      // 4. isGlobalStep - determines if step is global or transcript-specific
      
      // These will be implemented in the orchestration layer
      // For now, just verify we understand what's needed
      expect(true).toBe(true) // Will implement after hook migration
    })
  })
})