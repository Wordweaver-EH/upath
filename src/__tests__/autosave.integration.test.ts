import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePipelineStore } from '../stores/pipelineStore'
import { useUIStore } from '../stores/uiStore'
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
    
    // Reset stores to initial state
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
    usePipelineStore.setState({
      rawTranscripts: [transcript]
    })
    
    // Advance timers to ensure any debounced persist completes
    vi.runAllTimers()
    
    // Allow microtasks to complete
    await Promise.resolve()
    
    // Verify storage adapter was called
    expect(setItemSpy).toHaveBeenCalled()
    
    // Find the call that contains our transcript
    const calls = setItemSpy.mock.calls
    const relevantCall = calls.find(call => call[1].includes('"filename":"test.txt"'))
    expect(relevantCall).toBeDefined()
    
    // Verify the saved data structure
    const savedData = JSON.parse(relevantCall![1])
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
    usePipelineStore.setState({
      processedData: processedData
    })
    
    // Trigger persist
    vi.runAllTimers()
    await Promise.resolve()
    
    // Verify Map was converted to array
    expect(setItemSpy).toHaveBeenCalled()
    
    // Find the most recent call (should have our processedData)
    const lastCall = setItemSpy.mock.calls[setItemSpy.mock.calls.length - 1]
    const savedData = JSON.parse(lastCall[1])
    expect(Array.isArray(savedData.state.processedData)).toBe(true)
    expect(savedData.state.processedData).toHaveLength(1)
    expect(savedData.state.processedData[0][0]).toBe('transcript1')
    expect(savedData.state.processedData[0][1].filename).toBe('test1.txt')
  })

  it('restores state and converts array back to Map on rehydration', async () => {
    // Mock saved state with processedData as array
    const savedState = {
      state: {
        rawTranscripts: [
          { id: '1', name: 'transcript1.txt', content: 'content1', filename: 'transcript1.txt' }
        ],
        processedData: [
          ['transcript1', { 
            id: 'transcript1',
            filename: 'transcript1.txt',
            p1_output: { phases: ['phase1'] } 
          }]
        ],
        genericAnalysisState: { p3_2_output: { identified_gdus: [] } },
        promptHistory: [],
        totalInputTokens: 100,
        totalOutputTokens: 200
      },
      version: 0
    }
    
    // Configure mock to return saved state
    vi.mocked(localForageStorage.getItem).mockResolvedValue(JSON.stringify(savedState))
    
    // Trigger rehydration
    await usePipelineStore.persist.rehydrate()
    
    // Verify state was restored with Map conversion
    const state = usePipelineStore.getState()
    expect(state.rawTranscripts).toHaveLength(1)
    expect(state.rawTranscripts[0].name).toBe('transcript1.txt')
    expect(state.processedData).toBeInstanceOf(Map)
    expect(state.processedData.size).toBe(1)
    expect(state.processedData.get('transcript1')).toEqual({
      id: 'transcript1',
      filename: 'transcript1.txt',
      p1_output: { phases: ['phase1'] }
    })
    expect(state.totalInputTokens).toBe(100)
    expect(state.totalOutputTokens).toBe(200)
    
    // Verify UI flags were set
    const uiState = useUIStore.getState()
    expect(uiState.hasRehydrated).toBe(true)
    expect(uiState.sessionWasRestored).toBe(true)
  })

  it('handles rehydration with no saved data', async () => {
    // Mock no saved state
    vi.mocked(localForageStorage.getItem).mockResolvedValue(null)
    
    // Trigger rehydration
    await usePipelineStore.persist.rehydrate()
    
    // Verify state remains at initial values
    const state = usePipelineStore.getState()
    expect(state.rawTranscripts).toEqual([])
    expect(state.processedData.size).toBe(0)
    
    // Verify UI flags
    const uiState = useUIStore.getState()
    expect(uiState.hasRehydrated).toBe(true)
    expect(uiState.sessionWasRestored).toBe(false)
  })

  it('handles corrupted storage data gracefully', async () => {
    // Mock corrupted data
    vi.mocked(localForageStorage.getItem).mockResolvedValue('corrupted-json-data')
    
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Trigger rehydration
    await usePipelineStore.persist.rehydrate()
    
    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to parse stored data:',
      expect.any(Error)
    )
    
    // State should remain at initial values
    const state = usePipelineStore.getState()
    expect(state.rawTranscripts).toEqual([])
    expect(state.processedData.size).toBe(0)
    
    // UI should still be marked as hydrated
    const uiState = useUIStore.getState()
    expect(uiState.hasRehydrated).toBe(true)
    expect(uiState.sessionWasRestored).toBe(false)
    
    consoleErrorSpy.mockRestore()
  })

  it('clears storage when clearStorage is called', async () => {
    const removeItemSpy = vi.mocked(localForageStorage.removeItem)
    
    // Clear storage
    await usePipelineStore.persist.clearStorage()
    
    // Verify removeItem was called
    expect(removeItemSpy).toHaveBeenCalledTimes(1)
    expect(removeItemSpy).toHaveBeenCalledWith('upath-autosave-session-v2-localforage')
  })

  it('handles storage errors during save gracefully', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Update state first
    usePipelineStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test', filename: 'test.txt' }]
    })
    
    // Clear any pending persists
    vi.runAllTimers()
    await Promise.resolve()
    vi.clearAllMocks()
    
    // Now set up the rejection for the next call
    setItemSpy.mockRejectedValueOnce(new Error('QuotaExceededError'))
    
    // Trigger another state change
    usePipelineStore.setState({
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
    
    // Update various parts of the store
    usePipelineStore.setState({
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test', filename: 'test.txt' }],
      // These UI-related states should NOT be persisted:
      lastStepInfo: { stepId: StepId.P1_1_INTERVIEW_TRANSCRIPT_SELECTION, status: 'loading' },
      shouldStopAutorun: true,
      lastHilContext: { needsProcessing: true }
    })
    
    // Trigger persist
    vi.runAllTimers()
    await Promise.resolve()
    
    // Verify only data states were persisted
    const savedData = JSON.parse(setItemSpy.mock.calls[0][1])
    expect(savedData.state).toHaveProperty('rawTranscripts')
    expect(savedData.state).toHaveProperty('processedData')
    expect(savedData.state).toHaveProperty('genericAnalysisState')
    expect(savedData.state).toHaveProperty('promptHistory')
    expect(savedData.state).toHaveProperty('totalInputTokens')
    expect(savedData.state).toHaveProperty('totalOutputTokens')
    
    // UI state should NOT be persisted
    expect(savedData.state).not.toHaveProperty('lastStepInfo')
    expect(savedData.state).not.toHaveProperty('shouldStopAutorun')
    expect(savedData.state).not.toHaveProperty('lastHilContext')
  })

  it('persists final state after multiple changes', async () => {
    const setItemSpy = vi.mocked(localForageStorage.setItem)
    
    // Make multiple rapid state changes
    usePipelineStore.setState({ totalInputTokens: 10 })
    usePipelineStore.setState({ totalOutputTokens: 20 })
    usePipelineStore.setState({ 
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test', filename: 'test.txt' }]
    })
    
    // Advance timers to allow all persists to complete
    vi.runAllTimers()
    await Promise.resolve()
    
    // Verify final state was persisted
    expect(setItemSpy).toHaveBeenCalled()
    
    // Check the final persisted state
    const lastCall = setItemSpy.mock.calls[setItemSpy.mock.calls.length - 1]
    const savedData = JSON.parse(lastCall[1])
    expect(savedData.state.totalInputTokens).toBe(10)
    expect(savedData.state.totalOutputTokens).toBe(20)
    expect(savedData.state.rawTranscripts).toHaveLength(1)
  })
})