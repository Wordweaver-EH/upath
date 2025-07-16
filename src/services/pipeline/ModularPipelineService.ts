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
  shouldOfferBucketing?: boolean; // Flag to show bucketing modal
  bucketId?: string; // For bucket processing results
  originalTranscriptId?: string; // Original transcript ID before bucket prefixing
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
   * Supports both normal processing and bucket processing
   */
  async processSingleStep(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
    // Check if bucketing is enabled and this is not P_NEG1_1
    if (params.settings?.bucketingEnabled && params.stepId !== 'P_NEG1_1_VARIABLE_IDENTIFICATION') {
      // Route to bucket processing for non-P_NEG1_1 steps when bucketing is enabled
      return await this.processSingleStepWithBucketing(params);
    }

    // Use normal step processing
    return await this.processNormalStep(params);
  }

  /**
   * Process a single step using normal (non-bucketing) logic
   */
  async processNormalStep(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
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
      let currentTranscript: any;
      if (params.transcriptId) {
        // If specific transcript ID is provided (for bucket processing), use it
        currentTranscript = rawTranscripts.find(t => t.id === params.transcriptId);
        if (!currentTranscript) {
          return {
            success: false,
            error: `No transcript found with ID ${params.transcriptId}`,
            stepId: params.stepId,
            status: StepStatus.ERROR,
            executionTime: Date.now() - startTime
          };
        }
      } else {
        // Use active transcript index for normal processing
        const activeTranscriptIndex = this.dependencies.getActiveTranscriptIndex();
        currentTranscript = rawTranscripts[activeTranscriptIndex];
        
        if (!currentTranscript) {
          return {
            success: false,
            error: `No transcript found at index ${activeTranscriptIndex}`,
            stepId: params.stepId,
            status: StepStatus.ERROR,
            executionTime: Date.now() - startTime
          };
        }
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
        requestPayload: request,
        responseRaw: JSON.stringify(result.output, null, 2),
        responseParsed: result.output,
        estimatedInputTokens: 0, // Backend tracks tokens internally
        estimatedOutputTokens: 0
      };

      this.dependencies.addPromptEntry(promptEntry);

      console.log(`✅ [ModularPipelineService] Step ${result.stepId} completed in ${result.executionTimeMs}ms`);

      // Check if we should offer bucketing after P_NEG1_1 completion
      const shouldOfferBucketing = this.shouldOfferBucketing(result.stepId);

      return {
        success: true,
        output: result.output,
        stepId: result.stepId,
        status: StepStatus.COMPLETED,
        executionTime: result.executionTimeMs,
        promptHistory: promptEntry,
        shouldOfferBucketing // Add flag for UI to show bucketing modal
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
   * Check if bucketing should be offered after step completion
   * Only offer after P_NEG1_1 when we have header data available
   */
  private shouldOfferBucketing(stepId: StepId): boolean {
    if (stepId !== 'P_NEG1_1_VARIABLE_IDENTIFICATION') {
      return false;
    }

    // Check if any transcripts have discovered variables OR legacy header data
    const { processedData } = this.dependencies.getTranscriptData();
    let hasValidData = false;
    
    processedData.forEach((transcriptData) => {
      const output = transcriptData.p_neg1_1_output;
      if (output) {
        // Check for new discovered_variables array
        if (output.discovered_variables && output.discovered_variables.length > 0) {
          hasValidData = true;
        }
        // Also check legacy parsed_header for backward compatibility
        else if (output.parsed_header) {
          hasValidData = true;
        }
      }
    });

    return hasValidData;
  }

  /**
   * Group transcripts into buckets based on IV+Event combinations
   * Returns a map where key is bucketId and value is array of transcript IDs
   */
  private createTranscriptBuckets(ivField: 'suggestion' | 'score', eventField: 'suggestion' | 'score'): Map<string, string[]> {
    const { rawTranscripts, processedData } = this.dependencies.getTranscriptData();
    const buckets = new Map<string, string[]>();

    rawTranscripts.forEach((transcript) => {
      const transcriptData = processedData.get(transcript.id);
      const p_neg1_1_output = transcriptData?.p_neg1_1_output;

      if (p_neg1_1_output?.parsed_header) {
        const { iv_value, event_value } = p_neg1_1_output.parsed_header;
        
        // Map fields based on user selection
        const iv = ivField === 'score' ? iv_value : event_value;
        const event = eventField === 'suggestion' ? event_value : iv_value;
        
        if (iv && event) {
          const bucketId = `iv${iv}_event${event}`;
          
          if (!buckets.has(bucketId)) {
            buckets.set(bucketId, []);
          }
          buckets.get(bucketId)!.push(transcript.id);
        }
      }
    });

    return buckets;
  }

  /**
   * Create prefixed transcript ID for bucket processing
   */
  private createBucketTranscriptId(bucketId: string, originalTranscriptId: string): string {
    return `bucket_${bucketId}_${originalTranscriptId}`;
  }

  /**
   * Process a single bucket by running the normal pipeline on its transcript subset
   */
  async processBucket(bucketId: string, transcriptIds: string[], stepId: StepId, settings: any): Promise<ProcessSingleStepResult[]> {
    const { rawTranscripts, processedData } = this.dependencies.getTranscriptData();
    const results: ProcessSingleStepResult[] = [];

    console.log(`📦 [ModularPipelineService] Processing bucket ${bucketId} with ${transcriptIds.length} transcripts for step ${stepId}`);

    // Process each transcript in the bucket
    for (const transcriptId of transcriptIds) {
      const transcript = rawTranscripts.find(t => t.id === transcriptId);
      if (!transcript) {
        console.warn(`⚠️ [ModularPipelineService] Transcript ${transcriptId} not found for bucket ${bucketId}`);
        continue;
      }

      try {
        // Create bucket-prefixed transcript ID for storage isolation
        const bucketTranscriptId = this.createBucketTranscriptId(bucketId, transcriptId);
        
        // Copy original data to bucket-prefixed entry for processing isolation
        const originalData = processedData.get(transcriptId);
        if (originalData) {
          const bucketData = { ...originalData, id: bucketTranscriptId };
          this.dependencies.replaceProcessedData(bucketTranscriptId, bucketData);
        }

        // Process this transcript using normal pipeline logic, but with bucketing disabled
        // and using the original transcript ID for lookup (not the bucket-prefixed ID)
        const settingsWithoutBucketing = { ...settings, bucketingEnabled: false };
        const result = await this.processNormalStep({
          stepId,
          settings: settingsWithoutBucketing,
          transcriptId: transcriptId // Use original transcript ID for lookup in rawTranscripts
        });

        // Store result with bucket-prefixed ID in processed data for isolation
        if (result.success && result.output) {
          await this.updateStoresFromStepResult({
            success: true,
            stepId: result.stepId,
            output: result.output,
            executionTimeMs: result.executionTime || 0,
            timestamp: new Date().toISOString()
          }, bucketTranscriptId);
        }

        results.push({
          ...result,
          bucketId,
          originalTranscriptId: transcriptId
        });

        console.log(`✅ [ModularPipelineService] Processed ${transcriptId} in bucket ${bucketId}: ${result.success ? 'success' : 'failed'}`);

      } catch (error) {
        console.error(`❌ [ModularPipelineService] Error processing ${transcriptId} in bucket ${bucketId}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stepId,
          status: StepStatus.ERROR,
          bucketId,
          originalTranscriptId: transcriptId
        });
      }
    }

    return results;
  }

  /**
   * Process a single step with bucketing enabled
   * Routes to bucket processing for the current step
   */
  async processSingleStepWithBucketing(params: ProcessSingleStepParams): Promise<ProcessSingleStepResult> {
    const startTime = Date.now();

    try {
      console.log(`🎯 [ModularPipelineService] Processing step ${params.stepId} with bucketing enabled`);

      // Process all buckets for this step
      const bucketResults = await this.processAllBuckets(params.stepId, params.settings);

      // Aggregate results with hierarchical analysis
      const aggregatedResults = this.aggregateBucketResults(bucketResults.bucketResults, params.stepId);
      const analysisReport = this.generateBucketAnalysisReport(aggregatedResults, params.stepId);

      console.log(`🏁 [ModularPipelineService] Bucketing complete: ${aggregatedResults.summary.successfulTranscripts}/${aggregatedResults.summary.totalTranscripts} transcripts processed successfully`);

      return {
        success: bucketResults.overallSuccess,
        stepId: params.stepId,
        status: bucketResults.overallSuccess ? StepStatus.COMPLETED : StepStatus.ERROR,
        executionTime: Date.now() - startTime,
        output: {
          bucketResults: Object.fromEntries(bucketResults.bucketResults),
          aggregatedResults: {
            byIv: Object.fromEntries(aggregatedResults.byIv),
            byEvent: Object.fromEntries(aggregatedResults.byEvent),
            combined: Object.fromEntries(aggregatedResults.combined),
            summary: aggregatedResults.summary
          },
          analysisReport,
          summary: {
            totalBuckets: bucketResults.bucketResults.size,
            totalTranscripts: aggregatedResults.summary.totalTranscripts,
            successfulTranscripts: aggregatedResults.summary.successfulTranscripts,
            overallSuccess: bucketResults.overallSuccess,
            hierarchicalInsights: {
              ivCount: aggregatedResults.summary.ivCount,
              eventCount: aggregatedResults.summary.eventCount,
              avgSuccessRateByIv: aggregatedResults.summary.avgSuccessRateByIv,
              avgSuccessRateByEvent: aggregatedResults.summary.avgSuccessRateByEvent
            }
          }
        }
      };

    } catch (error) {
      console.error(`❌ [ModularPipelineService] Bucket processing failed for step ${params.stepId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during bucket processing',
        stepId: params.stepId,
        status: StepStatus.ERROR,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process all buckets for a given step
   * This is the main entry point for bucket execution
   */
  async processAllBuckets(stepId: StepId, settings: any): Promise<{ 
    bucketResults: Map<string, ProcessSingleStepResult[]>;
    overallSuccess: boolean;
  }> {
    const { bucketingEnabled, bucketIvField, bucketEventField } = settings;
    
    if (!bucketingEnabled) {
      throw new Error('Bucketing is not enabled');
    }

    console.log(`🎯 [ModularPipelineService] Starting bucket processing for step ${stepId}`);
    console.log(`📊 [ModularPipelineService] Bucket configuration: IV=${bucketIvField}, Event=${bucketEventField}`);

    // Create buckets
    const buckets = this.createTranscriptBuckets(bucketIvField, bucketEventField);
    console.log(`📦 [ModularPipelineService] Created ${buckets.size} buckets:`, Array.from(buckets.keys()));

    const bucketResults = new Map<string, ProcessSingleStepResult[]>();
    let overallSuccess = true;

    // Process each bucket sequentially
    for (const [bucketId, transcriptIds] of buckets.entries()) {
      try {
        const results = await this.processBucket(bucketId, transcriptIds, stepId, settings);
        bucketResults.set(bucketId, results);

        // Check if any transcript in this bucket failed
        const bucketSuccess = results.every(result => result.success);
        if (!bucketSuccess) {
          overallSuccess = false;
          console.warn(`⚠️ [ModularPipelineService] Bucket ${bucketId} had failures`);
        } else {
          console.log(`✅ [ModularPipelineService] Bucket ${bucketId} completed successfully`);
        }

      } catch (error) {
        console.error(`❌ [ModularPipelineService] Failed to process bucket ${bucketId}:`, error);
        overallSuccess = false;
      }
    }

    console.log(`🏁 [ModularPipelineService] Bucket processing complete. Overall success: ${overallSuccess}`);
    
    return {
      bucketResults,
      overallSuccess
    };
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

  /**
   * Aggregate bucket results into hierarchical structures
   * Provides rollups by IV, Event, and combined dimensions
   */
  aggregateBucketResults(bucketResults: Map<string, ProcessSingleStepResult[]>, stepId: StepId): {
    byIv: Map<string, ProcessSingleStepResult[]>;
    byEvent: Map<string, ProcessSingleStepResult[]>;
    combined: Map<string, ProcessSingleStepResult[]>;
    summary: {
      totalBuckets: number;
      totalTranscripts: number;
      successfulTranscripts: number;
      failedTranscripts: number;
      ivCount: number;
      eventCount: number;
      avgSuccessRateByIv: number;
      avgSuccessRateByEvent: number;
    };
  } {
    const byIv = new Map<string, ProcessSingleStepResult[]>();
    const byEvent = new Map<string, ProcessSingleStepResult[]>();
    const combined = new Map<string, ProcessSingleStepResult[]>();
    
    let totalTranscripts = 0;
    let successfulTranscripts = 0;
    
    // Parse bucket IDs and aggregate results
    for (const [bucketId, results] of bucketResults.entries()) {
      // Parse bucket ID: "iv4_event1" -> iv="4", event="1"
      const bucketMatch = bucketId.match(/^iv(\w+)_event(\w+)$/);
      if (!bucketMatch) {
        console.warn(`[ModularPipelineService] Invalid bucket ID format: ${bucketId}`);
        continue;
      }
      
      const iv = bucketMatch[1];
      const event = bucketMatch[2];
      
      // Store combined results
      combined.set(bucketId, results);
      
      // Aggregate by IV
      if (!byIv.has(iv)) {
        byIv.set(iv, []);
      }
      byIv.get(iv)!.push(...results);
      
      // Aggregate by Event
      if (!byEvent.has(event)) {
        byEvent.set(event, []);
      }
      byEvent.get(event)!.push(...results);
      
      // Count totals
      totalTranscripts += results.length;
      successfulTranscripts += results.filter(r => r.success).length;
    }
    
    // Calculate summary statistics
    const failedTranscripts = totalTranscripts - successfulTranscripts;
    const ivCount = byIv.size;
    const eventCount = byEvent.size;
    
    // Calculate average success rates
    let ivSuccessRateSum = 0;
    for (const [iv, results] of byIv.entries()) {
      const successCount = results.filter(r => r.success).length;
      const successRate = results.length > 0 ? (successCount / results.length) : 0;
      ivSuccessRateSum += successRate;
    }
    const avgSuccessRateByIv = ivCount > 0 ? (ivSuccessRateSum / ivCount) : 0;
    
    let eventSuccessRateSum = 0;
    for (const [event, results] of byEvent.entries()) {
      const successCount = results.filter(r => r.success).length;
      const successRate = results.length > 0 ? (successCount / results.length) : 0;
      eventSuccessRateSum += successRate;
    }
    const avgSuccessRateByEvent = eventCount > 0 ? (eventSuccessRateSum / eventCount) : 0;
    
    console.log(`📊 [ModularPipelineService] Aggregated ${bucketResults.size} buckets:`);
    console.log(`   - ${ivCount} IVs, ${eventCount} Events`);
    console.log(`   - ${successfulTranscripts}/${totalTranscripts} transcripts successful`);
    console.log(`   - Avg success rate by IV: ${(avgSuccessRateByIv * 100).toFixed(1)}%`);
    console.log(`   - Avg success rate by Event: ${(avgSuccessRateByEvent * 100).toFixed(1)}%`);
    
    return {
      byIv,
      byEvent,
      combined,
      summary: {
        totalBuckets: bucketResults.size,
        totalTranscripts,
        successfulTranscripts,
        failedTranscripts,
        ivCount,
        eventCount,
        avgSuccessRateByIv,
        avgSuccessRateByEvent
      }
    };
  }

  /**
   * Generate hierarchical analysis report from bucket results
   * Provides insights across IV and Event dimensions
   */
  generateBucketAnalysisReport(aggregatedResults: ReturnType<typeof this.aggregateBucketResults>, stepId: StepId): string {
    const { byIv, byEvent, summary } = aggregatedResults;
    
    let report = `# Hierarchical Bucketing Analysis Report - ${stepId}\n\n`;
    
    // Overall Summary
    report += `## Overall Summary\n`;
    report += `- **Total Buckets**: ${summary.totalBuckets}\n`;
    report += `- **Total Transcripts**: ${summary.totalTranscripts}\n`;
    report += `- **Success Rate**: ${summary.successfulTranscripts}/${summary.totalTranscripts} (${((summary.successfulTranscripts/summary.totalTranscripts)*100).toFixed(1)}%)\n`;
    report += `- **IV Dimensions**: ${summary.ivCount}\n`;
    report += `- **Event Dimensions**: ${summary.eventCount}\n\n`;
    
    // IV Analysis
    report += `## Analysis by Independent Variable (IV)\n\n`;
    for (const [iv, results] of byIv.entries()) {
      const successCount = results.filter(r => r.success).length;
      const successRate = (successCount / results.length) * 100;
      report += `### IV ${iv}\n`;
      report += `- **Transcripts**: ${results.length}\n`;
      report += `- **Success Rate**: ${successCount}/${results.length} (${successRate.toFixed(1)}%)\n`;
      report += `- **Failed Transcripts**: ${results.length - successCount}\n`;
      
      // List unique events for this IV
      const events = new Set(results.map(r => r.bucketId?.match(/event(\w+)$/)?.[1]).filter(Boolean));
      report += `- **Events**: ${Array.from(events).join(', ')}\n\n`;
    }
    
    // Event Analysis
    report += `## Analysis by Event Type\n\n`;
    for (const [event, results] of byEvent.entries()) {
      const successCount = results.filter(r => r.success).length;
      const successRate = (successCount / results.length) * 100;
      report += `### Event ${event}\n`;
      report += `- **Transcripts**: ${results.length}\n`;
      report += `- **Success Rate**: ${successCount}/${results.length} (${successRate.toFixed(1)}%)\n`;
      report += `- **Failed Transcripts**: ${results.length - successCount}\n`;
      
      // List unique IVs for this event
      const ivs = new Set(results.map(r => r.bucketId?.match(/^iv(\w+)_/)?.[1]).filter(Boolean));
      report += `- **IVs**: ${Array.from(ivs).join(', ')}\n\n`;
    }
    
    // Recommendations
    report += `## Recommendations\n\n`;
    
    if (summary.avgSuccessRateByIv < 0.8) {
      report += `- **IV Performance**: Some IV values show low success rates. Consider reviewing transcript quality or adjusting processing parameters.\n`;
    }
    
    if (summary.avgSuccessRateByEvent < 0.8) {
      report += `- **Event Performance**: Some event types show low success rates. Consider specialized processing for different event types.\n`;
    }
    
    if (summary.totalBuckets > 10) {
      report += `- **Bucket Optimization**: Consider consolidating buckets with similar characteristics to improve processing efficiency.\n`;
    }
    
    report += `\n---\n*Report generated: ${new Date().toISOString()}*\n`;
    
    return report;
  }

  /**
   * Export bucket results to downloadable format
   * Supports both detailed and summary export modes
   */
  exportBucketResults(bucketResults: Map<string, ProcessSingleStepResult[]>, aggregatedResults: ReturnType<typeof this.aggregateBucketResults>, format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: aggregatedResults.summary,
        bucketResults: Object.fromEntries(bucketResults),
        aggregations: {
          byIv: Object.fromEntries(aggregatedResults.byIv),
          byEvent: Object.fromEntries(aggregatedResults.byEvent)
        }
      }, null, 2);
    } else {
      // CSV format - flattened view
      let csv = 'BucketId,IV,Event,TranscriptId,Success,Error,ExecutionTime\n';
      
      for (const [bucketId, results] of bucketResults.entries()) {
        const bucketMatch = bucketId.match(/^iv(\w+)_event(\w+)$/);
        const iv = bucketMatch?.[1] || 'unknown';
        const event = bucketMatch?.[2] || 'unknown';
        
        for (const result of results) {
          csv += `${bucketId},${iv},${event},${result.originalTranscriptId || 'unknown'},${result.success},${result.error || ''},${result.executionTime || 0}\n`;
        }
      }
      
      return csv;
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