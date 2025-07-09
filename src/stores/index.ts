// Store Initialization with Dependency Injection
// This file establishes proper store dependencies and eliminates circular imports

import { enableMapSet } from 'immer'
import { useUIStore } from './uiStore'
import { usePipelineStore } from './pipelineStore'
import { useSettingsStore } from './settingsStore'
import { useIRRStore } from './irrStore'
import { useTranscriptStore } from './transcriptStore'
import { useAnalysisResultStore } from './analysisResultStore'

// Enable Immer's Map support
enableMapSet()

// Initialize stores in proper dependency order
// UI Store is independent, Pipeline Store will get UI Store injected
export const initializeStores = () => {
               // Get store instances
               const uiStore = useUIStore.getState()
               const pipelineStore = usePipelineStore.getState()
               const settingsStore = useSettingsStore.getState()
               const irrStore = useIRRStore.getState()
             
               // Set up dependency injection: UI store gets pipeline store's file handler
               uiStore.setFileDropCallback(pipelineStore.handleDroppedFiles)
             
               return {
                 uiStore,
                 pipelineStore,
                 settingsStore,
                 irrStore
               }
             }


// Export store hooks for components
export {
  useUIStore,
  usePipelineStore,
  useSettingsStore,
  useIRRStore,
  useTranscriptStore,
  useAnalysisResultStore
}

// Export selectors
export { selectCurrentStepDisplay, selectMermaidChartForStep } from './pipelineStore'