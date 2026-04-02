/**
 * Service Interface Definitions for Pipeline Step Processing
 * 
 * These interfaces define the contracts for the services extracted from
 * the monolithic processSingleStep function.
 */

import { 
  StepId, 
  StepStatus, 
  RawTranscript, 
  TranscriptProcessedData, 
  GenericAnalysisState, 
  PromptHistoryEntry, 
  GroundingChunk,
  CurrentStepInfo 
} from '../../../types'

// ============================================================================
// Core Service Parameters
// ============================================================================

export interface StepExecutionParams {
  stepId: StepId
  transcriptIdToProcess?: string
  overrideSeed?: number
  hilMetaPrompt?: string
  settings?: SettingsData
}

export interface SettingsData {
  apiKey: string
  temperature: number
  seed?: number
  userDvFocus: { dv_focus: string[] }
}

export interface StoreState {
  rawTranscripts: RawTranscript[]
  processedData: Map<string, TranscriptProcessedData>
  genericAnalysisState: GenericAnalysisState
}

// ============================================================================
// Service Result Types
// ============================================================================

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ValidationResult {
  isValid: boolean
  stepId: StepId
  transcriptIdToProcess?: string
  overrideSeed?: number
  hilMetaPrompt?: string
  settings: SettingsData
  error?: string
}

export interface ExecutionContext {
  currentTranscript?: RawTranscript
  currentPhase?: string
  currentGDU?: string
  tempGenericState: GenericAnalysisState
  isReportStep: boolean
}

export interface StepInput {
  data: any
  error?: string
}

export interface StepOutput {
  output: any
  apiError?: string
  groundingSources?: GroundingChunk[]
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  promptForHistory: string
}

// ============================================================================
// Store Interfaces (for dependency injection)
// ============================================================================

export type TranscriptStoreGetter = () => {
  rawTranscripts: RawTranscript[]
  processedData: Map<string, TranscriptProcessedData>
}

/**
 * Store operations interface for PipelineOrchestrator dependency injection
 * Provides all store access operations needed by the orchestrator
 */
export interface StoreOperations {
  // Get current state
  getTranscriptState: () => {
    rawTranscripts: RawTranscript[]
    processedData: Map<string, TranscriptProcessedData>
  }
  getAnalysisState: () => {
    genericAnalysisState: GenericAnalysisState
  }
  
  // Update operations
  replaceProcessedData: (id: string, data: TranscriptProcessedData) => void
  updateGenericState: (updates: Partial<GenericAnalysisState>) => void
}

/**
 * Extended store operations for StoreTransactionService
 * Includes all store operations needed for transactions
 */
export interface TransactionStoreOperations extends StoreOperations {
  // Get prompt history state
  getPromptHistoryState: () => {
    promptHistory: PromptHistoryEntry[]
    totalInputTokens: number
    totalOutputTokens: number
  }
  
  // Get orchestration state
  getOrchestrationState: () => {
    currentStepInfo: CurrentStepInfo
    activeTranscriptIndex: number
    isAutorunning: boolean
    shouldStopAutorun: boolean
    lastHilContext?: any
    lastExecutionParams?: any
  }
  
  // Reset operations
  resetTranscripts: () => void
  addTranscriptsSync: (transcripts: RawTranscript[]) => void
  resetAnalysisState: () => void
  resetPromptHistory: () => void
  addPromptEntry: (entry: PromptHistoryEntry) => void
  resetOrchestration: () => void
  setCurrentStepInfo: (info: CurrentStepInfo) => void
  setActiveTranscriptIndex: (index: number) => void
  setAutorunning: (value: boolean) => void
  setShouldStopAutorun: (value: boolean) => void
  setHilContext: (context: any) => void
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Validates and normalizes step execution parameters
 */
export interface IStepParameterValidationService {
  validate(params: StepExecutionParams): ServiceResult<ValidationResult>
}

/**
 * Prepares execution context for different step types
 */
export interface IStepContextPreparationService {
  prepareContext(
    stepId: StepId,
    transcriptIdToProcess?: string,
    storeState?: StoreState
  ): ServiceResult<ExecutionContext>
}

/**
 * Prepares input data for step execution
 */
export interface IStepInputPreparationService {
  prepareInput(
    stepId: StepId,
    context: ExecutionContext,
    storeState: StoreState,
    settings: SettingsData
  ): ServiceResult<StepInput>
}

/**
 * Executes the actual step logic (API call or report generation)
 */
export interface IStepExecutionService {
  executeStep(
    stepId: StepId,
    input: StepInput,
    context: ExecutionContext,
    settings: SettingsData
  ): Promise<ServiceResult<StepOutput>>
}

/**
 * Manages prompt history entries
 */
export interface IPromptHistoryService {
  createHistoryEntry(
    stepId: StepId,
    transcriptIdToProcess: string | undefined,
    output: StepOutput,
    context: ExecutionContext
  ): PromptHistoryEntry
}

/**
 * Handles step execution errors
 */
export interface IStepErrorHandlingService {
  handleError(
    stepId: StepId,
    transcriptIdToProcess: string | undefined,
    apiError: string,
    inputData: any,
    output: any,
    groundingSources: any,
    context: ExecutionContext
  ): void
}

/**
 * Parameters for step error handling
 */
export interface StepErrorHandlingParams {
  stepId: StepId
  transcriptIdToProcess: string | undefined
  apiError: string
  storeState: StoreState
  setStoreState: (updater: (state: StoreState) => void) => void
}

/**
 * Parameters for step success handling
 */
export interface StepSuccessHandlingParams {
  stepId: StepId
  transcriptIdToProcess: string | undefined
  output: any
  inputData: any
  groundingSources: any
  currentGDU: string | undefined
  currentPhase: string | undefined
  storeState: StoreState
  setStoreState: (updater: (state: StoreState) => void) => void
}

/**
 * Handles step execution errors
 */
export interface IStepErrorHandlingService {
  handleError(params: StepErrorHandlingParams): ServiceResult<void>
}

/**
 * Handles successful step execution
 */
export interface IStepSuccessHandlingService {
  handleSuccess(params: StepSuccessHandlingParams): ServiceResult<void>
}

// ============================================================================
// Service Factory Interface
// ============================================================================

export interface IPipelineServiceFactory {
  createParameterValidationService(): IStepParameterValidationService
  createContextPreparationService(): IStepContextPreparationService
  createInputPreparationService(): IStepInputPreparationService
  createExecutionService(): IStepExecutionService
  createPromptHistoryService(): IPromptHistoryService
  createErrorHandlingService(): IStepErrorHandlingService
  createSuccessHandlingService(): IStepSuccessHandlingService
}

// ============================================================================
// Orchestrator Interface
// ============================================================================

export interface IPipelineOrchestrator {
  processSingleStep(params: StepExecutionParams): Promise<void>
}

// ============================================================================
// Navigation Service Interface
// ============================================================================

export interface NavigationResult {
  nextStepId: StepId
  nextTranscriptIndex: number
}

export interface ProcessNextStepResult {
  stepId: StepId
  transcriptIndex: number
  transcriptId?: string
  isComplete: boolean
  report?: string
}

export interface IEnhancedPipelineNavigationService {
  getNextStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: GenericAnalysisState
  ): NavigationResult | null
  
  processNextStep(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: GenericAnalysisState
  ): ProcessNextStepResult | null
}

/**
 * Determines the next step in the pipeline based on current state
 */
export interface IPipelineNavigationService {
  getNextStepDetails(
    currentStepInfo: CurrentStepInfo,
    currentTranscriptIndex: number,
    transcriptData: {
      rawTranscripts: RawTranscript[]
      processedData: Map<string, TranscriptProcessedData>
    },
    genericAnalysisState: any
  ): NavigationResult | null
}

// ============================================================================
// Master Pipeline Service Interface
// ============================================================================

/**
 * Comprehensive pipeline service that orchestrates all pipeline operations
 */
export interface IPipelineService {
  // Pipeline execution
  processSingleStep(params: StepExecutionParams): Promise<void>
  
  // Navigation
  getNextStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): NavigationResult | null
  
  processNextStep(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): ProcessNextStepResult | null
  
  // Invalidation
  orchestrateInvalidation(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): void
  
  // State management
  loadState(savedState: any): void
  getSaveState(): any
  resetPipeline(): void
  resetPromptHistoryOnly(): void
  clearAutosaveData(): Promise<void>
  
  // UI operations
  getTranscriptStatusDisplay(transcriptId: string): string
  loadStepData(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): { inputData?: any; outputData?: any; error?: string; groundingSources?: any[] }
  getStepStatusForPipelineView(
    stepId: StepId,
    uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }
  ): { status: StepStatus; error?: string }
  handlePipelineStepClick(
    stepId: StepId,
    settings: SettingsData
  ): {
    stepId: StepId
    transcriptId?: string
    phaseId?: string
    gduId?: string
    status: StepStatus
    error?: string
  }
  
  // File operations
  uploadTranscripts(event: React.ChangeEvent<HTMLInputElement>): Promise<void>
  handleDroppedFiles(files: File[]): Promise<void>
  saveStateToFile(state: any, filename: string): void
  loadStateFromFile(file: File): Promise<any>
  
  // Export operations
  downloadOutput(
    stepIdToDownload?: StepId,
    transcriptId?: string,
    dataToDownload?: any,
    currentStepInfo?: CurrentStepInfo,
    outputDirectory?: string
  ): void
  downloadPromptHistory(
    format: 'tsv' | 'json',
    outputDirectory: string
  ): void
  generateAppendix(
    type: 'markdown' | 'html',
    outputDirectory: string
  ): void
  generateMarkdownReport(reportData: any, outputDirectory: string): void
  exportVisualization(
    mermaidSyntax: string,
    filename: string,
    format: 'svg' | 'mermaid'
  ): void
  
  // Utility methods
  isGlobalStep(stepId: StepId): boolean
  retryWithUserSeed(
    currentStepInfo: CurrentStepInfo,
    retrySeedInput: string,
    settings: SettingsData
  ): void
  
  // UI state helper methods
  getPreviousStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): { prevStepId: StepId; prevTranscriptIndex: number } | null
  isPreviousStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean
  isNextStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean
  isRunStepDisabled(
    currentStepInfo: CurrentStepInfo,
    apiKeyPresent: boolean,
    dvFocusError?: string
  ): boolean
  isHilModalDisabled(currentStepInfo: CurrentStepInfo): boolean
  isDownloadOutputDisabled(currentStepInfo: CurrentStepInfo): boolean
  isDownloadHistoryDisabled(): boolean
  isAppendixDataAvailable(): boolean
}