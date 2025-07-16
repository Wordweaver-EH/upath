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

  // 1. Handle wrapper states first (loading, error, initial empty state)
  if (status === 'loading') {
    return { type: 'loading', message: 'Processing...' }
  }

  if (error) {
    return { type: 'error', message: error }
  }

  if (stepId === StepId.IDLE && transcriptCount === 0) {
    return { type: 'empty', message: 'Upload transcripts to begin analysis' }
  }

  // 2. Handle content-specific display types based on stepId
  // For now, we need to get the actual output data from stores
  // This is a temporary solution until proper data flow is established
  const processedData = useTranscriptStore.getState().processedData
  const genericAnalysisState = useAnalysisResultStore.getState().genericAnalysisState
  
  // Special case for P_NEG1_1 - show editable table instead of JSON
  if (stepId === StepId.P_NEG1_1_VARIABLE_IDENTIFICATION) {
    return { type: 'variable_table' }
  }

  // Handle Mermaid diagram steps
  const mermaidSteps = [
    StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
    StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
    StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
    StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
    StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
    StepId.P7_3B_VALIDATE_AND_CLEAN_DAG
  ]
  
  if (mermaidSteps.includes(stepId)) {
    // TODO: Extract mermaid syntax from appropriate location
    return { type: 'mermaid', chart: '' }
  }

  // Handle report steps
  if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT || stepId === StepId.COMPLETE) {
    // TODO: Extract report content
    return { type: 'report', markdown: '' }
  }

  // Default to JSON output for other steps
  // TODO: Extract actual output data
  return { type: 'output', data: {} }
}