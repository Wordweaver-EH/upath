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
    processSingleStep: async (params: { stepId: StepId }) => {
      const settingsState = useSettingsStore.getState();
      const result = await service.processSingleStep({
        ...params,
        settings: {
          apiKey: settingsState.apiKey,
          model: settingsState.model,
          temperature: settingsState.temperature,
          seed: settingsState.seed,
          userDvFocus: settingsState.userDvFocus,
          bucketingEnabled: settingsState.bucketingEnabled,
          bucketIvField: settingsState.bucketIvField,
          bucketEventField: settingsState.bucketEventField
        }
      });

      // Check if we should show bucketing modal
      if (result.shouldOfferBucketing) {
        useUIStore.getState().openBucketingModal();
      }

      return result;
    },
    
    downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string) => 
      service.downloadOutput(stepIdToDownload, transcriptId, undefined, currentStepInfo, outputDirectory),
    
    downloadHistory: (format: 'tsv' | 'json', directory: string) => 
      service.downloadPromptHistory(format, directory),
    
    generateAppendix: (type: 'markdown' | 'html', directory: string) => 
      service.generateAppendix(type, directory),
    
    retryWithUserSeed: () => {
      const retrySeedInput = useUIStore.getState().retrySeedInput
      const settingsState = useSettingsStore.getState();
      const settings = {
        apiKey: settingsState.apiKey,
        model: settingsState.model,
        temperature: settingsState.temperature,
        seed: settingsState.seed,
        userDvFocus: settingsState.userDvFocus,
        bucketingEnabled: settingsState.bucketingEnabled,
        bucketIvField: settingsState.bucketIvField,
        bucketEventField: settingsState.bucketEventField
      }
      service.retryWithUserSeed(currentStepInfo, retrySeedInput, settings)
    },
    
    // Complex selectors
    getTranscriptStatusDisplay: (transcriptId: string) => 
      service.getTranscriptStatusDisplay(transcriptId),
    
    loadStepData: (stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string) => 
      service.loadStepData(stepIdToLoad, transcriptId, phaseName, gduId),
    
    handlePipelineStepClick: (stepId: StepId) => {
      const settingsState = useSettingsStore.getState();
      const settings = {
        apiKey: settingsState.apiKey,
        model: settingsState.model,
        temperature: settingsState.temperature,
        seed: settingsState.seed,
        userDvFocus: settingsState.userDvFocus,
        bucketingEnabled: settingsState.bucketingEnabled,
        bucketIvField: settingsState.bucketIvField,
        bucketEventField: settingsState.bucketEventField
      }
      return service.handlePipelineStepClick(stepId, settings)
    },
    
    // File operations
    uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => 
      service.uploadTranscripts(event),
    
    handleDroppedFiles: (files: File[]) => 
      service.handleDroppedFiles(files),
    
    saveStateToFile: async () => {
      try {
        const settings = {
          apiKey: useSettingsStore.getState().apiKey,
          temperature: useSettingsStore.getState().temperature,
          seed: useSettingsStore.getState().seed,
          userDvFocus: useSettingsStore.getState().userDvFocus
        }
        const savedState = service.getSaveState(activeTranscriptIndex, currentStepInfo, settings)
        await service.saveStateToFile(savedState, `upath-session-${Date.now()}.json`)
        alert('Backend session saved successfully!')
      } catch (error) {
        console.error('Failed to save backend state:', error)
        alert('Failed to save backend session state.')
      }
    },
    
    loadStateFromFile: async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return
      
      try {
        const savedState = await service.loadStateFromFile(files[0])
        service.loadState(savedState)
        event.target.value = ''
        alert('Backend session restored successfully!')
      } catch (error) {
        console.error('Failed to load backend state:', error)
        alert('Failed to restore backend session. Please check the file format.')
      }
    },
    
    // State management
    resetPipeline: () => service.resetPipeline(),
    
    clearAutosaveData: () => service.clearAutosaveData()
  }
}