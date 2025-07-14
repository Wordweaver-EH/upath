/**
 * Prompt History Entry - matches frontend PromptHistoryEntry interface
 */
export interface PromptHistoryEntry {
  timestamp: string;
  stepId: string;
  transcriptId?: string;
  prompt: string;
  response: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
}

/**
 * Saved Pipeline State - complete state snapshot for persistence
 */
export interface SavedPipelineState {
  // Core pipeline state
  pipelineId: string;
  transcripts: any[];
  stepOutputs: Record<string, any>;
  currentPhase: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  
  // User configuration
  userDvFocus?: { dv_focus: string[] };
  settings: {
    model?: string;
    temperature?: number;
    seed?: number;
    [key: string]: any;
  };
  
  // Execution history
  promptHistory: PromptHistoryEntry[];
  
  // Metadata
  metadata: {
    timestamp: string;
    version: string;
    totalSteps: number;
    completedSteps: number;
    sessionId?: string;
  };
  
  // Loop control state
  currentTranscriptIndex: number;
  currentPhaseIndex: number;
  currentGDUIndex: number;
  isMultiTranscript: boolean;
}

/**
 * State Export Options
 */
export interface StateExportOptions {
  format: 'json' | 'tsv';
  includePromptHistory: boolean;
  includeStepOutputs: boolean;
  includeSettings: boolean;
  stepFilter?: string[];
  transcriptFilter?: string[];
}

/**
 * Prompt History Export Options
 */
export interface PromptHistoryExportOptions {
  format: 'json' | 'tsv';
  stepFilter?: string[];
  transcriptFilter?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}