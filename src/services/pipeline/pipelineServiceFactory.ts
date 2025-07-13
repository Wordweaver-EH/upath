import { PipelineService } from './PipelineService'
import { LangGraphPipelineService } from './LangGraphPipelineService'
import { pipelineBackendToggle } from './pipelineBackendToggle'
import { useTranscriptStore } from '../../stores/transcriptStore'
import { useAnalysisResultStore } from '../../stores/analysisResultStore'
import { usePromptHistoryStore } from '../../stores/promptHistoryStore'
import { usePipelineOrchestrationStore } from '../../stores/pipelineOrchestrationStore'

// Create pipeline service with all dependencies
export const createPipelineService = () => {
  return new PipelineService({
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
      // This is a fallback - settings should be passed via processSingleStep params
      console.warn('[PipelineService] Using fallback settings - apiKey will be empty. Settings should be passed via processSingleStep params.')
      return {
        apiKey: '', 
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: [] }
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
    
    // Transcript store operations
    addTranscripts: async (files) => await useTranscriptStore.getState().addTranscripts(files),
    addTranscriptsSync: (transcripts) => useTranscriptStore.getState().addTranscriptsSync(transcripts),
    resetTranscripts: () => useTranscriptStore.getState().reset(),
    
    // Prompt history operations
    resetPromptHistory: () => usePromptHistoryStore.getState().reset(),
    
    // Analysis result operations
    resetAnalysisState: () => useAnalysisResultStore.getState().reset(),
    
    // Orchestration operations
    resetOrchestrationState: () => usePipelineOrchestrationStore.getState().reset()
  })
}

// Single instance of pipeline service
let pipelineService: PipelineService | LangGraphPipelineService | null = null

// UI callbacks that can be injected for testing
let uiCallbacks: {
  setCurrentStepInfo?: (info: any) => void
  setAutorunning?: (value: boolean) => void
} = {}

/**
 * Create LangGraph-enabled pipeline service
 */
export const createLangGraphPipelineService = () => {
  return new LangGraphPipelineService({
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
      // This is a fallback - settings should be passed via processSingleStep params
      console.warn('[LangGraphPipelineService] Using fallback settings - apiKey will be empty. Settings should be passed via processSingleStep params.')
      return {
        apiKey: '', 
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: [] }
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
    
    // Transcript store operations
    addTranscripts: async (files) => await useTranscriptStore.getState().addTranscripts(files),
    addTranscriptsSync: (transcripts) => useTranscriptStore.getState().addTranscriptsSync(transcripts),
    
    // Reset operations
    resetTranscripts: () => useTranscriptStore.getState().reset(),
    resetPromptHistory: () => usePromptHistoryStore.getState().reset(),
    resetAnalysisState: () => useAnalysisResultStore.getState().reset(),
    resetOrchestrationState: () => usePipelineOrchestrationStore.getState().reset()
  })
}

export const getPipelineService = () => {
  if (!pipelineService) {
    const useLangGraph = pipelineBackendToggle.isLangGraphBackendEnabled();
    
    if (useLangGraph) {
      console.log('🚀 [PipelineServiceFactory] Creating LangGraph-enabled pipeline service');
      pipelineService = createLangGraphPipelineService()
    } else {
      console.log('🔧 [PipelineServiceFactory] Creating traditional pipeline service');
      pipelineService = createPipelineService()
    }
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