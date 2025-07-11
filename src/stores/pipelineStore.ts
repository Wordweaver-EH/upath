import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { localForageStorage } from '../utils/storage'
import { performDataMigration } from '../utils/migration'
import { useAnalysisResultStore } from './analysisResultStore'
import { usePromptHistoryStore } from './promptHistoryStore'
import { useTranscriptStore } from './transcriptStore'
import { usePipelineOrchestrationStore } from './pipelineOrchestrationStore'
import { getPipelineService, resetPipelineService, setUICallbacks } from '../services/pipeline/pipelineServiceFactory'
import { 
  StepId,
  StepStatus,
  CurrentStepInfo,
  SavedState,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  PromptHistoryEntry
} from '../../types'

interface SettingsData {
  apiKey: string
  temperature: number
  seed?: number
  userDvFocus: { dv_focus: string[] }
}

interface PipelineStore {
  // All operations delegate to PipelineService
  processSingleStep: (params: any) => Promise<void>
  getNextStepDetails: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => any
  processNextStep: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => any
  orchestrateInvalidation: (stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string) => void
  invalidateStateFromStep: (stepId: StepId, transcriptId?: string, activeTranscriptIndex?: number, transcriptData?: any) => void
  loadState: (savedState: SavedState) => void
  getSaveState: (activeTranscriptIndex: number, currentStepInfo: CurrentStepInfo, settings: any) => SavedState
  resetPipeline: () => void
  resetPromptHistoryOnly: () => void
  clearAutosaveData: () => Promise<void>
  getTranscriptStatusDisplay: (transcriptId: string) => string
  loadStepData: (stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string) => any
  getStepStatusForPipelineView: (stepId: StepId, uiState?: any) => any
  handlePipelineStepClick: (stepId: StepId, settings: SettingsData) => any
  uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleDroppedFiles: (files: File[]) => Promise<void>
  saveStateToFile: (activeTranscriptIndex: number, currentStepInfo: CurrentStepInfo, settings: SettingsData) => void
  loadStateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any, currentStepInfo?: CurrentStepInfo, outputDirectory?: string) => void
  downloadHistory: (format: 'tsv' | 'json', outputDirectory: string) => void
  generateAppendix: (type: 'markdown' | 'html', outputDirectory: string) => void
  isGlobalStep: (stepId: StepId) => boolean
  retryWithUserSeed: (currentStepInfo: CurrentStepInfo, retrySeedInput: string) => void
  getPreviousStepDetails: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => any
  isPreviousStepDisabled: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => boolean
  isNextStepDisabled: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => boolean
  isRunStepDisabled: (currentStepInfo: CurrentStepInfo, apiKeyPresent: boolean, dvFocusError?: string) => boolean
  isHilModalDisabled: (currentStepInfo: CurrentStepInfo) => boolean
  isDownloadOutputDisabled: (currentStepInfo: CurrentStepInfo) => boolean
  isDownloadHistoryDisabled: () => boolean
  isAppendixDataAvailable: () => boolean
}

// Extended interface for backward compatibility
interface PipelineStoreWithCompat extends PipelineStore {
  // Compatibility getters for data that has moved to other stores
  rawTranscripts: RawTranscript[]
  processedData: Map<string, TranscriptProcessedData>
  genericAnalysisState: GenericAnalysisState
  promptHistory: PromptHistoryEntry[]
  totalInputTokens: number
  totalOutputTokens: number
  lastStepInfo?: CurrentStepInfo
  
  // UI callback injection for circular dependency resolution
  setUICallbacks: (callbacks: { setAutorunning: (value: boolean) => void; setCurrentStepInfo: (info: CurrentStepInfo) => void }) => void
  uiCallbacks?: { setAutorunning: (value: boolean) => void; setCurrentStepInfo: (info: CurrentStepInfo) => void }
  
  // Legacy methods that now delegate to other stores
  clearShouldStopAutorunFlag: () => void
  clearLastHilContext: () => void
}

export const usePipelineStore = create<PipelineStoreWithCompat>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Compatibility getters - these delegate to the actual stores
        get rawTranscripts() {
          return useTranscriptStore.getState().rawTranscripts
        },
        get processedData() {
          return useTranscriptStore.getState().processedData
        },
        get genericAnalysisState() {
          return useAnalysisResultStore.getState().genericAnalysisState
        },
        get promptHistory() {
          return usePromptHistoryStore.getState().promptHistory
        },
        get totalInputTokens() {
          return usePromptHistoryStore.getState().totalInputTokens
        },
        get totalOutputTokens() {
          return usePromptHistoryStore.getState().totalOutputTokens
        },
        get lastStepInfo() {
          return usePipelineOrchestrationStore.getState().currentStepInfo
        },
        
        // UI callback injection
        setUICallbacks: (callbacks) => {
          // Use the factory's setUICallbacks instead of storing locally
          setUICallbacks(callbacks)
          set((state) => {
            state.uiCallbacks = callbacks
          })
        },
        
        uiCallbacks: undefined,
        
        // Legacy methods that delegate to other stores
        clearShouldStopAutorunFlag: () => {
          usePipelineOrchestrationStore.getState().clearShouldStopAutorun()
        },
        
        clearLastHilContext: () => {
          usePipelineOrchestrationStore.getState().clearHilContext()
        },
        
        // All methods simply delegate to PipelineService
        processSingleStep: async (params) => {
          const service = getPipelineService()
          await service.processSingleStep(params)
        },
        
        getNextStepDetails: (currentStepInfo, activeTranscriptIndex) => {
          const service = getPipelineService()
          return service.getNextStepDetails(currentStepInfo, activeTranscriptIndex)
        },
        
        processNextStep: (currentStepInfo, activeTranscriptIndex) => {
          const service = getPipelineService()
          return service.processNextStep(currentStepInfo, activeTranscriptIndex)
        },
        
        orchestrateInvalidation: (stepId, transcriptId, phaseId, gduId) => {
          const service = getPipelineService()
          service.orchestrateInvalidation(stepId, transcriptId, phaseId, gduId)
        },
        
        invalidateStateFromStep: (stepId, transcriptId, activeTranscriptIndex, transcriptData) => {
          const service = getPipelineService()
          // This is a compatibility wrapper for the test that expects invalidateStateFromStep
          service.orchestrateInvalidation(stepId, transcriptId)
        },
        
        loadState: (savedState) => {
          const service = getPipelineService()
          service.loadState(savedState)
        },
        
        getSaveState: (activeTranscriptIndex, currentStepInfo, settings) => {
          const service = getPipelineService()
          return service.getSaveState(activeTranscriptIndex, currentStepInfo, settings)
        },
        
        resetPipeline: () => {
          resetPipelineService()
          const service = getPipelineService()
          service.resetPipeline()
        },
        
        resetPromptHistoryOnly: () => {
          const service = getPipelineService()
          service.resetPromptHistoryOnly()
        },
        
        clearAutosaveData: async () => {
          const service = getPipelineService()
          await service.clearAutosaveData()
        },
        
        getTranscriptStatusDisplay: (transcriptId) => {
          const service = getPipelineService()
          return service.getTranscriptStatusDisplay(transcriptId)
        },
        
        loadStepData: (stepIdToLoad, transcriptId, phaseName, gduId) => {
          const service = getPipelineService()
          return service.loadStepData(stepIdToLoad, transcriptId, phaseName, gduId)
        },
        
        getStepStatusForPipelineView: (stepId, uiState) => {
          const service = getPipelineService()
          return service.getStepStatusForPipelineView(stepId, uiState)
        },
        
        handlePipelineStepClick: (stepId, settings) => {
          const service = getPipelineService()
          return service.handlePipelineStepClick(stepId, settings)
        },
        
        uploadTranscripts: async (event) => {
          const service = getPipelineService()
          await service.uploadTranscripts(event)
        },
        
        handleDroppedFiles: async (files) => {
          const service = getPipelineService()
          await service.handleDroppedFiles(files)
        },
        
        saveStateToFile: (activeTranscriptIndex, currentStepInfo, settings) => {
          const service = getPipelineService()
          const savedState = service.getSaveState(activeTranscriptIndex, currentStepInfo, settings)
          service.saveStateToFile(savedState, `upath-session-${Date.now()}.json`)
        },
        
        loadStateFromFile: async (event) => {
          const service = getPipelineService()
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
        
        downloadOutput: (stepIdToDownload, transcriptId, dataToDownload, currentStepInfo, outputDirectory) => {
          const service = getPipelineService()
          service.downloadOutput(stepIdToDownload, transcriptId, dataToDownload, currentStepInfo, outputDirectory)
        },
        
        downloadHistory: (format, outputDirectory) => {
          const service = getPipelineService()
          service.downloadPromptHistory(format, outputDirectory)
        },
        
        generateAppendix: (type, outputDirectory) => {
          const service = getPipelineService()
          service.generateAppendix(type, outputDirectory)
        },
        
        isGlobalStep: (stepId) => {
          const service = getPipelineService()
          return service.isGlobalStep(stepId)
        },
        
        retryWithUserSeed: (currentStepInfo, retrySeedInput) => {
          const service = getPipelineService()
          const settings = {
            apiKey: '',
            temperature: 0.7,
            seed: undefined,
            userDvFocus: { dv_focus: [] }
          }
          service.retryWithUserSeed(currentStepInfo, retrySeedInput, settings)
        },
        
        getPreviousStepDetails: (currentStepInfo, activeTranscriptIndex) => {
          const service = getPipelineService()
          return service.getPreviousStepDetails(currentStepInfo, activeTranscriptIndex)
        },
        
        isPreviousStepDisabled: (currentStepInfo, activeTranscriptIndex) => {
          const service = getPipelineService()
          return service.isPreviousStepDisabled(currentStepInfo, activeTranscriptIndex)
        },
        
        isNextStepDisabled: (currentStepInfo, activeTranscriptIndex) => {
          const service = getPipelineService()
          return service.isNextStepDisabled(currentStepInfo, activeTranscriptIndex)
        },
        
        isRunStepDisabled: (currentStepInfo, apiKeyPresent, dvFocusError) => {
          const service = getPipelineService()
          return service.isRunStepDisabled(currentStepInfo, apiKeyPresent, dvFocusError)
        },
        
        isHilModalDisabled: (currentStepInfo) => {
          const service = getPipelineService()
          return service.isHilModalDisabled(currentStepInfo)
        },
        
        isDownloadOutputDisabled: (currentStepInfo) => {
          const service = getPipelineService()
          return service.isDownloadOutputDisabled(currentStepInfo)
        },
        
        isDownloadHistoryDisabled: () => {
          const service = getPipelineService()
          return service.isDownloadHistoryDisabled()
        },
        
        isAppendixDataAvailable: () => {
          const service = getPipelineService()
          return service.isAppendixDataAvailable()
        }
      })),
      {
        name: 'upath-autosave-session-v2-localforage',
        storage: {
          getItem: async (name) => {
            const str = await localForageStorage.getItem(name)
            if (!str) return null
            
            try {
              const data = JSON.parse(str)
              return data
            } catch (e) {
              console.error('Failed to parse stored data:', e)
              return null
            }
          },
          setItem: async (name, value) => {
            await localForageStorage.setItem(name, JSON.stringify(value))
          },
          removeItem: async (name) => await localForageStorage.removeItem(name)
        },
        onRehydrateStorage: () => (state, error) => {
          // Rehydration handled by other stores
        },
        partialize: (state) => {
          // All state is now in other stores, so nothing to persist here
          return undefined
        }
      }
    )
  )
)

// Perform data migration on app startup
if (typeof window !== 'undefined') {
  performDataMigration().catch(error => {
    console.error('Failed to perform data migration:', error)
  })
}