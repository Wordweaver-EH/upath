import { 
  SavedState, 
  GenericAnalysisState,
  CurrentStepInfo,
  StepId,
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  PromptHistoryEntry
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
    setShouldStopAutorun: (value: boolean) => void
  }
}

export interface IPipelineStateManagementService {
  loadState(savedState: SavedState): void
  getSaveState(
    activeTranscriptIndex: number,
    currentStepInfo: CurrentStepInfo,
    settings: {
      userDvFocus: string
      temperature: number
      seed: number
    }
  ): SavedState
  resetPipeline(): void
  clearAutosaveData(): Promise<void>
}

export class PipelineStateManagementService implements IPipelineStateManagementService {
  constructor(private dependencies: StateManagementDependencies) {}
  
  /**
   * Load a saved state into all stores
   */
  loadState(savedState: SavedState): void {
    const { transcriptStore, analysisResultStore, promptHistoryStore } = this.dependencies
    
    // Load transcript data
    transcriptStore.reset()
    transcriptStore.addTranscriptsSync(savedState.rawTranscripts)
    
    // Restore processed data entries
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
    
    // Note: UI state (currentStepInfo) is not restored from saved state
    // The caller should handle UI state updates if needed
  }
  
  /**
   * Get current state from all stores for saving
   */
  getSaveState(
    activeTranscriptIndex: number,
    currentStepInfo: CurrentStepInfo,
    settings: {
      userDvFocus: string
      temperature: number
      seed: number
    }
  ): SavedState {
    const { transcriptStore, analysisResultStore, promptHistoryStore } = this.dependencies
    
    // Get state from all stores
    const transcriptState = transcriptStore.getState()
    const analysisState = analysisResultStore.getState()
    const historyState = promptHistoryStore.getState()
    
    return {
      version: '1.0',
      savedAt: new Date().toISOString(),
      rawTranscripts: transcriptState.rawTranscripts,
      processedDataArray: Array.from(transcriptState.processedData.entries()),
      genericAnalysisState: analysisState.genericAnalysisState,
      promptHistory: historyState.promptHistory,
      activeTranscriptIndex: activeTranscriptIndex,
      totalInputTokens: historyState.totalInputTokens,
      totalOutputTokens: historyState.totalOutputTokens,
      userDvFocus: settings.userDvFocus,
      temperature: settings.temperature,
      seed: settings.seed,
      currentStepInfo: currentStepInfo
    }
  }
  
  /**
   * Reset all pipeline-related state
   */
  resetPipeline(): void {
    const { transcriptStore, analysisResultStore, promptHistoryStore, orchestrationStore } = this.dependencies
    
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