import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { enableMapSet } from 'immer'
import localforage from 'localforage'
import { usePipelineStore } from '../pipelineStore'
import { useUIStore } from '../uiStore'
import { useTranscriptStore } from '../transcriptStore'
import { useAnalysisResultStore } from '../analysisResultStore'
import { useStoreActions } from '../storeComposition'
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
  const storedData = new Map()
  const mockStorage = {
    getItem: vi.fn(async (name) => storedData.get(name) || null),
    setItem: vi.fn(async (name, value) => {
      // Store the value in our mock storage
      storedData.set(name, value)
      // Return the value for the mock call tracking
      return value
    }),
    removeItem: vi.fn(async (name) => {
      storedData.delete(name)
      return undefined
    }),
  }
  return {
    localForageStorage: mockStorage
  }
})

// Mock the migration utility
vi.mock('../../utils/migration', () => ({
  performDataMigration: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks are set up
import { localForageStorage } from '../../utils/storage'

// Type the mock
const mockLocalForageStorage = localForageStorage as {
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
}

describe('Multi-Store Persistence Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Clear mock storage data
    mockLocalForageStorage.getItem.mockImplementation(async () => null)
    mockLocalForageStorage.setItem.mockImplementation(async (name, value) => value)
    mockLocalForageStorage.removeItem.mockImplementation(async () => undefined)
    
    // Reset all stores
    usePipelineStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    })
    useTranscriptStore.getState().reset()
    useAnalysisResultStore.getState().reset()
    useUIStore.setState({
      hasRehydrated: false,
      sessionWasRestored: false,
    })
    
    // Clear any pending timers from store initialization
    vi.runAllTimers()
    await Promise.resolve()
    
    // Reset mocks again after initialization
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllTimers()
  })

  it('uses correct storage keys for each store', async () => {
    // Add data to each store
    const transcript: RawTranscript = {
      id: '1',
      name: 'test.txt',
      content: 'test content',
      filename: 'test.txt'
    }
    
    // Update transcript store
    useTranscriptStore.setState({
      rawTranscripts: [transcript]
    })
    
    // Update analysis store
    useAnalysisResultStore.setState({
      genericAnalysisState: { p3_1_output: { test: 'data' } }
    })
    
    // Update pipeline store (prompt history and tokens)
    usePipelineStore.setState({
      totalInputTokens: 100,
      totalOutputTokens: 200
    })
    
    // Advance timers to trigger debounced persist
    vi.advanceTimersByTime(1000)
    
    // Wait for async operations
    await vi.runAllTimersAsync()
    
    // Verify each store saves to its own key
    const calls = mockLocalForageStorage.setItem.mock.calls
    const storageKeys = calls.map(call => call[0])
    
    expect(storageKeys).toContain('transcript-storage')
    expect(storageKeys).toContain('analysis-storage')
    expect(storageKeys).toContain('upath-autosave-session-v2-localforage')
  })

  it('handles Map serialization correctly in TranscriptStore', async () => {
    // Create a Map with test data
    const processedDataMap = new Map([
      ['transcript1', { 
        id: 'transcript1',
        filename: 'test1.txt',
        p1_output: { test: 'data' }
      }]
    ])
    
    // Update transcript store with Map data AND at least one transcript
    // (TranscriptStore only persists if there's meaningful data)
    const transcripts = [{ 
      id: 'test-1', 
      name: 'test.txt', 
      content: 'test content', 
      filename: 'test.txt',
      uploadedAt: Date.now()
    }]
    
    useTranscriptStore.setState({
      rawTranscripts: transcripts,
      processedData: processedDataMap
    })
    
    // Advance timers and wait for async operations
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()
    
    // Find the transcript store call
    const calls = mockLocalForageStorage.setItem.mock.calls
    
    // Get the last transcript-storage call (in case there are multiple)
    const transcriptCalls = calls.filter(call => call[0] === 'transcript-storage')
    const transcriptCall = transcriptCalls[transcriptCalls.length - 1]
    
    expect(transcriptCall).toBeDefined()
    
    const [key, value] = transcriptCall
    // The value might already be a string or an object
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    
    expect(parsed.state.processedData).toBeInstanceOf(Array)
    expect(parsed.state.processedData).toContainEqual(['transcript1', expect.any(Object)])
  })

  it('coordinates rehydration across all stores', async () => {
    // Instead of mocking storage, we'll directly set state in stores
    // to test that coordinateRehydration detects the data
    useTranscriptStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'data', filename: 'test.txt' }],
      processedData: new Map([['transcript1', { p1_output: 'result' }]])
    })
    
    useAnalysisResultStore.setState({
      genericAnalysisState: { p3_1_output: { test: 'analysis' } }
    })
    
    usePipelineStore.setState({
      promptHistory: [],
      totalInputTokens: 100,
      totalOutputTokens: 200
    })
    
    // Spy on UI store methods
    const setHasRehydratedSpy = vi.spyOn(useUIStore.getState(), 'setHasRehydrated')
    const setSessionWasRestoredSpy = vi.spyOn(useUIStore.getState(), 'setSessionWasRestored')
    
    // Use the coordinateRehydration function from storeComposition
    const storeActions = useStoreActions()
    await storeActions.coordinateRehydration()
    
    // Wait for hydration to complete
    await vi.runAllTimersAsync()
    
    // Verify UI store was updated
    expect(setHasRehydratedSpy).toHaveBeenCalledWith(true)
    expect(setSessionWasRestoredSpy).toHaveBeenCalledWith(true)
  })

  it('handles hydration errors gracefully', async () => {
    // Spy on UI store methods
    const setHasRehydratedSpy = vi.spyOn(useUIStore.getState(), 'setHasRehydrated')
    const setSessionWasRestoredSpy = vi.spyOn(useUIStore.getState(), 'setSessionWasRestored')
    
    // Spy on console.error - we expect Zustand to log errors internally
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock corrupted data for transcript store
    mockLocalForageStorage.getItem.mockImplementation(async (key) => {
      if (key === 'transcript-storage') return 'invalid-json'
      return null
    })
    
    // Force transcript store to attempt rehydration with bad data
    try {
      // @ts-ignore - accessing internal persist api
      await useTranscriptStore.persist.rehydrate()
    } catch (e) {
      // Expected - store should handle this internally
    }
    
    // Use coordinateRehydration which handles errors gracefully
    const storeActions = useStoreActions()
    await storeActions.coordinateRehydration()
    
    // Wait for hydration to complete
    await vi.runAllTimersAsync()
    
    // Should still mark as hydrated even on error
    expect(setHasRehydratedSpy).toHaveBeenCalledWith(true)
    expect(setSessionWasRestoredSpy).toHaveBeenCalledWith(false)
    
    // Should have empty state in transcript store
    const transcriptState = useTranscriptStore.getState()
    expect(transcriptState.rawTranscripts).toEqual([])
    expect(transcriptState.processedData.size).toBe(0)
    
    // Note: Zustand's persist middleware may or may not log errors
    // depending on the version and configuration
    
    consoleErrorSpy.mockRestore()
  })

  it('handles no existing data gracefully', async () => {
    // Mock no data in storage
    mockLocalForageStorage.getItem.mockResolvedValue(null)
    
    // Spy on UI store methods
    const setHasRehydratedSpy = vi.spyOn(useUIStore.getState(), 'setHasRehydrated')
    const setSessionWasRestoredSpy = vi.spyOn(useUIStore.getState(), 'setSessionWasRestored')
    
    // Use coordinateRehydration
    const storeActions = useStoreActions()
    await storeActions.coordinateRehydration()
    
    // Wait for hydration to complete
    await vi.runAllTimersAsync()
    
    // Should mark as hydrated with no session
    expect(setHasRehydratedSpy).toHaveBeenCalledWith(true)
    expect(setSessionWasRestoredSpy).toHaveBeenCalledWith(false)
    
    // Should have empty state in all stores
    const transcriptState = useTranscriptStore.getState()
    expect(transcriptState.rawTranscripts).toEqual([])
    
    const analysisState = useAnalysisResultStore.getState()
    // Analysis state has default boolean flags
    expect(analysisState.genericAnalysisState).toEqual({
      isFullyProcessedGenericDiachronic: false,
      isFullyProcessedGenericSynchronic: false,
      isRefinementDone: false,
      isCausalModelingDone: false,
      isReportGenerated: false
    })
    
    const pipelineState = usePipelineStore.getState()
    expect(pipelineState.promptHistory).toEqual([])
  })

  it('preserves partialize behavior for each store', async () => {
    // Add data to transcript store
    const processedDataMap = new Map([
      ['transcript1', { 
        id: 'transcript1',
        filename: 'test1.txt',
        p1_output: 'result'
      }]
    ])
    
    useTranscriptStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'data', filename: 'test.txt' }],
      processedData: processedDataMap
    })
    
    // Add data to analysis store
    useAnalysisResultStore.setState({
      genericAnalysisState: { 
        p3_1_output: { test: 'analysis' },
        p3_1_error: undefined
      }
    })
    
    // Add data to pipeline store including UI state that should NOT be persisted
    usePipelineStore.setState({
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
      lastStepInfo: { stepId: 'PART_1', status: 'success' },
      shouldStopAutorun: true
    })
    
    // Advance timers to trigger persist
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()
    
    // Check transcript store persistence
    const calls = mockLocalForageStorage.setItem.mock.calls
    const transcriptCall = calls.find(call => call[0] === 'transcript-storage')
    // TranscriptStore should persist because we added data
    expect(transcriptCall).toBeDefined()
    if (transcriptCall) {
      const [key, value] = transcriptCall
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      expect(parsed).toBeDefined()
      expect(parsed.state).toBeDefined()
      expect(parsed.state).toHaveProperty('rawTranscripts')
      expect(parsed.state).toHaveProperty('processedData')
    }
    
    // Check analysis store persistence
    const analysisCall = calls.find(call => call[0] === 'analysis-storage')
    expect(analysisCall).toBeDefined()
    if (analysisCall) {
      const [key, value] = analysisCall
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      expect(parsed.state).toHaveProperty('genericAnalysisState')
    }
    
    // Check pipeline store persistence - should NOT include UI state
    const pipelineCall = calls.find(call => call[0] === 'upath-autosave-session-v2-localforage')
    expect(pipelineCall).toBeDefined()
    if (pipelineCall) {
      const [key, value] = pipelineCall
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      
      // Verify only data is persisted, not UI state
      expect(parsed.state).toHaveProperty('promptHistory')
      expect(parsed.state).toHaveProperty('totalInputTokens')
      expect(parsed.state).toHaveProperty('totalOutputTokens')
      expect(parsed.state).not.toHaveProperty('uiCallbacks')
      expect(parsed.state).not.toHaveProperty('lastStepInfo')
      expect(parsed.state).not.toHaveProperty('shouldStopAutorun')
      expect(parsed.state).not.toHaveProperty('genericAnalysisState') // This is now in analysisStore
    }
  })
})