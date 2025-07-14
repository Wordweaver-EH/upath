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
import { isGlobalStep } from '../../utils/stepIdToDataKeyPrefix';
import { PipelineUIService } from './PipelineUIService';
import { EnhancedPipelineNavigationService } from './EnhancedPipelineNavigationService';
import { FileManagementService } from './FileManagementService';

/**
 * Modular Pipeline Service
 * 
 * This service uses the new modular backend API (/api/pipeline/*) that provides
 * step-by-step execution replacing the complex LangGraph session management.
 * Each step is executed independently with proper dependency resolution.
 */

export interface ModularPipelineServiceDependencies {
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
  
  // File operations
  addTranscripts: (files: File[]) => Promise<void>;
  
  // Reset operations
  resetTranscripts: () => void;
  resetPromptHistory: () => void;
  resetAnalysisState: () => void;
  resetOrchestrationState: () => void;
}

/**
 * Interface for step execution parameters
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
 * Interface for step execution result
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

/**
 * Interface for backend pipeline API request
 */
interface PipelineExecuteRequest {
  stepId: StepId;
  currentTranscript: {
    id: string;
    filename: string;
    content: string;
  };
  userDvFocus: {
    dv_focus: string[];
  };
  processedData: Record<string, any>;
  genericAnalysisState: GenericAnalysisState;
  allRawTranscripts: Array<{
    id: string;
    filename: string;
    content: string;
  }>;
  apiKeyPresent: boolean;
  model?: string;
  temperature?: number;
  overrideSeed?: number;
}

/**
 * Interface for backend pipeline API response
 */
interface PipelineExecuteResponse {
  success: boolean;
  stepId: StepId;
  output?: any;
  error?: string;
  executionTimeMs: number;
  timestamp: string;
}

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
  : 'http://localhost:3001';

export class ModularPipelineService {
  private uiService: PipelineUIService;
  private navigationService: EnhancedPipelineNavigationService;
  private fileManagementService: FileManagementService;

  constructor(private dependencies: ModularPipelineServiceDependencies) {
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
   * Helper method to handle API response errors consistently
   */
  private async handleResponseError(response: Response): Promise<never> {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const contentType = response.headers?.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (jsonError) {
          console.warn('[ModularPipelineService] Failed to parse error response as JSON:', jsonError);
        }
      }
    } catch (headersError) {
      console.warn('[ModularPipelineService] Headers not available, using default error message');
    }
    
    throw new Error(errorMsg);
  }

  /**
   * Process a single pipeline step using the modular backend API
   */
  async processSingleStep(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
    const startTime = Date.now();

    try {
      // Check if we have transcripts
      const { rawTranscripts, processedData } = this.dependencies.getTranscriptData();
      if (rawTranscripts.length === 0) {
        console.warn('[ModularPipelineService] No transcripts available, cannot process step');
        return {
          success: false,
          error: 'No transcripts available. Please upload transcript files first.',
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      // Get the current transcript to process
      const activeTranscriptIndex = this.dependencies.getActiveTranscriptIndex();
      const currentTranscript = rawTranscripts[activeTranscriptIndex];
      
      if (!currentTranscript) {
        return {
          success: false,
          error: `No transcript found at index ${activeTranscriptIndex}`,
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      // Handle HIL correction if provided
      if (params.hilContext) {
        return await this.processHilCorrection(params);
      }

      // Prepare request for modular pipeline API
      const request: PipelineExecuteRequest = {
        stepId: params.stepId,
        currentTranscript: {
          id: currentTranscript.id,
          filename: currentTranscript.filename,
          content: currentTranscript.content
        },
        userDvFocus: params.settings.userDvFocus || { dv_focus: [] },
        processedData: this.convertProcessedDataToRecord(processedData, currentTranscript.id),
        genericAnalysisState: this.dependencies.getGenericAnalysisState(),
        allRawTranscripts: rawTranscripts.map(t => ({
          id: t.id,
          filename: t.filename,
          content: t.content
        })),
        apiKeyPresent: !!params.settings.apiKey && params.settings.apiKey.trim().length > 0,
        model: params.settings.model || 'gemini-2.5-flash',
        temperature: params.settings.temperature || 0.0,
        overrideSeed: params.settings.seed
      };

      console.log(`📤 [ModularPipelineService] Executing step ${params.stepId} for transcript ${currentTranscript.id}`);

      // Execute step via modular pipeline API
      const response = await fetch(`${BACKEND_URL}/api/pipeline/execute-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      const result: PipelineExecuteResponse = await response.json();

      if (!result.success) {
        console.error('❌ [ModularPipelineService] Step execution failed:', result);
        return {
          success: false,
          error: result.error || 'Step execution failed',
          stepId: params.stepId,
          status: StepStatus.ERROR,
          executionTime: Date.now() - startTime
        };
      }

      // Update frontend stores with step results
      await this.updateStoresFromStepResult(result, currentTranscript.id);

      // Create prompt history entry
      const promptEntry: PromptHistoryEntry = {
        timestamp: new Date().toISOString(),
        stepId: result.stepId,
        transcriptId: currentTranscript.id,
        prompt: `Step ${result.stepId} executed via modular pipeline`,
        response: JSON.stringify(result.output, null, 2),
        estimatedInputTokens: 0, // Backend tracks tokens internally
        estimatedOutputTokens: 0,
        actualInputTokens: 0,
        actualOutputTokens: 0
      };

      this.dependencies.addPromptEntry(promptEntry);

      console.log(`✅ [ModularPipelineService] Step ${result.stepId} completed in ${result.executionTimeMs}ms`);

      return {
        success: true,
        output: result.output,
        stepId: result.stepId,
        status: StepStatus.COMPLETED,
        executionTime: result.executionTimeMs,
        promptHistory: promptEntry
      };

    } catch (error) {
      console.error('❌ [ModularPipelineService] Step execution failed:', error);
      
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
   * Convert Map-based processed data to Record for API request
   */
  private convertProcessedDataToRecord(processedData: Map<string, TranscriptProcessedData>, transcriptId: string): Record<string, any> {
    const transcriptData = processedData.get(transcriptId);
    if (!transcriptData) {
      return {};
    }

    // Convert transcript processed data to a flat record
    const record: Record<string, any> = {};
    
    // Map step outputs to the expected format
    if (transcriptData.p_neg1_1_output) record.p_neg1_1_output = transcriptData.p_neg1_1_output;
    if (transcriptData.p0_1_output) record.p0_1_output = transcriptData.p0_1_output;
    if (transcriptData.p0_2_output) record.p0_2_output = transcriptData.p0_2_output;
    if (transcriptData.p0_3_output) record.p0_3_output = transcriptData.p0_3_output;
    if (transcriptData.p1_1_output) record.p1_1_output = transcriptData.p1_1_output;
    if (transcriptData.p1_2_output) record.p1_2_output = transcriptData.p1_2_output;
    if (transcriptData.p1_3_output) record.p1_3_output = transcriptData.p1_3_output;
    if (transcriptData.p1_4_output) record.p1_4_output = transcriptData.p1_4_output;

    return record;
  }

  /**
   * Update frontend stores from step execution result
   */
  private async updateStoresFromStepResult(result: PipelineExecuteResponse, transcriptId: string): Promise<void> {
    // Update current step info
    this.dependencies.setCurrentStepInfo({
      stepId: result.stepId,
      status: StepStatus.COMPLETED,
      progress: 100 // Individual step completion
    });

    // Update transcript-specific data
    if (!isGlobalStep(result.stepId)) {
      const outputKey = `${result.stepId}_output`;
      const completedKey = `${result.stepId}_completed`;
      
      this.dependencies.updateTranscriptData(transcriptId, {
        [outputKey]: result.output,
        [completedKey]: true
      });
    }

    // Update generic analysis state if it's a global step
    if (isGlobalStep(result.stepId)) {
      const outputKey = `${result.stepId}_output`;
      const completedKey = `${result.stepId}_completed`;
      
      const genericStateUpdates: Partial<GenericAnalysisState> = {};
      genericStateUpdates[outputKey as keyof GenericAnalysisState] = result.output;
      genericStateUpdates[completedKey as keyof GenericAnalysisState] = true;
      
      this.dependencies.updateGenericState(genericStateUpdates);
    }
  }

  /**
   * Process HIL correction (not implemented for modular API yet)
   */
  private async processHilCorrection(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
    console.warn('[ModularPipelineService] HIL correction not yet implemented for modular API');
    
    return {
      success: false,
      error: 'HIL correction not yet implemented for modular pipeline API',
      stepId: params.stepId,
      status: StepStatus.ERROR,
      executionTime: 0
    };
  }

  /**
   * Check if step is a global step (not transcript-specific)
   */
  isGlobalStep(stepId: StepId): boolean {
    return isGlobalStep(stepId);
  }

  /**
   * Get pipeline health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/pipeline/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [ModularPipelineService] Failed to get health status:', error);
      throw error;
    }
  }

  /**
   * Get list of available pipeline steps
   */
  async getAvailableSteps(): Promise<any> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/pipeline/steps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [ModularPipelineService] Failed to get available steps:', error);
      throw error;
    }
  }

  /**
   * Get details for a specific step
   */
  async getStepDetails(stepId: StepId): Promise<any> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/pipeline/steps/${stepId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [ModularPipelineService] Failed to get step details:', error);
      throw error;
    }
  }

  // ============================================================================
  // UI Navigation Methods (Delegated to PipelineUIService)
  // ============================================================================

  isPreviousStepDisabled(currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number): boolean {
    return this.uiService.isPreviousStepDisabled(currentStepInfo, activeTranscriptIndex);
  }

  isNextStepDisabled(currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number): boolean {
    return this.uiService.isNextStepDisabled(currentStepInfo, activeTranscriptIndex);
  }

  isRunStepDisabled(currentStepInfo: CurrentStepInfo, apiKeyPresent: boolean, dvFocusError?: string): boolean {
    return this.uiService.isRunStepDisabled(currentStepInfo, apiKeyPresent, dvFocusError);
  }

  isHilModalDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return this.uiService.isHilModalDisabled(currentStepInfo);
  }

  isDownloadOutputDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return this.uiService.isDownloadOutputDisabled(currentStepInfo);
  }

  isDownloadHistoryDisabled(): boolean {
    return this.uiService.isDownloadHistoryDisabled();
  }

  isAppendixDataAvailable(): boolean {
    return this.uiService.isAppendixDataAvailable();
  }

  getPreviousStepDetails(currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number): { prevStepId: StepId; prevTranscriptIndex: number } | null {
    return this.uiService.getPreviousStepDetails(currentStepInfo, activeTranscriptIndex);
  }

  processNextStep(currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number): any {
    const transcriptData = this.dependencies.getTranscriptData();
    const genericAnalysisState = this.dependencies.getGenericAnalysisState();
    
    return this.navigationService.processNextStep(
      currentStepInfo,
      activeTranscriptIndex,
      transcriptData,
      genericAnalysisState
    );
  }

  handlePipelineStepClick(stepId: StepId, settings: SettingsData): any {
    return this.uiService.handlePipelineStepClick(stepId, settings);
  }

  getStepStatusForPipelineView(stepId: StepId, uiState?: { currentStepInfo: CurrentStepInfo; activeTranscriptIndex: number }): { status: StepStatus; error?: string } {
    return this.uiService.getStepStatusForPipelineView(stepId, uiState);
  }

  getTranscriptStatusDisplay(transcriptId: string): string {
    return this.uiService.getTranscriptStatusDisplay(transcriptId);
  }

  loadStepData(stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string): { inputData?: any; outputData?: any; error?: string; groundingSources?: any[] } {
    return this.uiService.loadStepData(stepId, transcriptId, phaseId, gduId);
  }

  getNextStepDetails(currentStepInfo: CurrentStepInfo, activeTranscriptIndex: number): any {
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
  // File Operations (Delegated to FileManagementService)
  // ============================================================================

  async uploadTranscripts(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    await this.fileManagementService.uploadTranscripts(event);
  }

  async handleDroppedFiles(files: File[]): Promise<void> {
    await this.fileManagementService.handleDroppedFiles(files);
  }

  async saveStateToFile(state: any, filename: string): Promise<void> {
    this.fileManagementService.saveStateToFile(state, filename);
  }

  async loadStateFromFile(file: File): Promise<any> {
    return await this.fileManagementService.loadStateFromFile(file);
  }

  // ============================================================================
  // Reset and State Management
  // ============================================================================

  async resetPipeline(): Promise<void> {
    this.dependencies.resetTranscripts();
    this.dependencies.resetPromptHistory();
    this.dependencies.resetAnalysisState();
    this.dependencies.resetOrchestrationState();
    console.log('✅ [ModularPipelineService] Pipeline reset completed');
  }

  loadState(savedState: any): void {
    console.log('[ModularPipelineService] loadState - updating frontend state');
    // Implement state loading as needed
  }

  getSaveState(activeTranscriptIndex: number, currentStepInfo: CurrentStepInfo, settings: any): any {
    // Implement state saving as needed
    return {};
  }

  resetPromptHistoryOnly(): void {
    this.dependencies.resetPromptHistory();
  }

  async clearAutosaveData(): Promise<void> {
    // Implement autosave clearing as needed
  }

  // ============================================================================
  // Placeholder methods for compatibility
  // ============================================================================

  downloadOutput(stepIdToDownload?: StepId, transcriptId?: string, dataToDownload?: any): void {
    console.warn('[ModularPipelineService] downloadOutput - using fallback implementation');
    
    if (dataToDownload) {
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

  downloadPromptHistory(format: 'tsv' | 'json', outputDirectory: string): void {
    console.warn('[ModularPipelineService] downloadPromptHistory not yet implemented');
  }

  generateAppendix(type: 'markdown' | 'html', outputDirectory: string): void {
    console.warn('[ModularPipelineService] generateAppendix not yet implemented');
  }

  generateMarkdownReport(reportData: any, outputDirectory: string): void {
    console.warn('[ModularPipelineService] generateMarkdownReport not yet implemented');
  }

  exportVisualization(mermaidSyntax: string, filename: string, format: 'svg' | 'mermaid'): void {
    console.warn('[ModularPipelineService] exportVisualization not yet implemented');
  }

  orchestrateInvalidation(stepId: StepId, transcriptId?: string, phaseId?: string, gduId?: string): void {
    console.warn('[ModularPipelineService] orchestrateInvalidation not yet implemented');
  }

  retryWithUserSeed(currentStepInfo: CurrentStepInfo, retrySeedInput: string, settings: SettingsData): void {
    console.warn('[ModularPipelineService] retryWithUserSeed not yet implemented');
  }

  performIrrAnalysis(runAOutputs: any[], runBOutputs: any[], settings?: Partial<SettingsData>): Promise<any> {
    console.warn('[ModularPipelineService] performIrrAnalysis not yet implemented');
    return Promise.reject(new Error('IRR analysis not yet implemented for modular pipeline'));
  }
}