import { RawTranscript } from './transcript';
import { StepOutput } from './outputs';
import { GraphError } from './errors';

export interface PipelineSettings {
  model?: string;
  temperature?: number;
  autoRun?: boolean;
  startFrom?: string;
  [key: string]: any;
}

export interface GraphMetadata {
  startTime: number;
  lastUpdateTime: number;
  settings: PipelineSettings;
  checkpointId?: string;
  parentCheckpointId?: string;
}

export interface UserDVFocus {
  dv_focus: string[];
}

export interface GraphState {
  sessionId: string;
  currentStep: string;
  transcripts: RawTranscript[];
  stepOutputs: Record<string, StepOutput>;
  errors: Record<string, GraphError>;
  metadata: GraphMetadata;
  // Additional fields for LangGraph integration
  lastCompletedStep?: string;
  progress?: number;
  status?: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  userDvFocus?: UserDVFocus;
}

export interface NodeExecutionResult {
  success: boolean;
  state?: Partial<GraphState>;
  error?: GraphError & { stepId: string };
}

// Schema for LangGraph StateGraph channels
export const GraphStateSchema = {
  sessionId: null,
  currentStep: null,
  transcripts: null,
  stepOutputs: null,
  errors: null,
  metadata: null,
  lastCompletedStep: null,
  progress: null,
  status: null,
  userDvFocus: null
};

// Helper functions
export function createInitialGraphState(
  sessionId: string,
  transcripts: RawTranscript[],
  settings: PipelineSettings
): GraphState {
  const now = Date.now();
  return {
    sessionId,
    currentStep: 'P_NEG1_1_VARIABLE_IDENTIFICATION', // Start with first step
    transcripts,
    stepOutputs: {},
    errors: {},
    metadata: {
      startTime: now,
      lastUpdateTime: now,
      settings
    },
    status: 'idle'
  };
}

export function isValidGraphState(state: any): state is GraphState {
  return (
    typeof state === 'object' &&
    state !== null &&
    typeof state.sessionId === 'string' &&
    typeof state.currentStep === 'string' &&
    Array.isArray(state.transcripts) &&
    typeof state.stepOutputs === 'object' &&
    typeof state.errors === 'object' &&
    typeof state.metadata === 'object' &&
    typeof state.metadata.startTime === 'number' &&
    typeof state.metadata.lastUpdateTime === 'number' &&
    typeof state.metadata.settings === 'object'
  );
}

// Execution context for nodes
export interface ExecutionContext {
  llmClient: any; // Will be typed properly when we implement
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    debug: (message: string, data?: any) => void;
  };
  settings: PipelineSettings;
  progress?: {
    percentage: number;
    currentStepIndex: number;
    totalSteps: number;
  };
}