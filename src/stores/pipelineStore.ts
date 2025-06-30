import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import { 
  RawTranscript, 
  TranscriptProcessedData, 
  GenericAnalysisState,
  PromptHistoryEntry,
  StepId,
  StepStatus,
  SavedState,
  P2SPhaseData
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
  STEP_ORDER_PART_7_CAUSAL_MODELING
} from '../../constants'
import { callGeminiAPI } from '../../services/geminiService'
import { useUIStore } from './uiStore'
import { useSettingsStore } from './settingsStore'
import { processSingleStepImplementation, getInvalidatedStates } from './pipelineActions'
import { stepIdToDataKeyPrefix, isGlobalStep } from '../utils/stepIdToDataKeyPrefix'
import { downloadFile, generateTsvForPromptHistory } from '../../utils/tsvHelper'
import { generateHtmlAppendix, calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from '../../utils/htmlHelper'

// Slice types
interface TranscriptSlice {
  rawTranscripts: RawTranscript[]
  processedData: Map<string, TranscriptProcessedData>
  addTranscripts: (files: File[]) => Promise<void>
  updateProcessedData: (id: string, data: Partial<TranscriptProcessedData>) => void
  removeTranscript: (id: string) => void
}

interface GenericAnalysisSlice {
  genericAnalysisState: GenericAnalysisState
  updateGenericState: (updates: Partial<GenericAnalysisState>) => void
}

interface PromptSlice {
  promptHistory: PromptHistoryEntry[]
  totalInputTokens: number
  totalOutputTokens: number
  addPromptEntry: (entry: PromptHistoryEntry) => void
}

// Main pipeline actions
interface PipelineActions {
  processSingleStep: (params: { 
    stepId: StepId,
    transcriptIdToProcess?: string,
    overrideSeed?: number,
    hilMetaPrompt?: string
  }) => Promise<void>
  invalidateStateFromStep: (stepId: StepId, transcriptId?: string) => void
  getInvalidatedStates: (
    startInvalidationFromStepId: StepId,
    currentActiveTxId: string | undefined,
    currentProcessedData: Map<string, TranscriptProcessedData>,
    currentGenericState: GenericAnalysisState
  ) => {
    invalidatedProcessedData: Map<string, TranscriptProcessedData>
    invalidatedGenericState: GenericAnalysisState
  }
  getNextStepDetails: () => { nextStepId: StepId; nextTranscriptIndex: number } | null
  processNextStep: () => void
  resetPipeline: () => void
  loadState: (savedState: SavedState) => void
  getSaveState: () => SavedState
  downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any) => void
  downloadHistory: (format: 'tsv' | 'json') => void
  generateAppendix: (type: 'markdown' | 'html') => void
  // New actions for SettingsPanel
  saveStateToFile: () => void
  loadStateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => void
  uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => void
  setActiveTranscriptByIndex: (index: number) => void
  getTranscriptStatusDisplay: (transcriptId: string) => string
}


// Pipeline selectors for derived state
interface PipelineSelectors {
  isPreviousStepDisabled: () => boolean
  isNextStepDisabled: () => boolean
  isRunStepDisabled: () => boolean
  isHilModalDisabled: () => boolean
  getPreviousStepDetails: () => { prevStepId: StepId; prevTranscriptIndex: number } | null
  isDownloadOutputDisabled: () => boolean
  isDownloadHistoryDisabled: () => boolean
  isAppendixDataAvailable: () => boolean
}

type PipelineState = TranscriptSlice & GenericAnalysisSlice & PromptSlice
type PipelineStore = PipelineState & PipelineActions & PipelineSelectors

// Helper function to process file content
const processFileContent = async (file: File): Promise<RawTranscript> => {
  const text = await file.text()
  const lines = text.split('\\n').filter(line => line.trim())
  const metadata = { fileName: file.name, uploadDate: new Date().toISOString() }
  
  return {
    id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content: lines,
    metadata
  }
}

// Create slices
const createTranscriptSlice = (set: any, get: any): TranscriptSlice => ({
  rawTranscripts: [],
  processedData: new Map(),
  
  addTranscripts: async (files: File[]) => {
    const newTranscripts = await Promise.all(files.map(processFileContent))
    
    set((state: PipelineState) => {
      state.rawTranscripts = [...state.rawTranscripts, ...newTranscripts]
      
      // Initialize processed data for new transcripts
      newTranscripts.forEach(transcript => {
        state.processedData.set(transcript.id, {
          id: transcript.id,
          rawContent: transcript.content,
          fileName: transcript.metadata.fileName,
          isFullyProcessedSpecific: false,
          p_neg1_output: undefined,
          p_neg1_error: undefined,
          p0_output: undefined,
          p0_error: undefined,
          p1_1_output: undefined,
          p1_1_error: undefined,
          p1_2_output: undefined,
          p1_2_mermaid_syntax: undefined,
          p1_2_error: undefined,
          p2s_outputs_by_phase: {},
          p2s_mermaid_syntax_by_phase: {},
          p2s_1_a_error: undefined,
          p2s_1_b_error: undefined,
          current_phase_for_p2s_processing: undefined,
          phases_to_process_for_p2s: [],
          processed_phases_for_p2s: []
        })
      })
    })
  },
  
  updateProcessedData: (id: string, updates: Partial<TranscriptProcessedData>) => {
    set((state: PipelineState) => {
      const current = state.processedData.get(id)
      if (current) {
        state.processedData.set(id, { ...current, ...updates })
      }
    })
  },
  
  removeTranscript: (id: string) => {
    set((state: PipelineState) => {
      state.rawTranscripts = state.rawTranscripts.filter(t => t.id !== id)
      state.processedData.delete(id)
    })
  }
})

const createGenericAnalysisSlice = (set: any, get: any): GenericAnalysisSlice => ({
  genericAnalysisState: {
    isFullyProcessedGenericDiachronic: false,
    p3_1_output: undefined,
    p3_1_error: undefined,
    p3_2_output: undefined,
    p3_2_error: undefined,
    p3_3_output: undefined,
    p3_3_mermaid_syntax: undefined,
    p3_3_error: undefined,
    p4s_1_a_outputs_by_gdu: {},
    p4s_1_a_error: undefined,
    p4s_outputs_by_gdu: {},
    p4s_mermaid_syntax_by_gdu: {},
    p4s_1_b_error: undefined,
    current_gdu_for_p4s_processing: undefined,
    core_gdus_for_sync_analysis: [],
    processed_gdus_for_p4s: [],
    isFullyProcessedGenericSynchronic: false,
    p5_1_output: undefined,
    p5_1_error: undefined,
    isRefinementDone: false,
    p7_1_output: undefined,
    p7_1_error: undefined,
    p7_2_output: undefined,
    p7_2_error: undefined,
    p7_3_output: undefined,
    p7_3_mermaid_syntax_dag: undefined,
    p7_3_error: undefined,
    p7_3b_output: undefined,
    p7_3b_mermaid_syntax_dag: undefined,
    p7_3b_error: undefined,
    p7_4_output: undefined,
    p7_4_error: undefined,
    p7_5_output: undefined,
    p7_5_error: undefined,
    isCausalModelingDone: false,
    p6_1_output: undefined,
    p6_1_error: undefined,
    isReportGenerated: false
  },
  
  updateGenericState: (updates: Partial<GenericAnalysisState>) => {
    set((state: PipelineState) => {
      Object.assign(state.genericAnalysisState, updates)
    })
  }
})

const createPromptSlice = (set: any, get: any): PromptSlice => ({
  promptHistory: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  
  addPromptEntry: (entry: PromptHistoryEntry) => {
    set((state: PipelineState) => {
      state.promptHistory.push(entry)
      state.totalInputTokens += entry.inputTokens || 0
      state.totalOutputTokens += entry.outputTokens || 0
    })
  }
})

// Main store
export const usePipelineStore = create<PipelineStore>()(
  persist(
    immer((set, get) => ({
      ...createTranscriptSlice(set, get),
      ...createGenericAnalysisSlice(set, get),
      ...createPromptSlice(set, get),
      
      // Main pipeline orchestrator
      processSingleStep: async (params) => {
        const { stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt } = params
        const isReportStepForThisCall = stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT
        
        // Get current state
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        const uiStore = useUIStore.getState()
        const { apiKeyPresent, userDvFocus, dvFocusError, temperature, seed } = useSettingsStore.getState()
        
        // Apply invalidation logic before processing step
        const stepToStartFrom = stepId
        const activeTxIdForInvalidation = transcriptIdToProcess || rawTranscripts[uiStore.activeTranscriptIndex]?.id
        
        const { invalidatedProcessedData, invalidatedGenericState } = getInvalidatedStates(
          stepToStartFrom,
          activeTxIdForInvalidation,
          processedData,
          genericAnalysisState
        )
        
        // Update state with invalidated data
        set((state) => {
          state.processedData = invalidatedProcessedData
          state.genericAnalysisState = invalidatedGenericState
        })
        
        // API Key check
        if (!apiKeyPresent && !isReportStepForThisCall) {
          setTimeout(() => {
            uiStore.setCurrentStepInfo({ 
              stepId, 
              status: StepStatus.Error, 
              error: "API Key not set." 
            })
            uiStore.setAutorunning(false)
          }, 0)
          return
        }
        
        // DV Focus check
        if (dvFocusError) {
          setTimeout(() => {
            uiStore.setCurrentStepInfo({ 
              stepId, 
              status: StepStatus.Error, 
              error: `DV Focus Error: ${dvFocusError}` 
            })
            uiStore.setAutorunning(false)
          }, 0)
          return
        }
        
        // Call the implementation
        await processSingleStepImplementation(
          params,
          {
            rawTranscripts: get().rawTranscripts,
            processedData: get().processedData,
            genericAnalysisState: get().genericAnalysisState,
            set,
            get,
            uiStore: useUIStore.getState(),
            settingsStore: useSettingsStore.getState()
          }
        )
      },
      
      // Invalidation helper - exposed for use by processSingleStep
      getInvalidatedStates: (
        startInvalidationFromStepId: StepId,
        currentActiveTxId: string | undefined,
        currentProcessedData: Map<string, TranscriptProcessedData>,
        currentGenericState: GenericAnalysisState
      ) => {
        return getInvalidatedStates(
          startInvalidationFromStepId,
          currentActiveTxId,
          currentProcessedData,
          currentGenericState
        )
      },
      
      getNextStepDetails: () => {
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        const uiStore = useUIStore.getState()
        const { currentStepInfo, activeTranscriptIndex } = uiStore
        
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
      
      processNextStep: () => {
        const { rawTranscripts } = get()
        const uiStore = useUIStore.getState()
        const details = get().getNextStepDetails()
        
        if (!details) {
          const { genericAnalysisState } = get()
          if (uiStore.currentStepInfo.stepId !== StepId.COMPLETE && genericAnalysisState.isReportGenerated) {
            const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All processing complete."
            setTimeout(() => {
              uiStore.setCurrentStepInfo({ 
                stepId: StepId.COMPLETE, 
                status: StepStatus.Success, 
                outputData: report 
              })
              uiStore.setAutorunning(false)
            }, 0)
          }
          return
        }
        
        setTimeout(() => {
          uiStore.setActiveTranscript(details.nextTranscriptIndex)
        }, 0)
        
        if (details.nextStepId === StepId.COMPLETE) {
          const { genericAnalysisState } = get()
          const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete."
          setTimeout(() => {
            uiStore.setCurrentStepInfo({ 
              stepId: StepId.COMPLETE, 
              status: StepStatus.Success, 
              outputData: report 
            })
            uiStore.setAutorunning(false)
          }, 0)
        } else {
          const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId)
          const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id
          get().processSingleStep({ stepId: details.nextStepId, transcriptIdToProcess: nextTxId })
        }
      },
      
      invalidateStateFromStep: (stepId: StepId, transcriptId?: string) => {
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        const uiStore = useUIStore.getState()
        const activeTxId = transcriptId || rawTranscripts[uiStore.activeTranscriptIndex]?.id
        
        const { invalidatedProcessedData, invalidatedGenericState } = getInvalidatedStates(
          stepId,
          activeTxId,
          processedData,
          genericAnalysisState
        )
        
        set((state) => {
          state.processedData = invalidatedProcessedData
          state.genericAnalysisState = invalidatedGenericState
        })
      },
      
      resetPipeline: () => {
        set((state) => {
          // Reset transcript data
          state.rawTranscripts = []
          state.processedData = new Map()
          
          // Reset generic analysis
          state.genericAnalysisState = createGenericAnalysisSlice(set, get).genericAnalysisState
          
          // Reset prompt history
          state.promptHistory = []
          state.totalInputTokens = 0
          state.totalOutputTokens = 0
        })
        
        // Reset UI state
        useUIStore.getState().resetUIState()
      },
      
      loadState: (savedState: SavedState) => {
        set((state) => {
          // Load transcript data
          state.rawTranscripts = savedState.rawTranscripts
          state.processedData = new Map(savedState.processedDataArray)
          
          // Load generic analysis
          state.genericAnalysisState = savedState.genericAnalysisState
          
          // Load prompt history
          state.promptHistory = savedState.promptHistory
          state.totalInputTokens = savedState.totalInputTokens
          state.totalOutputTokens = savedState.totalOutputTokens
        })
        
        // Update UI state
        const uiStore = useUIStore.getState()
        setTimeout(() => {
          uiStore.setActiveTranscript(savedState.activeTranscriptIndex)
        }, 0)
        // Note: currentStepInfo is not restored from saved state
      },
      
      getSaveState: (): SavedState => {
        const state = get()
        const uiState = useUIStore.getState()
        const settingsState = useSettingsStore.getState()
        
        return {
          version: '1.0',
          savedAt: new Date().toISOString(),
          rawTranscripts: state.rawTranscripts,
          processedDataArray: Array.from(state.processedData.entries()),
          genericAnalysisState: state.genericAnalysisState,
          promptHistory: state.promptHistory,
          activeTranscriptIndex: uiState.activeTranscriptIndex,
          totalInputTokens: state.totalInputTokens,
          totalOutputTokens: state.totalOutputTokens,
          userDvFocus: settingsState.userDvFocus,
          temperature: settingsState.temperature,
          seed: settingsState.seed,
          currentStepInfo: uiState.currentStepInfo
        }
      },

      // Pipeline selectors for derived state
      getPreviousStepDetails: () => {
        const uiState = useUIStore.getState()
        const { currentStepInfo, activeTranscriptIndex } = uiState
        const { rawTranscripts } = get()
        
        if (currentStepInfo.stepId === StepId.IDLE) return null
        
        const currentIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(currentStepInfo.stepId)
        if (currentIndex <= 0) return null
        
        // Handle first step of pipeline for transcripts beyond the first
        if (currentStepInfo.stepId === STEP_ORDER_PART_NEG1[0] && activeTranscriptIndex > 0) {
          return { 
            prevStepId: StepId.IDLE,
            prevTranscriptIndex: activeTranscriptIndex - 1 
          }
        }
        
        const prevStepId = ALL_PIPELINE_STEP_IDS_IN_ORDER[currentIndex - 1] as StepId
        return { prevStepId, prevTranscriptIndex: activeTranscriptIndex }
      },

      isPreviousStepDisabled: () => {
        const uiState = useUIStore.getState()
        const { currentStepInfo } = uiState
        
        return currentStepInfo.status === StepStatus.Loading || !get().getPreviousStepDetails()
      },

      isNextStepDisabled: () => {
        const uiState = useUIStore.getState()
        const { currentStepInfo } = uiState
        const { genericAnalysisState } = get()
        
        return currentStepInfo.status === StepStatus.Loading || 
               (!get().getNextStepDetails() && currentStepInfo.stepId !== StepId.COMPLETE && !genericAnalysisState.isReportGenerated)
      },

      isRunStepDisabled: () => {
        const uiState = useUIStore.getState()
        const settingsState = useSettingsStore.getState()
        const { currentStepInfo } = uiState
        const { apiKeyPresent, dvFocusError } = settingsState
        
        return currentStepInfo.stepId === StepId.IDLE || 
               currentStepInfo.status === StepStatus.Loading || 
               currentStepInfo.stepId === StepId.COMPLETE || 
               (!apiKeyPresent && currentStepInfo.stepId !== StepId.P6_1_GENERATE_MARKDOWN_REPORT) || 
               !!dvFocusError
      },

      isHilModalDisabled: () => {
        const uiState = useUIStore.getState()
        const { currentStepInfo } = uiState
        
        return currentStepInfo.stepId === StepId.IDLE || 
               currentStepInfo.status === StepStatus.Loading || 
               currentStepInfo.stepId === StepId.COMPLETE || 
               !currentStepInfo.inputData || 
               (!currentStepInfo.outputData && !currentStepInfo.error)
      },

      isDownloadOutputDisabled: () => {
        const uiState = useUIStore.getState()
        const { currentStepInfo } = uiState
        const { genericAnalysisState } = get()
        
        return currentStepInfo.stepId === StepId.IDLE || 
               (!currentStepInfo.outputData && !genericAnalysisState.p6_1_output) || 
               (currentStepInfo.stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT && !genericAnalysisState.p6_1_output)
      },

      isDownloadHistoryDisabled: () => {
        const { promptHistory } = get()
        return promptHistory.length === 0
      },

      isAppendixDataAvailable: () => {
        const { rawTranscripts, genericAnalysisState } = get()
        return rawTranscripts.length > 0 && genericAnalysisState.isReportGenerated
      },

      // Download and appendix actions
      downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any) => {
        const uiState = useUIStore.getState()
        const settingsState = useSettingsStore.getState()
        const { currentStepInfo } = uiState
        const { outputDirectory } = settingsState
        const { processedData, genericAnalysisState } = get()
        
        const stepId = stepIdToDownload || currentStepInfo.stepId
        const transcriptIdToUse = transcriptId || currentStepInfo.transcriptId
        
        let data = dataToDownload
        let filename = `${outputDirectory}/${stepId}_output`
        
        // If no specific data provided, get it from current step
        if (!data) {
          if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
            data = genericAnalysisState.p6_1_output
          } else {
            data = currentStepInfo.outputData
          }
        }
        
        if (data) {
          const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          const extension = typeof data === 'string' ? '.txt' : '.json'
          downloadFile(content, `${filename}${extension}`, 'text/plain;charset=utf-8')
        } else {
          alert('No output data available to download.')
        }
      },

      downloadHistory: (format: 'tsv' | 'json') => {
        const { promptHistory } = get()
        const settingsState = useSettingsStore.getState()
        const { outputDirectory } = settingsState
        
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

      generateAppendix: (type: 'markdown' | 'html' = 'markdown') => {
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        const settingsState = useSettingsStore.getState()
        const { outputDirectory } = settingsState
        
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
          const markdownContent = `# Analysis Appendix\n\nGenerated on: ${new Date().toISOString()}\n\n## GDU Counts\n${JSON.stringify(gduCounts, null, 2)}\n\n## GSS Counts\n${JSON.stringify(gssCounts, null, 2)}\n\n## Transition Counts\n${JSON.stringify(transitionCounts, null, 2)}`
          const filename = `${outputDirectory}/appendix_${new Date().toISOString().slice(0,10)}.md`
          downloadFile(markdownContent, filename, 'text/markdown;charset=utf-8')
        }
      },

      // New actions for SettingsPanel integration
      saveStateToFile: () => {
        const savedState = get().getSaveState()
        const settingsState = useSettingsStore.getState()
        const { outputDirectory } = settingsState
        
        const content = JSON.stringify(savedState, null, 2)
        const filename = `${outputDirectory}/upath_state_${new Date().toISOString().slice(0,10)}.json`
        downloadFile(content, filename, 'application/json')
      },

      loadStateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string
            const savedState = JSON.parse(content) as SavedState
            get().loadState(savedState)
            
            // Reset file input
            event.target.value = ''
            
            alert('State loaded successfully!')
          } catch (error) {
            console.error('Failed to load state:', error)
            alert('Failed to load state file. Please check the file format.')
          }
        }
        reader.readAsText(file)
      },

      uploadTranscripts: async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        try {
          await get().addTranscripts(files)
          
          // Reset file input
          event.target.value = ''
          
          // Update UI state
          const uiStore = useUIStore.getState()
          if (uiStore.currentStepInfo.stepId === StepId.IDLE) {
            setTimeout(() => {
              uiStore.setCurrentStepInfo({
                stepId: StepId.IDLE,
                status: StepStatus.Idle,
                transcriptId: undefined
              })
            }, 0)
          }
        } catch (error) {
          console.error('Failed to upload transcripts:', error)
          alert('Failed to upload transcripts. Please try again.')
        }
      },

      setActiveTranscriptByIndex: (index: number) => {
        const uiStore = useUIStore.getState()
        setTimeout(() => {
          uiStore.setActiveTranscript(index)
        }, 0)
      },

      getTranscriptStatusDisplay: (transcriptId: string): string => {
        const { processedData } = get()
        const data = processedData.get(transcriptId)
        
        if (!data) return 'No Data'
        
        // Check completion status based on pipeline progress
        if (data.isFullyProcessedSpecificDiachronic && data.isFullyProcessedSpecificSynchronic) {
          return 'P2S Done'
        }
        if (data.isFullyProcessedSpecificDiachronic) {
          return 'P1 Done'
        }
        if (data.p0_3_output || data.p0_3_error) {
          return 'P0 Done'
        }
        if (data.p_neg1_1_output || data.p_neg1_1_error) {
          return 'P-1 Done'
        }
        
        return 'Pending'
      }
    })),
    {
      name: 'upath-pipeline',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const data = JSON.parse(str)
          return {
            ...data,
            state: {
              ...data.state,
              // Convert processedData array back to Map
              processedData: new Map(data.state.processedData)
            }
          }
        },
        setItem: (name, value) => {
          const dataToStore = {
            ...value,
            state: {
              ...value.state,
              // Convert Map to array for storage
              processedData: Array.from(value.state.processedData.entries())
            }
          }
          localStorage.setItem(name, JSON.stringify(dataToStore))
        },
        removeItem: (name) => localStorage.removeItem(name)
      })),
      partialize: (state) => ({
        // Only persist actual data, not UI state
        rawTranscripts: state.rawTranscripts,
        processedData: state.processedData,
        genericAnalysisState: state.genericAnalysisState,
        promptHistory: state.promptHistory,
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens
      })
    }
  )
)