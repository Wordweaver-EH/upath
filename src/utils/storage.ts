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
    return await localforage.getItem(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await localforage.setItem(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await localforage.removeItem(name)
  },
}