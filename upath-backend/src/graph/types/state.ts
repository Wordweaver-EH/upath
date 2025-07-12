import { RawTranscript } from './transcript';
import { StepOutput } from './outputs';
import { GraphError } from './errors';
import type { P9_1_Input } from '../nodes/P9_1_SemanticGduMappingNode';

export interface PipelineSettings {
  model?: string;
  temperature?: number;
  autoRun?: boolean;
  startFrom?: string;
  hilMetaPrompt?: string; // Human-in-the-Loop meta prompt for step corrections
  seed?: number;
  [key: string]: any;
}

export interface GraphMetadata {
  startTime: number;
  lastUpdateTime: number;
  settings: PipelineSettings;
  checkpointId?: string;
  parentCheckpointId?: string;
  // Phase-specific metadata for P2S nodes
  currentPhaseName?: string;
  // Collected structures for P3 alignment
  all_specific_diachronic_structures?: Array<{
    transcript_id: string;
    filename: string;
    independent_variable_details: string;
    dependent_variable_focus: string[];
    specific_diachronic_structure: {
      summary: string;
      phases: Array<{
        phase_name: string;
        description: string;
        units_involved: string[];
      }>;
      visualization_hint: string;
      iv_preliminary_observation: string;
    };
  }>;
  // Global DV focus for entire analysis
  global_dv_focus?: string[];
  // All refined DUs for P3_2 processing
  all_refined_dus_with_iv_and_ids?: Array<{
    transcript_id: string;
    refined_du_id: string;
    name: string;
    description: string;
    temporal_phase: string;
    confidence: number;
    iv_details: string;
  }>;
  // Current GDU being processed for P4S nodes
  current_gdu_id?: string;
  // All SSS data across transcripts for P4S processing
  all_sss_data?: Array<{
    transcript_id: string;
    phase_name: string;
    gdu_ids: string[]; // Which GDUs this transcript/phase contributes to
    sss_nodes: Array<{
      sss_node_id: string;
      sss_node_label: string;
      sss_node_definition?: string;
    }>;
  }>;
  [key: string]: any; // Allow additional metadata
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
  // Special input for IRR analysis (P9_1 node)
  irr_inputs?: P9_1_Input;
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
  userDvFocus: null,
  irr_inputs: null
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
  llmClient: any; // GenerativeModel from @google/generative-ai (keeping any for now due to import complexity)
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