/**
 * Core interfaces for the modular µ-PATH pipeline system
 * Based on the proven working prototype pattern from Wordweaver-EH/upath
 */

import { StepId, StepOutput, RawTranscript } from '../../graph/types';

/**
 * Parameters passed to step input preparation functions
 * Matches the pattern from the working prototype's processSingleStep
 */
export interface StepInputParams {
  // Core transcript data
  currentTranscript: RawTranscript;
  allRawTranscripts: RawTranscript[];
  
  // Pipeline state (matches frontend stores)
  processedData: Map<string, any>; // Maps transcript_id -> transcript processed data
  genericAnalysisState: Record<string, any>; // Global cross-transcript analysis state
  
  // User configuration
  userDvFocus: { dv_focus: string[] };
  
  // Context for iterative steps
  currentPhaseName?: string;
  currentGduName?: string;
  
  // Optional overrides
  apiKeyPresent?: boolean;
}

/**
 * Result returned by getInput functions
 * Matches the working prototype's pattern
 */
export interface StepInputResult {
  data: any; // Prepared input data for prompt generation
  error?: string; // Error message if input preparation failed
}

/**
 * Input preparation function interface
 * Exactly matches the working prototype's getInput pattern
 */
export interface GetInputFunction {
  (params: StepInputParams): StepInputResult;
}

/**
 * Prompt generation function interface
 * Exactly matches the working prototype's generatePrompt pattern
 */
export interface GeneratePromptFunction {
  (input: any): string;
}

/**
 * Output parsing function interface
 * Exactly matches the working prototype's parseOutput pattern
 */
export interface ParseOutputFunction {
  (rawOutput: any): any;
}

/**
 * Output validation function interface
 * Matches the working prototype's validateAndClean pattern
 */
export interface ValidateAndCleanFunction {
  (parsedOutput: any): any;
}

/**
 * Step configuration interface
 * Exactly matches the working prototype's StepConfig pattern
 */
export interface StepConfig {
  readonly id: StepId;
  readonly title: string;
  readonly part: string; // e.g., "PartNeg1", "Part0", "Part1", etc.
  readonly isJsonOutput: boolean;
  readonly dependencies?: StepId[]; // Steps that must complete before this one
}

/**
 * Complete step module interface
 * Modular replacement for the monolithic STEP_CONFIGS
 */
export interface StepModule {
  readonly config: StepConfig;
  readonly getInput: GetInputFunction;
  readonly generatePrompt: GeneratePromptFunction;
  readonly parseOutput?: ParseOutputFunction;
  readonly validateAndClean?: ValidateAndCleanFunction;
}

/**
 * Step execution request interface
 * Matches the API request format for processSingleStep replacement
 */
export interface StepExecutionRequest {
  stepId: StepId;
  currentTranscript: RawTranscript;
  processedData: Record<string, any>; // Serialized version of Map
  genericAnalysisState: Record<string, any>;
  userDvFocus: { dv_focus: string[] };
  allRawTranscripts: RawTranscript[];
  transcriptIdToProcess?: string;
  overrideSeed?: number;
  temperature?: number;
  useGrounding?: boolean;
  hilMetaPrompt?: string;
}

/**
 * Step execution response interface
 * Matches the working prototype's processSingleStep return pattern
 */
export interface StepExecutionResponse {
  success: boolean;
  stepId: StepId;
  output?: StepOutput;
  error?: string;
  
  // Token usage tracking (from working prototype)
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  
  // Execution metadata
  executionTimeMs?: number;
  timestamp?: string;
}

/**
 * Gemini API call parameters interface
 * Exactly matches the working prototype's callGeminiAPI parameters
 */
export interface GeminiApiParams {
  prompt: string;
  isJsonOutput: boolean;
  useGrounding?: boolean;
  temperature?: number;
  seed?: number;
  attempt?: number;
}

/**
 * Gemini API response interface
 * Exactly matches the working prototype's callGeminiAPI return type
 */
export interface GeminiApiResponse {
  text?: string;
  parsedJson?: any;
  error?: string;
  groundingSources?: Array<{
    uri?: string;
    title?: string;
  }>;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

/**
 * Pipeline executor interface
 * Core execution engine for step processing
 */
export interface PipelineExecutor {
  executeStep(request: StepExecutionRequest): Promise<StepExecutionResponse>;
}

/**
 * Step registry interface
 * Manages registration and retrieval of step modules
 */
export interface StepRegistry {
  register(step: StepModule): void;
  get(stepId: StepId): StepModule;
  getAllSteps(): StepModule[];
  isRegistered(stepId: StepId): boolean;
}

/**
 * Validation result interface
 * For comparing implementation with working prototype
 */
export interface ValidationResult {
  stepId: StepId;
  isValid: boolean;
  differences: string[];
  recommendations: string[];
  ourResult?: any;
  expectedResult?: any;
}

/**
 * Step validator interface
 * For systematic validation against working prototype
 */
export interface StepValidator {
  validateStepPreImplementation(stepId: StepId): Promise<ValidationResult>;
  validateStepPostImplementation(stepId: StepId, testData?: any): Promise<ValidationResult>;
}