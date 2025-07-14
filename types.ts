// ============================================================================
// FRONTEND TYPES (Clean after LangGraph Migration)
// ============================================================================
// This file now imports most types from the LangGraph backend and only 
// contains frontend-specific types for UI, state management, and file handling.

// ============================================================================
// BACKEND TYPE IMPORTS (All pipeline step outputs)
// ============================================================================
// Import all step output types from the authoritative LangGraph backend
export type {
  // Part -1: Variable Identification
  P_NEG1_1_Output,
  
  // Part 0: Data Preparation Output Types
  P0_1_Output,
  RefinedLine,
  P0_2_Output,
  SelectedProceduralUtterance as SelectedUtterance, // Alias for frontend compatibility
  P0_3_Output,
  
  // Part I: Specific Diachronic Analysis
  FineGrainedSegment as SegmentedUtteranceSegment, // Alias for frontend compatibility
  P1_1_Output,
  DiachronicUnit as DiachronicUnitP1_2, // Alias for frontend compatibility
  P1_2_Output,
  RefinedDiachronicUnit as RefinedDiachronicUnitP1_3, // Alias for frontend compatibility
  P1_3_Output,
  SpecificDiachronicPhase,
  SpecificDiachronicStructure as SpecificDiachronicStructureType, // Alias for frontend compatibility
  P1_4_Output,
  
  // Part II_S: Specific Synchronic Analysis
  P2S_1_ThematicGroup,
  P2S_1_Output,
  P2S_2_SpecificSynchronicUnit as P2S_2_SynchronicUnit, // Alias for frontend compatibility
  P2S_2_Output,
  P2S_3_NetworkNode,
  P2S_3_NetworkLink,
  P2S_3_Output,
  
  // Part III: Generic Diachronic Analysis
  P3_1_Output,
  P3_2_Classification,
  P3_2_IdentifiedGdu,
  P3_2_Output,
  GenericDiachronicStructureDefinition,
  P3_3_Output,
  
  // Part IV_S: Generic Synchronic Analysis
  SSSNodeReference,
  SSSNodeGroup,
  P4S_1_A_Output,
  P4S_1_GenericNode,
  P4S_1_GenericLink,
  P4S_1_InstantiationNote,
  P4S_1_Output,
  
  // Part V: Refinement
  P5_1_IvGroupAnalysis,
  P5_1_ComparativeAnalysisOutput,
  P5_1_TranscriptGduSequence,
  P5_1_IvGroupSummary,
  P5_1_Input,
  P5_1_InputWithFlag,
  P5_2_RefinementOutput,
  
  // Part VII: Causal Structure Elicitation
  P7_1_CandidateVariable,
  P7_1_Output,
  P7_2_ProposedLink,
  P7_2_RejectedLink,
  P7_2_Output,
  P7_3_DagNode,
  P7_3_DagEdge,
  P7_3_Mediator,
  P7_3_Confounder,
  P7_3_Collider,
  P7_3_Output,
  P7_4_BackdoorPath,
  P7_4_AdjustmentSet,
  P7_4_PathAnalysis,
  P7_4_ColliderBiasWarning,
  P7_4_Output,
  P7_5_FormalHypothesis,
  P7_5_Output,
  P7_3b_ResolutionAction,
  P7_3b_CompositeVariable,
  P7_3b_CycleInfo,
  P7_3b_Output,
  
  // Complete Node Output
  CompleteOutput,
  
} from './upath-backend/src/types/outputs';

// Import backend enums that the frontend uses
export { StepId } from './upath-backend/src/types/enums';

// ============================================================================
// FRONTEND-SPECIFIC TYPES (UI, State Management, File Handling)
// ============================================================================

export interface RawTranscript {
  id: string;
  filename: string;
  content: string;
}

export enum StepStatus {
  Idle = "idle",
  Loading = "loading",
  Success = "success",
  Error = "error",
}

export interface UserDVFocus {
  dv_focus: string[];
}

export interface PromptHistoryEntry {
  stepId: StepId;
  transcriptId?: string;
  timestamp: string;
  prompt: string;
  requestPayload: any;
  responseRaw: string;
  responseParsed?: any;
  error?: string;
  groundingSources?: GroundingChunk[];
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: GroundingChunkWeb;
}

// ============================================================================
// FRONTEND STATE MANAGEMENT TYPES
// ============================================================================

export interface P2SPhaseData {
  p2s_1_output?: P2S_1_Output;
  p2s_1_error?: string;
  p2s_2_output?: P2S_2_Output;
  p2s_2_error?: string;
  p2s_3_output?: P2S_3_Output;
  p2s_3_error?: string;
  p2s_3_mermaid_syntax?: string;
}

export interface TranscriptProcessedData {
  id: string;
  filename: string;

  p_neg1_1_output?: P_NEG1_1_Output;
  p_neg1_1_error?: string;

  p0_1_output?: P0_1_Output;
  p0_1_error?: string;
  p0_2_output?: P0_2_Output;
  p0_2_error?: string;
  p0_3_output?: P0_3_Output;
  p0_3_error?: string;

  p1_1_output?: P1_1_Output;
  p1_1_error?: string;
  p1_2_output?: P1_2_Output;
  p1_2_error?: string;
  p1_3_output?: P1_3_Output;
  p1_3_error?: string;
  p1_4_output?: P1_4_Output;
  p1_4_error?: string;
  p1_4_mermaid_syntax?: string;
  isFullyProcessedSpecificDiachronic: boolean;

  p2s_outputs_by_phase?: Record<string, P2SPhaseData>;
  phases_for_p2s_processing?: string[];
  current_phase_for_p2s_processing?: string;
  processed_phases_for_p2s?: string[];
  isFullyProcessedSpecificSynchronic: boolean;
}

export interface GenericAnalysisState {
  p3_1_output?: P3_1_Output;
  p3_1_error?: string;
  p3_2_output?: P3_2_Output;
  p3_2_error?: string;
  p3_3_output?: P3_3_Output;
  p3_3_mermaid_syntax?: string;
  p3_3_error?: string;
  isFullyProcessedGenericDiachronic: boolean;

  p4s_1_a_outputs_by_gdu?: Record<string, P4S_1_A_Output | undefined>;
  p4s_1_a_error?: string;

  p4s_outputs_by_gdu?: Record<string, P4S_1_Output | undefined>;
  p4s_mermaid_syntax_by_gdu?: Record<string, string | undefined>;
  p4s_1_b_error?: string;

  current_gdu_for_p4s_processing?: string;
  core_gdus_for_sync_analysis?: string[];
  processed_gdus_for_p4s?: string[];

  isFullyProcessedGenericSynchronic: boolean;

  p5_1_output?: P5_1_ComparativeAnalysisOutput;
  p5_1_error?: string;
  p5_2_output?: P5_2_RefinementOutput;
  p5_2_error?: string;
  isRefinementDone: boolean;

  p7_1_output?: P7_1_Output;
  p7_1_error?: string;
  p7_2_output?: P7_2_Output;
  p7_2_error?: string;
  p7_3_output?: P7_3_Output;
  p7_3_mermaid_syntax_dag?: string;
  p7_3_error?: string;
  p7_3b_output?: P7_3b_Output;
  p7_3b_error?: string;
  p7_3b_mermaid_syntax_dag?: string;
  p7_4_output?: P7_4_Output;
  p7_4_error?: string;
  p7_5_output?: P7_5_Output;
  p7_5_error?: string;
  isCausalModelingDone: boolean;

  p6_1_output?: P6_1_Output;
  p6_1_error?: string;
  isReportGenerated: boolean;
}

export interface CurrentStepInfo {
  transcriptId?: string;
  stepId: StepId;
  status: StepStatus;
  inputData?: any;
  outputData?: any;
  error?: string;
  groundingSources?: GroundingChunk[];
  currentGduForP4S?: string;
  currentPhaseForP2S?: string;
}

export interface HilContext {
  stepInfo: CurrentStepInfo;
  originalPrompt: string;
  previousResponse: string;
  metaPrompt?: string;
  needsProcessing?: boolean;
}

// ============================================================================
// FRONTEND UI TYPES
// ============================================================================

// Legacy types kept for UI compatibility - these are type aliases for synchronic structures
export type SynchronicStructureP2S = P2S_3_Output['specific_synchronic_structure'];
export type SynchronicStructureP4S = P4S_1_Output['generic_synchronic_structure'];
export type SynchronicStructureType = SynchronicStructureP2S | SynchronicStructureP4S;

// Report generation type (simplified)
export type P6_1_Output = string;

// ============================================================================
// APP STATE (Save/Load)
// ============================================================================

export type SavedState = AppState;

export interface AppState {
  version: string;
  rawTranscripts: RawTranscript[];
  processedDataArray: Array<[string, TranscriptProcessedData]>;
  genericAnalysisState: GenericAnalysisState;
  promptHistory: PromptHistoryEntry[];
  currentStepInfo: CurrentStepInfo;
  activeTranscriptIndex: number;
  userDvFocus: UserDVFocus;
  dvFocusInput: string;
  temperature: number;
  seedInput: string;
  outputDirectory: string;
  autoDownloadResults: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  elapsedTime: number;
}

// ============================================================================
// INTER-RATER RELIABILITY (IRR) MODULE TYPES
// ============================================================================

export interface P9_1_SemanticGduMapping {
  gdu_mappings: Array<{
    run_a_gdu_id: string;
    run_a_definition: string;
    run_a_contributing_rdu_count: number;
    run_b_gdu_id: string | null;
    run_b_definition: string | null;
    run_b_contributing_rdu_count: number;
    semantic_similarity_score: number;
    mapping_justification: string;
  }>;
}

export interface P9_1_Output extends P9_1_SemanticGduMapping {
  // Inherits gdu_mappings array
}

export interface IrrResults {
  alpha_score: number;
  interpretation: string;
  total_utterances: number;
  mapped_gdus: number;
  unmapped_gdus_run_a: number;
  unmapped_gdus_run_b: number;
  observed_disagreement: number;
  expected_disagreement: number;
  matrix_validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  cohens_kappa: number;
  kappa_interpretation: string;
  kappa_observed_agreement: number;
  kappa_expected_agreement: number;
}

export interface IrrWorkflowState {
  isIrrModalOpen: boolean;
  runA: AppState | null;
  runB: AppState | null;
  isMappingModalOpen: boolean;
  mappingProposal: P9_1_SemanticGduMapping | null;
  confirmedMapping: Record<string, string | null> | null;
  results: IrrResults | null;
  kappaResults?: any;
  loadingState: 'idle' | 'loading-files' | 'calling-llm' | 'calculating' | 'complete' | 'error';
  errorMessage?: string;
}

export interface GduMappingDisplayItem {
  runAGduId: string;
  runADefinition: string;
  runAContributingRduCount: number;
  runATranscriptCount: number;
  proposedRunBGduId: string | null;
  proposedRunBDefinition: string | null;
  proposedRunBContributingRduCount: number;
  proposedRunBTranscriptCount: number;
  semanticSimilarityScore: number;
  mappingJustification: string;
  availableRunBOptions: Array<{
    gduId: string;
    definition: string;
    contributingRduCount: number;
    transcriptCount: number;
  }>;
}