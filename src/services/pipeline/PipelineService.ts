import { 
  StepId,
  StepStatus,
  CurrentStepInfo,
  SettingsData,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  PromptHistoryEntry,
  SavedState
} from '../../../types'
import { useAnalysisResultStore } from '../../stores/analysisResultStore'
import { isGlobalStep } from '../../utils/stepIdToDataKeyPrefix'
import { usePipelineOrchestrationStore } from '../../stores/pipelineOrchestrationStore'
import { usePromptHistoryStore } from '../../stores/promptHistoryStore'
import { useSettingsStore } from '../../stores/settingsStore'

import { StepParameterValidationService } from './StepParameterValidationService'
import { StepContextPreparationService } from './StepContextPreparationService'
import { StepInputPreparationService } from './StepInputPreparationService'
import { StepExecutionService } from './StepExecutionService'
import { PromptHistoryService } from './PromptHistoryService'
import { StepErrorHandlingService } from './StepErrorHandlingService'
import { StepSuccessHandlingService } from './StepSuccessHandlingService'
import { PipelineOrchestrator } from './PipelineOrchestrator'
import { EnhancedPipelineNavigationService } from './EnhancedPipelineNavigationService'
import { PipelineStateService } from './PipelineStateService'
import { PipelineInvalidationService } from './PipelineInvalidationService'
import { FileManagementService } from './FileManagementService'
import { ExportService } from './ExportService'
import { PipelineStateManagementService } from './PipelineStateManagementService'
import { PipelineUIService } from './PipelineUIService'
import { StoreTransactionService } from './StoreTransactionService'

/**
 * Master service that composes all pipeline services into a cohesive API
 * This is the main entry point for all pipeline operations
 */
export interface PipelineServiceDependencies {
  // Store getters
  getTranscriptData: () => {
    rawTranscripts: RawTranscript[]
    processedData: Map<string, TranscriptProcessedData>
  }
  getGenericAnalysisState: () => GenericAnalysisState
  getPromptHistory: () => PromptHistoryEntry[]
  getCurrentStepInfo: () => CurrentStepInfo
  getActiveTranscriptIndex: () => number
  getSettings: () => SettingsData
  
  // Store setters
  updateTranscriptData: (id: string, data: Partial<TranscriptProcessedData>) => void
  replaceProcessedData: (id: string, data: TranscriptProcessedData) => void
  updateGenericState: (updates: Partial<GenericAnalysisState>) => void
  addPromptEntry: (entry: PromptHistoryEntry) => void
  setCurrentStepInfo: (info: CurrentStepInfo) => void
  setAutorunning: (value: boolean) => void
  
  // Transcript store operations
  addTranscripts: (files: File[]) => Promise<void>
  addTranscriptsSync: (transcripts: RawTranscript[]) => void
  resetTranscripts: () => void
  
  // Prompt history operations
  resetPromptHistory: () => void
  
  // Analysis result operations
  resetAnalysisState: () => void
  
  // Orchestration operations
  resetOrchestrationState: () => void
}

export class PipelineService {
  private navigationService: EnhancedPipelineNavigationService
  private orchestrator: PipelineOrchestrator
  private invalidationService: PipelineInvalidationService
  private stateManagementService: PipelineStateManagementService
  private uiService: PipelineUIService
  private fileManagementService: FileManagementService
  private exportService: ExportService
  
  constructor(private dependencies: PipelineServiceDependencies) {
    // Initialize navigation service
    this.navigationService = new EnhancedPipelineNavigationService()
    
    // Initialize orchestrator with all required services
    this.orchestrator = new PipelineOrchestrator(
      new StepParameterValidationService(dependencies.getTranscriptData),
      new StepContextPreparationService(),
      new StepInputPreparationService(),
      new StepExecutionService(),
      new PromptHistoryService(dependencies.addPromptEntry),
      new StepErrorHandlingService(),
      new StepSuccessHandlingService(),
      // updateStores function
      (updates) => {
        // Update current step info
        if (updates.stepId !== undefined && updates.status !== undefined) {
          dependencies.setCurrentStepInfo({
            stepId: updates.stepId,
            status: updates.status,
            transcriptId: updates.transcriptId,
            error: updates.error,
            inputData: updates.inputData,
            outputData: updates.outputData
          })
        }
        
        // Handle shouldStopAutorun
        if (updates.status === StepStatus.Error) {
          dependencies.setAutorunning(false)
          // Also need to set shouldStopAutorun in orchestration store
          usePipelineOrchestrationStore.getState().setShouldStopAutorun(true)
        }
      },
      // addPromptEntry is already passed via dependencies
      dependencies.addPromptEntry,
      // storeOperations for dependency injection
      {
        getTranscriptState: dependencies.getTranscriptData,
        getAnalysisState: () => ({ genericAnalysisState: dependencies.getGenericAnalysisState() }),
        replaceProcessedData: dependencies.replaceProcessedData,
        updateGenericState: dependencies.updateGenericState
      },
      // Inject StoreTransactionService with full store operations
      new StoreTransactionService({
        // Existing store operations from PipelineOrchestrator
        getTranscriptState: dependencies.getTranscriptData,
        getAnalysisState: () => ({ genericAnalysisState: dependencies.getGenericAnalysisState() }),
        replaceProcessedData: dependencies.replaceProcessedData,
        updateGenericState: dependencies.updateGenericState,
        
        // Additional operations for transaction service
        getPromptHistoryState: () => {
          const promptHistoryStore = usePromptHistoryStore.getState()
          return {
            promptHistory: promptHistoryStore.promptHistory,
            totalInputTokens: promptHistoryStore.totalInputTokens,
            totalOutputTokens: promptHistoryStore.totalOutputTokens
          }
        },
        getOrchestrationState: () => {
          const orchestrationStore = usePipelineOrchestrationStore.getState()
          return {
            currentStepInfo: orchestrationStore.currentStepInfo,
            activeTranscriptIndex: orchestrationStore.activeTranscriptIndex,
            isAutorunning: orchestrationStore.isAutorunning,
            shouldStopAutorun: orchestrationStore.shouldStopAutorun,
            lastHilContext: orchestrationStore.lastHilContext,
            lastExecutionParams: orchestrationStore.lastExecutionParams
          }
        },
        
        // Reset and update operations
        resetTranscripts: dependencies.resetTranscripts,
        addTranscriptsSync: dependencies.addTranscriptsSync,
        resetAnalysisState: dependencies.resetAnalysisState,
        resetPromptHistory: dependencies.resetPromptHistory,
        addPromptEntry: dependencies.addPromptEntry,
        resetOrchestration: dependencies.resetOrchestrationState,
        setCurrentStepInfo: dependencies.setCurrentStepInfo,
        setActiveTranscriptIndex: (index: number) => 
          usePipelineOrchestrationStore.getState().setActiveTranscriptIndex(index),
        setAutorunning: dependencies.setAutorunning,
        setShouldStopAutorun: (value: boolean) => 
          usePipelineOrchestrationStore.getState().setShouldStopAutorun(value),
        setHilContext: (context: any) => 
          usePipelineOrchestrationStore.getState().setHilContext(context)
      })
    )
    
    // Initialize invalidation service
    // Note: We need to import useAnalysisResultStore for replaceGenericState
    this.invalidationService = new PipelineInvalidationService({
      getTranscriptData: dependencies.getTranscriptData,
      updateGenericState: (state) => {
        // Use replaceGenericState for invalidation to properly clear deleted properties
        useAnalysisResultStore.getState().replaceGenericState(state)
      },
      updateProcessedData: dependencies.replaceProcessedData
    })
    
    // Initialize state management service
    this.stateManagementService = new PipelineStateManagementService({
      transcriptStore: {
        reset: dependencies.resetTranscripts,
        addTranscriptsSync: dependencies.addTranscriptsSync,
        updateProcessedData: dependencies.updateTranscriptData,
        getState: dependencies.getTranscriptData
      },
      analysisResultStore: {
        updateGenericState: dependencies.updateGenericState,
        getState: () => ({ genericAnalysisState: dependencies.getGenericAnalysisState() })
      },
      promptHistoryStore: {
        reset: dependencies.resetPromptHistory,
        addPromptEntry: dependencies.addPromptEntry,
        getState: () => {
          const promptHistoryStore = usePromptHistoryStore.getState()
          return {
            promptHistory: promptHistoryStore.promptHistory,
            totalInputTokens: promptHistoryStore.totalInputTokens,
            totalOutputTokens: promptHistoryStore.totalOutputTokens
          }
        }
      },
      orchestrationStore: {
        setCurrentStepInfo: dependencies.setCurrentStepInfo,
        setActiveTranscriptIndex: (index: number) =>
          usePipelineOrchestrationStore.getState().setActiveTranscriptIndex(index),
        setShouldStopAutorun: (value: boolean) =>
          usePipelineOrchestrationStore.getState().setShouldStopAutorun(value),
        getState: () => {
          const orchestrationStore = usePipelineOrchestrationStore.getState()
          return {
            currentStepInfo: orchestrationStore.currentStepInfo,
            activeTranscriptIndex: orchestrationStore.activeTranscriptIndex || 0
          }
        }
      },
      settingsStore: {
        updateSettings: (updates) => useSettingsStore.getState().updateSettings(updates),
        getState: () => {
          const settings = useSettingsStore.getState()
          return {
            userDvFocus: settings.userDvFocus,
            dvFocusInput: settings.dvFocusInput,
            temperature: settings.temperature,
            seedInput: settings.seedInput,
            seed: settings.seed,
            outputDirectory: settings.outputDirectory,
            autoDownloadResults: settings.autoDownloadResults
          }
        }
      }
    })
    
    // Initialize UI service
    this.uiService = new PipelineUIService({
      getTranscriptData: dependencies.getTranscriptData,
      getGenericAnalysisState: dependencies.getGenericAnalysisState,
      getPromptHistory: dependencies.getPromptHistory,
      getActiveTranscriptIndex: dependencies.getActiveTranscriptIndex,
      setAutorunning: dependencies.setAutorunning,
      setCurrentStepInfo: dependencies.setCurrentStepInfo
    })
    
    // Initialize file management service
    this.fileManagementService = new FileManagementService({
      addTranscripts: dependencies.addTranscripts,
      getCurrentStepInfo: dependencies.getCurrentStepInfo,
      setCurrentStepInfo: dependencies.setCurrentStepInfo
    })
    
    // Initialize export service
    this.exportService = new ExportService({
      getTranscriptData: dependencies.getTranscriptData,
      getGenericAnalysisState: dependencies.getGenericAnalysisState,
      getPromptHistory: dependencies.getPromptHistory,
      getCurrentStepInfo: dependencies.getCurrentStepInfo
    })
  }
  
  // Pipeline execution
  async processSingleStep(params: {
    stepId: StepId
    transcriptIdToProcess?: string
    overrideSeed?: number
    hilMetaPrompt?: string
    settings?: SettingsData
  }): Promise<void> {
    // Record execution in orchestration store
    const orchestrationStore = usePipelineOrchestrationStore.getState()
    orchestrationStore.recordExecution({
      stepId: params.stepId,
      transcriptId: params.transcriptIdToProcess
    })
    
    // If settings are provided, use them; otherwise get from dependencies
    const settings = params.settings || this.dependencies.getSettings()
    
    await this.orchestrator.processSingleStep({
      ...params,
      settings
    })
  }
  
  // Navigation
  getNextStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): { nextStepId: StepId; nextTranscriptIndex: number } | null {
    return this.navigationService.getNextStepDetails(
      currentStepInfo,
      activeTranscriptIndex,
      this.dependencies.getTranscriptData(),
      this.dependencies.getGenericAnalysisState()
    )
  }
  
  processNextStep(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): {
    stepId: StepId
    transcriptIndex: number
    transcriptId?: string
    isComplete: boolean
    report?: string
  } | null {
    return this.navigationService.processNextStep(
      currentStepInfo,
      activeTranscriptIndex,
      this.dependencies.getTranscriptData(),
      this.dependencies.getGenericAnalysisState()
    )
  }
  
  // Invalidation
  orchestrateInvalidation(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): void {
    this.invalidationService.orchestrateInvalidation(
      stepId,
      transcriptId,
      this.dependencies.getGenericAnalysisState()
    )
  }
  
  // State management
  loadState(savedState: SavedState): void {
    this.stateManagementService.loadState(savedState)
  }
  
  getSaveState(): SavedState {
    return this.stateManagementService.getSaveState()
  }
  
  resetPipeline(): void {
    this.stateManagementService.resetPipeline()
  }
  
  resetPromptHistoryOnly(): void {
    this.stateManagementService.resetPromptHistoryOnly()
  }
  
  clearAutosaveData(): Promise<void> {
    return this.stateManagementService.clearAutosaveData()
  }
  
  // UI operations
  getTranscriptStatusDisplay(transcriptId: string): string {
    return this.uiService.getTranscriptStatusDisplay(transcriptId)
  }
  
  loadStepData(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): {
    inputData?: any
    outputData?: any
    error?: string
    groundingSources?: any[]
  } {
    return this.uiService.loadStepData(stepId, transcriptId, phaseId, gduId)
  }
  
  getStepStatusForPipelineView(
    stepId: StepId,
    uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }
  ): { status: StepStatus; error?: string } {
    return this.uiService.getStepStatusForPipelineView(stepId, uiState)
  }
  
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
  } {
    return this.uiService.handlePipelineStepClick(stepId, settings)
  }
  
  // File operations
  async uploadTranscripts(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    await this.fileManagementService.uploadTranscripts(event)
  }
  
  async handleDroppedFiles(files: File[]): Promise<void> {
    await this.fileManagementService.handleDroppedFiles(files)
  }
  
  saveStateToFile(state: SavedState, filename: string): void {
    this.fileManagementService.saveStateToFile(state, filename)
  }
  
  async loadStateFromFile(file: File): Promise<SavedState> {
    return this.fileManagementService.loadStateFromFile(file)
  }
  
  // Export operations
  downloadOutput(
    stepIdToDownload?: StepId,
    transcriptId?: string,
    dataToDownload?: any,
    currentStepInfo?: CurrentStepInfo,
    outputDirectory?: string
  ): void {
    this.exportService.downloadOutput(
      stepIdToDownload,
      transcriptId,
      dataToDownload,
      currentStepInfo,
      outputDirectory
    )
  }
  
  downloadPromptHistory(
    format: 'tsv' | 'json' = 'json',
    outputDirectory: string = ''
  ): void {
    this.exportService.downloadPromptHistory(format, outputDirectory)
  }
  
  generateAppendix(
    type: 'markdown' | 'html' = 'markdown',
    outputDirectory: string = ''
  ): void {
    this.exportService.generateAppendix(type, outputDirectory)
  }
  
  generateMarkdownReport(reportData: any, outputDirectory: string): void {
    this.exportService.generateMarkdownReport(reportData, outputDirectory)
  }
  
  exportVisualization(
    mermaidSyntax: string,
    filename: string,
    format: 'svg' | 'mermaid' = 'svg'
  ): void {
    this.exportService.exportVisualization(mermaidSyntax, filename, format)
  }
  
  // State invalidation
  invalidateStateFromStep(
    stepId: StepId,
    transcriptId?: string,
    activeTranscriptIndex?: number
  ): void {
    // Get current state
    const currentGenericState = useAnalysisResultStore.getState().genericAnalysisState
    
    // Use the invalidation service to handle the invalidation
    const result = this.invalidationService.orchestrateInvalidation(
      stepId,
      transcriptId,
      currentGenericState
    )
    
    console.log(`🗑️ [PipelineService] Invalidated state from step ${stepId}`, {
      updatedTranscripts: result.updatedTranscriptIds,
      genericStateUpdated: result.genericStateUpdated
    })
  }

  // Utility methods
  isGlobalStep(stepId: StepId): boolean {
    return isGlobalStep(stepId)
  }
  
  retryWithUserSeed(
    currentStepInfo: CurrentStepInfo,
    retrySeedInput: string,
    settings: SettingsData
  ): void {
    if (currentStepInfo.status === StepStatus.Error && retrySeedInput.trim()) {
      const seedValue = parseInt(retrySeedInput.trim(), 10)
      if (!isNaN(seedValue) && seedValue > 0) {
        // Retry the current step with the user-provided seed
        this.processSingleStep({
          stepId: currentStepInfo.stepId,
          transcriptIdToProcess: currentStepInfo.transcriptId,
          overrideSeed: seedValue,
          settings
        })
      }
    }
  }
  
  // UI state helper methods - delegate to UI service
  getPreviousStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): { prevStepId: StepId; prevTranscriptIndex: number } | null {
    return this.uiService.getPreviousStepDetails(currentStepInfo, activeTranscriptIndex)
  }
  
  isPreviousStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean {
    return this.uiService.isPreviousStepDisabled(currentStepInfo, activeTranscriptIndex)
  }
  
  isNextStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean {
    return this.uiService.isNextStepDisabled(currentStepInfo, activeTranscriptIndex)
  }
  
  isRunStepDisabled(
    currentStepInfo: CurrentStepInfo,
    apiKeyPresent: boolean,
    dvFocusError?: string
  ): boolean {
    return this.uiService.isRunStepDisabled(currentStepInfo, apiKeyPresent, dvFocusError)
  }
  
  isHilModalDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return this.uiService.isHilModalDisabled(currentStepInfo)
  }
  
  isDownloadOutputDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return this.uiService.isDownloadOutputDisabled(currentStepInfo)
  }
  
  isDownloadHistoryDisabled(): boolean {
    return this.uiService.isDownloadHistoryDisabled()
  }
  
  isAppendixDataAvailable(): boolean {
    return this.uiService.isAppendixDataAvailable()
  }
}