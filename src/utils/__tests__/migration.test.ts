import { describe, it, expect, beforeEach, vi } from 'vitest'
import localforage from 'localforage'
import { performDataMigration } from '../migration'

// Mock localforage
vi.mock('localforage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Data Migration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('migrates existing localStorage data on first run', async () => {
    // Setup: existing data in localStorage
    const existingData = {
      state: {
        rawTranscripts: [{ id: '1', name: 'existing.txt', content: 'data' }],
        processedData: [['transcript1', { p1_output: 'result' }]],
        genericAnalysisState: {},
        promptHistory: [],
      },
    }
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'upath-pipeline') {
        return JSON.stringify(existingData)
      }
      return null
    })
    
    // Run migration
    await performDataMigration()
    
    // Verify: data copied to localforage
    expect(localforage.setItem).toHaveBeenCalledWith(
      'upath-autosave-session-v2-localforage',
      JSON.stringify(existingData)
    )
    
    // Verify: old data removed from localStorage
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('upath-pipeline')
    
    // Verify: migration flag set to prevent re-migration
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'upath-migration-completed',
      'true'
    )
  })

  it('skips migration if already completed', async () => {
    // Setup: migration already completed
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'upath-migration-completed') return 'true'
      if (key === 'upath-pipeline') return JSON.stringify({ state: { test: 'data' } })
      return null
    })
    
    await performDataMigration()
    
    // Verify: no data written to localforage
    expect(localforage.setItem).not.toHaveBeenCalled()
    
    // Verify: old data not removed
    expect(localStorageMock.removeItem).not.toHaveBeenCalled()
  })

  it('handles corrupted localStorage data gracefully', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'upath-pipeline') return 'invalid-json'
      return null
    })
    
    // Should not throw
    await expect(performDataMigration()).resolves.not.toThrow()
    
    // Migration flag should still be set
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'upath-migration-completed',
      'true'
    )
    
    // No data should be written to localforage
    expect(localforage.setItem).not.toHaveBeenCalled()
  })

  it('handles migration when localforage is unavailable', async () => {
    // Mock localforage failure
    vi.mocked(localforage.setItem).mockRejectedValue(
      new Error('IndexedDB unavailable')
    )
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'upath-pipeline') {
        return JSON.stringify({ state: { test: 'data' } })
      }
      return null
    })
    
    await performDataMigration()
    
    // Should gracefully fail and set migration flag
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'upath-migration-completed',
      'true'
    )
    
    // Old data should not be removed on failure
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('upath-pipeline')
  })

  it('handles case when no data to migrate', async () => {
    // No existing data
    localStorageMock.getItem.mockReturnValue(null)
    
    await performDataMigration()
    
    // Should still set migration flag
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'upath-migration-completed',
      'true'
    )
    
    // No data operations
    expect(localforage.setItem).not.toHaveBeenCalled()
    expect(localStorageMock.removeItem).not.toHaveBeenCalled()
  })

  it('logs migration process for debugging', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'upath-pipeline') {
        return JSON.stringify({ state: { test: 'data' } })
      }
      return null
    })
    
    await performDataMigration()
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Migration] Starting data migration')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Migration] Found existing data')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Migration] Migration process completed')
    )
    
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})