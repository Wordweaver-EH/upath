import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserDVFocus } from '../../types'
import { isApiKeySet } from '../../services/geminiService'

// Default DV focus input string
const DEFAULT_DV_FOCUS_INPUT = 'cognitions, emotions, sensations, imagination, internal_experiences'

// Pure helper function to parse DV focus string into array
const parseDvFocusString = (input: string): string[] => {
  const trimmed = input.trim()
  if (!trimmed) {
    return []
  }
  return trimmed.split(',').map(dv => dv.trim()).filter(dv => dv.length > 0)
}

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
    (set, get) => {
      // Calculate initial dv_focus array from default string
      const initialDvFocusArray = parseDvFocusString(DEFAULT_DV_FOCUS_INPUT)

      return {
        // Initial State
        apiKeyPresent: false,
        userDvFocus: { dv_focus: initialDvFocusArray },
        dvFocusInput: DEFAULT_DV_FOCUS_INPUT,
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
        const dvs = parseDvFocusString(input)
        
        let error = ''
        if (input.trim().length === 0) {
          error = 'At least one dependent variable focus is required.'
        } else if (dvs.length === 0) {
          error = 'At least one valid dependent variable focus is required.'
        }

        if (error) {
          set({ 
            dvFocusInput: input,
            dvFocusError: error,
            userDvFocus: { dv_focus: [] }
          })
        } else {
          set({ 
            dvFocusInput: input,
            userDvFocus: { dv_focus: dvs },
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
      }
    },
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