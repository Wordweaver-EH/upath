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