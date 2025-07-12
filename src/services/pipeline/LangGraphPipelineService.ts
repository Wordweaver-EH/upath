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

  constructor(private dependencies: LangGraphPipelineServiceDependencies) {
    this.langGraph = langGraphService;
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
    // For LangGraph backend, step navigation is handled by the backend graph
    // This method is mainly used for UI display purposes
    console.warn('[LangGraphPipelineService] getNextStepDetails delegated to backend graph execution');
    
    return {
      nextStepId: null, // Backend determines next step
      canProceed: this.sessionInitialized,
      requiresInput: false
    };
  }
}