import localforage from 'localforage'
import { StateStorage } from 'zustand/middleware'

// Configure localforage for our application
localforage.config({
  name: 'uPATH-Analysis-Storage',
  storeName: 'state_store',
  description: 'Persistent storage for µ-PATH application state.',
})

// Create the custom storage adapter that Zustand's persist middleware will use
export const localForageStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    console.log('🔍 [Storage] getItem called for:', name)
    const result = await localforage.getItem(name)
    console.log('🔍 [Storage] getItem result:', result ? 'data found' : 'no data')
    return result
  },
  setItem: async (name: string, value: string): Promise<void> => {
    console.log('💾 [Storage] setItem called for:', name, 'size:', value.length, 'chars')
    await localforage.setItem(name, value)
    console.log('💾 [Storage] setItem completed')
  },
  removeItem: async (name: string): Promise<void> => {
    console.log('🗑️ [Storage] removeItem called for:', name)
    await localforage.removeItem(name)
    console.log('🗑️ [Storage] removeItem completed')
  },
}

// QueuedStorageWrapper to fix race condition
class QueuedStorageWrapper implements StateStorage {
  private storage: StateStorage
  private isInitialized = false
  private hasExistingData = false
  private writeQueue: Array<{ name: string; value: string }> = []
  private initializationPromise: Promise<void> | null = null

  constructor(storage: StateStorage) {
    this.storage = storage
  }

  async getItem(name: string): Promise<string | null> {
    console.log('🔍 [QueuedStorage] getItem called for:', name)
    
    // First getItem triggers initialization
    if (!this.isInitialized && !this.initializationPromise) {
      console.log('🚀 [QueuedStorage] Starting initialization...')
      this.initializationPromise = this.initialize(name)
    }

    // Wait for initialization to complete
    if (this.initializationPromise) {
      await this.initializationPromise
    }

    // Now perform the actual getItem
    const result = await this.storage.getItem(name)
    return result
  }

  async setItem(name: string, value: string): Promise<void> {
    console.log('💾 [QueuedStorage] setItem called for:', name, 'size:', value.length, 'chars')
    
    // If not initialized, queue the write
    if (!this.isInitialized) {
      console.log('⏳ [QueuedStorage] Not initialized yet, queueing write')
      this.writeQueue.push({ name, value })
      return
    }

    // If initialized but no existing data was found, allow all writes
    if (!this.hasExistingData) {
      console.log('✅ [QueuedStorage] No existing data, allowing write')
      await this.storage.setItem(name, value)
      return
    }

    // If existing data was found, check if this is meaningful data
    try {
      const parsed = JSON.parse(value)
      const hasData = parsed.state && (
        parsed.state.rawTranscripts?.length > 0 ||
        parsed.state.processedData?.length > 0 ||
        parsed.state.promptHistory?.length > 0
      )
      
      if (hasData) {
        console.log('✅ [QueuedStorage] Meaningful data detected, allowing write')
        await this.storage.setItem(name, value)
      } else {
        console.log('🚫 [QueuedStorage] Empty state detected with existing data, blocking write')
      }
    } catch (e) {
      // If we can't parse, allow the write (safety fallback)
      console.log('⚠️ [QueuedStorage] Could not parse value, allowing write')
      await this.storage.setItem(name, value)
    }
  }

  async removeItem(name: string): Promise<void> {
    console.log('🗑️ [QueuedStorage] removeItem called for:', name)
    await this.storage.removeItem(name)
  }

  private async initialize(name: string): Promise<void> {
    try {
      // Check if there's existing data
      const existingData = await this.storage.getItem(name)
      this.hasExistingData = !!existingData
      
      console.log('✅ [QueuedStorage] Initialization complete:', {
        hasExistingData: this.hasExistingData,
        queuedWrites: this.writeQueue.length
      })

      // Process queued writes
      await this.processQueue()
      
      this.isInitialized = true
      this.initializationPromise = null
    } catch (error) {
      console.error('❌ [QueuedStorage] Initialization failed:', error)
      this.isInitialized = true
      this.initializationPromise = null
      // Process queue anyway to avoid blocking
      await this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    console.log(`📝 [QueuedStorage] Processing ${this.writeQueue.length} queued writes`)
    
    for (const { name, value } of this.writeQueue) {
      if (!this.hasExistingData) {
        // No existing data, allow the write
        console.log('✅ [QueuedStorage] Processing queued write (no existing data)')
        await this.storage.setItem(name, value)
      } else {
        // Existing data found, check if queued write has meaningful data
        try {
          const parsed = JSON.parse(value)
          const hasData = parsed.state && (
            parsed.state.rawTranscripts?.length > 0 ||
            parsed.state.processedData?.length > 0 ||
            parsed.state.promptHistory?.length > 0
          )
          
          if (hasData) {
            console.log('✅ [QueuedStorage] Processing queued write (has meaningful data)')
            await this.storage.setItem(name, value)
          } else {
            console.log('🚫 [QueuedStorage] Discarding queued empty state write')
          }
        } catch (e) {
          console.log('⚠️ [QueuedStorage] Could not parse queued value, discarding')
        }
      }
    }
    
    this.writeQueue = []
  }
}

// Export the wrapped storage for use in pipelineStore
export const queuedLocalForageStorage = new QueuedStorageWrapper(localForageStorage)