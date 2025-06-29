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
  processSingleStep: (stepId: StepId, transcriptId?: string, overrideSeed?: number, hilMetaPrompt?: string) => Promise<void>
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
}

type PipelineState = TranscriptSlice & GenericAnalysisSlice & PromptSlice
type PipelineStore = PipelineState & PipelineActions

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
      processSingleStep: async (
        stepId: StepId, 
        transcriptIdToProcess?: string, 
        overrideSeed?: number, 
        hilMetaPrompt?: string
      ) => {
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
          uiStore.setCurrentStepInfo({ 
            stepId, 
            status: StepStatus.Error, 
            error: "API Key not set." 
          })
          uiStore.setAutorunning(false)
          return
        }
        
        // DV Focus check
        if (dvFocusError) {
          uiStore.setCurrentStepInfo({ 
            stepId, 
            status: StepStatus.Error, 
            error: `DV Focus Error: ${dvFocusError}` 
          })
          uiStore.setAutorunning(false)
          return
        }
        
        // Call the implementation
        await processSingleStepImplementation(
          { stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt },
          {
            rawTranscripts: get().rawTranscripts,
            processedData: get().processedData,
            genericAnalysisState: get().genericAnalysisState,
            set,
            get
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
            uiStore.setCurrentStepInfo({ 
              stepId: StepId.COMPLETE, 
              status: StepStatus.Success, 
              outputData: report 
            })
            uiStore.setAutorunning(false)
          }
          return
        }
        
        uiStore.setActiveTranscript(details.nextTranscriptIndex)
        
        if (details.nextStepId === StepId.COMPLETE) {
          const { genericAnalysisState } = get()
          const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete."
          uiStore.setCurrentStepInfo({ 
            stepId: StepId.COMPLETE, 
            status: StepStatus.Success, 
            outputData: report 
          })
          uiStore.setAutorunning(false)
        } else {
          const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId)
          const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id
          get().processSingleStep(details.nextStepId, nextTxId)
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
        uiStore.setActiveTranscript(savedState.activeTranscriptIndex)
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