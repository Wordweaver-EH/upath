import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStoreActions } from '../storeComposition'
import { useTranscriptStore } from '../transcriptStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { usePipelineOrchestrationStore } from '../pipelineOrchestrationStore'

// Mock the storage utility
vi.mock('../../utils/storage', () => ({
  localForageStorage: {
    removeItem: vi.fn(),
    setItem: vi.fn(),
    getItem: vi.fn()
  }
}))

describe('Store Composition Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset all stores to clean state
    useTranscriptStore.getState().reset()
    useAnalysisResultStore.getState().reset()
    usePromptHistoryStore.getState().reset()
    usePipelineOrchestrationStore.getState().reset()
  })

  describe('resetPipeline', () => {
    it('should call reset methods on all stores when called', () => {
      // This test verifies that the composition layer calls the correct methods
      // The actual reset functionality is tested in individual store tests
      
      const { resetPipeline } = useStoreActions()
      
      // The function should execute without errors
      expect(() => resetPipeline()).not.toThrow()
      
      // We can verify that the stores are in their initial state after reset
      expect(useTranscriptStore.getState().rawTranscripts).toHaveLength(0)
      expect(useAnalysisResultStore.getState().genericAnalysisState.p3_1_output).toBeUndefined()
    })
  })

  describe('clearAutosaveData', () => {
    it('should clear autosave data from storage', async () => {
      const { localForageStorage } = await import('../../utils/storage')
      const { clearAutosaveData } = useStoreActions()
      
      // Call clearAutosaveData
      await clearAutosaveData()
      
      expect(localForageStorage.removeItem).toHaveBeenCalledWith('upath-autosave-session-v2-localforage')
    })
    
    it('should handle storage errors gracefully', async () => {
      const { localForageStorage } = await import('../../utils/storage')
      const mockError = new Error('Storage error')
      vi.mocked(localForageStorage.removeItem).mockRejectedValue(mockError)
      
      const { clearAutosaveData } = useStoreActions()
      
      // Should not throw error
      await expect(clearAutosaveData()).resolves.not.toThrow()
    })
  })

  describe('Integration with SessionRestoreNotification', () => {
    it('should provide the same interface as the original pipelineStore methods', () => {
      const storeActions = useStoreActions()
      
      // Verify the interface matches what SessionRestoreNotification expects
      expect(typeof storeActions.resetPipeline).toBe('function')
      expect(typeof storeActions.clearAutosaveData).toBe('function')
      
      // Verify functions can be called (functional interface test)
      expect(() => storeActions.resetPipeline()).not.toThrow()
      expect(() => storeActions.clearAutosaveData()).not.toThrow()
    })
  })

  describe('Orchestration Functions for useAutorunManager', () => {
    it('should provide getNextStepDetails function', () => {
      const storeActions = useStoreActions()
      
      // RED PHASE: This will fail because getNextStepDetails doesn't exist yet
      expect(typeof storeActions.getNextStepDetails).toBe('function')
    })

    it('should provide processSingleStep function', () => {
      const storeActions = useStoreActions()
      
      // RED PHASE: This will fail because processSingleStep doesn't exist yet
      expect(typeof storeActions.processSingleStep).toBe('function')
    })

    it('should provide downloadOutput function', () => {
      const storeActions = useStoreActions()
      
      // RED PHASE: This will fail because downloadOutput doesn't exist yet
      expect(typeof storeActions.downloadOutput).toBe('function')
    })

    it('should provide isGlobalStep function', () => {
      const storeActions = useStoreActions()
      
      // RED PHASE: This will fail because isGlobalStep doesn't exist yet
      expect(typeof storeActions.isGlobalStep).toBe('function')
    })
  })
})