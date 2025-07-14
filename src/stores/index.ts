// Store Initialization with Dependency Injection
// This file establishes proper store dependencies and eliminates circular imports

import { enableMapSet } from 'immer'
import { useUIStore } from './uiStore'
import { useSettingsStore } from './settingsStore'
import { useIRRStore } from './irrStore'
import { useTranscriptStore } from './transcriptStore'
import { useAnalysisResultStore } from './analysisResultStore'
import { usePromptHistoryStore } from './promptHistoryStore'
import { usePipelineOrchestrationStore } from './pipelineOrchestrationStore'
import { useStoreActions } from './storeComposition'
import { getPipelineService } from '../services/pipeline/pipelineServiceFactory'
import { CurrentStepInfo, StepId } from '../../types'

// Enable Immer's Map support
enableMapSet()

// Initialize stores in proper dependency order
export const initializeStores = () => {
  // Get store instances
  const uiStore = useUIStore.getState()
  const settingsStore = useSettingsStore.getState()
  const irrStore = useIRRStore.getState()
  const transcriptStore = useTranscriptStore.getState()
  const analysisResultStore = useAnalysisResultStore.getState()
  const promptHistoryStore = usePromptHistoryStore.getState()
  const orchestrationStore = usePipelineOrchestrationStore.getState()

  // Set up dependency injection: UI store gets file handler from pipeline service
  const pipelineService = getPipelineService()
  console.log('🔧 [initializeStores] Setting up file drop callback');
  console.log('🔧 [initializeStores] Pipeline service exists:', !!pipelineService);
  console.log('🔧 [initializeStores] handleDroppedFiles method exists:', !!pipelineService.handleDroppedFiles);
  
  // Bind the method to ensure proper 'this' context
  const boundHandleDroppedFiles = pipelineService.handleDroppedFiles.bind(pipelineService)
  uiStore.setFileDropCallback(boundHandleDroppedFiles)
  console.log('🔧 [initializeStores] File drop callback set successfully');

  return {
    uiStore,
    settingsStore,
    irrStore,
    transcriptStore,
    analysisResultStore,
    promptHistoryStore,
    orchestrationStore
  }
}

// Export store hooks for components
export {
  useUIStore,
  useSettingsStore,
  useIRRStore,
  useTranscriptStore,
  useAnalysisResultStore,
  usePromptHistoryStore,
  usePipelineOrchestrationStore,
  useStoreActions
}

// Temporary selector until moved to proper location
export const selectCurrentStepDisplay = (currentStepInfo: CurrentStepInfo, transcriptCount: number) => {
  const { stepId, status, error } = currentStepInfo

  if (status === 'loading') {
    return { type: 'loading', message: 'Processing...' }
  }

  if (error) {
    return { type: 'error', message: error }
  }

  if (stepId === StepId.IDLE && transcriptCount === 0) {
    return { type: 'empty', message: 'Upload transcripts to begin analysis' }
  }

  return { type: 'content' }
}