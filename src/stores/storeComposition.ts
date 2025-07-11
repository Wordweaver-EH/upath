// Store Composition Layer
// Provides cross-store operations and orchestration for complex multi-store operations

import { useTranscriptStore } from './transcriptStore'
import { useAnalysisResultStore } from './analysisResultStore'
import { usePromptHistoryStore } from './promptHistoryStore'
import { usePipelineOrchestrationStore } from './pipelineOrchestrationStore'
import { useUIStore } from './uiStore'
import { localForageStorage } from '../utils/storage'
import { CurrentStepInfo, StepId, RawTranscript, TranscriptProcessedData } from '../../types'
import { getPipelineService } from '../services/pipeline/pipelineServiceFactory'

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
    
    // Reset pipeline orchestration store
    const pipelineOrchestrationStore = usePipelineOrchestrationStore.getState()
    pipelineOrchestrationStore.reset()
    
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
   */
  const getNextStepDetails = (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => {
    const pipelineService = getPipelineService()
    return pipelineService.getNextStepDetails(currentStepInfo, activeTranscriptIndex)
  }
  
  /**
   * Process a single pipeline step
   */
  const processSingleStep = async (params: any) => {
    const pipelineService = getPipelineService()
    return pipelineService.processSingleStep(params)
  }
  
  /**
   * Download output for a pipeline step
   */
  const downloadOutput = (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any) => {
    const pipelineService = getPipelineService()
    return pipelineService.downloadOutput(stepIdToDownload, transcriptId, dataToDownload)
  }
  
  /**
   * Check if a step is global (not transcript-specific)
   */
  const isGlobalStep = (stepId: StepId) => {
    const pipelineService = getPipelineService()
    return pipelineService.isGlobalStep(stepId)
  }
  
  /**
   * Coordinates rehydration across multiple stores to determine if session was restored
   */
  const coordinateRehydration = async () => {
    // Rehydrate all stores
    await Promise.all([
      useTranscriptStore.persist.rehydrate(),
      useAnalysisResultStore.persist.rehydrate(),
      usePromptHistoryStore.persist.rehydrate(),
      usePipelineOrchestrationStore.persist.rehydrate()
    ]);
    
    // Check if any store has data
    const transcriptState = useTranscriptStore.getState();
    const analysisState = useAnalysisResultStore.getState();
    const promptHistoryState = usePromptHistoryStore.getState();
    const orchestrationState = usePipelineOrchestrationStore.getState();
    
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
    
    // Check orchestration store data
    const hasOrchestrationData = orchestrationState.currentStepInfo.stepId !== StepId.IDLE ||
                                orchestrationState.activeTranscriptIndex > 0;
    
    const hasAnyData = hasTranscriptData || hasAnalysisData || hasPromptHistoryData || hasOrchestrationData;
    
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
  
  /**
   * Get current orchestration state
   * Provides read-only access to pipeline orchestration state
   */
  const getOrchestrationState = () => {
    const orchestrationStore = usePipelineOrchestrationStore.getState()
    return {
      currentStepInfo: orchestrationStore.currentStepInfo,
      activeTranscriptIndex: orchestrationStore.activeTranscriptIndex,
      isAutorunning: orchestrationStore.isAutorunning,
      shouldStopAutorun: orchestrationStore.shouldStopAutorun,
      lastExecutionParams: orchestrationStore.lastExecutionParams,
      lastHilContext: orchestrationStore.lastHilContext
    }
  }
  
  /**
   * Set autorun state across stores
   * Coordinates autorun state between UI and orchestration stores
   */
  const setAutorunning = (isAutorunning: boolean) => {
    const orchestrationStore = usePipelineOrchestrationStore.getState()
    const uiStore = useUIStore.getState()
    
    orchestrationStore.setAutorunning(isAutorunning)
    uiStore.setAutorunning(isAutorunning)
  }
  
  /**
   * Clear HIL context across all stores
   * Ensures HIL state is cleared consistently
   */
  const clearHilContext = () => {
    const orchestrationStore = usePipelineOrchestrationStore.getState()
    
    // Clear HIL context directly in orchestration store
    orchestrationStore.clearHilContext()
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
    isDownloadHistoryDisabled,
    // Orchestration methods
    getOrchestrationState,
    setAutorunning,
    clearHilContext
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
    coordinateRehydration: composition.coordinateRehydration,
    
    // Orchestration state and actions
    getOrchestrationState: composition.getOrchestrationState,
    setAutorunning: composition.setAutorunning,
    clearHilContext: composition.clearHilContext
  }
}