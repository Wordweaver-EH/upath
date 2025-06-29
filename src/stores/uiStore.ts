import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { StepId, StepStatus, CurrentStepInfo, HilContext } from '../../types'
import { ALL_PIPELINE_STEP_IDS_IN_ORDER } from '../../constants'

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
  
  // UI State
  theme: 'light' | 'dark'
  isDraggingOver: boolean
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
  closeHilModal: () => void
  setHilUserGuidance: (guidance: string) => void
  
  // UI State
  toggleTheme: () => void
  setIsDraggingOver: (isDragging: boolean) => void
  
  // Utils
  resetUIState: () => void
}

type UIStore = UIState & UIActions

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
    theme: getInitialTheme(),
    isDraggingOver: false,
    
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
      set({ currentStepInfo: info })
    },
    
    toggleAutorun: () => {
      const isAutorunning = !get().isAutorunning
      set({ 
        isAutorunning,
        processStartTime: isAutorunning ? Date.now() : get().processStartTime
      })
      
      // Pipeline processing will be triggered by the component listening to this state change
    },
    
    setAutorunning: (value: boolean) => {
      set({ 
        isAutorunning: value,
        processStartTime: value ? Date.now() : get().processStartTime
      })
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
        isDraggingOver: false
        // Note: theme is not reset
      })
    }
  }))
)

// Set up elapsed time interval
if (typeof window !== 'undefined') {
  let interval: NodeJS.Timeout | null = null
  
  useUIStore.subscribe(
    (state) => ({ isAutorunning: state.isAutorunning, processStartTime: state.processStartTime }),
    ({ isAutorunning, processStartTime }) => {
      if (isAutorunning && processStartTime) {
        if (interval) clearInterval(interval)
        interval = setInterval(() => {
          useUIStore.getState().updateElapsedTime()
        }, 1000)
      } else {
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      }
    }
  )
}