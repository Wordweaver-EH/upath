import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { enableMapSet } from 'immer'
import localforage from 'localforage'
import { usePipelineStore } from '../pipelineStore'
import { useUIStore } from '../uiStore'
import type { RawTranscript } from '../../../types'

// Enable Immer MapSet plugin
enableMapSet()

// Mock localforage
vi.mock('localforage', () => ({
  default: {
    config: vi.fn(),
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}))

// Mock the storage adapter - must be defined before the mock
vi.mock('../../utils/storage', () => {
  const mockStorage = {
    getItem: vi.fn(async (name: string) => null),
    setItem: vi.fn(async (name: string, value: string) => undefined),
    removeItem: vi.fn(async (name: string) => undefined),
  }
  return {
    localForageStorage: mockStorage,
    // queuedLocalForageStorage wraps localForageStorage in production;
    // delegate to the same spies so existing assertions still pass.
    queuedLocalForageStorage: {
      getItem: (name: string) => mockStorage.getItem(name),
      setItem: (name: string, value: string) => mockStorage.setItem(name, value),
      removeItem: (name: string) => mockStorage.removeItem(name),
    },
  }
})

// Mock the migration utility
vi.mock('../../utils/migration', () => ({
  performDataMigration: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks are set up
import { localForageStorage } from '../../utils/storage'
import { _storeRefs } from '../pipelineStore'

// Type the mock
const mockLocalForageStorage = localForageStorage as {
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
}

describe('PipelineStore Persist Integration', () => {
  beforeEach(async () => {
    // Inject store refs so pipelineStore can call uiStore without a circular import
    _storeRefs.uiStore = useUIStore

    vi.clearAllMocks()
    vi.useFakeTimers()
    // Reset stores
    usePipelineStore.setState({
      rawTranscripts: [],
      processedData: new Map(),
      genericAnalysisState: {},
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    })
    useUIStore.setState({
      hasRehydrated: false,
      sessionWasRestored: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  it('uses new storage key for localforage', async () => {
    // Add some data to trigger persistence by directly updating state
    const transcript: RawTranscript = {
      id: '1',
      name: 'test.txt',
      content: 'test content',
      filename: 'test.txt'
    }
    
    // Use setState to directly update the store
    usePipelineStore.setState({
      rawTranscripts: [transcript]
    })
    
    // Advance timers to trigger debounced persist
    vi.advanceTimersByTime(1000)
    
    // Wait for async operations
    await vi.runAllTimersAsync()
    
    // Verify data saved to localforage with new key
    expect(mockLocalForageStorage.setItem).toHaveBeenCalledWith(
      'upath-autosave-session-v2-localforage',
      expect.any(String)
    )
  })

  it('handles Map serialization correctly', async () => {
    // Create a Map with test data
    const processedDataMap = new Map([
      ['transcript1', { 
        id: 'transcript1',
        filename: 'test1.txt',
        p1_output: { test: 'data' }
      }]
    ])
    
    // Use setState to directly update the store
    usePipelineStore.setState({
      processedData: processedDataMap
    })
    
    // Advance timers and wait for async operations
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()
    
    // Check that the serialized data includes the Map as an array
    const calls = mockLocalForageStorage.setItem.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall).toBeDefined()
    if (lastCall) {
      const [key, value] = lastCall
      const parsed = JSON.parse(value as string)
      expect(parsed.state.processedData).toBeInstanceOf(Array)
      expect(parsed.state.processedData).toContainEqual(['transcript1', expect.any(Object)])
    }
  })

  it('calls onRehydrateStorage on successful hydration', async () => {
    // Mock existing data in storage
    const existingData = {
      state: {
        rawTranscripts: [{ id: '1', name: 'test.txt', content: 'data', filename: 'test.txt' }],
        processedData: [['transcript1', { p1_output: 'result' }]],
        genericAnalysisState: {},
        promptHistory: [],
        totalInputTokens: 100,
        totalOutputTokens: 200,
      },
      version: 0,
    }
    
    // Mock the storage adapter to return our test data
    mockLocalForageStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingData))
    
    // Spy on UI store methods
    const setHasRehydratedSpy = vi.spyOn(useUIStore.getState(), 'setHasRehydrated')
    const setSessionWasRestoredSpy = vi.spyOn(useUIStore.getState(), 'setSessionWasRestored')
    
    // The store should hydrate on initial load
    // Force a re-read by clearing and re-creating the store
    const store = usePipelineStore.getState()
    
    // Trigger persist rehydration manually
    // @ts-ignore - accessing internal persist api
    await usePipelineStore.persist.rehydrate()
    
    // Wait for hydration to complete
    await vi.runAllTimersAsync()
    
    // Verify UI store was updated
    expect(setHasRehydratedSpy).toHaveBeenCalledWith(true)
    expect(setSessionWasRestoredSpy).toHaveBeenCalledWith(true)
    
    // Verify state was restored
    const state = usePipelineStore.getState()
    expect(state.rawTranscripts).toHaveLength(1)
    expect(state.rawTranscripts[0].name).toBe('test.txt')
    expect(state.processedData.size).toBe(1)
    expect(state.totalInputTokens).toBe(100)
    expect(state.totalOutputTokens).toBe(200)
  })

  it('handles hydration errors gracefully', async () => {
    // Mock corrupted data
    mockLocalForageStorage.getItem.mockResolvedValueOnce('invalid-json')
    
    // Spy on UI store methods
    const setHasRehydratedSpy = vi.spyOn(useUIStore.getState(), 'setHasRehydrated')
    const setSessionWasRestoredSpy = vi.spyOn(useUIStore.getState(), 'setSessionWasRestored')
    
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Trigger persist rehydration manually
    // @ts-ignore - accessing internal persist api
    await usePipelineStore.persist.rehydrate()
    
    // Wait for hydration to complete
    await vi.runAllTimersAsync()
    
    // Should still mark as hydrated even on error
    expect(setHasRehydratedSpy).toHaveBeenCalledWith(true)
    expect(setSessionWasRestoredSpy).toHaveBeenCalledWith(false)
    
    // Should have empty state
    const state = usePipelineStore.getState()
    expect(state.rawTranscripts).toEqual([])
    expect(state.processedData.size).toBe(0)
    
    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    consoleErrorSpy.mockRestore()
  })

  it('handles no existing data gracefully', async () => {
    // Mock no data in storage
    mockLocalForageStorage.getItem.mockResolvedValueOnce(null)
    
    // Spy on UI store methods
    const setHasRehydratedSpy = vi.spyOn(useUIStore.getState(), 'setHasRehydrated')
    const setSessionWasRestoredSpy = vi.spyOn(useUIStore.getState(), 'setSessionWasRestored')
    
    // Trigger persist rehydration manually
    // @ts-ignore - accessing internal persist api
    await usePipelineStore.persist.rehydrate()
    
    // Wait for hydration to complete
    await vi.runAllTimersAsync()
    
    // Should mark as hydrated with no session
    expect(setHasRehydratedSpy).toHaveBeenCalledWith(true)
    expect(setSessionWasRestoredSpy).toHaveBeenCalledWith(false)
    
    // Should have empty state
    const state = usePipelineStore.getState()
    expect(state.rawTranscripts).toEqual([])
  })

  it('preserves existing partialize behavior', async () => {
    // Add various types of data using setState
    const processedDataMap = new Map([
      ['transcript1', { 
        id: 'transcript1',
        filename: 'test1.txt',
        p1_output: 'result'
      }]
    ])
    
    usePipelineStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'data', filename: 'test.txt' }],
      processedData: processedDataMap,
      promptHistory: [{
        timestamp: new Date(),
        stepId: 'PART_0',
        prompt: 'test prompt',
        response: 'test response',
        inputTokens: 50,
        outputTokens: 100,
      }],
      totalInputTokens: 50,
      totalOutputTokens: 100,
      // Add UI state that should NOT be persisted
      uiCallbacks: {
        setAutorunning: vi.fn(),
        setCurrentStepInfo: vi.fn(),
      },
      lastStepInfo: { stepId: 'PART_1', status: 'success' }
    })
    
    // Advance timers to trigger persist
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()
    
    // Get the persisted data
    const calls = mockLocalForageStorage.setItem.mock.calls
    const lastCall = calls[calls.length - 1]
    if (lastCall) {
      const [key, value] = lastCall
      const parsed = JSON.parse(value as string)
      
      // Verify only data is persisted, not UI state
      expect(parsed.state).toHaveProperty('rawTranscripts')
      expect(parsed.state).toHaveProperty('processedData')
      expect(parsed.state).toHaveProperty('genericAnalysisState')
      expect(parsed.state).toHaveProperty('promptHistory')
      expect(parsed.state).toHaveProperty('totalInputTokens')
      expect(parsed.state).toHaveProperty('totalOutputTokens')
      expect(parsed.state).not.toHaveProperty('uiCallbacks')
      expect(parsed.state).not.toHaveProperty('lastStepInfo')
    }
  })
})