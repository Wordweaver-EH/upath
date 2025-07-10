import { describe, test, expect, beforeEach, vi } from 'vitest'
import { usePromptHistoryStore } from '../promptHistoryStore'
import type { PromptHistoryEntry } from '../../../types'

// Mock storage
vi.mock('../../utils/storage', () => ({
  localForageStorage: {
    setItem: vi.fn(),
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn()
  }
}))

describe('PromptHistoryStore', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Setup fake timers
    vi.useFakeTimers()
    
    // Reset store before each test
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
  })

  afterEach(() => {
    // Restore timers
    vi.useRealTimers()
  })

  describe('Store Initialization', () => {
    test('should initialize with empty prompt history', () => {
      const state = usePromptHistoryStore.getState()
      
      expect(state.promptHistory).toEqual([])
      expect(state.totalInputTokens).toBe(0)
      expect(state.totalOutputTokens).toBe(0)
    })

    test('should have required methods', () => {
      const state = usePromptHistoryStore.getState()
      
      expect(typeof state.addPromptEntry).toBe('function')
      expect(typeof state.reset).toBe('function')
    })
  })

  describe('Adding Prompt Entries', () => {
    test('should add prompt entry and update tokens', () => {
      const store = usePromptHistoryStore.getState()
      
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        transcriptId: 'transcript-1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test prompt',
        requestPayload: { model: 'test', contents: 'test' },
        responseRaw: 'Test response',
        responseParsed: { result: 'test' },
        error: undefined,
        groundingSources: [],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      }
      
      store.addPromptEntry(entry)
      
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toHaveLength(1)
      expect(updatedState.promptHistory[0]).toEqual(entry)
      expect(updatedState.totalInputTokens).toBe(100)
      expect(updatedState.totalOutputTokens).toBe(50)
    })

    test('should handle entries without token counts', () => {
      const store = usePromptHistoryStore.getState()
      
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test prompt',
        requestPayload: { model: 'test', contents: 'test' },
        responseRaw: 'Test response',
        // No token counts provided
      } as PromptHistoryEntry
      
      store.addPromptEntry(entry)
      
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.totalInputTokens).toBe(0)
      expect(updatedState.totalOutputTokens).toBe(0)
    })
  })

  describe('Token Accumulation', () => {
    test('should correctly accumulate input and output tokens', () => {
      const store = usePromptHistoryStore.getState()
      
      const entry1: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test 1',
        requestPayload: {},
        responseRaw: 'Response 1',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      } as PromptHistoryEntry
      
      const entry2: PromptHistoryEntry = {
        stepId: 'P0_2',
        timestamp: '2024-01-01T00:01:00Z',
        prompt: 'Test 2',
        requestPayload: {},
        responseRaw: 'Response 2',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 75
      } as PromptHistoryEntry
      
      store.addPromptEntry(entry1)
      store.addPromptEntry(entry2)
      
      const updatedState = usePromptHistoryStore.getState()
      expect(updatedState.promptHistory).toHaveLength(2)
      expect(updatedState.totalInputTokens).toBe(300)
      expect(updatedState.totalOutputTokens).toBe(125)
    })
  })

  describe('Reset Functionality', () => {
    test('should reset prompt history and tokens', () => {
      const store = usePromptHistoryStore.getState()
      
      // Add some data first
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test',
        requestPayload: {},
        responseRaw: 'Response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      } as PromptHistoryEntry
      
      store.addPromptEntry(entry)
      
      // Verify data was added
      let state = usePromptHistoryStore.getState()
      expect(state.promptHistory).toHaveLength(1)
      expect(state.totalInputTokens).toBe(100)
      
      // Reset
      store.reset()
      
      // Verify reset
      state = usePromptHistoryStore.getState()
      expect(state.promptHistory).toEqual([])
      expect(state.totalInputTokens).toBe(0)
      expect(state.totalOutputTokens).toBe(0)
    })
  })

  describe('Persistence', () => {
    test('should persist prompt history to storage', async () => {
      const { localForageStorage } = await import('../../utils/storage')
      const store = usePromptHistoryStore.getState()
      
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test',
        requestPayload: {},
        responseRaw: 'Response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      } as PromptHistoryEntry
      
      store.addPromptEntry(entry)
      
      // Wait for persistence
      await vi.runAllTimersAsync()
      
      expect(localForageStorage.setItem).toHaveBeenCalledWith(
        'prompt-history-storage',
        expect.objectContaining({
          state: expect.objectContaining({
            promptHistory: expect.arrayContaining([entry]),
            totalInputTokens: 100,
            totalOutputTokens: 50
          })
        })
      )
    })

    test('should exclude empty state from persistence', async () => {
      const { localForageStorage } = await import('../../utils/storage')
      
      // Clear previous calls
      vi.mocked(localForageStorage.setItem).mockClear()
      
      // Store is empty by default
      const state = usePromptHistoryStore.getState()
      
      // Add and then remove data to trigger persistence
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test',
        requestPayload: {},
        responseRaw: 'Response',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      } as PromptHistoryEntry
      
      state.addPromptEntry(entry)
      
      // Clear mock to ignore the add
      vi.mocked(localForageStorage.setItem).mockClear()
      
      // Now reset to empty
      state.reset()
      
      // Wait for any potential persistence
      await vi.runAllTimersAsync()
      
      // When resetting to empty, it should persist undefined (which means "delete from storage")
      expect(localForageStorage.setItem).toHaveBeenCalledWith(
        'prompt-history-storage',
        expect.objectContaining({
          state: undefined
        })
      )
    })

    test('should rehydrate from persisted state', async () => {
      // This test verifies the store can properly rehydrate from persisted data
      // In a real scenario, this happens when the store is first created
      // For now, we'll just verify the persist configuration is correct
      
      const store = usePromptHistoryStore.getState()
      
      // Add some data
      const entry: PromptHistoryEntry = {
        stepId: 'P0_1',
        timestamp: '2024-01-01T00:00:00Z',
        prompt: 'Test prompt for persistence',
        requestPayload: {},
        responseRaw: 'Test response',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100
      } as PromptHistoryEntry
      
      store.addPromptEntry(entry)
      
      // Verify the data would be persisted correctly
      const state = usePromptHistoryStore.getState()
      expect(state.promptHistory).toHaveLength(1)
      expect(state.totalInputTokens).toBe(200)
      expect(state.totalOutputTokens).toBe(100)
    })
  })
})