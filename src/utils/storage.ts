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
    const result = await localforage.getItem<any>(name)
    // If we get an object, stringify it for Zustand
    if (result && typeof result === 'object') {
      return JSON.stringify(result)
    }
    return result
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // Try to parse the value if it's a JSON string
    let dataToStore: any = value
    try {
      dataToStore = JSON.parse(value)
    } catch {
      // If parsing fails, store as-is
    }
    await localforage.setItem(name, dataToStore)
  },
  removeItem: async (name: string): Promise<void> => {
    console.log('🗑️ [Storage] removeItem called for:', name)
    await localforage.removeItem(name)
    console.log('🗑️ [Storage] removeItem completed')
  },
}