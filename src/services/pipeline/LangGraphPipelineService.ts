import { 
  StepId,
  StepStatus,
  CurrentStepInfo,
  SettingsData,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  PromptHistoryEntry
} from '../../../types';
import { langGraphService, LangGraphService } from '../langGraphService';
import { isGlobalStep } from '../../utils/stepIdToDataKeyPrefix';
import { PipelineUIService } from './PipelineUIService';
import { EnhancedPipelineNavigationService } from './EnhancedPipelineNavigationService';
import { FileManagementService } from './FileManagementService';

/**
 * LangGraph-enabled Pipeline Service
 * 
 * This service provides pipeline execution using the LangGraph backend instead of
 * direct Gemini API calls. It maintains compatibility with the existing frontend
 * pipeline interface while delegating execution to the backend.
 */

export interface LangGraphPipelineServiceDependencies {
  // Store getters
  getTranscriptData: () => {
    rawTranscripts: RawTranscript[];
    processedData: Map<string, TranscriptProcessedData>;
  };
  getGenericAnalysisState: () => GenericAnalysisState;
  getPromptHistory: () => PromptHistoryEntry[];
  getCurrentStepInfo: () => CurrentStepInfo;
  getActiveTranscriptIndex: () => number;
  getSettings: () => SettingsData;
  
  // Store setters
  updateTranscriptData: (id: string, data: Partial<TranscriptProcessedData>) => void;
  replaceProcessedData: (id: string, data: TranscriptProcessedData) => void;
  updateGenericState: (updates: Partial<GenericAnalysisState>) => void;
  addPromptEntry: (entry: PromptHistoryEntry) => void;
  setCurrentStepInfo: (info: CurrentStepInfo) => void;
  setAutorunning: (value: boolean) => void;
  
  // Reset operations
  resetTranscripts: () => void;
  resetPromptHistory: () => void;
  resetAnalysisState: () => void;
  resetOrchestrationState: () => void;
}

/**
 * Interface for step execution parameters compatible with existing pipeline
 */
interface ProcessSingleStepParams {
  stepId: StepId;
  settings: SettingsData;
  transcriptId?: string;
  isAutorun?: boolean;
  hilContext?: {
    userGuidance: string;
    originalPrompt?: string;
    previousResponse?: string;
  };
}

/**
 * Interface for step execution result compatible with existing pipeline
 */
interface ProcessSingleStepResult {
  success: boolean;
  output?: any;
  error?: string;
  stepId: StepId;
  status: StepStatus;
  executionTime?: number;
  promptHistory?: PromptHistoryEntry;
}

export class LangGraphPipelineService {
  private langGraph: LangGraphService;
  private sessionInitialized: boolean = false;
  private initializationPromise: Promise<string> | null = null;
  private uiService: PipelineUIService;
  private navigationService: EnhancedPipelineNavigationService;
  private fileManagementService: FileManagementService;

  constructor(private dependencies: LangGraphPipelineServiceDependencies) {
    this.langGraph = langGraphService;
    
    // Initialize UI service for navigation and display logic
    this.uiService = new PipelineUIService({
      getTranscriptData: dependencies.getTranscriptData,
      getGenericAnalysisState: dependencies.getGenericAnalysisState,
      getPromptHistory: dependencies.getPromptHistory,
      getActiveTranscriptIndex: dependencies.getActiveTranscriptIndex,
      setAutorunning: dependencies.setAutorunning,
      setCurrentStepInfo: dependencies.setCurrentStepInfo
    });
    
    // Initialize navigation service
    this.navigationService = new EnhancedPipelineNavigationService();
    
    // Initialize file management service
    this.fileManagementService = new FileManagementService({
      addTranscripts: dependencies.addTranscripts,
      getCurrentStepInfo: dependencies.getCurrentStepInfo,
      setCurrentStepInfo: dependencies.setCurrentStepInfo
    });
  }

  /**
   * Initialize LangGraph session with current transcripts
   * Uses promise-based locking to prevent race conditions
   */
  async initializeSession(): Promise<string> {
    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If already initialized, return current session ID
    if (this.sessionInitialized) {
      const currentSessionId = this.langGraph.getCurrentSessionId();
      if (currentSessionId) {
        return currentSessionId;
      }
    }

    // Create the initialization promise
    const doInitialize = async (): Promise<string> => {
      const { rawTranscripts } = this.dependencies.getTranscriptData();
      const settings = this.dependencies.getSettings();

      if (rawTranscripts.length === 0) {
        throw new Error('Cannot initialize session: No transcripts available');
      }

      try {
        const sessionId = await this.langGraph.createSession(rawTranscripts, settings);
        this.sessionInitialized = true;
        console.log(`✅ [LangGraphPipelineService] Session initialized: ${sessionId}`);
        return sessionId;
      } catch (error) {
        console.error('❌ [LangGraphPipelineService] Failed to initialize session:', error);
        throw error;
      }
    };

    // Set the promise with proper cleanup and handle completion
    this.initializationPromise = doInitialize().finally(() => {
      this.initializationPromise = null; // Clear on both success and failure
    });
    
    try {
      const result = await this.initializationPromise;
      // sessionInitialized is already set to true inside doInitialize on success
      return result;
    } catch (error) {
      // On failure, ensure sessionInitialized is false
      this.sessionInitialized = false;
      throw error;
    }
  }

  /**
   * Process a single pipeline step using LangGraph backend
   */
  async processSingleStep(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
    const startTime = Date.now();

    try {
      // Check if we have transcripts before initializing session
      const { rawTranscripts } = this.dependencies.getTranscriptData();
      if (rawTranscripts.length === 0) {
        console.warn('[LangGraphPipelineService] No transcripts available, cannot process step');
        return {
          success: false,
          error: 'No transcripts available. Please upload transcript files first.',
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      // Ensure session is initialized
      if (!this.sessionInitialized) {
        await this.initializeSession();
      }

      // Handle HIL correction if provided
      if (params.hilContext) {
        return await this.processHilCorrection(params);
      }

      // Execute next step via LangGraph
      const executeResult = await this.langGraph.executeNextStep(undefined, {
        temperature: params.settings.temperature,
        seed: params.settings.seed
      });

      if (!executeResult.success) {
        return {
          success: false,
          error: executeResult.error || 'Step execution failed',
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      const executionResult = executeResult.executionResult;
      const state = executeResult.state;

      if (!executionResult || !state) {
        return {
          success: false,
          error: 'Invalid response from backend: missing execution result or state',
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      // Update frontend stores with backend results
      await this.updateStoresFromBackendState(state, executionResult);

      // Create prompt history entry
      const promptEntry: PromptHistoryEntry = {
        timestamp: new Date().toISOString(),
        stepId: executionResult.stepId,
        transcriptId: params.transcriptId,
        prompt: `Step ${executionResult.stepId} executed via LangGraph backend`,
        response: JSON.stringify(executionResult.output, null, 2),
        estimatedInputTokens: 0, // Backend tracks tokens internally
        estimatedOutputTokens: 0,
        actualInputTokens: 0,
        actualOutputTokens: 0
      };

      this.dependencies.addPromptEntry(promptEntry);

      return {
        success: true,
        output: executionResult.output,
        stepId: executionResult.stepId,
        status: executionResult.status === 'completed' ? StepStatus.COMPLETED : StepStatus.ERROR,
        executionTime: Date.now() - startTime,
        promptHistory: promptEntry
      };

    } catch (error) {
      console.error('❌ [LangGraphPipelineService] Step execution failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during step execution',
        stepId: params.stepId,
        status: StepStatus.ERROR,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process HIL correction via LangGraph backend
   */
  private async processHilCorrection(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
    const startTime = Date.now();

    if (!params.hilContext) {
      throw new Error('HIL context is required for HIL correction');
    }

    try {
      const hilResult = await this.langGraph.applyHilCorrection({
        sessionId: this.langGraph.getCurrentSessionId()!,
        stepId: params.stepId,
        userGuidance: params.hilContext.userGuidance,
        originalPrompt: params.hilContext.originalPrompt,
        previousResponse: params.hilContext.previousResponse,
        transcriptId: params.transcriptId,
        temperature: params.settings.temperature,
        seed: params.settings.seed
      });

      if (!hilResult.success) {
        return {
          success: false,
          error: hilResult.error || 'HIL correction failed',
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      // Update frontend stores with corrected results
      if (hilResult.updatedState) {
        await this.updateStoresFromHilResult(hilResult);
      }

      // Create prompt history entry for HIL correction
      const promptEntry: PromptHistoryEntry = {
        timestamp: new Date().toISOString(),
        stepId: params.stepId,
        transcriptId: params.transcriptId,
        prompt: `HIL correction: ${params.hilContext.userGuidance}`,
        response: JSON.stringify(hilResult.correctedOutput, null, 2),
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        actualInputTokens: 0,
        actualOutputTokens: 0
      };

      this.dependencies.addPromptEntry(promptEntry);

      return {
        success: true,
        output: hilResult.correctedOutput,
        stepId: params.stepId,
        status: StepStatus.COMPLETED,
        executionTime: Date.now() - startTime,
        promptHistory: promptEntry
      };

    } catch (error) {
      console.error('❌ [LangGraphPipelineService] HIL correction failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during HIL correction',
        stepId: params.stepId,
        status: StepStatus.ERROR,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Update frontend stores from backend state after step execution
   */
  private async updateStoresFromBackendState(state: any, executionResult: any): Promise<void> {
    // Update current step info
    this.dependencies.setCurrentStepInfo({
      stepId: state.metadata.currentStep,
      status: StepStatus.COMPLETED,
      progress: state.metadata.progress.percentage
    });

    // Update generic analysis state with step outputs
    const stepOutputs = state.stepOutputs || {};
    const genericStateUpdates: Partial<GenericAnalysisState> = {};

    // Map step outputs to generic analysis state structure
    for (const [stepId, output] of Object.entries(stepOutputs)) {
      const outputKey = `${stepId}_output`;
      const completedKey = `${stepId}_completed`;
      
      genericStateUpdates[outputKey as keyof GenericAnalysisState] = output;
      genericStateUpdates[completedKey as keyof GenericAnalysisState] = true;
    }

    this.dependencies.updateGenericState(genericStateUpdates);

    // Update transcript-specific data if applicable
    if (!isGlobalStep(executionResult.stepId)) {
      const { rawTranscripts } = this.dependencies.getTranscriptData();
      
      // Update each transcript's processed data
      for (const transcript of rawTranscripts) {
        this.dependencies.updateTranscriptData(transcript.id, {
          [`${executionResult.stepId}_output`]: executionResult.output,
          [`${executionResult.stepId}_completed`]: true
        });
      }
    }
  }

  /**
   * Update frontend stores from HIL correction result
   */
  private async updateStoresFromHilResult(hilResult: any): Promise<void> {
    const state = hilResult.updatedState;
    
    if (state) {
      // Update current step info
      this.dependencies.setCurrentStepInfo({
        stepId: state.currentStep,
        status: StepStatus.COMPLETED,
        progress: state.metadata?.progress?.percentage || 100
      });

      // Update generic analysis state
      const stepOutputs = state.stepOutputs || {};
      const genericStateUpdates: Partial<GenericAnalysisState> = {};

      for (const [stepId, output] of Object.entries(stepOutputs)) {
        const outputKey = `${stepId}_output`;
        const completedKey = `${stepId}_completed`;
        
        genericStateUpdates[outputKey as keyof GenericAnalysisState] = output;
        genericStateUpdates[completedKey as keyof GenericAnalysisState] = true;
      }

      this.dependencies.updateGenericState(genericStateUpdates);
    }
  }

  /**
   * Perform Inter-Rater Reliability analysis
   */
  async performIrrAnalysis(runAOutputs: any[], runBOutputs: any[], settings?: Partial<SettingsData>): Promise<any> {
    try {
      // Ensure session is initialized
      if (!this.sessionInitialized) {
        await this.initializeSession();
      }

      const irrResult = await this.langGraph.performIrrAnalysis({
        sessionId: this.langGraph.getCurrentSessionId()!,
        runAOutputs,
        runBOutputs,
        temperature: settings?.temperature || 0.7,
        seed: settings?.seed
      });

      if (!irrResult.success) {
        throw new Error(irrResult.error || 'IRR analysis failed');
      }

      console.log(`✅ [LangGraphPipelineService] IRR analysis completed with ${irrResult.gduMappings?.length} mappings`);
      return irrResult.gduMappings;

    } catch (error) {
      console.error('❌ [LangGraphPipelineService] IRR analysis failed:', error);
      throw error;
    }
  }

  /**
   * Reset the pipeline (clear session and reset stores)
   */
  async resetPipeline(): Promise<void> {
    // Clear LangGraph session and initialization state
    this.langGraph.clearSession();
    this.sessionInitialized = false;
    this.initializationPromise = null;

    // Reset all stores
    this.dependencies.resetTranscripts();
    this.dependencies.resetPromptHistory();
    this.dependencies.resetAnalysisState();
    this.dependencies.resetOrchestrationState();

    console.log('✅ [LangGraphPipelineService] Pipeline reset completed');
  }

  /**
   * Check if global step (not transcript-specific)
   */
  isGlobalStep(stepId: StepId): boolean {
    return isGlobalStep(stepId);
  }

  /**
   * Get session status from backend
   */
  async getSessionStatus(): Promise<any> {
    try {
      return await this.langGraph.getSessionStatus();
    } catch (error) {
      console.error('❌ [LangGraphPipelineService] Failed to get session status:', error);
      throw error;
    }
  }

  /**
   * Check if session is initialized
   */
  isSessionInitialized(): boolean {
    return this.sessionInitialized;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.langGraph.getCurrentSessionId();
  }

  /**
   * Download output for a pipeline step (compatibility method)
   */
  downloadOutput(stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any): void {
    // For LangGraph backend, we could implement this by fetching step outputs
    // from the backend session, but for now we delegate to frontend processing
    console.warn('[LangGraphPipelineService] downloadOutput not yet implemented for LangGraph backend');
    
    // Fallback: use the data provided or get from analysis state
    if (dataToDownload) {
      // Create and download the file
      const jsonString = JSON.stringify(dataToDownload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stepIdToDownload || 'output'}_${transcriptId || 'global'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Get next step details (compatibility method)
   */
  getNextStepDetails(currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number): any {
    // Delegate to navigation service for UI consistency
    const transcriptData = this.dependencies.getTranscriptData();
    const genericAnalysisState = this.dependencies.getGenericAnalysisState();
    
    return this.navigationService.getNextStepDetails(
      currentStepInfo,
      activeTranscriptIndex,
      transcriptData,
      genericAnalysisState
    );
  }

  // ============================================================================
  // UI Navigation Methods (Delegated to PipelineUIService)
  // ============================================================================

  /**
   * Check if previous step navigation is disabled
   */
  isPreviousStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean {
    return this.uiService.isPreviousStepDisabled(currentStepInfo, activeTranscriptIndex);
  }

  /**
   * Check if next step navigation is disabled
   */
  isNextStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean {
    return this.uiService.isNextStepDisabled(currentStepInfo, activeTranscriptIndex);
  }

  /**
   * Check if run step is disabled
   */
  isRunStepDisabled(
    currentStepInfo: CurrentStepInfo,
    apiKeyPresent: boolean,
    dvFocusError?: string
  ): boolean {
    return this.uiService.isRunStepDisabled(currentStepInfo, apiKeyPresent, dvFocusError);
  }

  /**
   * Check if HIL modal is disabled
   */
  isHilModalDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return this.uiService.isHilModalDisabled(currentStepInfo);
  }

  /**
   * Check if download output is disabled
   */
  isDownloadOutputDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return this.uiService.isDownloadOutputDisabled(currentStepInfo);
  }

  /**
   * Check if download history is disabled
   */
  isDownloadHistoryDisabled(): boolean {
    return this.uiService.isDownloadHistoryDisabled();
  }

  /**
   * Check if appendix data is available
   */
  isAppendixDataAvailable(): boolean {
    return this.uiService.isAppendixDataAvailable();
  }

  /**
   * Get previous step details
   */
  getPreviousStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): { prevStepId: StepId; prevTranscriptIndex: number } | null {
    return this.uiService.getPreviousStepDetails(currentStepInfo, activeTranscriptIndex);
  }

  /**
   * Process next step in the pipeline
   */
  processNextStep(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): any {
    const transcriptData = this.dependencies.getTranscriptData();
    const genericAnalysisState = this.dependencies.getGenericAnalysisState();
    
    return this.navigationService.processNextStep(
      currentStepInfo,
      activeTranscriptIndex,
      transcriptData,
      genericAnalysisState
    );
  }

  /**
   * Handle pipeline step click
   */
  handlePipelineStepClick(
    stepId: StepId,
    settings: SettingsData
  ): any {
    return this.uiService.handlePipelineStepClick(stepId, settings);
  }

  /**
   * Get step status for pipeline view
   */
  getStepStatusForPipelineView(
    stepId: StepId,
    uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }
  ): { status: StepStatus; error?: string } {
    return this.uiService.getStepStatusForPipelineView(stepId, uiState);
  }

  /**
   * Get transcript status display
   */
  getTranscriptStatusDisplay(transcriptId: string): string {
    return this.uiService.getTranscriptStatusDisplay(transcriptId);
  }

  /**
   * Load step data
   */
  loadStepData(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): { inputData?: any; outputData?: any; error?: string; groundingSources?: any[] } {
    return this.uiService.loadStepData(stepId, transcriptId, phaseId, gduId);
  }

  // ============================================================================
  // File Operations (Stubs for now)
  // ============================================================================

  /**
   * Upload transcripts - delegates to file management service
   */
  async uploadTranscripts(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    console.log('[LangGraphPipelineService] uploadTranscripts - delegating to file management service');
    await this.fileManagementService.uploadTranscripts(event);
  }

  /**
   * Handle dropped files - delegates to file management service
   */
  async handleDroppedFiles(files: File[]): Promise<void> {
    console.log('[LangGraphPipelineService] handleDroppedFiles - delegating to file management service');
    await this.fileManagementService.handleDroppedFiles(files);
  }

  /**
   * Save state to file - delegates to file management service
   */
  saveStateToFile(state: any, filename: string): void {
    console.log('[LangGraphPipelineService] saveStateToFile - delegating to file management service');
    this.fileManagementService.saveStateToFile(state, filename);
  }

  /**
   * Load state from file - delegates to file management service
   */
  async loadStateFromFile(file: File): Promise<any> {
    console.log('[LangGraphPipelineService] loadStateFromFile - delegating to file management service');
    return await this.fileManagementService.loadStateFromFile(file);
  }

  /**
   * Download prompt history
   */
  downloadPromptHistory(format: 'tsv' | 'json', outputDirectory: string): void {
    console.warn('[LangGraphPipelineService] downloadPromptHistory not yet implemented');
    // TODO: Implement prompt history download
  }

  /**
   * Generate appendix
   */
  generateAppendix(type: 'markdown' | 'html', outputDirectory: string): void {
    console.warn('[LangGraphPipelineService] generateAppendix not yet implemented');
    // TODO: Implement appendix generation
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(reportData: any, outputDirectory: string): void {
    console.warn('[LangGraphPipelineService] generateMarkdownReport not yet implemented');
    // TODO: Implement markdown report generation
  }

  /**
   * Export visualization
   */
  exportVisualization(
    mermaidSyntax: string,
    filename: string,
    format: 'svg' | 'mermaid'
  ): void {
    console.warn('[LangGraphPipelineService] exportVisualization not yet implemented');
    // TODO: Implement visualization export
  }

  // ============================================================================
  // State Management (Stubs for now)
  // ============================================================================

  /**
   * Orchestrate invalidation
   */
  orchestrateInvalidation(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): void {
    console.warn('[LangGraphPipelineService] orchestrateInvalidation not yet implemented');
    // TODO: Implement invalidation logic
  }

  /**
   * Load state
   */
  loadState(savedState: any): void {
    console.warn('[LangGraphPipelineService] loadState not yet implemented');
    // TODO: Implement state loading
  }

  /**
   * Get save state
   */
  getSaveState(
    activeTranscriptIndex: number,
    currentStepInfo: CurrentStepInfo,
    settings: any
  ): any {
    console.warn('[LangGraphPipelineService] getSaveState not yet implemented');
    // TODO: Implement state saving
    return {};
  }

  /**
   * Reset prompt history only
   */
  resetPromptHistoryOnly(): void {
    this.dependencies.resetPromptHistory();
  }

  /**
   * Clear autosave data
   */
  async clearAutosaveData(): Promise<void> {
    console.warn('[LangGraphPipelineService] clearAutosaveData not yet implemented');
    // TODO: Implement autosave clearing
  }

  /**
   * Retry with user seed
   */
  retryWithUserSeed(
    currentStepInfo: CurrentStepInfo,
    retrySeedInput: string,
    settings: SettingsData
  ): void {
    console.warn('[LangGraphPipelineService] retryWithUserSeed not yet implemented');
    // TODO: Implement retry logic
  }
}