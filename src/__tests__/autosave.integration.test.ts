import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTranscriptStore } from '../stores/transcriptStore'
import { useAnalysisResultStore } from '../stores/analysisResultStore'
import { usePromptHistoryStore } from '../stores/promptHistoryStore'
import { useUIStore } from '../stores/uiStore'
import { useStoreActions } from '../stores/storeComposition'
import { localForageStorage } from '../utils/storage'
import type { RawTranscript } from '../../types'
import { StepId } from '../../types'

// Mock the storage adapter
vi.mock('../utils/storage', () => ({
  localForageStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

// Mock the migration to prevent it from running during tests
vi.mock('../utils/migration', () => ({
  performDataMigration: vi.fn().mockResolvedValue(undefined)
}))

describe('Autosave Integration Tests', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Configure default mock behavior
    vi.mocked(localForageStorage.getItem).mockResolvedValue(null)
    vi.mocked(localForageStorage.setItem).mockResolvedValue(undefined)
    vi.mocked(localForageStorage.removeItem).mockResolvedValue(undefined)
    
    // Force stores to clear their persisted state
    await useTranscriptStore.persist.clearStorage()
    await useAnalysisResultStore.persist.clearStorage()
    await usePromptHistoryStore.persist.clearStorage()
    
    // Reset stores to initial state
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    })
    useAnalysisResultStore.setState({
      genericAnalysisState: {}
    })
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
    })
    
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
  })

  it('calls storage adapter after state change', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Add a transcript
    const transcript: RawTranscript = {
      id: 'test-1',
      name: 'test.txt',
      content: 'Test transcript content',
      filename: 'test.txt'
    }
    
    // Update store state
    useTranscriptStore.setState({
      rawTranscripts: [transcript]
    })
    
    // Advance timers to ensure any debounced persist completes
    vi.runAllTimers()
    
    // Allow microtasks to complete
    await Promise.resolve()
    
    // Verify storage adapter was called for transcript store
    expect(setItemSpy).toHaveBeenCalled()
    
    // Find the call that contains our transcript (should be transcript-storage key)
    const calls = setItemSpy.mock.calls
    const relevantCall = calls.find(call => call[0] === 'transcript-storage')
    expect(relevantCall).toBeDefined()
    
    // Verify the saved data structure
    const savedData = typeof relevantCall![1] === 'string' ? JSON.parse(relevantCall![1]) : relevantCall![1]
    // The transcriptStore has custom serialization, so the structure is different
    expect(savedData.state.rawTranscripts).toHaveLength(1)
    expect(savedData.state.rawTranscripts[0].name).toBe('test.txt')
  })

  it('converts Map to array when persisting processedData', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Create a Map with processed data
    const processedData = new Map([
      ['transcript1', {
        id: 'transcript1',
        filename: 'test1.txt',
        p1_output: { phases: ['phase1', 'phase2'] }
      }]
    ])
    
    // Update store with Map data
    useTranscriptStore.setState({
      processedData: processedData
    })
    
    // Trigger persist
    vi.runAllTimers()
    await Promise.resolve()
    
    // Verify Map was converted to array in transcript store
    expect(setItemSpy).toHaveBeenCalled()
    
    // Find the transcript store call
    const calls = setItemSpy.mock.calls
    const transcriptCall = calls.find(call => call[0] === 'transcript-storage')
    expect(transcriptCall).toBeDefined()
    
    const savedData = typeof transcriptCall![1] === 'string' ? JSON.parse(transcriptCall![1]) : transcriptCall![1]
    
    // The transcriptStore has custom serialization that converts Map to Array
    expect(Array.isArray(savedData.state.processedData)).toBe(true)
    expect(savedData.state.processedData).toHaveLength(1)
    expect(savedData.state.processedData[0][0]).toBe('transcript1')
    expect(savedData.state.processedData[0][1].filename).toBe('test1.txt')
  })

  it('stores coordinate to set sessionWasRestored based on combined data', async () => {
    // This test verifies that the sessionWasRestored flag is set correctly
    // based on data from all stores, not just pipelineStore
    
    // Test 1: When only transcript store has data
    useTranscriptStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test' }],
      processedData: new Map()
    })
    useAnalysisResultStore.setState({ genericAnalysisState: {} })
    usePromptHistoryStore.setState({ promptHistory: [], totalInputTokens: 0, totalOutputTokens: 0 })
    
    const storeActions1 = useStoreActions()
    await storeActions1.coordinateRehydration()
    
    let uiState = useUIStore.getState()
    expect(uiState.hasRehydrated).toBe(true)
    expect(uiState.sessionWasRestored).toBe(true) // Should be true because transcript has data
    
    // Test 2: When only analysis store has data
    useTranscriptStore.setState({ rawTranscripts: [], processedData: new Map() })
    useAnalysisResultStore.setState({ genericAnalysisState: { p3_2_output: { some: 'data' } } })
    usePromptHistoryStore.setState({ promptHistory: [], totalInputTokens: 0, totalOutputTokens: 0 })
    
    const storeActions2 = useStoreActions()
    await storeActions2.coordinateRehydration()
    
    uiState = useUIStore.getState()
    expect(uiState.sessionWasRestored).toBe(true) // Should be true because analysis has data
    
    // Test 3: When only pipeline store has data
    useTranscriptStore.setState({ rawTranscripts: [], processedData: new Map() })
    useAnalysisResultStore.setState({ genericAnalysisState: {} })
    usePromptHistoryStore.setState({ promptHistory: [], totalInputTokens: 100, totalOutputTokens: 0 })
    
    const storeActions3 = useStoreActions()
    await storeActions3.coordinateRehydration()
    
    uiState = useUIStore.getState()
    expect(uiState.sessionWasRestored).toBe(true) // Should be true because pipeline has tokens
    
    // Test 4: When no store has data
    useTranscriptStore.setState({ rawTranscripts: [], processedData: new Map() })
    useAnalysisResultStore.setState({ genericAnalysisState: {} })
    usePromptHistoryStore.setState({ promptHistory: [], totalInputTokens: 0, totalOutputTokens: 0 })
    
    const storeActions4 = useStoreActions()
    await storeActions4.coordinateRehydration()
    
    uiState = useUIStore.getState()
    expect(uiState.sessionWasRestored).toBe(false) // Should be false because no data
  })

  it('handles rehydration with no saved data', async () => {
    // Mock no saved state
    vi.mocked(localForageStorage.getItem).mockResolvedValue(null)
    
    // Trigger coordinated rehydration
    const storeActions = useStoreActions()
    await storeActions.coordinateRehydration()
    
    // Verify transcript state remains at initial values
    const transcriptState = useTranscriptStore.getState()
    expect(transcriptState.rawTranscripts).toEqual([])
    expect(transcriptState.processedData.size).toBe(0)
    
    // Verify prompt history state remains at initial values
    const promptHistoryState = usePromptHistoryStore.getState()
    expect(promptHistoryState.totalInputTokens).toBe(0)
    expect(promptHistoryState.totalOutputTokens).toBe(0)
    
    // Verify UI flags
    const uiState = useUIStore.getState()
    expect(uiState.hasRehydrated).toBe(true)
    expect(uiState.sessionWasRestored).toBe(false)
  })

  it('handles corrupted storage data gracefully', async () => {
    // Mock storage to throw an error during getItem
    vi.mocked(localForageStorage.getItem).mockRejectedValue(new Error('Storage corruption error'))
    
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Trigger coordinated rehydration
    const storeActions = useStoreActions()
    
    // The rehydration should not throw, but handle errors gracefully
    await expect(storeActions.coordinateRehydration()).resolves.not.toThrow()
    
    // Should log error for corrupted storage
    // Note: The exact error message might vary based on how Zustand handles storage errors
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    // State should remain at initial values
    const transcriptState = useTranscriptStore.getState()
    expect(transcriptState.rawTranscripts).toEqual([])
    expect(transcriptState.processedData.size).toBe(0)
    
    // UI should still be marked as hydrated
    const uiState = useUIStore.getState()
    expect(uiState.hasRehydrated).toBe(true)
    expect(uiState.sessionWasRestored).toBe(false)
    
    consoleErrorSpy.mockRestore()
  })

  it('clears storage when clearStorage is called', async () => {
    const removeItemSpy = vi.mocked(localForageStorage.removeItem)
    
    // Clear storage for all stores
    await useTranscriptStore.persist.clearStorage()
    await useAnalysisResultStore.persist.clearStorage()
    await usePromptHistoryStore.persist.clearStorage()
    
    // Verify removeItem was called for all stores
    expect(removeItemSpy).toHaveBeenCalledTimes(3)
    expect(removeItemSpy).toHaveBeenCalledWith('transcript-storage')
    expect(removeItemSpy).toHaveBeenCalledWith('analysis-storage')
    expect(removeItemSpy).toHaveBeenCalledWith('prompt-history-storage')
  })

  it('handles storage errors during save gracefully', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Update state first
    useTranscriptStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test', filename: 'test.txt' }]
    })
    
    // Clear any pending persists
    vi.runAllTimers()
    await Promise.resolve()
    vi.clearAllMocks()
    
    // Now set up the rejection for the next call
    setItemSpy.mockRejectedValueOnce(new Error('QuotaExceededError'))
    
    // Trigger another state change in prompt history store
    usePromptHistoryStore.setState({
      totalInputTokens: 100
    })
    
    // Trigger persist
    vi.runAllTimers()
    
    // Use real timers for async error handling
    vi.useRealTimers()
    
    try {
      // Wait for the rejected promise to be handled
      await new Promise(resolve => setTimeout(resolve, 10))
    } catch (e) {
      // Expected - persist middleware should handle this internally
    }
    
    // Should not crash, and setItem should have been called
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    
    // Restore fake timers for next test
    vi.useFakeTimers()
  })

  it('only persists specified state slices (partialize)', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Update transcript store with meaningful data
    useTranscriptStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test', filename: 'test.txt' }]
    })
    
    // Update analysis store with meaningful data
    useAnalysisResultStore.setState({
      genericAnalysisState: { p3_1_output: { some: 'data' } }
    })
    
    // Update prompt history store with meaningful data
    usePromptHistoryStore.setState({
      totalInputTokens: 100,
      totalOutputTokens: 200,
      promptHistory: []
    })
    
    // Update UI store with UI-related states that should NOT be persisted
    useUIStore.setState({
      isAutorunning: true,
      processingStepId: StepId.P1_1_INTERVIEW_TRANSCRIPT_SELECTION,
      currentStepInfo: { stepId: StepId.P1_1_INTERVIEW_TRANSCRIPT_SELECTION, status: 'loading' }
    })
    
    // Trigger persist
    vi.runAllTimers()
    await Promise.resolve()
    
    // Find each store's call
    const transcriptCall = setItemSpy.mock.calls.find(call => call[0] === 'transcript-storage')
    expect(transcriptCall).toBeDefined()
    const transcriptData = typeof transcriptCall![1] === 'string' ? JSON.parse(transcriptCall![1]) : transcriptCall![1]
    
    const promptHistoryCall = setItemSpy.mock.calls.find(call => call[0] === 'prompt-history-storage')
    expect(promptHistoryCall).toBeDefined()
    const promptHistoryData = typeof promptHistoryCall![1] === 'string' ? JSON.parse(promptHistoryCall![1]) : promptHistoryCall![1]
    
    // UI store should not persist any state (no persist middleware)
    const uiCall = setItemSpy.mock.calls.find(call => call[0] === 'ui-storage')
    expect(uiCall).toBeUndefined() // UI store doesn't persist
    expect(transcriptData.state.rawTranscripts).toHaveLength(1)
    expect(transcriptData.state).toHaveProperty('processedData')
    
    // Find analysis store call
    const analysisCall = setItemSpy.mock.calls.find(call => call[0] === 'analysis-storage')
    expect(analysisCall).toBeDefined()
    const analysisData = typeof analysisCall![1] === 'string' ? JSON.parse(analysisCall![1]) : analysisCall![1]
    expect(analysisData.state).toHaveProperty('genericAnalysisState')
    
    // Verify prompt history store has the data that was previously in pipeline store
    expect(promptHistoryData.state).toHaveProperty('promptHistory')
    expect(promptHistoryData.state).toHaveProperty('totalInputTokens')
    expect(promptHistoryData.state).toHaveProperty('totalOutputTokens')
    
    // UI state should NOT be persisted anywhere
    expect(transcriptData.state).not.toHaveProperty('lastStepInfo')
    expect(analysisData.state).not.toHaveProperty('lastStepInfo')
    expect(promptHistoryData.state).not.toHaveProperty('lastStepInfo')
  })

  it('persists final state after multiple changes', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Make multiple rapid state changes
    usePromptHistoryStore.setState({ totalInputTokens: 10 })
    usePromptHistoryStore.setState({ totalOutputTokens: 20 })
    useTranscriptStore.setState({ 
      rawTranscripts: [{ id: '1', filename: 'test.txt', content: 'test' }]
    })
    
    // Advance timers to allow all persists to complete
    vi.runAllTimers()
    await Promise.resolve()
    
    // Verify final state was persisted
    expect(setItemSpy).toHaveBeenCalled()
    
    // Check the final persisted state for prompt history store (get the last call, not the first)
    const promptHistoryCalls = setItemSpy.mock.calls.filter(call => call[0] === 'prompt-history-storage')
    expect(promptHistoryCalls.length).toBeGreaterThan(0)
    const lastPromptHistoryCall = promptHistoryCalls[promptHistoryCalls.length - 1]
    const promptHistoryData = typeof lastPromptHistoryCall[1] === 'string' ? JSON.parse(lastPromptHistoryCall[1]) : lastPromptHistoryCall[1]
    expect(promptHistoryData.state.totalInputTokens).toBe(10)
    expect(promptHistoryData.state.totalOutputTokens).toBe(20)
    
    // Check the final persisted state for transcript store (if it persisted)
    const transcriptCalls = setItemSpy.mock.calls.filter(call => call[0] === 'transcript-storage')
    if (transcriptCalls.length > 0) {
      const lastTranscriptCall = transcriptCalls[transcriptCalls.length - 1]
      const transcriptData = typeof lastTranscriptCall[1] === 'string' ? JSON.parse(lastTranscriptCall[1]) : lastTranscriptCall[1]
      expect(transcriptData.state.rawTranscripts).toHaveLength(1)
    }
    // Note: transcriptStore may skip persist if it has no meaningful data according to its partialize function
  })
})