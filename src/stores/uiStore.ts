import { create } from 'zustand'
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
  
  // Retry UI
  setRetrySeedInput: (value: string) => void
  
  // UI State
  toggleTheme: () => void
  setIsDraggingOver: (isDragging: boolean) => void
  
  // Dependency injection
  setFileDropCallback: (callback: (files: File[]) => void) => void
  
  // Utils
  resetUIState: () => void
}


interface UISelectors {
  // Derived state selectors
  isAutorunDisabled: () => boolean
  getStepStatusForPipelineView: (stepId: StepId) => { status: StepStatus; error?: string }
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
    },
    
    // Selectors
    isAutorunDisabled: () => {
      const { currentStepInfo } = get()
      
      // Basic UI-level checks - pipeline-specific checks moved to component level
      return currentStepInfo.stepId === StepId.COMPLETE
    },

    getStepStatusForPipelineView: (stepId: StepId): { status: StepStatus; error?: string } => {
      // This function needs access to other stores, so it will use the store pattern
      // We'll access other stores through their state getters
      const { usePipelineStore } = require('./index')
      const { currentStepInfo, activeTranscriptIndex } = get()
      
      const { 
        rawTranscripts, 
        processedData, 
        genericAnalysisState 
      } = usePipelineStore.getState()
      
      const isStepGlobal = isGlobalStep(stepId)
      let status = StepStatus.Idle
      let error: string | undefined

      if (isStepGlobal) {
        if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
          if (genericAnalysisState.isFullyProcessedGenericSynchronic) status = StepStatus.Success
          else if ((genericAnalysisState.processed_gdus_for_p4s?.length || 0) > 0) status = StepStatus.Loading
          
          // Check for specific P4S_A or P4S_B error
          if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_error) {
            error = genericAnalysisState.p4s_1_a_error
          }
          if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.p4s_1_b_error) {
            error = genericAnalysisState.p4s_1_b_error
          }
        } else {
          const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof typeof genericAnalysisState
          if (genericAnalysisState[keyPrefix]) status = StepStatus.Success
          error = genericAnalysisState[`${String(keyPrefix).replace('_output', '_error')}` as keyof typeof genericAnalysisState] as string | undefined
          if (error) status = StepStatus.Error
        }
      } else {
        const currentTId = rawTranscripts[activeTranscriptIndex]?.id
        if (currentTId) {
          const tData = processedData.get(currentTId)
          if (tData) {
            const { STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC } = require('../../constants')
            if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
              if (tData.isFullyProcessedSpecificSynchronic) status = StepStatus.Success
              else if ((tData.processed_phases_for_p2s?.length || 0) > 0) status = StepStatus.Loading
              if (currentStepInfo.stepId === stepId && currentStepInfo.transcriptId === currentTId && currentStepInfo.error) {
                error = currentStepInfo.error
              }
            } else {
              const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof typeof tData
              if (tData[keyPrefix]) status = StepStatus.Success
              error = tData[`${String(keyPrefix).replace('_output', '_error')}` as keyof typeof tData] as string | undefined
              if (error) status = StepStatus.Error
            }
          }
        }
      }

      if (currentStepInfo.stepId === stepId) {
        if (isStepGlobal || currentStepInfo.transcriptId === rawTranscripts[activeTranscriptIndex]?.id) {
          if (currentStepInfo.status === StepStatus.Loading) status = StepStatus.Loading
          else if (currentStepInfo.status === StepStatus.Error) { 
            status = StepStatus.Error
            error = currentStepInfo.error
          }
          else if (currentStepInfo.status === StepStatus.Success) status = StepStatus.Success
        }
      }

      return { status, error }
    }
  }))
)

