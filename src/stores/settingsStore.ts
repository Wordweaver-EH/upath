import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserDVFocus } from '../../types'
import { isApiKeySet } from '../../services/geminiService'

interface SettingsState {
  // API
  apiKeyPresent: boolean
  
  // DV Focus
  userDvFocus: UserDVFocus
  dvFocusInput: string
  dvFocusError: string
  
  // Generation Settings
  temperature: number
  seedInput: string
  seed: number | undefined
  retrySeedInput: string
  
  // Output
  outputDirectory: string
  autoDownloadResults: boolean
}

interface SettingsActions {
  updateSettings: (updates: Partial<SettingsState>) => void
  validateAndSetDvFocus: (input: string) => void
  validateAndSetSeed: (input: string) => void
  checkApiKey: () => void
  setTemperature: (temp: number) => void
  setOutputDirectory: (dir: string) => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial State
      apiKeyPresent: false,
      userDvFocus: { dv_focus: [] },
      dvFocusInput: 'cognitions, emotions, sensations, imagination, internal_experiences',
      dvFocusError: '',
      temperature: 0.0,
      seedInput: '42',
      seed: 42,
      retrySeedInput: '',
      outputDirectory: 'MicroPheno_Analysis_Outputs',
      autoDownloadResults: false,
      
      // Actions
      updateSettings: (updates) => set(updates),
      
      validateAndSetDvFocus: (input: string) => {
        const focuses = input.split(',').map(focus => focus.trim()).filter(focus => focus.length > 0)
        
        if (input.trim() === '') {
          set({ 
            dvFocusInput: input,
            dvFocusError: "DV Focus is required." 
          })
        } else if (focuses.length === 0) {
          set({ 
            dvFocusInput: input,
            dvFocusError: "No valid DVs found." 
          })
        } else {
          set({ 
            dvFocusInput: input,
            userDvFocus: { dv_focus: focuses },
            dvFocusError: '' 
          })
        }
      },
      
      validateAndSetSeed: (input: string) => {
        const num = parseInt(input, 10)
        if (!isNaN(num) && num > 0) {
          set({ 
            seedInput: input,
            seed: num,
            retrySeedInput: input 
          })
        } else {
          set({ 
            seedInput: input,
            seed: undefined,
            retrySeedInput: '' 
          })
        }
      },
      
      checkApiKey: () => {
        set({ apiKeyPresent: isApiKeySet() })
      },
      
      setTemperature: (temp: number) => {
        set({ temperature: Math.max(0, Math.min(1, temp)) })
      },
      
      setOutputDirectory: (dir: string) => {
        set({ outputDirectory: dir })
      }
    }),
    {
      name: 'upath-settings',
      partialize: (state) => ({
        // Only persist user preferences, not runtime states
        userDvFocus: state.userDvFocus,
        dvFocusInput: state.dvFocusInput,
        temperature: state.temperature,
        seedInput: state.seedInput,
        seed: state.seed,
        outputDirectory: state.outputDirectory,
        autoDownloadResults: state.autoDownloadResults
      })
    }
  )
)