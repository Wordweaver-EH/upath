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