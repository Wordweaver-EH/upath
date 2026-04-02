import {
  SavedState,
  GenericAnalysisState,
  CurrentStepInfo,
  StepId,
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  PromptHistoryEntry,
  UserDVFocus
} from '../../../types'
import { localForageStorage } from '../../utils/storage'

// Interface for store dependencies
export interface StateManagementDependencies {
  // Transcript store operations
  transcriptStore: {
    reset: () => void
    addTranscriptsSync: (transcripts: RawTranscript[]) => void
    updateProcessedData: (id: string, data: TranscriptProcessedData) => void
    getState: () => {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    }
  }

  // Analysis result store operations
  analysisResultStore: {
    updateGenericState: (updates: Partial<GenericAnalysisState>) => void
    getState: () => {
      genericAnalysisState: GenericAnalysisState
    }
  }

  // Prompt history store operations
  promptHistoryStore: {
    reset: () => void
    addPromptEntry: (entry: PromptHistoryEntry) => void
    getState: () => {
      promptHistory: PromptHistoryEntry[]
      totalInputTokens: number
      totalOutputTokens: number
    }
  }

  // Pipeline orchestration store operations
  orchestrationStore: {
    setCurrentStepInfo: (info: CurrentStepInfo) => void
    setActiveTranscriptIndex: (index: number) => void
    setShouldStopAutorun: (value: boolean) => void
    getState: () => {
      currentStepInfo: CurrentStepInfo
      activeTranscriptIndex: number
    }
  }

  // UI store operations (for syncing visible state after loadState/reset)
  uiStore: {
    setCurrentStepInfo: (info: CurrentStepInfo) => void
    setActiveTranscript: (index: number) => void
  }

  // Settings store operations
  settingsStore: {
    updateSettings: (updates: {
      userDvFocus?: UserDVFocus
      dvFocusInput?: string
      temperature?: number
      seedInput?: string
      seed?: number
      outputDirectory?: string
      autoDownloadResults?: boolean
    }) => void
    getState: () => {
      userDvFocus: UserDVFocus
      dvFocusInput: string
      temperature: number
      seedInput: string
      seed: number | undefined
      outputDirectory: string
      autoDownloadResults: boolean
    }
  }
}

export interface IPipelineStateManagementService {
  loadState(savedState: SavedState): void
  getSaveState(): SavedState
  resetPipeline(): void
  clearAutosaveData(): Promise<void>
}

export class PipelineStateManagementService implements IPipelineStateManagementService {
  constructor(private dependencies: StateManagementDependencies) {}

  /**
   * Load a saved state into all stores
   */
  loadState(savedState: SavedState): void {
    const { transcriptStore, analysisResultStore, promptHistoryStore, orchestrationStore, settingsStore } = this.dependencies

    // Load transcript data
    transcriptStore.reset()
    transcriptStore.addTranscriptsSync(savedState.rawTranscripts)

    // Restore processed data entries (Map revived from Array<[string, data]>)
    savedState.processedDataArray.forEach(([id, data]) => {
      transcriptStore.updateProcessedData(id, data)
    })

    // Load generic analysis state
    analysisResultStore.updateGenericState(savedState.genericAnalysisState)

    // Load prompt history
    promptHistoryStore.reset()
    savedState.promptHistory.forEach(entry => {
      promptHistoryStore.addPromptEntry(entry)
    })

    // Restore settings from saved state
    settingsStore.updateSettings({
      userDvFocus: savedState.userDvFocus,
      dvFocusInput: savedState.dvFocusInput,
      temperature: savedState.temperature,
      seedInput: savedState.seedInput,
      outputDirectory: savedState.outputDirectory,
      autoDownloadResults: savedState.autoDownloadResults
    })

    // Restore UI state (currentStepInfo and activeTranscriptIndex)
    orchestrationStore.setCurrentStepInfo(savedState.currentStepInfo)
    orchestrationStore.setActiveTranscriptIndex(savedState.activeTranscriptIndex)

    // Sync uiStore so the visible UI reflects the loaded position
    this.dependencies.uiStore.setCurrentStepInfo(savedState.currentStepInfo)
    this.dependencies.uiStore.setActiveTranscript(savedState.activeTranscriptIndex)
  }

  /**
   * Get current state from all stores for saving
   */
  getSaveState(): SavedState {
    const { transcriptStore, analysisResultStore, promptHistoryStore, orchestrationStore, settingsStore } = this.dependencies

    // Get state from all stores
    const transcriptState = transcriptStore.getState()
    const analysisState = analysisResultStore.getState()
    const historyState = promptHistoryStore.getState()
    const orchestrationState = orchestrationStore.getState()
    const settings = settingsStore.getState()

    return {
      version: '1.0',
      rawTranscripts: transcriptState.rawTranscripts,
      processedDataArray: Array.from(transcriptState.processedData.entries()),
      genericAnalysisState: analysisState.genericAnalysisState,
      promptHistory: historyState.promptHistory,
      activeTranscriptIndex: orchestrationState.activeTranscriptIndex,
      currentStepInfo: orchestrationState.currentStepInfo,
      totalInputTokens: historyState.totalInputTokens,
      totalOutputTokens: historyState.totalOutputTokens,
      userDvFocus: settings.userDvFocus,
      dvFocusInput: settings.dvFocusInput,
      temperature: settings.temperature,
      seedInput: settings.seedInput,
      outputDirectory: settings.outputDirectory,
      autoDownloadResults: settings.autoDownloadResults,
      elapsedTime: 0  // Transient: not tracked across saves
    }
  }
  
  /**
   * Reset all pipeline-related state
   */
  resetPipeline(): void {
    const { transcriptStore, analysisResultStore, promptHistoryStore, orchestrationStore, uiStore } = this.dependencies
    
    // Reset transcript store
    transcriptStore.reset()
    
    // Reset analysis state to initial values
    analysisResultStore.updateGenericState({
      p3_1_output: undefined,
      p3_1_error: undefined,
      p3_2_output: undefined,
      p3_2_error: undefined,
      p3_3_output: undefined,
      p3_3_error: undefined,
      p3_3_mermaid_syntax: undefined,
      isFullyProcessedGenericDiachronic: false,
      core_gdus_for_sync_analysis: [],
      processed_gdus_for_p4s: [],
      current_gdu_for_p4s_processing: undefined,
      p4s_outputs_by_gdu: {},
      p4s_mermaid_syntax_by_gdu: {},
      p4s_1_a_outputs_by_gdu: {},
      p4s_1_a_error: undefined,
      p4s_1_b_error: undefined,
      isFullyProcessedGenericSynchronic: false,
      p5_1_output: undefined,
      p5_1_error: undefined,
      p5_2_output: undefined,
      p5_2_error: undefined,
      p5_3_output: undefined,
      p5_3_error: undefined,
      p5_3_mermaid_syntax: undefined,
      p6_1_output: undefined,
      p6_1_error: undefined,
      p7_1_output: undefined,
      p7_1_error: undefined,
      p7_1_mermaid_syntax: undefined
    })
    
    // Reset prompt history
    promptHistoryStore.reset()
    
    // Signal UI state reset
    orchestrationStore.setCurrentStepInfo({
      stepId: StepId.IDLE,
      status: StepStatus.Idle
    })
    orchestrationStore.setShouldStopAutorun(true)

    // Sync uiStore so the visible UI reflects the reset position
    uiStore.setCurrentStepInfo({ stepId: StepId.IDLE, status: StepStatus.Idle })
  }
  
  /**
   * Reset only the prompt history
   */
  resetPromptHistoryOnly(): void {
    this.dependencies.promptHistoryStore.reset()
  }
  
  /**
   * Clear autosave data from local storage
   */
  async clearAutosaveData(): Promise<void> {
    try {
      await localForageStorage.removeItem('upath-autosave-session-v2-localforage')
      console.log('Autosave data cleared')
    } catch (error) {
      console.error('Failed to clear autosave data:', error)
      throw error
    }
  }
}