import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { localForageStorage } from '../utils/storage'
import { performDataMigration } from '../utils/migration'
import { useAnalysisResultStore } from './analysisResultStore'
import { usePromptHistoryStore } from './promptHistoryStore'
import { useTranscriptStore } from './transcriptStore'
import { usePipelineOrchestrationStore } from './pipelineOrchestrationStore'
import { 
  RawTranscript, 
  TranscriptProcessedData, 
  GenericAnalysisState,
  PromptHistoryEntry,
  StepId,
  StepStatus,
  SavedState,
  P2SPhaseData,
  CurrentStepInfo,
  HilContext,
  P1_4_Output,
  P3_3_Output
} from '../../types'
import { 
  STEP_CONFIGS, 
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_6_REPORT,
  STEP_ORDER_PART_7_CAUSAL_MODELING,
  P3_2_APPROACH,
  getStepDisplayName
} from '../../constants'
import { callGeminiAPI } from '../../services/geminiService'
// Circular dependency removed - UI updates handled through dependency injection
import { stepIdToDataKeyPrefix, isGlobalStep } from '../utils/stepIdToDataKeyPrefix'
import { generateMarkdownReportProgrammatically, ReportData } from '../utils/reportHelper'
import { 
  transformDiachronicToMermaid, 
  transformSynchronicToMermaid, 
  transformGenericDiachronicToMermaid, 
  transformDagToMermaid 
} from '../utils/visualizationHelper'
import { downloadFile, generateTsvForPromptHistory } from '../utils/tsvHelper'
import { generateHtmlAppendix, calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from '../utils/htmlHelper'
import { 
  StepParameterValidationService,
  StepContextPreparationService,
  StepInputPreparationService,
  StepExecutionService,
  PromptHistoryService,
  StepErrorHandlingService,
  StepSuccessHandlingService,
  PipelineOrchestrator,
  FileManagementService,
  ExportService
} from '../services/pipeline'

// Dependency injection interfaces for breaking circular dependencies
interface UICallbacks {
  setAutorunning: (running: boolean) => void
  setCurrentStepInfo: (info: CurrentStepInfo) => void
}

interface SettingsData {
  apiKey: string
  temperature: number
  seed?: number
  userDvFocus: { dv_focus: string[] }
}

// Slice types
// TranscriptSlice has been moved to transcriptStore.ts

interface GenericAnalysisSlice {
  genericAnalysisState: GenericAnalysisState
  updateGenericState: (updates: Partial<GenericAnalysisState>) => void
  // UI synchronization state - App.tsx will listen to these
  lastStepInfo?: CurrentStepInfo
  lastError?: string
  lastHilContext?: HilContext
  shouldStopAutorun?: boolean
}

interface DependencyInjectionSlice {
  uiCallbacks?: UICallbacks
  setUICallbacks: (callbacks: UICallbacks) => void
}

// PromptSlice removed - migrated to promptHistoryStore

// Main pipeline actions
interface PipelineActions {
  processSingleStep: (params: { 
    stepId: StepId,
    transcriptIdToProcess?: string,
    overrideSeed?: number,
    hilMetaPrompt?: string,
    settings?: SettingsData,
    // Transcript data passed from caller to avoid circular dependencies
    transcriptData?: {
      rawTranscripts: RawTranscript[],
      processedData: Map<string, TranscriptProcessedData>
    }
  }) => Promise<void>
  
  invalidateStateFromStep: (stepId: StepId, transcriptId?: string, activeTranscriptIndex?: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => void
  getInvalidatedStates: (
    startInvalidationFromStepId: StepId,
    currentActiveTxId: string | undefined,
    currentProcessedData: Map<string, TranscriptProcessedData>,
    currentGenericState: GenericAnalysisState
  ) => {
    invalidatedProcessedData: Map<string, TranscriptProcessedData>
    invalidatedGenericState: GenericAnalysisState
  }
  getNextStepDetails: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => { nextStepId: StepId; nextTranscriptIndex: number } | null
  processNextStep: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => void
  resetPipeline: () => void
  resetPromptHistoryOnly: () => void
  clearAutosaveData: () => Promise<void>
  loadState: (savedState: SavedState) => void
  getSaveState: () => SavedState
  downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any) => void
  downloadHistory: (format: 'tsv' | 'json', outputDirectory: string) => void
  generateAppendix: (type: 'markdown' | 'html', outputDirectory: string) => void
  retryWithUserSeed: () => void
  // New actions for SettingsPanel
  saveStateToFile: (activeTranscriptIndex: number, currentStepInfo: CurrentStepInfo, settings: SettingsData) => void
  loadStateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => void
  uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleDroppedFiles: (files: File[]) => Promise<void>
  setActiveTranscriptByIndex: (index: number) => void
  getTranscriptStatusDisplay: (transcriptId: string) => string
  isGlobalStep: (stepId: StepId) => boolean
  loadStepData: (stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string) => any
  getStepStatusForPipelineView: (stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string) => StepStatus
  handlePipelineStepClick: (clickedStepId: StepId, settings: SettingsData) => void
  // State cleanup actions
  clearShouldStopAutorunFlag: () => void
  clearLastHilContext: () => void
}

type PipelineState = GenericAnalysisSlice & DependencyInjectionSlice
type PipelineStore = PipelineState & PipelineActions

// UI updates are now handled through state changes that App.tsx listens to
// Create slices
// createTranscriptSlice has been moved to transcriptStore.ts

const createGenericAnalysisSlice = (set: any, get: any): GenericAnalysisSlice => ({
  // Delegate to analysisResultStore for genericAnalysisState
  get genericAnalysisState() {
    return useAnalysisResultStore.getState().genericAnalysisState
  },
  
  // Delegate to analysisResultStore for updates
  updateGenericState: (updates: Partial<GenericAnalysisState>) => {
    useAnalysisResultStore.getState().updateGenericState(updates)
  }
})

// createPromptSlice removed - migrated to promptHistoryStore

const createDependencyInjectionSlice = (set: any, get: any): DependencyInjectionSlice => ({
  uiCallbacks: undefined,
  
  setUICallbacks: (callbacks: UICallbacks) => {
    set((state: PipelineState) => {
      state.uiCallbacks = callbacks
    })
  }
})

// Main store
export const usePipelineStore = create<PipelineStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
      ...createGenericAnalysisSlice(set, get),
      ...createDependencyInjectionSlice(set, get),
      
      // Main pipeline orchestrator - refactored to use PipelineOrchestrator
      processSingleStep: async (params) => {
        // Get transcript data if not provided
        const transcriptStore = useTranscriptStore.getState()
        const transcriptData = params.transcriptData || {
          rawTranscripts: transcriptStore.rawTranscripts,
          processedData: transcriptStore.processedData
        }
        
        console.groupCollapsed(`🚀 [pipelineStore] processSingleStep: ${params.stepId}`);
        console.log(`- Transcript ID: ${params.transcriptIdToProcess || 'N/A (Global Step)'}`);
        console.log(`- Override Seed: ${params.overrideSeed || 'Default'}`);
        console.log(`- HIL Prompt: ${params.hilMetaPrompt ? 'Yes' : 'No'}`);
        console.log(`- Raw Transcripts Count: ${transcriptData.rawTranscripts.length}`);

        // Record execution in orchestration store
        const orchestrationStore = usePipelineOrchestrationStore.getState()
        orchestrationStore.recordExecution({
          stepId: params.stepId,
          transcriptId: params.transcriptIdToProcess,
          settings: params.settings,
          seed: params.overrideSeed,
          hilMetaPrompt: params.hilMetaPrompt
        })

        try {
          // Initialize all services
          const validationService = new StepParameterValidationService()
          const contextService = new StepContextPreparationService()
          const inputService = new StepInputPreparationService()
          const executionService = new StepExecutionService()
          const historyService = new PromptHistoryService()
          const errorService = new StepErrorHandlingService()
          const successService = new StepSuccessHandlingService()
          
          // Create update callbacks
          const updateStores = (updates: any) => {
            // Handle transcript-specific updates BEFORE set() to avoid closure issues
            if (updates.transcriptId && updates.output) {
              const transcriptStore = useTranscriptStore.getState()
              const processedData = new Map(transcriptStore.processedData)
              const tData = processedData.get(updates.transcriptId)
              
              if (tData) {
                const key = stepIdToDataKeyPrefix[updates.stepId]
                if (key && typeof key === 'string') {
                  const updatedData = {
                    ...tData,
                    [key as keyof TranscriptProcessedData]: updates.output,
                    [`${key.replace('_output','_error')}` as keyof TranscriptProcessedData]: undefined
                  } as TranscriptProcessedData
                  
                  // Special handling for P1.4
                  if (updates.stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && updates.output) {
                    updatedData.isFullyProcessedSpecificDiachronic = true
                    updatedData.p1_4_mermaid_syntax = transformDiachronicToMermaid((updates.output as P1_4_Output).specific_diachronic_structure)
                    const phases = (updates.output as P1_4_Output)?.specific_diachronic_structure?.phases.map(p => p.phase_name) || []
                    updatedData.phases_for_p2s_processing = phases
                    updatedData.current_phase_for_p2s_processing = phases[0] || undefined
                    updatedData.processed_phases_for_p2s = []
                    updatedData.p2s_outputs_by_phase = {}
                    updatedData.isFullyProcessedSpecificSynchronic = phases.length === 0
                  }
                  
                  // Update the specific transcript data
                  transcriptStore.updateProcessedData(updates.transcriptId, updatedData)
                }
              }
            }
            
            // Handle generic state updates BEFORE set()
            if (updates.output && !updates.transcriptId) {
              const key = stepIdToDataKeyPrefix[updates.stepId]
              if (key && typeof key === 'string') {
                // Use updateGenericState to update analysisResultStore
                get().updateGenericState({
                  [key as keyof GenericAnalysisState]: updates.output,
                  [`${key.replace('_output','_error')}` as keyof GenericAnalysisState]: undefined
                })
              }
              
              // Handle special cases like P3.3
              if (updates.stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE && updates.output) {
                const p3_3 = updates.output as P3_3_Output
                const core = p3_3?.generic_diachronic_structure_definition?.core_gdus || []
                const mermaid = p3_3 ? transformGenericDiachronicToMermaid(p3_3.generic_diachronic_structure_definition) : undefined
                
                // Use updateGenericState to update analysisResultStore
                get().updateGenericState({
                  p3_3_output: p3_3,
                  p3_3_mermaid_syntax: mermaid,
                  p3_3_error: undefined,
                  isFullyProcessedGenericDiachronic: true,
                  core_gdus_for_sync_analysis: core,
                  processed_gdus_for_p4s: [],
                  current_gdu_for_p4s_processing: core[0] || undefined,
                  p4s_outputs_by_gdu: {},
                  p4s_mermaid_syntax_by_gdu: {},
                  p4s_1_a_error: undefined,
                  p4s_1_b_error: undefined,
                  isFullyProcessedGenericSynchronic: (core.length === 0)
                })
              }
            }
            
            // Update pipeline-specific state
            set(state => {
              // Update lastStepInfo based on the updates
              if (updates.stepId && updates.status) {
                state.lastStepInfo = {
                  stepId: updates.stepId,
                  status: updates.status,
                  transcriptId: updates.transcriptId,
                  error: updates.error
                }
                
                // Sync with orchestration store
                orchestrationStore.setCurrentStepInfo({
                  stepId: updates.stepId,
                  status: updates.status
                })
              }
              
              // Handle shouldStopAutorun
              if (updates.status === StepStatus.Error) {
                state.shouldStopAutorun = true
                orchestrationStore.setShouldStopAutorun(true)
              }
            })
          }
          
          const addPromptEntry = (entry: PromptHistoryEntry) => {
            const promptHistoryStore = usePromptHistoryStore.getState()
            promptHistoryStore.addPromptEntry(entry)
          }
          
          // Create orchestrator instance
          const orchestrator = new PipelineOrchestrator(
            validationService,
            contextService,
            inputService,
            executionService,
            historyService,
            errorService,
            successService,
            updateStores,
            addPromptEntry
          )
          
          // Execute the step with transcript data
          await orchestrator.processSingleStep({
            ...params,
            transcriptData
          })
          
        } catch (error) {
          console.error(`❌ [pipelineStore] Unexpected error in processSingleStep:`, error)
          set(state => ({
            ...state,
            lastStepInfo: { 
              stepId: params.stepId, 
              status: StepStatus.Error, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            },
            shouldStopAutorun: true
          }))
        } finally {
          console.groupEnd()
        }
      },
      
      

      // Invalidation logic - integrated from pipelineActions.ts
      getInvalidatedStates: (
        startInvalidationFromStepId: StepId,
        currentActiveTxId: string | undefined,
        currentProcessedData: Map<string, TranscriptProcessedData>,
        currentGenericState: GenericAnalysisState
      ) => {
        let newProcessedData = new Map(currentProcessedData)
        let newGenericState = { ...currentGenericState }
        
        // Flag to track when per-transcript changes require global cascade
        let globalCascadeRequired = false
        
        const startIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(startInvalidationFromStepId)
        if (startIndex === -1) return { invalidatedProcessedData: newProcessedData, invalidatedGenericState: newGenericState }
        
        for (let i = startIndex; i < ALL_PIPELINE_STEP_IDS_IN_ORDER.length; i++) {
          const stepToInvalidate = ALL_PIPELINE_STEP_IDS_IN_ORDER[i]
          if (stepToInvalidate === StepId.COMPLETE || stepToInvalidate === StepId.IDLE) continue
          
          const keyPrefix = stepIdToDataKeyPrefix[stepToInvalidate]
          if (!keyPrefix) continue
          const errorKey = `${String(keyPrefix).replace('_output', '_error')}` as any
          
          // Per-transcript invalidation logic
          if (currentActiveTxId && !isGlobalStep(stepToInvalidate)) {
            if (STEP_ORDER_PART_NEG1.includes(stepToInvalidate) || 
                STEP_ORDER_PART_0.includes(stepToInvalidate) || 
                STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepToInvalidate)) {
              const tData = newProcessedData.get(currentActiveTxId)
              if (tData) {
                let updatedTData = { ...tData, [keyPrefix]: undefined, [errorKey]: undefined }
                if (stepToInvalidate === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
                  updatedTData = { 
                    ...updatedTData, 
                    isFullyProcessedSpecificDiachronic: false, 
                    p1_4_mermaid_syntax: undefined, 
                    phases_for_p2s_processing: [], 
                    current_phase_for_p2s_processing: undefined, 
                    processed_phases_for_p2s: [], 
                    p2s_outputs_by_phase: {}, 
                    isFullyProcessedSpecificSynchronic: false 
                  }
                }
                newProcessedData.set(currentActiveTxId, updatedTData as TranscriptProcessedData)
              }
            } else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepToInvalidate)) {
              const tData = newProcessedData.get(currentActiveTxId)
              if (tData) {
                // Invalidation for P2S steps is scoped to the currently active phase.
                const currentPhase = tData.current_phase_for_p2s_processing
                
                if (currentPhase && tData.p2s_outputs_by_phase?.[currentPhase]) {
                  const keyPrefixToClear = stepIdToDataKeyPrefix[stepToInvalidate] as keyof P2SPhaseData
                  if (keyPrefixToClear) {
                    // Create a mutable copy of the data for the specific phase we are invalidating
                    const phaseDataToUpdate = { ...tData.p2s_outputs_by_phase[currentPhase] }
                    
                    // Delete the output and error for this specific step
                    delete phaseDataToUpdate[keyPrefixToClear]
                    const errorKeyToClear = `${String(keyPrefixToClear).replace('_output', '_error')}` as keyof P2SPhaseData
                    delete phaseDataToUpdate[errorKeyToClear]
                    
                    // Special handling for P2S.3 which also generates mermaid syntax
                    if (stepToInvalidate === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
                      delete phaseDataToUpdate.p2s_3_mermaid_syntax
                    }
                    
                    // Construct the new state for p2s_outputs_by_phase
                    const updatedP2SOutputs = {
                      ...tData.p2s_outputs_by_phase,
                      [currentPhase]: phaseDataToUpdate,
                    }
                    
                    // Since we are invalidating a step, this phase is no longer fully processed.
                    // We must remove it from the list of completed phases.
                    const newProcessedPhases = tData.processed_phases_for_p2s?.filter(p => p !== currentPhase) || []
                    
                    // Update the transcript data in the map
                    newProcessedData.set(currentActiveTxId, {
                      ...tData,
                      p2s_outputs_by_phase: updatedP2SOutputs,
                      isFullyProcessedSpecificSynchronic: false, // The transcript is no longer fully synchronic processed
                      processed_phases_for_p2s: newProcessedPhases,
                    })
                  }
                }
              }
            }
            globalCascadeRequired = true
          } else if (isGlobalStep(stepToInvalidate) || globalCascadeRequired) {
            // Invalidate global step if downstream OR if cascade required from per-transcript changes
            newGenericState = { ...newGenericState, [keyPrefix]: undefined, [errorKey]: undefined }
            if (stepToInvalidate === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) {
              newGenericState.isFullyProcessedGenericDiachronic = false
              newGenericState.p3_3_mermaid_syntax = undefined
              newGenericState.core_gdus_for_sync_analysis = []
              newGenericState.p4s_1_a_outputs_by_gdu = {}
              newGenericState.p4s_1_a_error = undefined
              newGenericState.p4s_outputs_by_gdu = {}
              newGenericState.p4s_mermaid_syntax_by_gdu = {}
              newGenericState.p4s_1_b_error = undefined
              newGenericState.current_gdu_for_p4s_processing = undefined
              newGenericState.processed_gdus_for_p4s = []
              newGenericState.isFullyProcessedGenericSynchronic = false
            } else if (stepToInvalidate === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && globalCascadeRequired) {
              newGenericState.p4s_1_a_outputs_by_gdu = {}
              newGenericState.p4s_1_a_error = undefined
              newGenericState.p4s_outputs_by_gdu = {}
              newGenericState.p4s_mermaid_syntax_by_gdu = {}
              newGenericState.p4s_1_b_error = undefined
              newGenericState.processed_gdus_for_p4s = []
              newGenericState.isFullyProcessedGenericSynchronic = false
            } else if (stepToInvalidate === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && globalCascadeRequired) {
              newGenericState.p4s_outputs_by_gdu = {}
              newGenericState.p4s_mermaid_syntax_by_gdu = {}
              newGenericState.p4s_1_b_error = undefined
              newGenericState.processed_gdus_for_p4s = []
              newGenericState.isFullyProcessedGenericSynchronic = false
            } else if (stepToInvalidate === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) {
              newGenericState.p7_3_mermaid_syntax_dag = undefined
            } else if (stepToInvalidate === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) {
              newGenericState.p7_3b_mermaid_syntax_dag = undefined
            } else if (stepToInvalidate === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
              newGenericState.isReportGenerated = false
            }
          }
        }
        
        return {
          invalidatedProcessedData: newProcessedData,
          invalidatedGenericState: newGenericState
        }
      },
      
      getNextStepDetails: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => {
        const { genericAnalysisState } = get()
        
        // Use transcript data passed from caller, fall back to empty defaults
        const { rawTranscripts = [], processedData = new Map() } = transcriptData || {}
        
        const currentTranscriptId = rawTranscripts[activeTranscriptIndex]?.id
        const currentTData = currentTranscriptId ? processedData.get(currentTranscriptId) : undefined
        
        if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0) {
          return { nextStepId: STEP_ORDER_PART_NEG1[0], nextTranscriptIndex: 0 }
        }
        
        // Handle Part -1 steps
        const currentPartNeg1StepIndex = STEP_ORDER_PART_NEG1.indexOf(currentStepInfo.stepId)
        if (currentPartNeg1StepIndex !== -1) {
          const pNeg1DoneThisTranscript = currentTData?.p_neg1_1_output || currentTData?.p_neg1_1_error
          if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || pNeg1DoneThisTranscript) {
            if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_NEG1[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
            const allVarIdDone = rawTranscripts.every(rt => processedData.get(rt.id)?.p_neg1_1_output || processedData.get(rt.id)?.p_neg1_1_error)
            if (allVarIdDone) return { nextStepId: STEP_ORDER_PART_0[0], nextTranscriptIndex: 0 }
          }
        }
        
        // Handle Part 0 steps
        const currentPart0StepIndex = STEP_ORDER_PART_0.indexOf(currentStepInfo.stepId)
        if (currentPart0StepIndex !== -1) {
          const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof TranscriptProcessedData
          const part0OutputExists = key && (currentTData?.[key] || currentTData?.[`${key.replace('_output', '_error')}` as keyof TranscriptProcessedData])
          if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || part0OutputExists) {
            if (currentPart0StepIndex < STEP_ORDER_PART_0.length - 1) return { nextStepId: STEP_ORDER_PART_0[currentPart0StepIndex + 1], nextTranscriptIndex: activeTranscriptIndex }
            if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_0[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
            if (rawTranscripts.every(rt => STEP_ORDER_PART_0.every(s => { 
              const k = stepIdToDataKeyPrefix[s] as keyof TranscriptProcessedData
              return k && (processedData.get(rt.id)?.[k] || processedData.get(rt.id)?.[`${k.replace('_output','_error')}` as keyof TranscriptProcessedData])
            }))) {
              return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: 0 }
            }
          }
        }
        
        // Handle Part 1 steps
        const currentPart1StepIndex = STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.indexOf(currentStepInfo.stepId)
        if (currentPart1StepIndex !== -1) {
          const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof TranscriptProcessedData
          const part1OutputExists = key && (currentTData?.[key] || currentTData?.[`${key.replace('_output', '_error')}` as keyof TranscriptProcessedData])
          if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || part1OutputExists) {
            if (currentPart1StepIndex < STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.length - 1) {
              return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[currentPart1StepIndex + 1], nextTranscriptIndex: activeTranscriptIndex }
            }
            if (currentStepInfo.stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && currentTData?.isFullyProcessedSpecificDiachronic) {
              if ((currentTData?.phases_for_p2s_processing?.length || 0) > 0 && !currentTData?.isFullyProcessedSpecificSynchronic) {
                return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], nextTranscriptIndex: activeTranscriptIndex }
              }
              if (activeTranscriptIndex < rawTranscripts.length - 1) {
                return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
              }
              if (rawTranscripts.every(rt => processedData.get(rt.id)?.isFullyProcessedSpecificDiachronic) && 
                  rawTranscripts.every(rt => { 
                    const d = processedData.get(rt.id)
                    return !d || (!d.phases_for_p2s_processing?.length || d.isFullyProcessedSpecificSynchronic)
                  })) {
                return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], nextTranscriptIndex: 0 }
              }
            }
          }
        }
        
        // Handle Part 2 steps
        const currentP2SStepIndex = STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.indexOf(currentStepInfo.stepId)
        if (currentP2SStepIndex !== -1 && currentTData) {
          const phaseDone = currentStepInfo.currentPhaseForP2S
          let p2sOutputForCurrentPhaseAndStepExists = false
          if (phaseDone) {
            const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof P2SPhaseData
            if (key) {
              const pData = currentTData.p2s_outputs_by_phase?.[phaseDone]
              p2sOutputForCurrentPhaseAndStepExists = !!(pData?.[key] || pData?.[`${key.replace('_output', '_error')}` as keyof P2SPhaseData])
            }
          } else if (currentTData.isFullyProcessedSpecificSynchronic && !currentTData.phases_for_p2s_processing?.length) {
            p2sOutputForCurrentPhaseAndStepExists = true
          }
          
          if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || p2sOutputForCurrentPhaseAndStepExists) {
            if (currentP2SStepIndex < STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length - 1) {
              return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[currentP2SStepIndex + 1], nextTranscriptIndex: activeTranscriptIndex }
            }
            if (currentStepInfo.stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
              const totalPhases = currentTData.phases_for_p2s_processing || []
              const processedPhases = currentTData.processed_phases_for_p2s || []
              const allPhasesProcessed = totalPhases.length > 0 && totalPhases.every(phase => processedPhases.includes(phase))
              
              if (!allPhasesProcessed && totalPhases.length > 0) {
                return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], nextTranscriptIndex: activeTranscriptIndex }
              } else {
                if (activeTranscriptIndex < rawTranscripts.length - 1) {
                  return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: activeTranscriptIndex + 1 }
                } else {
                  return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], nextTranscriptIndex: 0 }
                }
              }
            }
          }
        }
        
        // Handle Part 3 steps
        const currentPart3StepIndex = STEP_ORDER_PART_3_GENERIC_DIACHRONIC.indexOf(currentStepInfo.stepId)
        if (currentPart3StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isFullyProcessedGenericDiachronic)) {
          if (genericAnalysisState.isFullyProcessedGenericDiachronic) {
            if ((genericAnalysisState.core_gdus_for_sync_analysis?.length || 0) > 0 && !genericAnalysisState.isFullyProcessedGenericSynchronic) {
              return { nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, nextTranscriptIndex: 0 }
            }
            if (STEP_ORDER_PART_5_REFINEMENT.length > 0 && !genericAnalysisState.isRefinementDone) {
              return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 }
            }
            if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0 && !genericAnalysisState.isCausalModelingDone) {
              return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 }
            }
            return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
          }
          if (currentPart3StepIndex < STEP_ORDER_PART_3_GENERIC_DIACHRONIC.length - 1) {
            return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[currentPart3StepIndex + 1], nextTranscriptIndex: 0 }
          }
        }
        
        // Handle Part 4 steps
        const currentP4SStepIndex = STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.indexOf(currentStepInfo.stepId)
        if (currentP4SStepIndex !== -1) {
          const stepErrorExists = currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES ? genericAnalysisState.p4s_1_a_error : genericAnalysisState.p4s_1_b_error
          const gduContextIsDone = (
            currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_outputs_by_gdu?.[currentStepInfo.currentGduForP4S || '']
          ) || (
            currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.processed_gdus_for_p4s?.includes(currentStepInfo.currentGduForP4S || '')
          )
          
          if (currentStepInfo.status === StepStatus.Success || (currentStepInfo.status === StepStatus.Error && stepErrorExists) || gduContextIsDone) {
            if (currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
              return { nextStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, nextTranscriptIndex: 0 }
            } else if (currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
              if (genericAnalysisState.isFullyProcessedGenericSynchronic) {
                if (STEP_ORDER_PART_5_REFINEMENT.length > 0) return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 }
                if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0) return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 }
                return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
              } else {
                return { nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, nextTranscriptIndex: 0 }
              }
            }
          }
        }
        
        // Handle Part 5 steps
        const currentPart5StepIndex = STEP_ORDER_PART_5_REFINEMENT.indexOf(currentStepInfo.stepId)
        if (currentPart5StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isRefinementDone)) {
          if (genericAnalysisState.isRefinementDone) {
            if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0 && !genericAnalysisState.isCausalModelingDone) {
              return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 }
            }
            if (STEP_ORDER_PART_6_REPORT.length > 0 && !genericAnalysisState.isReportGenerated) {
              return { nextStepId: STEP_ORDER_PART_6_REPORT[0], nextTranscriptIndex: 0 }
            }
            return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
          }
          if (currentPart5StepIndex < STEP_ORDER_PART_5_REFINEMENT.length - 1) {
            return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[currentPart5StepIndex + 1], nextTranscriptIndex: 0 }
          }
        }
        
        // Handle Part 7 steps
        const currentPart7StepIndex = STEP_ORDER_PART_7_CAUSAL_MODELING.indexOf(currentStepInfo.stepId)
        if (currentPart7StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isCausalModelingDone)) {
          if (genericAnalysisState.isCausalModelingDone) {
            if (STEP_ORDER_PART_6_REPORT.length > 0 && !genericAnalysisState.isReportGenerated) {
              return { nextStepId: STEP_ORDER_PART_6_REPORT[0], nextTranscriptIndex: 0 }
            }
            return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
          }
          if (currentPart7StepIndex < STEP_ORDER_PART_7_CAUSAL_MODELING.length - 1) {
            return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[currentPart7StepIndex + 1], nextTranscriptIndex: 0 }
          }
        }
        
        // Handle Part 6 steps
        const currentPart6StepIndex = STEP_ORDER_PART_6_REPORT.indexOf(currentStepInfo.stepId)
        if (currentPart6StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isReportGenerated)) {
          if (genericAnalysisState.isReportGenerated) return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 }
          if (currentPart6StepIndex < STEP_ORDER_PART_6_REPORT.length - 1) {
            return { nextStepId: STEP_ORDER_PART_6_REPORT[currentPart6StepIndex + 1], nextTranscriptIndex: 0 }
          }
        }
        
        if (currentStepInfo.stepId === StepId.COMPLETE) return null
        return null
      },
      
      processNextStep: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => {
        // Use transcript data passed from caller, fall back to empty defaults
        const { rawTranscripts = [] } = transcriptData || {}
        const details = get().getNextStepDetails(currentStepInfo, activeTranscriptIndex, transcriptData)
        
        if (!details) {
          const { genericAnalysisState } = get()
          if (currentStepInfo.stepId !== StepId.COMPLETE && genericAnalysisState.isReportGenerated) {
            const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All processing complete."
            // Update pipeline state - App.tsx will handle UI updates
            set(state => ({
              ...state,
              lastStepInfo: { stepId: StepId.COMPLETE, status: StepStatus.Success, outputData: report },
              shouldStopAutorun: true
            }))
          }
          return
        }
        
        // Note: activeTranscript update should be handled by the caller
        
        if (details.nextStepId === StepId.COMPLETE) {
          const { genericAnalysisState } = get()
          const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete."
          // Update pipeline state - App.tsx will handle UI updates
          set(state => ({
            ...state,
            lastStepInfo: { stepId: StepId.COMPLETE, status: StepStatus.Success, outputData: report },
            shouldStopAutorun: true
          }))
        } else {
          const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId)
          const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id
          get().processSingleStep({ stepId: details.nextStepId, transcriptIdToProcess: nextTxId, transcriptData })
        }
      },
      
      invalidateStateFromStep: (stepId: StepId, transcriptId?: string, activeTranscriptIndex?: number, transcriptData?: { rawTranscripts: RawTranscript[]; processedData: Map<string, TranscriptProcessedData> }) => {
        const { genericAnalysisState } = get()
        
        // Use transcript data passed from caller, fall back to empty defaults
        const { rawTranscripts = [], processedData = new Map() } = transcriptData || {}
        const activeTxId = transcriptId || (activeTranscriptIndex !== undefined ? rawTranscripts[activeTranscriptIndex]?.id : undefined)
        
        const { invalidatedProcessedData, invalidatedGenericState } = get().getInvalidatedStates(
          stepId,
          activeTxId,
          processedData,
          genericAnalysisState
        )
        
        // Update only the generic analysis state in pipeline store
        set((state) => {
          state.genericAnalysisState = invalidatedGenericState
        })
        
        // Update transcript data in transcript store if available
        if (transcriptData) {
          const transcriptStore = useTranscriptStore.getState()
          transcriptStore.setProcessedData(invalidatedProcessedData)
        }
      },
      
      resetPipeline: () => {
        // This function now only resets pipeline-specific data
        // Use Store Composition Layer for full cross-store reset
        get().resetPromptHistoryOnly()
      },
      
      // Internal function for Store Composition Layer to reset only pipeline-specific data
      resetPromptHistoryOnly: () => {
        set((state) => {
          // Reset only pipeline-specific data (not transcript data)
          state.genericAnalysisState = createGenericAnalysisSlice(set, get).genericAnalysisState
        })
        
        // Reset prompt history via the new store
        const promptHistoryStore = usePromptHistoryStore.getState()
        promptHistoryStore.reset()
        
        // Signal that UI should be reset
        set(state => ({
          ...state,
          lastStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
          shouldStopAutorun: true
        }))
      },
      
      clearAutosaveData: async () => {
        try {
          await localForageStorage.removeItem('upath-autosave-session-v2-localforage')
          console.log('Autosave data cleared')
        } catch (error) {
          console.error('Failed to clear autosave data:', error)
        }
      },
      
      loadState: (savedState: SavedState) => {
        // Load transcript data to transcript store
        const transcriptStore = useTranscriptStore.getState()
        transcriptStore.reset() // Clear existing data first
        transcriptStore.addTranscriptsSync(savedState.rawTranscripts)
        
        // Restore processed data entries
        savedState.processedDataArray.forEach(([id, data]) => {
          transcriptStore.updateProcessedData(id, data)
        })
        
        // Load pipeline-specific data
        set((state) => {
          // Load generic analysis
          state.genericAnalysisState = savedState.genericAnalysisState
        })
        
        // Load prompt history via the new store
        // For now, we need to recreate the state since we don't have a loadState method
        const promptHistoryStore = usePromptHistoryStore.getState()
        promptHistoryStore.reset() // Clear existing data
        savedState.promptHistory.forEach(entry => {
          promptHistoryStore.addPromptEntry(entry)
        })
        
        // Note: UI state updates should be handled by the caller or through state synchronization
        // Note: currentStepInfo is not restored from saved state
      },
      
      getSaveState: (activeTranscriptIndex: number, currentStepInfo: CurrentStepInfo, settingsData: { userDvFocus: string, temperature: number, seed: number }): SavedState => {
        const state = get()
        
        // Get transcript data from transcript store
        const transcriptStore = useTranscriptStore.getState()
        
        // Get prompt history data from prompt history store
        const promptHistoryStore = usePromptHistoryStore.getState()
        
        return {
          version: '1.0',
          savedAt: new Date().toISOString(),
          rawTranscripts: transcriptStore.rawTranscripts,
          processedDataArray: Array.from(transcriptStore.processedData.entries()),
          genericAnalysisState: state.genericAnalysisState,
          promptHistory: promptHistoryStore.promptHistory,
          activeTranscriptIndex: activeTranscriptIndex,
          totalInputTokens: promptHistoryStore.totalInputTokens,
          totalOutputTokens: promptHistoryStore.totalOutputTokens,
          userDvFocus: settingsData.userDvFocus,
          temperature: settingsData.temperature,
          seed: settingsData.seed,
          currentStepInfo: currentStepInfo
        }
      },

      // Download and appendix actions
      downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any, currentStepInfo?: CurrentStepInfo, outputDirectory?: string) => {
        // If not provided, use defaults - but ideally these should be passed in
        const actualCurrentStepInfo = currentStepInfo || get().lastStepInfo || { stepId: StepId.IDLE, status: StepStatus.Idle }
        const { genericAnalysisState } = get()
        
        // Get transcript data from transcript store
        const transcriptStore = useTranscriptStore.getState()
        const { processedData } = transcriptStore
        
        const stepId = stepIdToDownload || actualCurrentStepInfo.stepId
        const transcriptIdToUse = transcriptId || actualCurrentStepInfo.transcriptId
        
        let data = dataToDownload
        
        // If no specific data provided, get it from current step
        if (!data) {
          if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
            data = genericAnalysisState.p6_1_output
          } else {
            data = actualCurrentStepInfo.outputData
          }
        }
        
        if (data) {
          const exportService = new ExportService()
          let filename = `${stepId}-output`
          
          if (transcriptIdToUse) {
            const transcriptData = processedData.get(transcriptIdToUse)
            if (transcriptData) {
              filename = `${stepId}-${transcriptData.filename}-output`
            }
          }
          
          const extension = typeof data === 'string' ? '.txt' : '.json'
          exportService.downloadOutput(stepId, data, `${filename}-${Date.now()}${extension}`)
        } else {
          alert('No output data available to download.')
        }
      },

      downloadHistory: (format: 'tsv' | 'json', outputDirectory: string) => {
        // Get prompt history from the new store
        const promptHistoryStore = usePromptHistoryStore.getState()
        const { promptHistory } = promptHistoryStore
        
        if (promptHistory.length === 0) {
          alert('No history to download.')
          return
        }
        
        const filename = `${outputDirectory}/prompt_history_${new Date().toISOString().slice(0,10)}`
        
        if (format === 'tsv') {
          const tsvContent = generateTsvForPromptHistory(promptHistory)
          downloadFile(tsvContent, `${filename}.tsv`, 'text/tab-separated-values;charset=utf-8')
        } else {
          const jsonContent = JSON.stringify(promptHistory, null, 2)
          downloadFile(jsonContent, `${filename}.json`, 'application/json')
        }
      },

      generateAppendix: (type: 'markdown' | 'html' = 'markdown', outputDirectory: string) => {
        const { genericAnalysisState } = get()
        
        // Get transcript data from transcript store
        const transcriptStore = useTranscriptStore.getState()
        const { rawTranscripts, processedData } = transcriptStore
        
        if (rawTranscripts.length === 0) {
          alert('No transcripts to generate appendix for.')
          return
        }
        
        const gduCounts = calculateGduUtteranceCounts(processedData, genericAnalysisState.p3_2_output)
        const gssCounts = calculateGssCategoryUtteranceCounts(processedData, genericAnalysisState.p4s_outputs_by_gdu)
        const transitionCounts = calculateGduTransitionCounts(processedData, genericAnalysisState.p3_2_output, genericAnalysisState.p3_3_output)
        
        if (type === 'html') {
          const htmlContent = generateHtmlAppendix(gduCounts, gssCounts, transitionCounts, false)
          const filename = `${outputDirectory}/appendix_${new Date().toISOString().slice(0,10)}.html`
          downloadFile(htmlContent, filename, 'text/html;charset=utf-8')
        } else {
          // Basic markdown implementation
          const markdownContent = `# Analysis Appendix

Generated on: ${new Date().toISOString()}

## GDU Counts
${JSON.stringify(gduCounts, null, 2)}

## GSS Counts
${JSON.stringify(gssCounts, null, 2)}

## Transition Counts
${JSON.stringify(transitionCounts, null, 2)}`
          const filename = `${outputDirectory}/appendix_${new Date().toISOString().slice(0,10)}.md`
          downloadFile(markdownContent, filename, 'text/markdown;charset=utf-8')
        }
      },

      // New actions for SettingsPanel integration
      saveStateToFile: (activeTranscriptIndex: number, currentStepInfo: CurrentStepInfo, settings: SettingsData) => {
        // Call getSaveState with required parameters
        const savedState = get().getSaveState(
          activeTranscriptIndex,
          currentStepInfo,
          {
            userDvFocus: settings.userDvFocus,
            temperature: settings.temperature,
            seed: settings.seed
          }
        )
        
        const fileService = new FileManagementService()
        fileService.saveStateToFile(savedState, `upath-session-${Date.now()}.json`)
      },

      loadStateFromFile: async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileService = new FileManagementService()
        const files = fileService.handleFileInput(event)
        
        if (files.length === 0) return
        
        try {
          const savedState = await fileService.loadStateFromFile(files[0])
          get().loadState(savedState)
          
          // Reset file input
          event.target.value = ''
          
          alert('State loaded successfully!')
        } catch (error) {
          console.error('Failed to load state:', error)
          alert('Failed to load state file. Please check the file format.')
        }
      },

      uploadTranscripts: async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        try {
          // Use transcriptStore to add transcripts
          const transcriptStore = useTranscriptStore.getState()
          await transcriptStore.addTranscripts(files)
          
          // Reset file input
          event.target.value = ''
          
          // Signal ready state if we're idle
          const orchestrationStore = usePipelineOrchestrationStore.getState()
          if (orchestrationStore.currentStepInfo.stepId === StepId.IDLE) {
            orchestrationStore.setCurrentStepInfo({
              stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
              status: StepStatus.Idle
            })
          }
        } catch (error) {
          console.error('Failed to upload transcripts:', error)
          alert('Failed to upload transcripts. Please try again.')
        }
      },
      
            
            // Handle files dropped from UI store (avoids circular dependency)
            handleDroppedFiles: async (files: File[]) => {
              console.log('🗂️ handleDroppedFiles called with', files.length, 'files');
              if (files.length === 0) return
      
              try {
                console.log('📤 Calling transcriptStore.addTranscripts...');
                // Use transcriptStore to add transcripts
                const transcriptStore = useTranscriptStore.getState()
                await transcriptStore.addTranscripts(files)
                console.log('✅ addTranscripts completed successfully');
                
                // Signal ready state if we're idle
                const orchestrationStore = usePipelineOrchestrationStore.getState()
                if (orchestrationStore.currentStepInfo.stepId === StepId.IDLE) {
                  orchestrationStore.setCurrentStepInfo({
                    stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
                    status: StepStatus.Idle
                  })
                }
              } catch (error) {
                console.error('❌ Error in handleDroppedFiles:', error);
                console.error('❌ Error stack:', error.stack);
                alert('Failed to upload files. Please try again.')
              }
            },
      // Note: setActiveTranscriptByIndex removed - UI operations should be handled by UI store

      getTranscriptStatusDisplay: (transcriptId: string): string => {
        const transcriptStore = useTranscriptStore.getState()
        const data = transcriptStore.processedData.get(transcriptId)
        
        if (!data) return 'No Data'
        
        // Check completion status based on pipeline progress
        if (data.isFullyProcessedSpecificDiachronic && data.isFullyProcessedSpecificSynchronic) {
          return `${getStepDisplayName(StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE)} Done`
        }
        if (data.isFullyProcessedSpecificDiachronic) {
          return `${getStepDisplayName(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE)} Done`
        }
        if (data.p0_3_output || data.p0_3_error) {
          return `${getStepDisplayName(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES)} Done`
        }
        if (data.p_neg1_1_output || data.p_neg1_1_error) {
          return `${getStepDisplayName(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION)} Done`
        }
        
        return 'Pending'
      },

      retryWithUserSeed: (currentStepInfo: CurrentStepInfo, retrySeedInput: string) => {
        if (currentStepInfo.status === StepStatus.Error && retrySeedInput.trim()) {
          const seedValue = parseInt(retrySeedInput.trim(), 10)
          if (!isNaN(seedValue) && seedValue > 0) {
            // Retry the current step with the user-provided seed
            get().processSingleStep({
              stepId: currentStepInfo.stepId,
              transcriptIdToProcess: currentStepInfo.transcriptId,
              overrideSeed: seedValue
            })
            
            // Clear the retry input - this should be handled by UI components
            // uiStore.setRetrySeedInput('') // REMOVED: circular dependency
          }
        }
      },

      isGlobalStep: (stepId: StepId): boolean => {
        return isGlobalStep(stepId)
      },

      loadStepData: (stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string): { inputData?: any, outputData?: any, error?: string, groundingSources?: any[] } => {
        const { genericAnalysisState } = get()
        const transcriptStore = useTranscriptStore.getState()
        const { processedData } = transcriptStore
        const keyPrefix = stepIdToDataKeyPrefix[stepIdToLoad]
        let output: any
        let error: string | undefined
        
        // Get prompt history from the new store
        const promptHistoryStore = usePromptHistoryStore.getState()
        const { promptHistory } = promptHistoryStore
        
        // Find the most recent prompt history entry for this step
        const reversedHistory = [...promptHistory].reverse()
        const historyEntry = reversedHistory.find(entry => 
          entry.stepId === stepIdToLoad && 
          (transcriptId ? entry.transcriptId === transcriptId : true)
        )
        
        const currentInputData = historyEntry?.requestPayload
        const currentGroundingSources = historyEntry?.groundingSources
        
        // Get output data based on step type
        if (transcriptId && phaseName && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepIdToLoad) && keyPrefix) {
          const tData = processedData.get(transcriptId)
          output = tData?.p2s_outputs_by_phase?.[phaseName]?.[keyPrefix as keyof P2SPhaseData]
          error = tData?.p2s_outputs_by_phase?.[phaseName]?.[`${keyPrefix.toString().replace('_output', '_error')}` as keyof P2SPhaseData] as string | undefined
        } else if (transcriptId && keyPrefix && (STEP_ORDER_PART_NEG1.includes(stepIdToLoad) || STEP_ORDER_PART_0.includes(stepIdToLoad) || STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepIdToLoad))) {
          const tData = processedData.get(transcriptId)
          output = tData?.[keyPrefix as keyof TranscriptProcessedData]
          error = tData?.[`${keyPrefix.toString().replace('_output', '_error')}` as keyof TranscriptProcessedData] as string | undefined
        } else if (gduId && keyPrefix) {
          if (stepIdToLoad === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
            output = genericAnalysisState.p4s_1_a_outputs_by_gdu?.[gduId]
            if (genericAnalysisState.p4s_1_a_error && genericAnalysisState.current_gdu_for_p4s_processing === gduId && !output) error = genericAnalysisState.p4s_1_a_error
          } else if (stepIdToLoad === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
            output = genericAnalysisState.p4s_outputs_by_gdu?.[gduId]
            if (genericAnalysisState.p4s_1_b_error && genericAnalysisState.current_gdu_for_p4s_processing === gduId && !output) error = genericAnalysisState.p4s_1_b_error
          }
        } else if (keyPrefix && isGlobalStep(stepIdToLoad)) {
          output = genericAnalysisState[keyPrefix as keyof GenericAnalysisState]
          error = genericAnalysisState[`${keyPrefix.toString().replace('_output', '_error')}` as keyof GenericAnalysisState] as string | undefined
        }
        
        return { outputData: output, error: error, inputData: currentInputData, groundingSources: currentGroundingSources }
      },

      getStepStatusForPipelineView: (stepId: StepId, uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }): { status: StepStatus; error?: string } => {
        const { genericAnalysisState } = get()
        const transcriptStore = useTranscriptStore.getState()
        const { processedData, rawTranscripts } = transcriptStore
        
        // If UI state not provided, try to get it safely
        if (!uiState && typeof window !== 'undefined' && (window as any).__uiStore) {
          try {
            const uiStore = (window as any).__uiStore.getState()
            uiState = {
              currentStepInfo: uiStore.currentStepInfo,
              activeTranscriptIndex: uiStore.activeTranscriptIndex
            }
          } catch (e) {
            // Fallback to safe defaults
            uiState = {
              currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
              activeTranscriptIndex: 0
            }
          }
        }
        
        // Final fallback
        if (!uiState) {
          uiState = {
            currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
            activeTranscriptIndex: 0
          }
        }
        
        const { currentStepInfo, activeTranscriptIndex } = uiState
        const isStepGlobal = isGlobalStep(stepId)
        let status = StepStatus.Idle
        let error: string | undefined

        if (isStepGlobal) {
          if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
            if (genericAnalysisState.isFullyProcessedGenericSynchronic) status = StepStatus.Success
            else if ((genericAnalysisState.processed_gdus_for_p4s?.length || 0) > 0) status = StepStatus.Loading
            
            // Check for specific P4S_A or P4S_B error
            if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_error) {
              error = genericAnalysisState.p4s_1_a_error
            }
            if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.p4s_1_b_error) {
              error = genericAnalysisState.p4s_1_b_error
            }
          } else {
            const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof GenericAnalysisState
            if (genericAnalysisState[keyPrefix]) status = StepStatus.Success
            error = genericAnalysisState[`${String(keyPrefix).replace('_output', '_error')}` as keyof GenericAnalysisState] as string | undefined
            if (error) status = StepStatus.Error
          }
        } else {
          const currentTId = rawTranscripts[activeTranscriptIndex]?.id
          if (currentTId) {
            const tData = processedData.get(currentTId)
            if (tData) {
              if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
                if (tData.isFullyProcessedSpecificSynchronic) status = StepStatus.Success
                else if ((tData.processed_phases_for_p2s?.length || 0) > 0) status = StepStatus.Loading
                if (currentStepInfo.stepId === stepId && currentStepInfo.transcriptId === currentTId && currentStepInfo.error) {
                  error = currentStepInfo.error
                }
              } else {
                const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof TranscriptProcessedData
                if (tData[keyPrefix]) status = StepStatus.Success
                error = tData[`${String(keyPrefix).replace('_output', '_error')}` as keyof TranscriptProcessedData] as string | undefined
                if (error) status = StepStatus.Error
              }
            }
          }
        }

        if (currentStepInfo.stepId === stepId) {
          if (isStepGlobal || currentStepInfo.transcriptId === rawTranscripts[activeTranscriptIndex]?.id) {
            if (currentStepInfo.status === StepStatus.Loading) status = StepStatus.Loading
            else if (currentStepInfo.status === StepStatus.Error) { 
              status = StepStatus.Error
              error = currentStepInfo.error
            }
            else if (currentStepInfo.status === StepStatus.Success) status = StepStatus.Success
          }
        }

        return { status, error }
      },
      
      handlePipelineStepClick: (clickedStepId: StepId, settings: SettingsData) => {
        const { uiCallbacks } = get()
        const transcriptStore = useTranscriptStore.getState()
        const { rawTranscripts, processedData } = transcriptStore
        const orchestrationStore = usePipelineOrchestrationStore.getState()
        const { activeTranscriptIndex } = orchestrationStore
        
        // Use injected UI callbacks instead of direct store access
        if (uiCallbacks) {
          uiCallbacks.setAutorunning(false)
          uiCallbacks.setCurrentStepInfo({
            stepId: clickedStepId,
            status: StepStatus.Processing
          })
        }
        
        let txIdNav: string | undefined = undefined
        let phaseNav: string | undefined = undefined
        let gduNav: string | undefined = undefined
        
        const stepConfig = STEP_CONFIGS[clickedStepId]
        if (!stepConfig) return
        
        if (STEP_ORDER_PART_NEG1.includes(clickedStepId) || 
            STEP_ORDER_PART_0.includes(clickedStepId) || 
            STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(clickedStepId)) {
          txIdNav = rawTranscripts[activeTranscriptIndex]?.id
        } else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(clickedStepId)) {
          txIdNav = rawTranscripts[activeTranscriptIndex]?.id
          const tData = txIdNav ? processedData.get(txIdNav) : undefined
          phaseNav = tData?.current_phase_for_p2s_processing || tData?.phases_for_p2s_processing?.[0]
          if (!phaseNav && (tData?.processed_phases_for_p2s?.length || 0) > 0) {
            phaseNav = tData?.processed_phases_for_p2s?.[tData.processed_phases_for_p2s.length - 1]
          }
        } else if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(clickedStepId)) {
          const { genericAnalysisState } = get()
          const gduIds = genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || []
          gduNav = genericAnalysisState.current_gdu_for_p4s_processing || gduIds[0] || undefined
        }
        
        const data = get().loadStepData(clickedStepId, txIdNav, phaseNav, gduNav)
        
        // Use injected UI callback instead of direct call
        if (uiCallbacks) {
          uiCallbacks.setCurrentStepInfo({
            stepId: clickedStepId,
            transcriptId: txIdNav,
            phaseId: phaseNav,
            gduId: gduNav,
            status: data.error ? StepStatus.Error : (data.outputData ? StepStatus.Success : StepStatus.Idle),
            error: data.error
          })
        }
      },
      
      // State cleanup actions
      clearShouldStopAutorunFlag: () => {
        set((state) => {
          state.shouldStopAutorun = false
        })
        // Also clear in orchestration store
        usePipelineOrchestrationStore.getState().setShouldStopAutorun(false)
      },
      
      clearLastHilContext: () => {
        set((state) => {
          state.lastHilContext = undefined
        })
        // Also clear in orchestration store
        usePipelineOrchestrationStore.getState().clearHilContext()
      }
      
      // Removed duplicate resetPromptHistoryOnly function - already defined earlier
    })),
    {
      name: 'upath-autosave-session-v2-localforage',
      storage: {
        getItem: async (name) => {
          const str = await localForageStorage.getItem(name)
          if (!str) return null
          
          try {
            const data = JSON.parse(str)
            console.log('🔍 [Storage] Parsed data from storage:', {
              rawTranscriptsLength: data.state?.rawTranscripts?.length || 0,
              processedDataLength: data.state?.processedData?.length || 0,
              hasState: !!data.state
            })
            
            const result = {
              ...data,
              state: {
                ...data.state,
                // Convert processedData array back to Map
                processedData: new Map(data.state.processedData || [])
              }
            }
            
            console.log('🔍 [Storage] Returning deserialized data:', {
              rawTranscriptsLength: result.state?.rawTranscripts?.length || 0,
              processedDataSize: result.state?.processedData?.size || 0
            })
            
            return result
          } catch (e) {
            console.error('Failed to parse stored data:', e)
            return null
          }
        },
        setItem: async (name, value) => {
          // If partialize returns undefined, store will be called with value.state = undefined
          if (value.state === undefined) {
            // Don't store anything when partialize returns undefined
            await localForageStorage.removeItem(name)
            return
          }
          
          console.log('💾 [Storage] setItem - incoming value:', {
            rawTranscriptsLength: value.state?.rawTranscripts?.length || 0,
            processedDataType: value.state?.processedData?.constructor?.name || 'unknown',
            processedDataSize: value.state?.processedData instanceof Map ? value.state.processedData.size : (value.state?.processedData?.length || 0)
          })
          
          const dataToStore = {
            ...value,
            state: {
              ...value.state,
              // Convert Map to array for storage
              processedData: value.state?.processedData instanceof Map 
                ? Array.from(value.state.processedData.entries()) 
                : []
            }
          }
          
          console.log('💾 [Storage] setItem - final data:', {
            rawTranscriptsLength: dataToStore.state?.rawTranscripts?.length || 0,
            processedDataLength: dataToStore.state?.processedData?.length || 0
          })
          
          await localForageStorage.setItem(name, JSON.stringify(dataToStore))
        },
        removeItem: async (name) => await localForageStorage.removeItem(name)
      },
      onRehydrateStorage: () => (state, error) => {
        // Note: UI flags are now set by coordinateRehydration in storeComposition
      },
      partialize: (state) => {
        // Only persist pipeline-specific state
        // Note: rawTranscripts and processedData are now in transcriptStore
        // Note: genericAnalysisState is now in analysisResultStore
        // Note: promptHistory and token counts are now in promptHistoryStore
        
        // For now, return undefined as all data has been migrated to other stores
        // This will be updated in Phase 3 when we extract more pipeline logic
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
