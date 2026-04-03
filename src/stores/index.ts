// Store Initialization with Dependency Injection
// This file establishes proper store dependencies and eliminates circular imports

import { enableMapSet } from 'immer'
import { useUIStore } from './uiStore'
import { usePipelineStore, _storeRefs } from './pipelineStore'
import { useSettingsStore } from './settingsStore'
import { useIRRStore } from './irrStore'

// Enable Immer's Map support
enableMapSet()

// Wire cross-store refs so pipelineStore can call uiStore/settingsStore
// without a direct circular import. Runs at module-load time (before any
// async persist hydration), so the refs are always available in callbacks.
_storeRefs.uiStore = useUIStore
_storeRefs.settingsStore = useSettingsStore

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
  useIRRStore
}

// Export selectors
export { selectCurrentStepDisplay, selectMermaidChartForStep } from './pipelineStore'