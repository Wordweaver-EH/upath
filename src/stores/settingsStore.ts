import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserDVFocus } from '../../types'
import { isApiKeySet } from '../../services/geminiService'

// Default DV focus input string
const DEFAULT_DV_FOCUS_INPUT = 'cognitions, emotions, sensations, imagination, internal_experiences'

// Model type
export interface ModelOption {
  value: string
  label: string
  description?: string
  inputTokenLimit?: number
  outputTokenLimit?: number
}

// Default thinking models (used as fallback)
export const DEFAULT_AVAILABLE_MODELS: ModelOption[] = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Stable version with thinking capabilities' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Advanced reasoning with thinking mode' },
  { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking Experimental', description: 'Experimental thinking model' }
]

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
  model: string
  availableModels: ModelOption[]
  isLoadingModels: boolean
  temperature: number
  seedInput: string
  seed: number | undefined
  retrySeedInput: string
  
  // Output
  outputDirectory: string
  autoDownloadResults: boolean
  
  // Debug
  debugMode: boolean
}

interface SettingsActions {
  updateSettings: (updates: Partial<SettingsState>) => void
  validateAndSetDvFocus: (input: string) => void
  validateAndSetSeed: (input: string) => void
  checkApiKey: () => void
  fetchAvailableModels: () => Promise<void>
  setModel: (model: string) => void
  setTemperature: (temp: number) => void
  setOutputDirectory: (dir: string) => void
  setDebugMode: (enabled: boolean) => void
  clearSettings: () => Promise<void>
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
        model: 'gemini-2.5-flash',
        availableModels: DEFAULT_AVAILABLE_MODELS,
        isLoadingModels: false,
        temperature: 0.0,
        seedInput: '42',
        seed: 42,
        retrySeedInput: '',
        outputDirectory: 'MicroPheno_Analysis_Outputs',
        autoDownloadResults: false,
        debugMode: (process.env as any).REACT_APP_DEBUG_MODE === 'true',
      
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
      
      fetchAvailableModels: async () => {
        set({ isLoadingModels: true })
        
        try {
          const BACKEND_URL = process.env.NODE_ENV === 'production' 
            ? process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
            : 'http://localhost:3001'
            
          const response = await fetch(`${BACKEND_URL}/api/models`)
          
          if (response.ok) {
            const data = await response.json()
            
            // Update available models and potentially the selected model
            set({ 
              availableModels: data.models || DEFAULT_AVAILABLE_MODELS,
              isLoadingModels: false 
            })
            
            // If current model is not in the list, update to default
            const currentModel = get().model
            const modelExists = data.models?.some((m: ModelOption) => m.value === currentModel)
            if (!modelExists && data.defaultModel) {
              set({ model: data.defaultModel })
            }
          } else {
            console.warn('Failed to fetch models, using defaults')
            set({ 
              availableModels: DEFAULT_AVAILABLE_MODELS,
              isLoadingModels: false 
            })
          }
        } catch (error) {
          console.error('Error fetching models:', error)
          set({ 
            availableModels: DEFAULT_AVAILABLE_MODELS,
            isLoadingModels: false 
          })
        }
      },
      
      setModel: (model: string) => {
        set({ model })
      },
      
      setTemperature: (temp: number) => {
        set({ temperature: Math.max(0, Math.min(1, temp)) })
      },
      
      setOutputDirectory: (dir: string) => {
        set({ outputDirectory: dir })
      },
      
      setDebugMode: (enabled: boolean) => {
        set({ debugMode: enabled })
      },
      
      clearSettings: async () => {
        // Reset to default values
        const initialDvFocusArray = parseDvFocusString(DEFAULT_DV_FOCUS_INPUT)
        set({
          userDvFocus: { dv_focus: initialDvFocusArray },
          dvFocusInput: DEFAULT_DV_FOCUS_INPUT,
          dvFocusError: '',
          model: 'gemini-2.5-flash',
          availableModels: DEFAULT_AVAILABLE_MODELS,
          isLoadingModels: false,
          temperature: 0.0,
          seedInput: '42',
          seed: 42,
          retrySeedInput: '',
          outputDirectory: 'MicroPheno_Analysis_Outputs',
          autoDownloadResults: false,
          debugMode: false
        })
        
        // Clear persisted storage
        try {
          const storage = window.localStorage
          storage.removeItem('upath-settings')
        } catch (error) {
          console.error('Failed to clear settings storage:', error)
        }
      }
      }
    },
    {
      name: 'upath-settings',
      partialize: (state) => ({
        // Only persist user preferences, not runtime states
        userDvFocus: state.userDvFocus,
        dvFocusInput: state.dvFocusInput,
        model: state.model,
        temperature: state.temperature,
        seedInput: state.seedInput,
        seed: state.seed,
        outputDirectory: state.outputDirectory,
        autoDownloadResults: state.autoDownloadResults,
        debugMode: state.debugMode
      })
    }
  )
)

// Run validation on initial load to ensure the derived state is in sync with the input state
useSettingsStore.getState().validateAndSetDvFocus(useSettingsStore.getState().dvFocusInput);
useSettingsStore.getState().validateAndSetSeed(useSettingsStore.getState().seedInput);