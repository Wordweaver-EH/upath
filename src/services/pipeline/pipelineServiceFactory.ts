import { ModularPipelineService } from './ModularPipelineService'
import { useTranscriptStore } from '../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../stores/analysisResultStore'
import { usePromptHistoryStore } from '../../stores/promptHistoryStore'
import { usePipelineOrchestrationStore } from '../../stores/pipelineOrchestrationStore'
import { useSettingsStore } from '../../stores/settingsStore'

// Single instance of pipeline service
let pipelineService: ModularPipelineService | null = null

// UI callbacks that can be injected for testing
let uiCallbacks: {
  setCurrentStepInfo?: (info: any) => void
  setAutorunning?: (value: boolean) => void
} = {}

/**
 * Create Modular Pipeline service
 */
export const createModularPipelineService = () => {
  return new ModularPipelineService({
    // Store getters
    getTranscriptData: () => {
      const state = useTranscriptStore.getState()
      return {
        rawTranscripts: state.rawTranscripts,
        processedData: state.processedData
      }
    },
    getGenericAnalysisState: () => useAnalysisResultStore.getState().genericAnalysisState,
    getPromptHistory: () => usePromptHistoryStore.getState().promptHistory,
    getCurrentStepInfo: () => usePipelineOrchestrationStore.getState().currentStepInfo,
    getActiveTranscriptIndex: () => usePipelineOrchestrationStore.getState().activeTranscriptIndex || 0,
    getSettings: () => {
      const settingsState = useSettingsStore.getState()
      return {
        apiKey: '', 
        model: settingsState.model || 'gemini-2.5-flash',
        temperature: settingsState.temperature || 0,
        seed: settingsState.seed,
        userDvFocus: settingsState.userDvFocus || { dv_focus: [] }
      }
    },
    
    // Store setters
    updateTranscriptData: (id, data) => useTranscriptStore.getState().updateProcessedData(id, data),
    replaceProcessedData: (id, data) => useTranscriptStore.getState().replaceProcessedData(id, data),
    updateGenericState: (updates) => useAnalysisResultStore.getState().updateGenericState(updates),
    addPromptEntry: (entry) => usePromptHistoryStore.getState().addPromptEntry(entry),
    setCurrentStepInfo: (info) => {
      if (uiCallbacks.setCurrentStepInfo) {
        uiCallbacks.setCurrentStepInfo(info)
      } else {
        usePipelineOrchestrationStore.getState().setCurrentStepInfo(info)
      }
    },
    setAutorunning: (value) => {
      if (uiCallbacks.setAutorunning) {
        uiCallbacks.setAutorunning(value)
      } else {
        usePipelineOrchestrationStore.getState().setAutorunning(value)
      }
    },
    
    // File operations
    addTranscripts: async (files) => await useTranscriptStore.getState().addTranscripts(files),
    
    // Reset operations
    resetTranscripts: () => useTranscriptStore.getState().reset(),
    resetPromptHistory: () => usePromptHistoryStore.getState().reset(),
    resetAnalysisState: () => useAnalysisResultStore.getState().reset(),
    resetOrchestrationState: () => usePipelineOrchestrationStore.getState().reset()
  })
}

export const getPipelineService = () => {
  if (!pipelineService) {
    console.log('🎯 [PipelineServiceFactory] Creating modular pipeline service');
    pipelineService = createModularPipelineService()
  }
  return pipelineService
}

// Reset the pipeline service singleton
export const resetPipelineService = () => {
  pipelineService = null
}

// Set UI callbacks for testing
export const setUICallbacks = (callbacks: {
  setCurrentStepInfo?: (info: any) => void
  setAutorunning?: (value: boolean) => void
}) => {
  uiCallbacks = callbacks
}