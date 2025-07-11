import { getPipelineService } from '../services/pipeline/pipelineServiceFactory'
import { CurrentStepInfo, StepId } from '../../types'
import { useUIStore } from './uiStore'
import { useSettingsStore } from './settingsStore'

/**
 * Hook that provides actions and selectors that span multiple stores
 * This replaces direct usage of pipelineStore facade
 */
export const useStoreActions = () => {
  const service = getPipelineService()
  
  // Get current state for selectors
  const currentStepInfo = useUIStore.getState().currentStepInfo
  const activeTranscriptIndex = useUIStore.getState().activeTranscriptIndex
  const apiKeyPresent = useSettingsStore.getState().apiKeyPresent
  const dvFocusError = useSettingsStore.getState().dvFocusError
  const outputDirectory = useSettingsStore.getState().outputDirectory
  
  return {
    // Navigation selectors
    isPreviousStepDisabled: () => 
      service.isPreviousStepDisabled(currentStepInfo, activeTranscriptIndex),
    
    isNextStepDisabled: () => 
      service.isNextStepDisabled(currentStepInfo, activeTranscriptIndex),
    
    isRunStepDisabled: () => 
      service.isRunStepDisabled(currentStepInfo, apiKeyPresent, dvFocusError),
    
    isHilModalDisabled: () => 
      service.isHilModalDisabled(currentStepInfo),
    
    isDownloadOutputDisabled: () => 
      service.isDownloadOutputDisabled(currentStepInfo),
    
    isDownloadHistoryDisabled: () => 
      service.isDownloadHistoryDisabled(),
    
    isAppendixDataAvailable: () => 
      service.isAppendixDataAvailable(),
    
    // Actions
    processSingleStep: (params: { stepId: StepId }) => 
      service.processSingleStep({
        ...params,
        settings: {
          apiKey: useSettingsStore.getState().apiKey,
          temperature: useSettingsStore.getState().temperature,
          seed: useSettingsStore.getState().seed,
          userDvFocus: useSettingsStore.getState().userDvFocus
        }
      }),
    
    downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string) => 
      service.downloadOutput(stepIdToDownload, transcriptId, undefined, currentStepInfo, outputDirectory),
    
    downloadHistory: (format: 'tsv' | 'json', directory: string) => 
      service.downloadPromptHistory(format, directory),
    
    generateAppendix: (type: 'markdown' | 'html', directory: string) => 
      service.generateAppendix(type, directory),
    
    retryWithUserSeed: () => {
      const retrySeedInput = useUIStore.getState().retrySeedInput
      const settings = {
        apiKey: useSettingsStore.getState().apiKey,
        temperature: useSettingsStore.getState().temperature,
        seed: useSettingsStore.getState().seed,
        userDvFocus: useSettingsStore.getState().userDvFocus
      }
      service.retryWithUserSeed(currentStepInfo, retrySeedInput, settings)
    },
    
    // Complex selectors
    getTranscriptStatusDisplay: (transcriptId: string) => 
      service.getTranscriptStatusDisplay(transcriptId),
    
    loadStepData: (stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string) => 
      service.loadStepData(stepIdToLoad, transcriptId, phaseName, gduId),
    
    handlePipelineStepClick: (stepId: StepId) => {
      const settings = {
        apiKey: useSettingsStore.getState().apiKey,
        temperature: useSettingsStore.getState().temperature,
        seed: useSettingsStore.getState().seed,
        userDvFocus: useSettingsStore.getState().userDvFocus
      }
      return service.handlePipelineStepClick(stepId, settings)
    },
    
    // File operations
    uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => 
      service.uploadTranscripts(event),
    
    handleDroppedFiles: (files: File[]) => 
      service.handleDroppedFiles(files),
    
    saveStateToFile: () => {
      const settings = {
        apiKey: useSettingsStore.getState().apiKey,
        temperature: useSettingsStore.getState().temperature,
        seed: useSettingsStore.getState().seed,
        userDvFocus: useSettingsStore.getState().userDvFocus
      }
      const savedState = service.getSaveState(activeTranscriptIndex, currentStepInfo, settings)
      service.saveStateToFile(savedState, `upath-session-${Date.now()}.json`)
    },
    
    loadStateFromFile: async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return
      
      try {
        const savedState = await service.loadStateFromFile(files[0])
        service.loadState(savedState)
        event.target.value = ''
        alert('State loaded successfully!')
      } catch (error) {
        console.error('Failed to load state:', error)
        alert('Failed to load state file. Please check the file format.')
      }
    },
    
    // State management
    resetPipeline: () => service.resetPipeline(),
    
    clearAutosaveData: () => service.clearAutosaveData()
  }
}