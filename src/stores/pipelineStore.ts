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
import { stepIdToDataKeyPrefix, isGlobalStep } from '../utils/stepIdToDataKeyPrefix'
import { generateMarkdownReportProgrammatically, ReportData } from '../../utils/reportHelper'
import { 
  transformDiachronicToMermaid, 
  transformSynchronicToMermaid, 
  transformGenericDiachronicToMermaid, 
  transformDagToMermaid 
} from '../../utils/visualizationHelper'
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
  // Helper functions for step processing  
  handleStepError: (
    stepId: StepId,
    transcriptIdToProcess: string | undefined,
    apiError: string,
    inputData: any,
    output: any,
    groundingSources: any,
    currentGDU: string | undefined,
    currentPhase: string | undefined,
    isReportStepForThisCall: boolean
  ) => void
  handleReportGeneration: (output: any) => void
  handleSuccessfulStep: (
    stepId: StepId,
    transcriptIdToProcess: string | undefined,
    output: any,
    inputData: any,
    groundingSources: any,
    currentGDU: string | undefined,
    currentPhase: string | undefined,
    processedData: Map<string, TranscriptProcessedData>
  ) => void
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
  retryWithUserSeed: () => void
  // New actions for SettingsPanel
  saveStateToFile: () => void
  loadStateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => void
  uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleDroppedFiles: (files: File[]) => Promise<void>
  setActiveTranscriptByIndex: (index: number) => void
  getTranscriptStatusDisplay: (transcriptId: string) => string
  isGlobalStep: (stepId: StepId) => boolean
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
  loadStepData: (stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string) => { inputData?: any, outputData?: any, error?: string, groundingSources?: any[] }
}

type PipelineState = TranscriptSlice & GenericAnalysisSlice & PromptSlice
type PipelineStore = PipelineState & PipelineActions & PipelineSelectors

      // Helper function to avoid circular dependency
      const getUIStore = () => {
        // Dynamic import to break circular dependency
        return import('./uiStore').then(module => module.useUIStore.getState())
      }
      
      // Synchronous version for use in actions (temporary bridge until better architecture)
      const getUIStoreSync = () => {
        // This requires the store to be initialized first via initializeStores()
        // For now, we'll use a workaround with global access
        if (typeof window !== 'undefined' && (window as any).__uiStore) {
          return (window as any).__uiStore
        }
        // Fallback - dynamic import (will be async)
        throw new Error('UI Store not available - make sure initializeStores() was called')
      }
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
      
      // Main pipeline orchestrator - integrated from pipelineActions.ts
      processSingleStep: async (params) => {
        const { stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt } = params
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        const uiStore = useUIStore.getState()
        const settingsStore = useSettingsStore.getState()
        
        const isReportStepForThisCall = stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT
        const { apiKeyPresent, userDvFocus, dvFocusError, temperature, seed } = settingsStore
        
        // Get step config
        const config = STEP_CONFIGS[stepId]
        if (!config) {
          setTimeout(() => {
            setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
            setTimeout(() => { uiStore.setAutorunning($1) }, 0)
          }, 0)
          return
        }
        
        // Prepare context variables
        const currentTranscript = transcriptIdToProcess 
          ? rawTranscripts.find(t => t.id === transcriptIdToProcess) 
          : undefined
        let currentPhase: string | undefined = undefined
        let currentGDU: string | undefined = undefined
        let tempGenericState = { ...genericAnalysisState }
        
        // Handle P2S phase context
        if (transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
          const tData = processedData.get(transcriptIdToProcess)
          if (tData) {
            currentPhase = tData.current_phase_for_p2s_processing
            if (!currentPhase && stepId === STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0] && (tData.phases_for_p2s_processing?.length || 0) > 0) {
              currentPhase = tData.phases_for_p2s_processing?.[0]
              set((state) => {
                const d = state.processedData.get(transcriptIdToProcess)
                if (d) {
                  state.processedData.set(transcriptIdToProcess, {
                    ...d,
                    current_phase_for_p2s_processing: currentPhase
                  })
                }
              })
            }
            if (!currentPhase && (tData.phases_for_p2s_processing?.length || 0) > 0 && !tData.isFullyProcessedSpecificSynchronic) {
              setTimeout(() => {
                setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
                setTimeout(() => { uiStore.setAutorunning($1) }, 0)
              }, 0)
              return
            }
          }
        }
        
        // Handle P4S GDU context
        if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
          currentGDU = tempGenericState.current_gdu_for_p4s_processing
          if (!currentGDU && stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && (tempGenericState.core_gdus_for_sync_analysis?.length || 0) > 0) {
            const firstNonProcessed = tempGenericState.core_gdus_for_sync_analysis?.find(g => 
              !(tempGenericState.processed_gdus_for_p4s || []).includes(g)
            )
            if (firstNonProcessed) {
              currentGDU = firstNonProcessed
              tempGenericState = { 
                ...tempGenericState, 
                current_gdu_for_p4s_processing: firstNonProcessed, 
                p4s_1_a_error: undefined, 
                p4s_1_b_error: undefined 
              }
              set((state) => {
                state.genericAnalysisState.current_gdu_for_p4s_processing = firstNonProcessed
                state.genericAnalysisState.p4s_1_a_error = undefined
                state.genericAnalysisState.p4s_1_b_error = undefined
              })
            } else if (!tempGenericState.isFullyProcessedGenericSynchronic) {
              setTimeout(() => {
                setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
                setTimeout(() => { uiStore.setAutorunning($1) }, 0)
              }, 0)
              return
            }
          }
          if (!currentGDU && (tempGenericState.core_gdus_for_sync_analysis || []).length > 0 && !tempGenericState.isFullyProcessedGenericSynchronic) {
            setTimeout(() => {
              setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
              setTimeout(() => { uiStore.setAutorunning($1) }, 0)
            }, 0)
            return
          }
        }
        
        // Get input data
        let inputResult = config.getInput(
          currentTranscript, 
          processedData, 
          tempGenericState, 
          apiKeyPresent, 
          userDvFocus, 
          rawTranscripts, 
          currentPhase, 
          currentGDU
        )
        
        if (inputResult === null || inputResult?.error) {
          const errText = `Input error for ${stepId}: ${inputResult?.error || 'Input null'}`
          setTimeout(() => {
            setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
            setTimeout(() => { uiStore.setAutorunning($1) }, 0)
          }, 0)
          
          if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
            set((state) => { state.genericAnalysisState.p4s_1_a_error = errText })
          } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
            set((state) => { state.genericAnalysisState.p4s_1_b_error = errText })
          }
          
          return
        }
        
        const inputData = inputResult.data
        setTimeout(() => {
          setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
        }, 0)
        
        // Process the step
        let output: string | any
        let apiError: string | undefined
        let groundingSources: PromptHistoryEntry['groundingSources']
        let estIn: number | undefined = 0
        let estOut: number | undefined = 0
        let promptForHistory = hilMetaPrompt || config.generatePrompt(inputData)
        
        if (isReportStepForThisCall) {
          // Generate report programmatically
          try {
            output = generateMarkdownReportProgrammatically(inputData as ReportData)
            apiError = undefined
          } catch (e: any) {
            console.error("Error generating report programmatically:", e)
            output = ""
            apiError = `Programmatic report generation failed: ${e.message || String(e)}`
          }
          promptForHistory = "Programmatic report generation."
        } else {
          // Call Gemini API
          const effectiveSeed = overrideSeed !== undefined ? overrideSeed : seed
          const apiResult = await callGeminiAPI(
            promptForHistory, 
            1, // maxRetries
            config.isJsonOutput, 
            false, // useGrounding
            temperature, 
            effectiveSeed
          )
          output = config.isJsonOutput ? apiResult.parsedJson : apiResult.text
          apiError = apiResult.error
          
          // Apply parseOutput validation if available and no API error
          if (!apiError && output && config.parseOutput) {
            try {
              output = config.parseOutput(output, inputData)
            } catch (validationError: any) {
              apiError = `Output validation failed: ${validationError.message || String(validationError)}`
              console.error(`Validation failed for ${stepId}:`, validationError)
            }
          }
          
          groundingSources = apiResult.groundingSources
          estIn = apiResult.estimatedInputTokens
          estOut = apiResult.estimatedOutputTokens
          
          // Update token counts
          if (estIn != null) {
            set((state) => { state.totalInputTokens += estIn! })
          }
          if (estOut != null) {
            set((state) => { state.totalOutputTokens += estOut! })
          }
        }
        
        // Add to prompt history
        const historyEntry: PromptHistoryEntry = {
          stepId,
          transcriptId: transcriptIdToProcess,
          timestamp: new Date().toISOString(),
          prompt: promptForHistory,
          requestPayload: isReportStepForThisCall 
            ? { programmaticInput: inputData } 
            : { 
                model: 'gemini-2.5-flash-preview-04-17', 
                contents: promptForHistory, 
                temperature, 
                seed: (!isReportStepForThisCall ? (overrideSeed !== undefined ? overrideSeed : seed) : undefined) 
              },
          responseRaw: typeof output === 'string' ? output : (output ? JSON.stringify(output) : ''),
          responseParsed: output,
          error: apiError,
          groundingSources,
          estimatedInputTokens: estIn,
          estimatedOutputTokens: estOut
        }
        
        set((state) => {
          state.promptHistory.push(historyEntry)
        })
        
        // Handle errors
        if (apiError) {
          get().handleStepError(stepId, transcriptIdToProcess, apiError, inputData, output, groundingSources, currentGDU, currentPhase, isReportStepForThisCall)
          return
        }
        
        // Handle successful output
        if (isReportStepForThisCall) {
          get().handleReportGeneration(output)
        } else {
          get().handleSuccessfulStep(stepId, transcriptIdToProcess, output, inputData, groundingSources, currentGDU, currentPhase, processedData)
        }
      },
      
      // Helper functions for step processing - integrated from pipelineActions.ts
      handleStepError: (
        stepId: StepId,
        transcriptIdToProcess: string | undefined,
        apiError: string,
        inputData: any,
        output: any,
        groundingSources: any,
        currentGDU: string | undefined,
        currentPhase: string | undefined,
        isReportStepForThisCall: boolean
      ) => {
        const uiStore = useUIStore.getState()
        setTimeout(() => {
          setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
        }, 0)
        
        const key = stepIdToDataKeyPrefix[stepId]
        
        if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
          set((state: any) => { state.genericAnalysisState.p4s_1_a_error = apiError })
        } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
          set((state: any) => { state.genericAnalysisState.p4s_1_b_error = apiError })
        } else if (isReportStepForThisCall) {
          set((state: any) => { 
            state.genericAnalysisState.p6_1_error = apiError
            state.genericAnalysisState.isReportGenerated = false
            state.genericAnalysisState.p6_1_output = undefined
          })
        } else if (key) {
          const eKey = `${key.toString().replace('_output', '_error')}`
          
          if (transcriptIdToProcess && currentPhase && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
            set((state: any) => {
              const d = state.processedData.get(transcriptIdToProcess)
              if (d) {
                const p2sU = {
                  ...(d.p2s_outputs_by_phase || {}),
                  [currentPhase!]: {
                    ...(d.p2s_outputs_by_phase?.[currentPhase!] || {}),
                    [eKey]: apiError,
                    [key as keyof P2SPhaseData]: undefined
                  }
                }
                state.processedData.set(transcriptIdToProcess, { ...d, p2s_outputs_by_phase: p2sU })
              }
            })
          } else if (transcriptIdToProcess) {
            set((state: any) => {
              const d = state.processedData.get(transcriptIdToProcess)
              if (d) {
                state.processedData.set(transcriptIdToProcess, {
                  ...d,
                  [eKey]: apiError,
                  [key as keyof TranscriptProcessedData]: undefined
                } as any)
              }
            })
          } else {
            set((state: any) => {
              state.genericAnalysisState[eKey] = apiError
              state.genericAnalysisState[key as keyof GenericAnalysisState] = undefined
            })
          }
        }
        
        setTimeout(() => {
          setTimeout(() => { uiStore.setAutorunning($1) }, 0)
        }, 0)
      },

      handleReportGeneration: (output: any) => {
        const uiStore = useUIStore.getState()
        if (typeof output === 'string' && output.trim() !== '') {
          set((state: any) => {
            state.genericAnalysisState.isReportGenerated = true
            state.genericAnalysisState.p6_1_output = output as P6_1_Output
            state.genericAnalysisState.p6_1_error = undefined
          })
          
          setTimeout(() => {
            setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
          }, 0)
        } else {
          const rptErr = "Report generation resulted in empty/invalid content."
          setTimeout(() => {
            setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
          }, 0)
          
          set((state: any) => {
            state.genericAnalysisState.isReportGenerated = false
            state.genericAnalysisState.p6_1_output = undefined
            state.genericAnalysisState.p6_1_error = rptErr
          })
          
          setTimeout(() => {
            setTimeout(() => { uiStore.setAutorunning($1) }, 0)
          }, 0)
        }
      },

      handleSuccessfulStep: (
        stepId: StepId,
        transcriptIdToProcess: string | undefined,
        output: any,
        inputData: any,
        groundingSources: any,
        currentGDU: string | undefined,
        currentPhase: string | undefined,
        processedData: Map<string, TranscriptProcessedData>
      ) => {
        const uiStore = useUIStore.getState()
        setTimeout(() => {
          setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
        }, 0)
        
        const key = stepIdToDataKeyPrefix[stepId]
        
        // Handle transcript-specific outputs
        if (transcriptIdToProcess && key && typeof key === 'string' && !STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
          set((state: any) => {
            const d = state.processedData.get(transcriptIdToProcess)
            if (d) {
              const nD: TranscriptProcessedData = {
                ...d,
                [key as keyof TranscriptProcessedData]: output,
                [`${key.replace('_output','_error')}` as keyof TranscriptProcessedData]: undefined
              } as any
              
              // Special handling for P1.4
              if (stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && output) {
                nD.isFullyProcessedSpecificDiachronic = true
                nD.p1_4_mermaid_syntax = transformDiachronicToMermaid((output as P1_4_Output).specific_diachronic_structure)
                const phases = (output as P1_4_Output)?.specific_diachronic_structure?.phases.map(p => p.phase_name) || []
                nD.phases_for_p2s_processing = phases
                nD.current_phase_for_p2s_processing = phases[0] || undefined
                nD.processed_phases_for_p2s = []
                nD.p2s_outputs_by_phase = {}
                nD.isFullyProcessedSpecificSynchronic = phases.length === 0
              }
              
              state.processedData.set(transcriptIdToProcess, nD)
            }
          })
        }
        
        // Handle P2S phase outputs
        if (currentPhase && transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId) && key && typeof key === 'string') {
          set((state: any) => {
            const tD = state.processedData.get(transcriptIdToProcess)
            if (tD) {
              let mermaid: string | undefined = undefined
              if (stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE && output) {
                mermaid = transformSynchronicToMermaid((output as P2S_3_Output).specific_synchronic_structure, currentPhase)
              }
              
              const uP2S = {
                ...(tD.p2s_outputs_by_phase || {}),
                [currentPhase!]: {
                  ...(tD.p2s_outputs_by_phase?.[currentPhase!] || {}),
                  [key as keyof P2SPhaseData]: output,
                  [`${key.replace('_output','_error')}` as keyof P2SPhaseData]: undefined,
                  ...(mermaid && { p2s_3_mermaid_syntax: mermaid })
                }
              }
              
              let newProcPhases = [...(tD.processed_phases_for_p2s || [])]
              let allDone = tD.isFullyProcessedSpecificSynchronic
              let nextPhase: string | undefined = currentPhase
              
              if (stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
                newProcPhases = Array.from(new Set([...newProcPhases, currentPhase!]))
                const transcriptPhases = tD.phases_for_p2s_processing || []
                allDone = transcriptPhases.length > 0 ? newProcPhases.length === transcriptPhases.length : true
                if (!allDone) {
                  nextPhase = transcriptPhases.find(p => !newProcPhases.includes(p))
                } else {
                  nextPhase = undefined
                }
              }
              
              state.processedData.set(transcriptIdToProcess, {
                ...tD,
                p2s_outputs_by_phase: uP2S,
                processed_phases_for_p2s: newProcPhases,
                isFullyProcessedSpecificSynchronic: allDone,
                current_phase_for_p2s_processing: nextPhase
              })
            }
          })
        } 
        // Handle global step outputs
        else if (stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE && output) {
          const p3_3 = (output as P3_3_Output)
          const core = p3_3?.generic_diachronic_structure_definition?.core_gdus || []
          const mermaid = p3_3 ? transformGenericDiachronicToMermaid(p3_3.generic_diachronic_structure_definition) : undefined
          
          set((state: any) => {
            state.genericAnalysisState.p3_3_output = p3_3
            state.genericAnalysisState.p3_3_mermaid_syntax = mermaid
            state.genericAnalysisState.p3_3_error = undefined
            state.genericAnalysisState.isFullyProcessedGenericDiachronic = true
            state.genericAnalysisState.core_gdus_for_sync_analysis = core
            state.genericAnalysisState.processed_gdus_for_p4s = []
            state.genericAnalysisState.current_gdu_for_p4s_processing = core[0] || undefined
            state.genericAnalysisState.p4s_outputs_by_gdu = {}
            state.genericAnalysisState.p4s_mermaid_syntax_by_gdu = {}
            state.genericAnalysisState.p4s_1_a_error = undefined
            state.genericAnalysisState.p4s_1_b_error = undefined
            state.genericAnalysisState.isFullyProcessedGenericSynchronic = (core.length === 0)
          })
        }
        // Handle P4S.1.A output processing
        else if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && output && currentGDU) {
          // [Large P4S.1.A processing logic - will be added in next edit]
          const llmResponse = output as any
          
          // Validate SSS nodes exist in their respective P2S_3 outputs
          const validatedNodes: typeof llmResponse.grouped_data = []
          const invalidNodes: Array<{ nodeId: string; transcriptId: string; phase: string; reason: string }> = []
          
          llmResponse.grouped_data.forEach((nodeData: any) => {
            const txData = processedData.get(nodeData.transcript_id)
            if (!txData) {
              invalidNodes.push({ 
                nodeId: nodeData.sss_node_id, 
                transcriptId: nodeData.transcript_id, 
                phase: nodeData.phase_name, 
                reason: "transcript not found" 
              })
              return
            }
            
            const phaseData = txData.p2s_outputs_by_phase?.[nodeData.phase_name]
            if (!phaseData?.p2s_3_output?.specific_synchronic_structure) {
              invalidNodes.push({ 
                nodeId: nodeData.sss_node_id, 
                transcriptId: nodeData.transcript_id, 
                phase: nodeData.phase_name, 
                reason: "phase data not found" 
              })
              return
            }
            
            const sssNodeExists = phaseData.p2s_3_output.specific_synchronic_structure.network_nodes.some(
              (n: any) => n.id === nodeData.sss_node_id
            )
            if (!sssNodeExists) {
              invalidNodes.push({ 
                nodeId: nodeData.sss_node_id, 
                transcriptId: nodeData.transcript_id, 
                phase: nodeData.phase_name, 
                reason: "SSS node not found in P2S_3 data" 
              })
              return
            }
            
            validatedNodes.push(nodeData)
          })
          
          if (invalidNodes.length > 0) {
            console.warn(`[P4S.1.A Processing] Found ${invalidNodes.length} invalid node references from LLM:`, invalidNodes)
            console.log(`[P4S.1.A Processing] Proceeding with ${validatedNodes.length} valid nodes, excluding invalid ones`)
          }
          
          // Group nodes by group_id (excluding "N/A")
          const groupsMap = new Map<string, Array<any>>()
          
          validatedNodes.forEach(nodeData => {
            if (nodeData.group_id !== "N/A") {
              if (!groupsMap.has(nodeData.group_id)) {
                groupsMap.set(nodeData.group_id, [])
              }
              groupsMap.get(nodeData.group_id)!.push({
                transcript_id: nodeData.transcript_id,
                phase_name: nodeData.phase_name,
                sss_node_id: nodeData.sss_node_id,
                sss_node_label: nodeData.sss_node_label,
                group_rationale: nodeData.group_rationale
              })
            }
          })
          
          // Validate cross-transcript requirement for each group
          const validatedGroups: P4S_1_A_Output['sss_node_groups'] = []
          const idiosyncraticGroups: SSSNodeGroup[] = []
          let groupCounter = 1
          let idiosyncraticCounter = 1
          
          groupsMap.forEach((nodes, groupId) => {
            const transcriptIds = new Set(nodes.map(n => n.transcript_id))
            if (transcriptIds.size >= 2) {
              // Valid cross-transcript group
              const groupRationale = nodes[0]?.group_rationale || `Generic group for concept: ${groupId}`
              validatedGroups.push({
                group_id: `gss_node_group_${groupCounter}_${groupId}`,
                group_rationale: groupRationale,
                contributing_sss_nodes: nodes.map(n => ({
                  transcript_id: n.transcript_id,
                  phase_name: n.phase_name,
                  sss_node_id: n.sss_node_id,
                  sss_node_label: n.sss_node_label
                }))
              })
              groupCounter++
              console.log(`[P4S.1.A Processing] Created valid group ${groupId} with ${nodes.length} nodes from ${transcriptIds.size} transcripts`)
            } else {
              const groupRationale = `Idiosyncratic group for concept: ${groupId}. ` + (nodes[0]?.group_rationale || 'No specific rationale provided.')
              idiosyncraticGroups.push({
                group_id: `idiosyncratic_group_${idiosyncraticCounter}_${groupId}`,
                group_rationale: groupRationale,
                contributing_sss_nodes: nodes.map(n => ({
                  transcript_id: n.transcript_id,
                  phase_name: n.phase_name,
                  sss_node_id: n.sss_node_id,
                  sss_node_label: n.sss_node_label
                }))
              })
              idiosyncraticCounter++
              console.log(`[P4S.1.A Processing] Identified idiosyncratic group ${groupId} from transcript ${Array.from(transcriptIds)[0]}`)
            }
          })
          
          if (validatedGroups.length === 0) {
            const noValidGroupsError = `No valid cross-transcript groups created for GDU ${currentGDU}. All groups failed the minimum 2-transcript requirement.`
            console.error(`[P4S.1.A Processing] ${noValidGroupsError}`)
            setTimeout(() => {
              setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
              setTimeout(() => { uiStore.setAutorunning($1) }, 0)
            }, 0)
            set((state: any) => { state.genericAnalysisState.p4s_1_a_error = noValidGroupsError })
            return
          }
          
          // Reconstruct final P4S_1_A_Output
          const p4s1a_out: P4S_1_A_Output = {
            analyzed_gdu: currentGDU,
            sss_node_groups: validatedGroups,
            idiosyncratic_sss_node_groups: idiosyncraticGroups.length > 0 ? idiosyncraticGroups : undefined,
            dependent_variable_focus: inputData?.userDvFocus?.dv_focus || [],
            grouping_process_notes: `Reconstructed from LLM classification. Original nodes: ${llmResponse.grouped_data.length}, Valid groups: ${validatedGroups.length}, Idiosyncratic groups: ${idiosyncraticGroups.length}. ${llmResponse.classification_notes || ''}`
          }
          
          console.log(`[P4S.1.A Processing] Successfully reconstructed P4S_1_A output with ${validatedGroups.length} valid groups`)
          
          set((state: any) => {
            state.genericAnalysisState.p4s_1_a_outputs_by_gdu = {
              ...(state.genericAnalysisState.p4s_1_a_outputs_by_gdu || {}),
              [currentGDU]: p4s1a_out
            }
            state.genericAnalysisState.p4s_1_a_error = undefined
          })
        }
        // Handle P4S.1.B output processing
        else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && output && currentGDU) {
          const p4s1b_out = output as P4S_1_Output
          const mermaid = p4s1b_out ? transformSynchronicToMermaid(p4s1b_out.generic_synchronic_structure, currentGDU) : undefined
          
          set((state: any) => {
            const newP4SOut = { 
              ...(state.genericAnalysisState.p4s_outputs_by_gdu || {}), 
              [currentGDU]: p4s1b_out 
            }
            const newP4SMermaid = { 
              ...(state.genericAnalysisState.p4s_mermaid_syntax_by_gdu || {}), 
              [currentGDU]: mermaid 
            }
            const newProcGDUs = Array.from(new Set([
              ...(state.genericAnalysisState.processed_gdus_for_p4s || []), 
              currentGDU
            ]))
            const allCoreDone = state.genericAnalysisState.core_gdus_for_sync_analysis 
              ? newProcGDUs.length === state.genericAnalysisState.core_gdus_for_sync_analysis.length 
              : (state.genericAnalysisState.core_gdus_for_sync_analysis || []).length === 0
            
            let nextGDUforP4S: string | undefined = undefined
            if (!allCoreDone && state.genericAnalysisState.core_gdus_for_sync_analysis) {
              nextGDUforP4S = state.genericAnalysisState.core_gdus_for_sync_analysis.find((g: string) => !newProcGDUs.includes(g))
            }
            
            state.genericAnalysisState.p4s_outputs_by_gdu = newP4SOut
            state.genericAnalysisState.p4s_mermaid_syntax_by_gdu = newP4SMermaid
            state.genericAnalysisState.processed_gdus_for_p4s = newProcGDUs
            state.genericAnalysisState.p4s_1_b_error = undefined
            state.genericAnalysisState.isFullyProcessedGenericSynchronic = allCoreDone
            state.genericAnalysisState.current_gdu_for_p4s_processing = nextGDUforP4S
            state.genericAnalysisState.p4s_1_a_error = nextGDUforP4S ? undefined : state.genericAnalysisState.p4s_1_a_error
          })
        }
        // Handle P3.2 output processing
        else if (stepId === StepId.P3_2_IDENTIFY_GDUS && output) {
          // All approaches now produce the original schema directly - validate and clean for duplicates
          console.log(`[P3.2 ${P3_2_APPROACH}] Using direct output from LLM with original schema`)
          
          // Apply defensive validation - clean any duplicate RDU assignments with first-assignment-wins
          const cleanedOutput = STEP_CONFIGS[StepId.P3_2_IDENTIFY_GDUS]?.validateAndClean 
            ? STEP_CONFIGS[StepId.P3_2_IDENTIFY_GDUS].validateAndClean(output, inputData?.tot_rdus || 0)
            : output
          
          const p3_2_output = cleanedOutput as P3_2_Output
          
          set((state: any) => {
            state.genericAnalysisState.p3_2_output = p3_2_output
            state.genericAnalysisState.p3_2_error = undefined
          })
        }
        // Handle other global outputs 
        else if (key && !transcriptIdToProcess && typeof key === 'string') {
          const eKey = `${key.replace('_output','_error')}` as keyof GenericAnalysisState
          set((state: any) => {
            state.genericAnalysisState[key as keyof GenericAnalysisState] = output
            state.genericAnalysisState[eKey] = undefined
          })
          
          // Special handling for steps that generate diagrams
          if (stepId === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS && output) {
            const p7_3 = output as P7_3_Output
            const mermaid = p7_3.final_dag ? transformDagToMermaid(p7_3.final_dag) : undefined
            set((state: any) => { state.genericAnalysisState.p7_3_mermaid_syntax_dag = mermaid })
          } else if (stepId === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG && output) {
            const p7_3b = output as P7_3b_Output
            const mermaid = p7_3b.final_dag ? transformDagToMermaid(p7_3b.final_dag) : undefined
            set((state: any) => { state.genericAnalysisState.p7_3b_mermaid_syntax_dag = mermaid })
          } else if (stepId === StepId.P5_2_HOLISTIC_REFINEMENT) {
            set((state: any) => { state.genericAnalysisState.isRefinementDone = true })
          } else if (stepId === StepId.P7_5_GENERATE_FORMAL_HYPOTHESES) {
            set((state: any) => { state.genericAnalysisState.isCausalModelingDone = true })
          }
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
              setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
              setTimeout(() => { uiStore.setAutorunning($1) }, 0)
            }, 0)
          }
          return
        }
        
        setTimeout(() => {
          setTimeout(() => { uiStore.setActiveTranscript($1) }, 0)
        }, 0)
        
        if (details.nextStepId === StepId.COMPLETE) {
          const { genericAnalysisState } = get()
          const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete."
          setTimeout(() => {
            setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
            setTimeout(() => { uiStore.setAutorunning($1) }, 0)
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
          setTimeout(() => { uiStore.setActiveTranscript($1) }, 0)
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
              setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
            }, 0)
          }
        } catch (error) {
          console.error('Failed to upload transcripts:', error)
          alert('Failed to upload transcripts. Please try again.')
        }
      },
      
            
            // Handle files dropped from UI store (avoids circular dependency)
            handleDroppedFiles: async (files: File[]) => {
              if (files.length === 0) return
      
              try {
                await get().addTranscripts(files)
                
                // Update UI state
                const uiStore = useUIStore.getState()
                if (uiStore.currentStepInfo.stepId === StepId.IDLE) {
                  setTimeout(() => {
                    setTimeout(() => { uiStore.setCurrentStepInfo($1) }, 0)
                  }, 0)
                }
              } catch (error) {
                console.error('Failed to handle dropped files:', error)
                alert('Failed to upload files. Please try again.')
              }
            },
      setActiveTranscriptByIndex: (index: number) => {
        const uiStore = useUIStore.getState()
        setTimeout(() => {
          setTimeout(() => { uiStore.setActiveTranscript($1) }, 0)
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
      },

      retryWithUserSeed: () => {
        const uiStore = useUIStore.getState()
        const { currentStepInfo, retrySeedInput } = uiStore
        
        if (currentStepInfo.status === StepStatus.Error && retrySeedInput.trim()) {
          const seedValue = parseInt(retrySeedInput.trim(), 10)
          if (!isNaN(seedValue) && seedValue > 0) {
            // Retry the current step with the user-provided seed
            get().processSingleStep({
              stepId: currentStepInfo.stepId,
              transcriptIdToProcess: currentStepInfo.transcriptId,
              overrideSeed: seedValue
            })
            
            // Clear the retry input
            uiStore.setRetrySeedInput('')
          }
        }
      },

      isGlobalStep: (stepId: StepId): boolean => {
        return isGlobalStep(stepId)
      },

      loadStepData: (stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string): { inputData?: any, outputData?: any, error?: string, groundingSources?: any[] } => {
        const { processedData, genericAnalysisState, promptHistory } = get()
        const keyPrefix = stepIdToDataKeyPrefix[stepIdToLoad]
        let output: any
        let error: string | undefined
        
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