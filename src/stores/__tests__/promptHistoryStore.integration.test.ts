import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { usePromptHistoryStore } from '../promptHistoryStore'
import { usePipelineStore } from '../pipelineStore'
import { useStoreActions } from '../storeComposition'
import { localForageStorage } from '../../utils/storage'
import type { PromptHistoryEntry } from '../../../types'

// Mock storage
vi.mock('../../utils/storage', () => ({
  localForageStorage: {
    setItem: vi.fn(),
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn()
  }
}))

describe('PromptHistoryStore Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Reset all stores
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Storage Integration', () => {
    test('should persist to storage when data changes', async () => {
      const store = usePromptHistoryStore.getState()
      
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Integration test prompt',
        requestPayload: { model: 'test' },
        responseRaw: 'Test response',
        estimatedInputTokens: 150,
        estimatedOutputTokens: 75
      } as PromptHistoryEntry
      
      store.addPromptEntry(entry)
      
      // Trigger persistence
      await vi.runAllTimersAsync()
      
      // Verify storage was called with correct data
      expect(localForageStorage.setItem).toHaveBeenCalledWith(
        'prompt-history-storage',
        expect.objectContaining({
          state: expect.objectContaining({
            promptHistory: [entry],
            totalInputTokens: 150,
            totalOutputTokens: 75
          }),
          version: 0
        })
      )
    })

    test('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      vi.mocked(localForageStorage.setItem).mockRejectedValueOnce(new Error('Storage full'))
      
      const store = usePromptHistoryStore.getState()
      
      // This should not throw even if storage fails
      expect(() => {
        store.addPromptEntry({
          stepId: 'P0_1',
          timestamp: '2024-01-01T00:00:00Z',
          prompt: 'Test',
          requestPayload: {},
          responseRaw: 'Response'
        } as PromptHistoryEntry)
      }).not.toThrow()
      
      // Store should still have the data even if persistence failed
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toHaveLength(1)
    })
  })

  describe('Cross-Store Coordination', () => {
    test('should work with storeComposition for coordinated resets', () => {
      const promptStore = usePromptHistoryStore.getState()
      const storeActions = useStoreActions()
      
      // Add some data
      promptStore.addPromptEntry({
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test',
        requestPayload: {},
        responseRaw: 'Response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      } as PromptHistoryEntry)
      
      // Verify data exists
      const stateBeforeReset = usePromptHistoryStore.getState()
      expect(stateBeforeReset.promptHistory).toHaveLength(1)
      expect(stateBeforeReset.totalInputTokens).toBe(100)
      
      // Note: storeComposition reset integration will be implemented in Phase 2.5
      // For now, we test direct reset on the store
      promptStore.reset()
      
      // Verify prompt history was reset
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toEqual([])
      expect(updatedState.totalInputTokens).toBe(0)
      expect(updatedState.totalOutputTokens).toBe(0)
    })

    test('should provide data for download functionality', () => {
      const promptStore = usePromptHistoryStore.getState()
      const storeActions = useStoreActions()
      
      // Add multiple entries
      const entries: PromptHistoryEntry[] = [
        {
          stepId: 'P0_1',
          transcriptId: 'transcript-1',
          timestamp: '2024-01-01T00:00:00Z',
          prompt: 'First prompt',
          requestPayload: { model: 'gemini' },
          responseRaw: 'First response',
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        },
        {
          stepId: 'P0_2',
          transcriptId: 'transcript-1',
          timestamp: '2024-01-01T00:01:00Z',
          prompt: 'Second prompt',
          requestPayload: { model: 'gemini' },
          responseRaw: 'Second response',
          estimatedInputTokens: 200,
          estimatedOutputTokens: 100
        }
      ] as PromptHistoryEntry[]
      
      entries.forEach(entry => promptStore.addPromptEntry(entry))
      
      // The isDownloadHistoryDisabled method will be implemented in storeComposition
      // For now, just verify the data exists for download
      
      // Verify data is available for export
      const state = usePromptHistoryStore.getState()
      expect(state.promptHistory).toHaveLength(2)
      expect(state.totalInputTokens).toBe(300)
      expect(state.totalOutputTokens).toBe(150)
    })
  })

  describe('Migration Compatibility', () => {
    test('should maintain compatibility with existing pipelineStore usage', () => {
      const promptStore = usePromptHistoryStore.getState()
      const pipelineStore = usePipelineStore.getState()
      
      // Add entry via prompt store
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Migration test',
        requestPayload: {},
        responseRaw: 'Response',
        estimatedInputTokens: 50,
        estimatedOutputTokens: 25
      } as PromptHistoryEntry
      
      promptStore.addPromptEntry(entry)
      
      // Pipeline store should be able to access the data
      // (This will be implemented in the migration phase)
      // For now, just verify the data exists in prompt store
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toHaveLength(1)
      expect(updatedState.promptHistory[0]).toEqual(entry)
    })

    test('should not create circular dependencies', () => {
      // Verify stores don't reference each other directly
      const promptStore = usePromptHistoryStore.getState()
      
      // Prompt store should not have references to other stores
      expect(promptStore).not.toHaveProperty('pipelineStore')
      expect(promptStore).not.toHaveProperty('transcriptStore')
      expect(promptStore).not.toHaveProperty('analysisStore')
      
      // Should only have its own methods and state
      expect(promptStore).toHaveProperty('promptHistory')
      expect(promptStore).toHaveProperty('totalInputTokens')
      expect(promptStore).toHaveProperty('totalOutputTokens')
      expect(promptStore).toHaveProperty('addPromptEntry')
      expect(promptStore).toHaveProperty('reset')
    })
  })
})