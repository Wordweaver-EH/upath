import { create } from 'zustand'
import { STEP_CONFIGS } from '../constants'
import { subscribeWithSelector } from 'zustand/middleware'
import { StepId, StepStatus, CurrentStepInfo, HilContext } from '../../types'
import { ALL_PIPELINE_STEP_IDS_IN_ORDER, STEP_CONFIGS, STEP_ORDER_PART_4_GENERIC_SYNCHRONIC } from '../../constants'
import { stepIdToDataKeyPrefix, isGlobalStep } from '../utils/stepIdToDataKeyPrefix'

interface UIState {
  // Navigation
  currentStepInfo: CurrentStepInfo
  activeTranscriptIndex: number
  
  // Process Control
  isAutorunning: boolean
  processStartTime: number | null
  elapsedTime: number
  
  // HIL Modal
  isHilModalOpen: boolean
  hilContext: HilContext | null
  hilUserGuidance: string
  
  // Retry UI
  retrySeedInput: string
  
  // UI State
  theme: 'light' | 'dark'
  isDraggingOver: boolean
  
  // Hydration State
  hasRehydrated: boolean
  sessionWasRestored: boolean
  
  // Drag & Drop - now uses callback pattern to avoid circular dependency
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => void
  
  // Callback for file upload - injected by pipeline store
  onFilesDropped?: (files: File[]) => void
}


interface UIActions {
  // Navigation
  navigateToStep: (stepId: StepId) => void
  nextStep: () => void
  previousStep: () => void
  setActiveTranscript: (index: number) => void
  setCurrentStepInfo: (info: CurrentStepInfo) => void
  
  // Process Control
  toggleAutorun: () => void
  setAutorunning: (value: boolean) => void
  setProcessStartTime: (time: number | null) => void
  updateElapsedTime: () => void
  
  // HIL Modal
  openHilModal: (context: HilContext) => void
  openHilModalWithContext: () => void
  closeHilModal: () => void
  setHilUserGuidance: (guidance: string) => void
  handleHilSubmit: () => Promise<void>
  
  // Retry UI
  setRetrySeedInput: (value: string) => void
  
  // UI State
  toggleTheme: () => void
  setIsDraggingOver: (isDragging: boolean) => void
  
  // Hydration
  setHasRehydrated: (hasRehydrated: boolean) => void
  setSessionWasRestored: (wasRestored: boolean) => void
  hideSessionRestoreNotification: () => void
  
  // Dependency injection
  setFileDropCallback: (callback: (files: File[]) => void) => void
  
  // Utils
  resetUIState: () => void
}



interface UISelectors {
  // Derived state selectors
  isAutorunDisabled: () => boolean
  selectShowRetryUI: () => boolean
}

type UIStore = UIState & UIActions & UISelectors

// Helper to get initial theme
const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const storedTheme = localStorage.getItem('app-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
    activeTranscriptIndex: 0,
    isAutorunning: false,
    processStartTime: null,
    elapsedTime: 0,
    isHilModalOpen: false,
    hilContext: null,
    hilUserGuidance: '',
    retrySeedInput: '',
    theme: getInitialTheme(),
    isDraggingOver: false,
    hasRehydrated: false,
    sessionWasRestored: false,
    
    // Actions
    navigateToStep: (stepId: StepId) => {
      const stepIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(stepId)
      if (stepIndex >= 0) {
        set({ 
          currentStepInfo: { 
            stepId, 
            status: StepStatus.Idle 
          },
          isAutorunning: false // Stop autorun when manually navigating
        })
      }
    },
    
    nextStep: () => {
      const { currentStepInfo } = get()
      const currentIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(currentStepInfo.stepId)
      const nextIndex = currentIndex + 1
      
      if (nextIndex < ALL_PIPELINE_STEP_IDS_IN_ORDER.length) {
        set({
          currentStepInfo: {
            stepId: ALL_PIPELINE_STEP_IDS_IN_ORDER[nextIndex] as StepId,
            status: StepStatus.Idle
          }
        })
      }
    },
    
    previousStep: () => {
      const { currentStepInfo } = get()
      const currentIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(currentStepInfo.stepId)
      const prevIndex = currentIndex - 1
      
      if (prevIndex >= 0) {
        set({
          currentStepInfo: {
            stepId: ALL_PIPELINE_STEP_IDS_IN_ORDER[prevIndex] as StepId,
            status: StepStatus.Idle
          }
        })
      }
    },
    
    setActiveTranscript: (index: number) => {
      set({ activeTranscriptIndex: index })
    },
    
    setCurrentStepInfo: (info: CurrentStepInfo) => {
      const currentInfo = get().currentStepInfo
      console.log(`🔄 [uiStore] setCurrentStepInfo called`);
      console.log(`- Previous: ${currentInfo.stepId} (${currentInfo.status})`);
      console.log(`- New: ${info.stepId} (${info.status})`);
      if (info.error) console.log(`- Error: ${info.error}`);
      if (info.outputData) console.log(`- Has output data: ${typeof info.outputData} (${typeof info.outputData === 'string' ? info.outputData.length + ' chars' : 'object'})`);
      
      set({ currentStepInfo: info })
    },
    
    toggleAutorun: () => {
      const { isAutorunning } = get();
      get().setAutorunning(!isAutorunning);
    },
    
    setAutorunning: (value: boolean) => {
      if (value) {
        // Starting
        set({ isAutorunning: true, processStartTime: Date.now(), elapsedTime: 0 });
      } else {
        // Stopping/Pausing - trigger resume checkpoint save in pipeline store
        const { processStartTime } = get();
        if (processStartTime) {
          set({ isAutorunning: false, elapsedTime: Math.floor((Date.now() - processStartTime) / 1000), processStartTime: null });
        } else {
          set({ isAutorunning: false });
        }
        
        // Save resume checkpoint when pausing
        // This will be handled by the useAutorunManager effect watching isAutorunning changes
      }
    },
    
    setProcessStartTime: (time: number | null) => {
      set({ processStartTime: time })
    },
    
    updateElapsedTime: () => {
      const { processStartTime } = get()
      if (processStartTime) {
        set({ elapsedTime: Math.floor((Date.now() - processStartTime) / 1000) })
      }
    },
    
    openHilModal: (context: HilContext) => {
      set({ 
        isHilModalOpen: true, 
        hilContext: context,
        hilUserGuidance: '' 
      })
    },

    openHilModalWithContext: () => {
      const { currentStepInfo } = get()
      
      if (currentStepInfo.inputData && (currentStepInfo.outputData || currentStepInfo.error)) {
        const config = STEP_CONFIGS[currentStepInfo.stepId]
        if (config) {
          const originalPrompt = config.generatePrompt(currentStepInfo.inputData)
          const previousResponse = currentStepInfo.outputData ? 
            (typeof currentStepInfo.outputData === 'string' ? 
              currentStepInfo.outputData : 
              JSON.stringify(currentStepInfo.outputData, null, 2)) : 
            (currentStepInfo.error || "No previous response data.")
          
          set({ 
            isHilModalOpen: true,
            hilContext: {
              stepInfo: currentStepInfo,
              originalPrompt,
              previousResponse
            },
            hilUserGuidance: '' 
          })
        }
      }
    },
    
    closeHilModal: () => {
      set({ 
        isHilModalOpen: false, 
        hilContext: null,
        hilUserGuidance: '' 
      })
    },
    
    setHilUserGuidance: (guidance: string) => {
      set({ hilUserGuidance: guidance })
    },
    
    // Retry UI Actions
    setRetrySeedInput: (value: string) => {
      set({ retrySeedInput: value })
    },
    
    // Hydration Actions
    setHasRehydrated: (hasRehydrated: boolean) => {
      set({ hasRehydrated })
    },
    
    setSessionWasRestored: (wasRestored: boolean) => {
      set({ sessionWasRestored: wasRestored })
    },
    
    hideSessionRestoreNotification: () => {
      set({ sessionWasRestored: false })
    },
    
        // Dependency injection
        setFileDropCallback: (callback: (files: File[]) => void) => {
          set({ onFilesDropped: callback })
        },    
    toggleTheme: () => {
      set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light'
        
        // Apply theme to DOM
        if (typeof window !== 'undefined') {
          const root = window.document.documentElement
          const body = window.document.body
          root.classList.remove(state.theme)
          root.classList.add(newTheme)
          body.classList.remove(state.theme)
          body.classList.add(newTheme)
          localStorage.setItem('app-theme', newTheme)
          
          // Reinitialize Mermaid if available
          if ((window as any).reinitializeMermaidTheme) {
            (window as any).reinitializeMermaidTheme()
          }
        }
        
        return { theme: newTheme }
      })
    },
    
    setIsDraggingOver: (isDragging: boolean) => {
      set({ isDraggingOver: isDragging })
    },

    handleDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      set({ isDraggingOver: true })
    },

    handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      set({ isDraggingOver: false })
    },

    handleDrop: (event: React.DragEvent<HTMLDivElement>) => {
          event.preventDefault()
          set({ isDraggingOver: false })
          
          const files = Array.from(event.dataTransfer.files).filter(file => 
            file.name.endsWith('.txt') || file.type === 'text/plain'
          )
          
          if (files.length > 0) {
            // Use callback pattern instead of circular import
            const { onFilesDropped } = get()
            if (onFilesDropped) {
              onFilesDropped(files)
            }
          }
        },
    
    handleHilSubmit: async () => {
      const { hilContext, hilUserGuidance } = get()
      if (!hilContext || !hilUserGuidance.trim()) return
      
      const { stepInfo, originalPrompt } = hilContext
      const config = STEP_CONFIGS[stepInfo.stepId]
      if (config) {
        const metaPrompt = `The original prompt was:
--- ORIGINAL PROMPT START ---
${originalPrompt}
--- ORIGINAL PROMPT END ---

The AI's previous response was problematic. User guidance for correction:
--- USER GUIDANCE START ---
${hilUserGuidance}
--- USER GUIDANCE END ---

Please provide a corrected response addressing the user's feedback.`
        
        // Store the HIL context for the pipeline to process
        // App.tsx will handle the actual pipeline processing
        set({
          hilContext: {
            ...hilContext,
            metaPrompt,
            needsProcessing: true
          }
        })
        
        get().closeHilModal()
      }
    },
    
    resetUIState: () => {
      set({
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
        activeTranscriptIndex: 0,
        isAutorunning: false,
        processStartTime: null,
        elapsedTime: 0,
        isHilModalOpen: false,
        hilContext: null,
        hilUserGuidance: '',
        isDraggingOver: false,
        hasRehydrated: false,
        sessionWasRestored: false
        // Note: theme is not reset
      })
    },
    
    // Selectors
    selectIsAutorunDisabled: (apiKeyPresent: boolean, dvFocusError: string | null, transcriptsLength: number) => {
      const { currentStepInfo } = get()
      
      return !apiKeyPresent || 
        !!dvFocusError || 
        (transcriptsLength === 0 && currentStepInfo.stepId === StepId.IDLE) || 
        currentStepInfo.stepId === StepId.COMPLETE
    },
    
    selectShowRetryUI: () => {
      const { currentStepInfo } = get()
      
      // Show retry UI when there's a JSON parse error
      return currentStepInfo.status === StepStatus.Error && 
             !!currentStepInfo.error?.match(/parse JSON/i)
    }
  }))
)

