import { describe, it, expect, beforeEach, vi } from 'vitest'
import localforage from 'localforage'
import { localForageStorage } from '../storage'

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

describe('LocalForage Storage Adapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('implements StateStorage interface correctly', async () => {
    const adapter = localForageStorage
    
    // Test all required methods exist
    expect(typeof adapter.getItem).toBe('function')
    expect(typeof adapter.setItem).toBe('function')
    expect(typeof adapter.removeItem).toBe('function')
  })

  it('handles string data correctly', async () => {
    const mockValue = 'test-value'
    vi.mocked(localforage.getItem).mockResolvedValue(mockValue)
    
    await localForageStorage.setItem('test-key', mockValue)
    const result = await localForageStorage.getItem('test-key')
    
    expect(localforage.setItem).toHaveBeenCalledWith('test-key', mockValue)
    expect(localforage.getItem).toHaveBeenCalledWith('test-key')
    expect(result).toBe(mockValue)
  })

  it('handles large JSON data (>5MB)', async () => {
    // Create realistic large state similar to actual app
    const largeTranscripts = Array.from({ length: 20 }, (_, i) => ({
      id: `transcript-${i}`,
      name: `test-${i}.txt`,
      content: 'x'.repeat(300000), // 300KB per transcript = 6MB total
    }))
    
    const largeData = JSON.stringify({
      rawTranscripts: largeTranscripts,
      processedData: [],
      promptHistory: [],
    })
    
    vi.mocked(localforage.getItem).mockResolvedValue(largeData)
    
    await localForageStorage.setItem('large-state', largeData)
    const result = await localForageStorage.getItem('large-state')
    
    expect(localforage.setItem).toHaveBeenCalledWith('large-state', largeData)
    expect(result).toBe(largeData)
  })

  it('returns null for non-existent keys', async () => {
    vi.mocked(localforage.getItem).mockResolvedValue(null)
    
    const result = await localForageStorage.getItem('non-existent')
    
    expect(localforage.getItem).toHaveBeenCalledWith('non-existent')
    expect(result).toBeNull()
  })

  it('removes items successfully', async () => {
    await localForageStorage.removeItem('remove-key')
    
    expect(localforage.removeItem).toHaveBeenCalledWith('remove-key')
  })

  it('handles storage errors gracefully', async () => {
    const error = new Error('QuotaExceededError')
    vi.mocked(localforage.setItem).mockRejectedValue(error)
    
    await expect(localForageStorage.setItem('test', 'data'))
      .rejects.toThrow('QuotaExceededError')
  })
})

describe('LocalForage Configuration', () => {
  it('configures with correct database settings', async () => {
    // Clear the module cache to force re-import
    vi.resetModules()
    
    // Re-import to trigger configuration
    await import('../storage')
    
    expect(localforage.config).toHaveBeenCalledWith({
      name: 'uPATH-Analysis-Storage',
      storeName: 'state_store',
      description: 'Persistent storage for µ-PATH application state.',
    })
  })
})