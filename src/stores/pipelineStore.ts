import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { localForageStorage } from '../utils/storage'
import { performDataMigration } from '../utils/migration'
import { useSettingsStore } from './settingsStore'
import { useUIStore } from './uiStore'
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
  P1_5_Output
} from '../../types'
import { ProcessState } from '../config/pipelineDefinition'
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
  getStepDisplayName,
  GEMINI_MODEL_TEXT
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
import packageJson from '../../package.json'
import { PipelineOrchestrator } from '../services/PipelineOrchestrator'

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
interface ProcessSlice {
  processState: ProcessState
  updateProcessState: (updates: Partial<ProcessState>) => void
  setProcessState: (state: ProcessState) => void
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
    hilMetaPrompt?: string,
    settings?: SettingsData
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
  resetPipeline: () => void
  clearAutosaveData: () => Promise<void>
  loadState: (savedState: SavedState) => void
  getSaveState: () => SavedState
  downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any) => void
  downloadHistory: (format: 'tsv' | 'json', outputDirectory: string) => void
  generateAppendix: (type: 'markdown' | 'html', outputDirectory: string) => void
  retryWithUserSeed: () => void
  // New actions for SettingsPanel
  saveStateToFile: () => void
  loadStateFromFile: (event: React.ChangeEvent<HTMLInputElement>) => void
  uploadTranscripts: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleDroppedFiles: (files: File[]) => Promise<void>
  setActiveTranscriptByIndex: (index: number) => void
  getTranscriptStatusDisplay: (transcriptId: string) => string
  isGlobalStep: (stepId: StepId) => boolean
  loadStepData: (stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string) => any
  getStepStatusForPipelineView: (stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string) => StepStatus
  handlePipelineStepClick: (clickedStepId: StepId, settings: SettingsData, activeTranscriptIndex: number) => void
  // State cleanup actions
  clearShouldStopAutorunFlag: () => void
  clearLastHilContext: () => void
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
  getStepStatusForPipelineView: (stepId: StepId, uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }) => { status: StepStatus; error?: string }
}

type PipelineState = TranscriptSlice & GenericAnalysisSlice & PromptSlice & DependencyInjectionSlice & ProcessSlice
type PipelineStore = PipelineState & PipelineActions & PipelineSelectors

// UI updates are now handled through state changes that App.tsx listens to
// Helper function to process file content
const processFileContent = async (file: File): Promise<RawTranscript> => {
  const text = await file.text()
  
  return {
    id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    filename: file.name,
    content: text
  }
}

// Create slices
const createTranscriptSlice = (set: any, get: any): TranscriptSlice => ({
  rawTranscripts: [],
  processedData: new Map(),
  
  addTranscripts: async (files: File[]) => {
    console.log('🔄 addTranscripts called with', files.length, 'files');
    const newTranscripts = await Promise.all(files.map(processFileContent))
    console.log('✅ Processed transcripts:', newTranscripts);
    
    set((state: PipelineState) => {
      console.log('📝 Starting state update...');
      state.rawTranscripts = [...state.rawTranscripts, ...newTranscripts]
      console.log('📋 Updated rawTranscripts, count:', state.rawTranscripts.length);
      
      // Initialize processed data for new transcripts
      console.log('🔄 Initializing processed data...');
      newTranscripts.forEach(transcript => {
        console.log('📊 Processing transcript:', transcript.id, transcript.filename);
        state.processedData.set(transcript.id, {
          id: transcript.id,
          filename: transcript.filename,
          isFullyProcessedSpecificDiachronic: false,
          isFullyProcessedSpecificSynchronic: false
        } as TranscriptProcessedData)
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

const createDependencyInjectionSlice = (set: any, get: any): DependencyInjectionSlice => ({
  uiCallbacks: undefined,
  
  setUICallbacks: (callbacks: UICallbacks) => {
    set((state: PipelineState) => {
      state.uiCallbacks = callbacks
    })
  }
})

const createProcessSlice = (set: any, get: any): ProcessSlice => ({
  processState: {
    status: 'idle',
    currentPartIndex: -1,
    currentStepIndex: -1,
    iterationContext: {}
  },
  
  updateProcessState: (updates: Partial<ProcessState>) => {
    set((state: PipelineState) => {
      state.processState = { ...state.processState, ...updates }
    })
  },
  
  setProcessState: (newState: ProcessState) => {
    set((state: PipelineState) => {
      state.processState = newState
    })
  }
})

// Main store
export const usePipelineStore = create<PipelineStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
      ...createTranscriptSlice(set, get),
      ...createGenericAnalysisSlice(set, get),
      ...createPromptSlice(set, get),
      ...createDependencyInjectionSlice(set, get),
      ...createProcessSlice(set, get),
      
      // Main pipeline orchestrator - integrated from pipelineActions.ts
      processSingleStep: async (params) => {
        const { stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt, settings } = params
        const { rawTranscripts, processedData, genericAnalysisState } = get()

        console.groupCollapsed(`🚀 [pipelineStore] processSingleStep: ${stepId}`);
        console.log(`- Transcript ID: ${transcriptIdToProcess || 'N/A (Global Step)'}`);
        console.log(`- Override Seed: ${overrideSeed || 'Default'}`);
        console.log(`- HIL Prompt: ${hilMetaPrompt ? 'Yes' : 'No'}`);
        console.log(`- Raw Transcripts Count: ${rawTranscripts.length}`);

        // Use passed settings instead of direct store access
        if (!settings) {
          console.error('❌ No settings provided to processSingleStep');
          console.groupEnd();
          return;
        }
        
        const isReportStepForThisCall = stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT
        const { apiKey, userDvFocus, temperature, seed } = settings
        
        // Validate settings
        const apiKeyPresent = !!apiKey
        const dvFocusError = !userDvFocus?.dv_focus?.length ? 'DV focus is required' : undefined
        
        // Get step config
        const config = STEP_CONFIGS[stepId]
        if (!config) {
          console.error(`❌ No configuration found for stepId: ${stepId}`);
          // Update pipeline state - App.tsx will handle UI updates
          set(state => ({
            ...state,
            lastStepInfo: { stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, status: StepStatus.Idle },
            shouldStopAutorun: true
          }))
          console.groupEnd();
          return
        }
        
        console.log(`✅ Step config found for: ${stepId}`);
        
        // Add special debug logging for P1.5
        if (stepId === StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
          console.log('🔍 [P1.5 Debug] Starting P1.5 processing');
          console.log('- transcriptIdToProcess:', transcriptIdToProcess);
          console.log('- currentTranscript exists:', !!rawTranscripts.find(t => t.id === transcriptIdToProcess));
          if (transcriptIdToProcess) {
            const transcriptData = processedData.get(transcriptIdToProcess);
            console.log('- P1.4 output exists:', !!transcriptData?.p1_4_output);
            console.log('- P1.4 output:', transcriptData?.p1_4_output);
          }
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
                // Store synchronization - App.tsx will handle UI updates
                set(state => ({
                  ...state,
                  lastStepInfo: { stepId, status: StepStatus.Error, error: "Phase processing requirements not met" },
                  shouldStopAutorun: true
                }))
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
                // Store synchronization - App.tsx will handle UI updates
                set(state => ({
                  ...state,
                  lastStepInfo: { stepId, status: StepStatus.Error, error: "Generic synchronic processing not complete" },
                  shouldStopAutorun: true
                }))
              }, 0)
              return
            }
          }
          if (!currentGDU && (tempGenericState.core_gdus_for_sync_analysis || []).length > 0 && !tempGenericState.isFullyProcessedGenericSynchronic) {
            setTimeout(() => {
              // Store synchronization - App.tsx will handle UI updates
              set(state => ({
                ...state,
                lastStepInfo: { stepId, status: StepStatus.Error, error: "GDU processing requirements not met" },
                shouldStopAutorun: true
              }))
            }, 0)
            return
          }
        }
        
        // Get input data
        console.log('📦 Calling getInput with:', {
          currentTranscript: currentTranscript?.filename || 'None',
          currentPhase,
          currentGDU,
          apiKeyPresent,
          userDvFocus
        });
        
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
        
        console.log('📦 Input result:', inputResult);
        
        if (inputResult === null || inputResult?.error) {
          const errText = `Input error for ${stepId}: ${inputResult?.error || 'Input null'}`
          console.error(`❌ Input validation failed: ${errText}`);
          setTimeout(() => {
            // Store synchronization - App.tsx will handle UI updates
            set(state => ({
              ...state,
              lastStepInfo: { stepId, status: StepStatus.Error, error: errText },
              shouldStopAutorun: true
            }))
          }, 0)
          
          if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
            set((state) => { state.genericAnalysisState.p4s_1_a_error = errText })
          } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
            set((state) => { state.genericAnalysisState.p4s_1_b_error = errText })
          }
          
          console.groupEnd();
          return
        }
        
        const inputData = inputResult.data
        // Store synchronization - set processing status
        set(state => ({
          ...state,
          lastStepInfo: { stepId, status: StepStatus.Processing, transcriptId: transcriptIdToProcess }
        }))
        
        // Process the step
        let output: string | any
        let apiError: string | undefined
        let groundingSources: PromptHistoryEntry['groundingSources']
        let estIn: number | undefined = 0
        let estOut: number | undefined = 0
        // NEW LOGIC: Check if this is a programmatic step (no generatePrompt function)
        const isProgrammaticStep = !config.generatePrompt;
        
        let promptForHistory = isProgrammaticStep 
          ? "Programmatic step execution. No LLM prompt."
          : (hilMetaPrompt || config.generatePrompt!(inputData))
        
        if (isProgrammaticStep) {
          console.log(`⚙️ [pipelineStore] Executing programmatic step: ${stepId}`);
          output = inputData; // The 'input' is the final output for programmatic steps
          apiError = undefined;
          console.log('✅ Programmatic step execution successful');
        } else if (isReportStepForThisCall) {
          console.log('📝 Generating report programmatically...');
          // Generate report programmatically
          try {
            output = generateMarkdownReportProgrammatically(inputData as ReportData)
            apiError = undefined
            console.log('✅ Report generation successful');
          } catch (e: any) {
            console.error("❌ Error generating report programmatically:", e)
            output = ""
            apiError = `Programmatic report generation failed: ${e.message || String(e)}`
          }
          promptForHistory = "Programmatic report generation."
        } else {
          console.log('📞 Calling Gemini API...');
          console.log('- Temperature:', temperature);
          console.log('- Seed:', overrideSeed !== undefined ? overrideSeed : seed);
          console.log('- Is JSON Output:', config.isJsonOutput);
          
          // Call Gemini API
          const effectiveSeed = overrideSeed !== undefined ? overrideSeed : seed
          const apiResult = await callGeminiAPI(
            promptForHistory, 
            config.isJsonOutput, 
            false, // useGrounding
            temperature, 
            effectiveSeed,
            1 // maxRetries/attempt
          )
          output = config.isJsonOutput ? apiResult.parsedJson : apiResult.text
          apiError = apiResult.error
          
          console.log('📡 API Response:', {
            hasOutput: !!output,
            outputType: typeof output,
            hasError: !!apiError,
            error: apiError
          });
          
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
                model: GEMINI_MODEL_TEXT, 
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
          console.error(`❌ Step Failed: ${stepId}. Error:`, apiError);
          get().handleStepError(stepId, transcriptIdToProcess, apiError, inputData, output, groundingSources, currentGDU, currentPhase, isReportStepForThisCall)
          console.groupEnd();
          return
        }
        
        // Handle successful output
        if (isReportStepForThisCall) {
          console.log(`✅ Report Generation Succeeded for: ${stepId}`);
          get().handleReportGeneration(output)
        } else {
          console.log(`✅ Step Succeeded: ${stepId}`);
          get().handleSuccessfulStep(stepId, transcriptIdToProcess, output, inputData, groundingSources, currentGDU, currentPhase, processedData)
        }
        
        console.groupEnd();
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
        console.log(`🔴 [handleStepError] Setting lastStepInfo to Error for failed step: ${stepId}`);
        console.log(`- TranscriptId: ${transcriptIdToProcess || 'N/A (global)'}`);
        console.log(`- Error: ${apiError}`);
        
        // Update pipeline state - App.tsx will handle UI updates
        set(state => ({
          ...state,
          lastStepInfo: { 
            stepId, 
            status: StepStatus.Error,
            error: apiError,
            transcriptId: transcriptIdToProcess
          },
          lastError: apiError
        }))
        
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
        
        // Signal to stop autorun
        set(state => ({
          ...state,
          shouldStopAutorun: true
        }))
      },

      handleReportGeneration: (output: any) => {
        if (typeof output === 'string' && output.trim() !== '') {
          set((state: any) => {
            state.genericAnalysisState.isReportGenerated = true
            state.genericAnalysisState.p6_1_output = output as P6_1_Output
            state.genericAnalysisState.p6_1_error = undefined
            // Update pipeline state - App.tsx will handle UI updates
            state.lastStepInfo = { stepId: StepId.P6_1_GENERATE_MARKDOWN_REPORT, status: StepStatus.Success, outputData: output }
          })
        } else {
          const rptErr = "Report generation resulted in empty/invalid content."
          
          set((state: any) => {
            state.genericAnalysisState.isReportGenerated = false
            state.genericAnalysisState.p6_1_output = undefined
            state.genericAnalysisState.p6_1_error = rptErr
            // Update pipeline state - App.tsx will handle UI updates
            state.lastStepInfo = { stepId: StepId.P6_1_GENERATE_MARKDOWN_REPORT, status: StepStatus.Error, error: rptErr }
            state.lastError = rptErr
            state.shouldStopAutorun = true
          })
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
        console.log(`✅ [handleSuccessfulStep] Setting lastStepInfo to Success for: ${stepId}`);
        console.log(`- TranscriptId: ${transcriptIdToProcess || 'N/A (global)'}`);
        console.log(`- Output type: ${typeof output}`);
        
        // Update pipeline state - App.tsx will handle UI updates
        set(state => ({
          ...state,
          lastStepInfo: { 
            stepId, 
            status: StepStatus.Success,
            outputData: output,
            transcriptId: transcriptIdToProcess
          }
        }))
        
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
              
              // Special handling for P1.5
              if (stepId === StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && output) {
                console.log('🔍 [P1.5 Debug] Handling P1.5 successful output');
                nD.isFullyProcessedSpecificDiachronic = true
                // No mermaid generation for P1.5 - that's only for synchronic structures
                const phases = (output as P1_5_Output)?.specific_diachronic_structure?.phases.map(p => p.phase_name) || []
                nD.phases_for_p2s_processing = phases
                nD.current_phase_for_p2s_processing = phases[0] || undefined
                nD.processed_phases_for_p2s = []
                nD.p2s_outputs_by_phase = {}
                nD.isFullyProcessedSpecificSynchronic = phases.length === 0
                console.log('🔍 [P1.5 Debug] Set phases for P2S processing:', phases);
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
            // Store synchronization - App.tsx will handle UI updates
            set(state => ({
              ...state,
              lastStepInfo: { stepId, status: StepStatus.Error, error: noValidGroupsError },
              shouldStopAutorun: true
            }))
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
      
                  invalidateStateFromStep: (stepId: StepId, transcriptId?: string, activeTranscriptIndex?: number) => {
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        const activeTxId = transcriptId || (activeTranscriptIndex !== undefined ? rawTranscripts[activeTranscriptIndex]?.id : undefined)
        
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
        
        // Note: UI state updates should be handled by the caller or through state synchronization
        // Note: currentStepInfo is not restored from saved state
      },
      
      getSaveState: (): SavedState => {
        const state = get()
        const uiState = useUIStore.getState()
        const settingsState = useSettingsStore.getState()
        
        return {
          version: packageJson.version,
          savedAt: new Date().toISOString(),
          rawTranscripts: state.rawTranscripts,
          processedDataArray: Array.from(state.processedData.entries()),
          genericAnalysisState: state.genericAnalysisState,
          promptHistory: state.promptHistory,
          currentStepInfo: uiState.currentStepInfo,
          activeTranscriptIndex: uiState.activeTranscriptIndex,
          userDvFocus: settingsState.userDvFocus,
          dvFocusInput: settingsState.dvFocusInput,
          temperature: settingsState.temperature,
          seedInput: settingsState.seedInput,
          outputDirectory: settingsState.outputDirectory,
          autoDownloadResults: settingsState.autoDownloadResults,
          totalInputTokens: state.totalInputTokens,
          totalOutputTokens: state.totalOutputTokens,
          elapsedTime: uiState.elapsedTime
        }
      },

      // Pipeline selectors for derived state
      getPreviousStepDetails: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => {
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

      isPreviousStepDisabled: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => {
        return currentStepInfo.status === StepStatus.Loading || !get().getPreviousStepDetails(currentStepInfo, activeTranscriptIndex)
      },

      isNextStepDisabled: (currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number) => {
        const { genericAnalysisState, rawTranscripts, processedData, processState } = get()
        
        // Handle special states first
        if (currentStepInfo.stepId === StepId.IDLE) {
          return rawTranscripts.length === 0 // Can only proceed from IDLE if we have transcripts
        }
        
        if (currentStepInfo.stepId === StepId.COMPLETE) {
          return true // Cannot proceed from COMPLETE
        }
        
        const orchestrator = new PipelineOrchestrator()
        
        const nextStep = orchestrator.getNextStep(
          processState,
          currentStepInfo,
          { rawTranscripts, processedData, genericAnalysisState },
          activeTranscriptIndex
        )
        
        return currentStepInfo.status === StepStatus.Loading || 
               (!nextStep && currentStepInfo.stepId !== StepId.COMPLETE && !genericAnalysisState.isReportGenerated)
      },

      isRunStepDisabled: (currentStepInfo: CurrentStepInfo, apiKeyPresent: boolean, dvFocusError?: string) => {
        return currentStepInfo.stepId === StepId.IDLE || 
               currentStepInfo.status === StepStatus.Loading || 
               currentStepInfo.stepId === StepId.COMPLETE || 
               (!apiKeyPresent && currentStepInfo.stepId !== StepId.P6_1_GENERATE_MARKDOWN_REPORT) || 
               !!dvFocusError
      },

      isHilModalDisabled: (currentStepInfo: CurrentStepInfo) => {
        
        return currentStepInfo.stepId === StepId.IDLE || 
               currentStepInfo.status === StepStatus.Loading || 
               currentStepInfo.stepId === StepId.COMPLETE || 
               !currentStepInfo.inputData || 
               (!currentStepInfo.outputData && !currentStepInfo.error)
      },

      isDownloadOutputDisabled: (currentStepInfo: CurrentStepInfo) => {
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
      downloadOutput: (stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any, currentStepInfo?: CurrentStepInfo, outputDirectory?: string) => {
        // If not provided, use defaults - but ideally these should be passed in
        const actualCurrentStepInfo = currentStepInfo || get().lastStepInfo || { stepId: StepId.IDLE, status: StepStatus.Idle }
        const actualOutputDirectory = outputDirectory || ''
        const { processedData, genericAnalysisState } = get()
        
        const stepId = stepIdToDownload || actualCurrentStepInfo.stepId
        const transcriptIdToUse = transcriptId || actualCurrentStepInfo.transcriptId
        
        let data = dataToDownload
        let filename = `${actualOutputDirectory}/${stepId}_output`
        
        // If no specific data provided, get it from current step
        if (!data) {
          if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
            data = genericAnalysisState.p6_1_output
          } else {
            data = actualCurrentStepInfo.outputData
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

      downloadHistory: (format: 'tsv' | 'json', outputDirectory: string) => {
        const { promptHistory } = get()
        
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
        const { rawTranscripts, processedData, genericAnalysisState } = get()
        
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
        
        const content = JSON.stringify(savedState, null, 2)
        const filename = `${settingsState.outputDirectory}/upath_state_${new Date().toISOString().replace(/:/g, '-')}.json`
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
            
            // 1. Restore pipeline data
            get().loadState(savedState)
            
            // 2. Restore UI state
            const uiStore = useUIStore.getState()
            if (savedState.currentStepInfo) {
              uiStore.setCurrentStepInfo(savedState.currentStepInfo)
            }
            if (savedState.activeTranscriptIndex !== undefined) {
              uiStore.setActiveTranscript(savedState.activeTranscriptIndex)
            }
            if (savedState.elapsedTime) {
              useUIStore.setState({ elapsedTime: savedState.elapsedTime, processStartTime: null })
            }
            
            // 3. Restore settings state
            const settingsStore = useSettingsStore.getState()
            
            // Handle older saved states that might not have all fields
            const settingsUpdate: any = {}
            if (savedState.userDvFocus !== undefined) settingsUpdate.userDvFocus = savedState.userDvFocus
            if (savedState.dvFocusInput !== undefined) settingsUpdate.dvFocusInput = savedState.dvFocusInput
            if (savedState.temperature !== undefined) settingsUpdate.temperature = savedState.temperature
            if (savedState.seedInput !== undefined) settingsUpdate.seedInput = savedState.seedInput
            if (savedState.outputDirectory !== undefined) settingsUpdate.outputDirectory = savedState.outputDirectory
            if (savedState.autoDownloadResults !== undefined) settingsUpdate.autoDownloadResults = savedState.autoDownloadResults
            
            settingsStore.updateSettings(settingsUpdate)
            
            // Re-validate derived state in settings store if the values exist
            if (savedState.dvFocusInput) {
              settingsStore.validateAndSetDvFocus(savedState.dvFocusInput)
            }
            if (savedState.seedInput) {
              settingsStore.validateAndSetSeed(savedState.seedInput)
            }
            
            // Reset file input
            if (event.target) {
              event.target.value = ''
            }
            
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
          
          // Signal ready state if we're idle
          const currentState = get()
          if (!currentState.lastStepInfo || currentState.lastStepInfo.stepId === StepId.IDLE) {
            set(state => ({
              ...state,
              lastStepInfo: { stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, status: StepStatus.Idle }
            }))
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
                console.log('📤 Calling addTranscripts...');
                await get().addTranscripts(files)
                console.log('✅ addTranscripts completed successfully');
                
                // Signal ready state if we're idle
                const currentState = get()
                if (!currentState.lastStepInfo || currentState.lastStepInfo.stepId === StepId.IDLE) {
                  set(state => ({
                    ...state,
                    lastStepInfo: { stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, status: StepStatus.Idle }
                  }))
                }
              } catch (error) {
                console.error('❌ Error in handleDroppedFiles:', error);
                console.error('❌ Error stack:', error.stack);
                alert('Failed to upload files. Please try again.')
              }
            },
      // Note: setActiveTranscriptByIndex removed - UI operations should be handled by UI store

      getTranscriptStatusDisplay: (transcriptId: string): string => {
        const { processedData } = get()
        const data = processedData.get(transcriptId)
        
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
      },

      getStepStatusForPipelineView: (stepId: StepId, uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }): { status: StepStatus; error?: string } => {
        const { processedData, genericAnalysisState, rawTranscripts } = get()
        
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
      
      handlePipelineStepClick: (clickedStepId: StepId, settings: SettingsData, activeTranscriptIndex: number) => {
        const { rawTranscripts, processedData, uiCallbacks } = get()
        
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
            error: data.error,
            outputData: data.outputData
          })
        }
      },
      
      // State cleanup actions
      clearShouldStopAutorunFlag: () => {
        set((state) => {
          state.shouldStopAutorun = false
        })
      },
      
      clearLastHilContext: () => {
        set((state) => {
          state.lastHilContext = undefined
        })
      }
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
          // Handle the case where value might be the state directly instead of wrapped
          const stateData = value.state || value;
          
          console.log('💾 [Storage] setItem - incoming value:', {
            rawTranscriptsLength: stateData?.rawTranscripts?.length || 0,
            processedDataType: stateData?.processedData?.constructor?.name || 'unknown',
            processedDataSize: stateData?.processedData instanceof Map ? stateData.processedData.size : (stateData?.processedData?.length || 0)
          })
          
          const dataToStore = {
            ...value,
            state: {
              ...stateData,
              // Convert Map to array for storage
              processedData: stateData?.processedData instanceof Map 
                ? Array.from(stateData.processedData.entries()) 
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
        console.log('🔄 [Rehydration] onRehydrateStorage callback called')
        console.log('🔄 [Rehydration] state:', state ? 'present' : 'null')
        console.log('🔄 [Rehydration] error:', error)
        
        if (error) {
          console.error('❌ [Rehydration] Failed to rehydrate state from localForage:', error)
          useUIStore.getState().setHasRehydrated(true)
          useUIStore.getState().setSessionWasRestored(false)
        } else {
          // Set UI flags based on whether data was restored
          const hasData = state && (
            state.rawTranscripts?.length > 0 || 
            state.processedData?.size > 0 ||
            state.promptHistory?.length > 0
          )
          console.log('✅ [Rehydration] hasData check:', hasData)
          console.log('✅ [Rehydration] rawTranscripts length:', state?.rawTranscripts?.length || 0)
          console.log('✅ [Rehydration] processedData size:', state?.processedData?.size || 0)
          
          useUIStore.getState().setHasRehydrated(true)
          useUIStore.getState().setSessionWasRestored(!!hasData)
          
          console.log('🔄 [Rehydration] UI flags set - hasRehydrated: true, sessionWasRestored:', !!hasData)
        }
      },
      partialize: (state) => {
        // Only persist if there's actually data to save
        const hasData = state.rawTranscripts.length > 0 || 
                       state.processedData.size > 0 || 
                       state.promptHistory.length > 0 ||
                       state.totalInputTokens > 0 ||
                       state.totalOutputTokens > 0
        
        if (!hasData) {
          console.log('🚫 [Storage] Skipping persist - no meaningful data to save')
          return undefined // Don't persist empty state
        }
        
        console.log('✅ [Storage] Persisting meaningful data:', {
          transcripts: state.rawTranscripts.length,
          processedData: state.processedData.size,
          promptHistory: state.promptHistory.length
        })
        
        return {
          // Only persist actual data, not UI state
          rawTranscripts: state.rawTranscripts,
          processedData: state.processedData,
          genericAnalysisState: state.genericAnalysisState,
          promptHistory: state.promptHistory,
          totalInputTokens: state.totalInputTokens,
          totalOutputTokens: state.totalOutputTokens,
          processState: state.processState
        }
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

// Selectors for derived state
export const selectCurrentStepDisplay = (currentStepInfo: CurrentStepInfo, transcriptsLength: number) => {
  const state = usePipelineStore.getState()
  
  // Loading state
  if (currentStepInfo.status === StepStatus.Loading) {
    return {
      type: 'loading' as const,
      message: 'Loading output...'
    }
  }
  
  // Error state with no output
  if (currentStepInfo.status === StepStatus.Error && !currentStepInfo.outputData) {
    return {
      type: 'error' as const,
      message: 'Error occurred. See status bar for details.'
    }
  }
  
  // No output yet
  if (!currentStepInfo.outputData && currentStepInfo.stepId !== StepId.IDLE) {
    return {
      type: 'empty' as const,
      message: 'No output to display for this step yet.'
    }
  }
  
  // Idle states
  if (currentStepInfo.stepId === StepId.IDLE && transcriptsLength === 0) {
    return {
      type: 'empty' as const,
      message: 'Upload transcripts to begin.'
    }
  }
  
  if (currentStepInfo.stepId === StepId.IDLE && transcriptsLength > 0) {
    return {
      type: 'empty' as const,
      message: 'Ready to start. Click "Autorun" or "Next Step".'
    }
  }
  
  // Check for mermaid chart
  const mermaidChart = selectMermaidChartForStep(currentStepInfo)
  if (mermaidChart) {
    return {
      type: 'mermaid' as const,
      chart: mermaidChart
    }
  }
  
  // Report steps
  if (currentStepInfo.stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT || currentStepInfo.stepId === StepId.COMPLETE) {
    if (typeof currentStepInfo.outputData === 'string' && currentStepInfo.outputData.trim() !== "") {
      return {
        type: 'report' as const,
        markdown: currentStepInfo.outputData
      }
    }
    return {
      type: 'empty' as const,
      message: 'Report not generated or empty.'
    }
  }
  
  // Regular output
  return {
    type: 'output' as const,
    data: currentStepInfo.outputData
  }
}

export const selectMermaidChartForStep = (stepInfo: CurrentStepInfo): string | undefined => {
  const state = usePipelineStore.getState()
  const { processedData, genericAnalysisState } = state
  const tId = stepInfo.transcriptId
  const phase = stepInfo.currentPhaseForP2S
  const gdu = stepInfo.currentGduForP4S
  
  switch (stepInfo.stepId) {
    // P1.4 no longer uses mermaid - it uses table display with comparison
    // case StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE:
    //   return tId ? processedData.get(tId)?.p1_4_mermaid_syntax : undefined
      
    case StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE:
      return tId && phase ? processedData.get(tId)?.p2s_outputs_by_phase?.[phase]?.p2s_3_mermaid_syntax : undefined
      
    case StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE:
      return genericAnalysisState.p3_3_mermaid_syntax
      
    case StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS:
      return gdu ? genericAnalysisState.p4s_mermaid_syntax_by_gdu?.[gdu] : undefined
      
    case StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS:
      return genericAnalysisState.p7_3_mermaid_syntax_dag
      
    case StepId.P7_3B_VALIDATE_AND_CLEAN_DAG:
      return genericAnalysisState.p7_3b_mermaid_syntax_dag
      
    default:
      return undefined
  }
}