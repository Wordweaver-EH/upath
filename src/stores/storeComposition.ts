// Store Composition Layer
// Provides cross-store operations and orchestration for complex multi-store operations

import { useTranscriptStore } from './transcriptStore'
import { useAnalysisResultStore } from './analysisResultStore'
import { usePipelineStore } from './pipelineStore'
import { usePromptHistoryStore } from './promptHistoryStore'
import { useUIStore } from './uiStore'
import { localForageStorage } from '../utils/storage'
import { CurrentStepInfo, StepId, RawTranscript, TranscriptProcessedData } from '../../types'

/**
 * Store composition layer that provides cross-store operations
 * This acts as a facade for operations that span multiple stores
 */
export const useStoreComposition = () => {
  
  /**
   * Resets all pipeline-related state across multiple stores
   * This replaces the monolithic resetPipeline function
   */
  const resetPipeline = () => {
    console.log('🔄 [StoreComposition] Resetting all pipeline stores')
    
    // Reset transcript store
    const transcriptStore = useTranscriptStore.getState()
    transcriptStore.reset()
    
    // Reset analysis results store
    const analysisResultStore = useAnalysisResultStore.getState()
    analysisResultStore.reset()
    
    // Reset prompt history store
    const promptHistoryStore = usePromptHistoryStore.getState()
    promptHistoryStore.reset()
    
    // Reset prompt history in pipelineStore (temporary during migration)
    // TODO: Remove this once pipelineStore is fully migrated
    const pipelineStore = usePipelineStore.getState()
    pipelineStore.resetPromptHistoryOnly()
    
    console.log('✅ [StoreComposition] All pipeline stores reset')
  }
  
  /**
   * Clears autosave data from storage
   * This is a simple operation that doesn't require cross-store coordination
   */
  const clearAutosaveData = async () => {
    try {
      await localForageStorage.removeItem('upath-autosave-session-v2-localforage')
      console.log('✅ [StoreComposition] Autosave data cleared')
    } catch (error) {
      console.error('❌ [StoreComposition] Failed to clear autosave data:', error)
    }
  }
  
  /**
   * Get next step details for pipeline progression
   * Temporary delegation to pipelineStore during migration
   */
  const getNextStepDetails = (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => {
    // During migration: delegate to pipelineStore for now
    // This will be refactored to use new stores once migration is complete
    const pipelineStore = usePipelineStore.getState()
    return pipelineStore.getNextStepDetails(currentStepInfo, activeTranscriptIndex, transcriptData)
  }
  
  /**
   * Process a single pipeline step
   * Temporary delegation to pipelineStore during migration 
   */
  const processSingleStep = async (params: any) => {
    // During migration: delegate to pipelineStore for now
    // This will be refactored to use extracted services once migration is complete
    const pipelineStore = usePipelineStore.getState()
    return pipelineStore.processSingleStep(params)
  }
  
  /**
   * Download output for a pipeline step
   * Temporary delegation to pipelineStore during migration
   */
  const downloadOutput = (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any) => {
    // During migration: delegate to pipelineStore for now
    const pipelineStore = usePipelineStore.getState()
    return pipelineStore.downloadOutput(stepIdToDownload, transcriptId, dataToDownload)
  }
  
  /**
   * Check if a step is global (not transcript-specific)
   * Temporary delegation to pipelineStore during migration
   */
  const isGlobalStep = (stepId: StepId) => {
    // During migration: delegate to pipelineStore for now
    const pipelineStore = usePipelineStore.getState()
    return pipelineStore.isGlobalStep(stepId)
  }
  
  /**
   * Coordinates rehydration across multiple stores to determine if session was restored
   */
  const coordinateRehydration = async () => {
    // Rehydrate all stores
    await Promise.all([
      useTranscriptStore.persist.rehydrate(),
      useAnalysisResultStore.persist.rehydrate(),
      usePipelineStore.persist.rehydrate(),
      usePromptHistoryStore.persist.rehydrate()
    ]);
    
    // Check if any store has data
    const transcriptState = useTranscriptStore.getState();
    const analysisState = useAnalysisResultStore.getState();
    const pipelineState = usePipelineStore.getState();
    const promptHistoryState = usePromptHistoryStore.getState();
    
    const hasTranscriptData = transcriptState.rawTranscripts.length > 0 || 
                             transcriptState.processedData.size > 0;
    
    // Check if analysis state has actual data (not just default boolean flags)
    const hasAnalysisData = Object.keys(analysisState.genericAnalysisState).some(key => {
      const value = analysisState.genericAnalysisState[key as keyof typeof analysisState.genericAnalysisState];
      // Check if this is actual data (not just default false booleans)
      return key.includes('_output') || key.includes('_error') || 
             (typeof value === 'boolean' && value === true);
    });
    
    // Check prompt history store
    const hasPromptHistoryData = promptHistoryState.promptHistory.length > 0 ||
                                promptHistoryState.totalInputTokens > 0 ||
                                promptHistoryState.totalOutputTokens > 0;
    
    // Pipeline store might have other data in the future
    const hasPipelineData = false; // Currently no data persisted in pipelineStore
    
    const hasAnyData = hasTranscriptData || hasAnalysisData || hasPipelineData || hasPromptHistoryData;
    
    // Set UI flags based on combined state
    const uiStore = useUIStore.getState();
    uiStore.setHasRehydrated(true);
    uiStore.setSessionWasRestored(hasAnyData);
    
    return hasAnyData;
  };
  
  /**
   * Check if download history is disabled (no prompt history exists)
   */
  const isDownloadHistoryDisabled = () => {
    const promptHistoryStore = usePromptHistoryStore.getState()
    return promptHistoryStore.promptHistory.length === 0
  }
  
  // TODO: Implement getSaveState and loadState for cross-store operations
  // These will be needed for full state management but are not required for the pilot migration
  
  return {
    resetPipeline,
    clearAutosaveData,
    getNextStepDetails,
    processSingleStep,
    downloadOutput,
    isGlobalStep,
    coordinateRehydration,
    isDownloadHistoryDisabled
  }
}

/**
 * Hook that provides store composition actions
 * This is the main interface for cross-store operations
 */
export const useStoreActions = () => {
  const composition = useStoreComposition()
  
  return {
    // Cross-store operations
    resetPipeline: composition.resetPipeline,
    clearAutosaveData: composition.clearAutosaveData,
    
    // Pipeline orchestration functions (temporary delegation during migration)
    getNextStepDetails: composition.getNextStepDetails,
    processSingleStep: composition.processSingleStep,
    downloadOutput: composition.downloadOutput,
    isGlobalStep: composition.isGlobalStep,
    
    // Prompt history operations
    isDownloadHistoryDisabled: composition.isDownloadHistoryDisabled,
    
    // Rehydration coordination
    coordinateRehydration: composition.coordinateRehydration
  }
}