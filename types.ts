// General Types

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

// Part -1: Variable Identification Output
export interface P_neg1_1_Output {
  transcript_id: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

// Part 0: Data Preparation Output Types
export interface P0_1_Output {
  transcript_id: string;
  line_numbered_transcript: string[];
  transcription_convention_notes: string;
  initial_impressions_log: string;
}

export interface RefinedLine {
  line_num: number;
  text: string;
  information_tags: string[];
  decision_notes?: string;
}
export interface P0_2_Output {
  transcript_id: string;
  refined_data_transcript: RefinedLine[];
}

export interface SelectedUtterance {
  original_line_num: string; // Can be "X.Y" for split lines
  utterance_text: string;
  selection_justification?: string;
}
export interface P0_3_Output {
  transcript_id: string;
  selected_procedural_utterances: SelectedUtterance[];
  discarded_info_summary?: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

// Part I: Specific Diachronic Analysis
export interface SegmentedUtteranceSegment {
  segment_id: string; // e.g., utt_LINE.NUM_seg_INDEX
  segment_text: string;
  temporal_cues?: string[];
}
export interface P1_1_Output {
  transcript_id: string;
  segmented_utterances: Array<{
    original_utterance: SelectedUtterance;
    segments: SegmentedUtteranceSegment[];
  }>;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface DiachronicUnitP1_2 {
  unit_id: string;
  description: string;
  source_segment_ids: string[]; // Replaces related_utterances_or_segments_text
}
export interface P1_2_Output {
  transcript_id: string;
  diachronic_units: DiachronicUnitP1_2[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface RefinedDiachronicUnitP1_3 {
  unit_id: string; // Can be same as P1.2 ID or new if merged/split
  description: string;
  confidence: number;
  temporal_phase: string;
  source_p1_2_du_ids: string[]; // IDs from P1.2 DiachronicUnitP1_2.unit_id
}
export interface P1_3_Output {
  transcript_id: string;
  refined_diachronic_units: RefinedDiachronicUnitP1_3[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface SpecificDiachronicPhase {
    phase_name: string;
    description: string;
    units_involved: string[]; // refined_du_ids from P1_3_Output.refined_diachronic_units[].unit_id
}
export interface SpecificDiachronicStructureType {
    summary: string;
    phases: SpecificDiachronicPhase[];
    visualization_hint?: string;
    iv_preliminary_observation?: string;
}
export interface P1_4_Output {
  transcript_id: string;
  specific_diachronic_structure: SpecificDiachronicStructureType;
  independent_variable_details: string;
  dependent_variable_focus: string[];
  mermaid_syntax_specific_diachronic?: string;
}

// Part II_S: Specific Synchronic Analysis
export interface P2S_1_ThematicGroup {
  group_label: string;
  justification: string;
  utterances: Array<{ original_line_num: string; utterance_text: string }>; // These are from P0.3 SelectedUtterance
}
export interface P2S_1_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string; // This is the phase_name from P1.4
  synchronic_thematic_groups: P2S_1_ThematicGroup[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface P2S_2_SynchronicUnit {
  unit_name: string; // Serves as ID for this ISU
  level: number;
  abstraction_op: string;
  intensional_definition: string;
  utterances?: Array<{ original_line_num: string; utterance_text: string }>; // From P0.3 SelectedUtterance
  constituent_lower_units?: string[]; // unit_names of other ISUs
}
export interface P2S_2_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string; // phase_name
  specific_synchronic_units_hierarchy: P2S_2_SynchronicUnit[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface P2S_3_NetworkNode {
  id: string; // Unique ID for this SSS node
  label: string;
  source_isu_id: string; // unit_name from P2S_2_SynchronicUnit
}
export interface P2S_3_NetworkLink {
  from: string; // P2S_3_NetworkNode.id
  to: string;   // P2S_3_NetworkNode.id
  type: string;
}
export interface P2S_3_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string; // phase_name
  specific_synchronic_structure: {
    representation_type: "Semantic Network";
    description: string;
    network_nodes: P2S_3_NetworkNode[];
    network_links: P2S_3_NetworkLink[];
  };
  independent_variable_details: string;
  dependent_variable_focus: string[];
  // mermaid_syntax_specific_synchronic is stored per-phase in TranscriptProcessedData.P2SPhaseData
}


// Part III: Generic Diachronic Analysis
export interface P3_1_Output {
  aligned_structures_report: string;
  common_patterns_summary: string;
  key_differences: string[];
  dependent_variable_focus: string[];
}

// New intermediate type for P3.2 LLM classification output (Two-Phase Architecture)
export interface P3_2_Classification {
  refined_du_id: string; // The ID of the RDU being classified
  gdu_group_id: string;  // The generic group name assigned by the LLM
  rationale: string;     // The LLM's justification for the grouping
  iv_variation_note?: string; // The LLM's analysis of IV influence (optional for backward compatibility)
}

export interface P3_2_IdentifiedGdu {
  gdu_id: string;
  definition: string;
  supporting_transcripts_count: number;
  iv_variation_notes?: string;
  contributing_refined_du_ids: Array<{ transcript_id: string; refined_du_id: string; }>; // From P1.3 refined_diachronic_units[].unit_id
}
export interface P3_2_Output {
  identified_gdus: P3_2_IdentifiedGdu[];
  criteria_for_gdu_identification: string;
  dependent_variable_focus: string[];
}

export interface GenericDiachronicStructureDefinition {
    name: string;
    description: string;
    core_gdus: string[]; // GDU_IDs from P3_2_IdentifiedGdu
    optional_gdus?: string[]; // GDU_IDs
    typical_sequence?: string[]; // GDU_IDs
}
export interface P3_3_Output {
  generic_diachronic_structure_definition: GenericDiachronicStructureDefinition;
  variants_summary: string;
  confidence_level?: string;
  dependent_variable_focus: string[];
  mermaid_syntax_generic_diachronic?: string;
}

// Part IV_S: Generic Synchronic Analysis

// Output for P4S_1_A (New Step)
export interface SSSNodeReference {
  transcript_id: string;
  sss_node_id: string; // from P2S_3_NetworkNode.id
  phase_name: string;  // from P2S_3_Output.analyzed_diachronic_unit (which is a phase_name)
  sss_node_label?: string; // from P2S_3_NetworkNode.label (for AI's grouping context)
}

export interface SSSNodeGroup {
  group_id: string; // e.g., "sss_group_1"
  group_rationale: string; // Why these nodes are grouped
  contributing_sss_nodes: SSSNodeReference[];
}

export interface P4S_1_A_Output {
  analyzed_gdu: string; // GDU_ID from P3.2
  sss_node_groups: SSSNodeGroup[];
  dependent_variable_focus: string[];
  // Potential notes on grouping process or challenges
  grouping_process_notes?: string;
}


// Output for P4S_1_B (Old P4S_1, now takes P4S_1_A_Output as primary input)
// This structure remains largely the same as the old P4S_1_Output
export interface P4S_1_GenericNode {
  id: string; // Unique ID for this GSS category/node
  label: string;
}
export interface P4S_1_GenericLink {
  from: string; // P4S_1_GenericNode.id
  to: string;   // P4S_1_GenericNode.id
  type: string;
}
export interface P4S_1_InstantiationNote {
  generic_category_id: string; // P4S_1_GenericNode.id this note pertains to
  textual_description: string;
  example_specific_nodes?: Array<{ // This structure is compatible with SSSNodeReference
    transcript_id: string;
    sss_node_id: string; // P2S_3_NetworkNode.id
    phase_name?: string;  // Context for the SSS node
    // sss_node_label could be omitted here if not needed for final GSS output
  }>;
}
export interface P4S_1_Output { // This is effectively P4S_1_B_Output now
  analyzed_gdu: string; // GDU_ID from P3.2
  generic_synchronic_structure: {
    representation_type: string;
    description: string;
    generic_nodes_categories: P4S_1_GenericNode[];
    generic_network_links: P4S_1_GenericLink[];
    instantiation_notes?: P4S_1_InstantiationNote[];
  };
  variations_notes?: string;
  dependent_variable_focus: string[];
  // mermaid_syntax_generic_synchronic is stored per-GDU in GenericAnalysisState
}

// Part V: Refinement
export interface P5_1_Output {
  final_refined_generic_diachronic_structure_summary: string;
  final_refined_generic_synchronic_structures_summary: Record<string, string>; // GDU_ID -> summary string
  refinement_log: Array<{ observation: string; adjustment_made: string; justification: string; }>;
  emergent_insights: string[]; // Might need IDs if referenced by P7.1
  hypotheses_generated: string[]; // Might need IDs if referenced by P7.1
  updated_gds_object?: GenericDiachronicStructureDefinition; // Full updated GDS
  updated_gss_outputs_by_gdu?: Record<string, P4S_1_Output['generic_synchronic_structure']>; // GDU_ID -> full updated GSS
}

// Part VII: Causal Structure Elicitation
export interface P7_1_CandidateVariable {
  variable_id: string;
  variable_name: string;
  phenomenological_grounding: string; // Textual description
  measurement_type: string;
  grounding_references?: Array<{ // Structured grounding
    type: 'GDU' | 'GSS_Category' | 'P5_Insight' | 'P5_Hypothesis' | 'IV' | 'DV_Focus' | 'Other';
    id: string; // e.g., GDU_ID, GSS_Category_ID, P5_Insight_ID, DV_Focus_Name
    details?: string; // e.g., GDU_ID if type is GSS_Category and id is category id
  }>;
}
export interface P7_1_Output {
  candidate_variables: P7_1_CandidateVariable[];
  rationale_summary: string;
}

// P7.2: Propose and Justify Pairwise Causal Links
export interface P7_2_ProposedLink {
  source: string; // P7_1_CandidateVariable.variable_id
  target: string; // P7_1_CandidateVariable.variable_id
  justification_from_phenomenology: string;
  justification_from_glossary: string;
}

export interface P7_2_RejectedLink {
  source: string;
  target: string;
  reason: string;
}

export interface P7_2_Output {
  proposed_links: P7_2_ProposedLink[];
  rejected_links: P7_2_RejectedLink[];
}

// P7.3: Assemble DAG and Identify Primitive Patterns
export interface P7_3_DagNode {
  id: string; // Corresponds to P7_1_CandidateVariable.variable_id
  label?: string;
}

export interface P7_3_DagEdge {
  source: string; // variable_id
  target: string; // variable_id
  rationale?: string;
}

export interface P7_3_Mediator {
  primitive_id: string; // e.g., "MED_M1_S_Y"
  node_id: string; // The M node (variable_id)
  path: string; // e.g., "S -> M1 -> Y"
  glossary_term: string;
}

export interface P7_3_Confounder {
  primitive_id: string; // e.g., "CONF_U1_M1_Y"
  node_id: string; // The C node (variable_id)
  confounds_relationship: string; // e.g., "M1 and Y"
  glossary_term: string;
}

export interface P7_3_Collider {
  primitive_id: string; // e.g., "COLL_Z_X_Y"
  node_id: string; // The Z node (variable_id)
  path: string; // e.g., "X -> Z <- Y"
  glossary_term: string;
}

export interface P7_3_Output {
  final_dag: {
    nodes: P7_3_DagNode[];
    edges: P7_3_DagEdge[];
  };
  identified_primitives: {
    mediators: P7_3_Mediator[];
    confounders: P7_3_Confounder[];
    colliders: P7_3_Collider[];
  };
  acyclicity_check: string;
  cycle_detected?: string;
}

// P7.4: Analyze Paths and Identify Potential Biases
export interface P7_4_BackdoorPath {
  path: string;
  description: string;
}

export interface P7_4_AdjustmentSet {
  set: string[]; // variable_ids
  justification: string;
}

export interface P7_4_PathAnalysis {
  path_analysis_id: string; // e.g., "PA_M1_Y"
  relationship_of_interest: string; // e.g., "Effect of M1 on Y"
  note?: string;
  backdoor_paths_found: P7_4_BackdoorPath[];
  proposed_adjustment_sets: P7_4_AdjustmentSet[];
}

export interface P7_4_ColliderBiasWarning {
  collider_warning_id: string; // e.g., "CBW_M1_S_U1"
  note?: string;
  collider_node: string; // variable_id
  scenario: string;
  predicted_bias: string;
}

export interface P7_4_Output {
  path_analysis: P7_4_PathAnalysis[];
  collider_bias_warnings: P7_4_ColliderBiasWarning[];
}

// P7.5: Generate Formal Causal Hypotheses
export interface P7_5_FormalHypothesis {
  hypothesis_id: string; // e.g., "Causal_H1"
  causal_claim: string;
  causal_concept: string;
  formal_query?: string;
  testable_prediction: string;
  related_primitive_ids?: string[]; // primitive_id from P7.3
  related_path_analysis_ids?: string[]; // path_analysis_id or collider_warning_id from P7.4
}

export interface P7_5_Output {
  analysis_context_note?: string;
  formal_causal_hypotheses: P7_5_FormalHypothesis[];
}

// P7.3b: DAG Validation & Cleaning
export interface P7_3b_ResolutionAction {
  action_type: 'remove_weak_link' | 'aggregate_cycle' | 'time_index' | 'no_action' | 'validate_clean';
  reason: string;
  details: string;
  affected_variables?: string[]; // variable_ids involved
  created_composite_variable?: string; // new composite variable name if aggregated
  time_indexed_variables?: Array<{ original: string; indexed: string }>; // if time indexing applied
}

export interface P7_3b_CompositeVariable {
  composite_id: string; // e.g., "Imagination_Experience_Cluster"
  description: string;
  aggregated_variables: string[]; // original variable_ids that were combined
  justification: string;
}

export interface P7_3b_CycleInfo {
  cycle_id: string;
  cycle_variables: string[]; // variable_ids in the cycle
  cycle_edges: Array<{ source: string; target: string }>;
  resolution_strategy: 'removed' | 'aggregated' | 'time_indexed';
}

export interface P7_3b_Output {
  final_dag: {
    nodes: P7_3_DagNode[];
    edges: P7_3_DagEdge[];
  };
  cleaning_required: boolean;
  cycles_detected: P7_3b_CycleInfo[];
  resolution_log: P7_3b_ResolutionAction[];
  composite_variables_created: P7_3b_CompositeVariable[];
  time_indexed_variables_created: Array<{ original: string; indexed: string }>;
  complexity_assessment: string;
  validation_summary: string;
}

// Part VI: Report
export type P6_1_Output = string;


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

  p_neg1_1_output?: P_neg1_1_Output;
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

  p2s_outputs_by_phase?: Record<string, P2SPhaseData>; // Key is phase_name
  phases_for_p2s_processing?: string[]; // phase_names
  current_phase_for_p2s_processing?: string; // phase_name
  processed_phases_for_p2s?: string[]; // phase_names
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

  p4s_1_a_outputs_by_gdu?: Record<string, P4S_1_A_Output | undefined>; // New state for P4S_1_A outputs
  p4s_1_a_error?: string; // Error for the current P4S_1_A step

  p4s_outputs_by_gdu?: Record<string, P4S_1_Output | undefined>; // Key is GDU_ID (This will now hold P4S_1_B outputs)
  p4s_mermaid_syntax_by_gdu?: Record<string, string | undefined>; // Key is GDU_ID
  p4s_1_b_error?: string; // Store error for current P4S_1_B or general P4S_1_B error

  current_gdu_for_p4s_processing?: string; // GDU_ID
  core_gdus_for_sync_analysis?: string[]; // GDU_IDs
  processed_gdus_for_p4s?: string[]; // GDU_IDs (tracks completion of P4S_1_B for a GDU)

  isFullyProcessedGenericSynchronic: boolean;

  p5_1_output?: P5_1_Output;
  p5_1_error?: string;
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
  currentGduForP4S?: string; // GDU_ID
  currentPhaseForP2S?: string; // phase_name
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}
export interface GroundingChunk {
  web: GroundingChunkWeb;
}

export enum StepId {
  // Part -1: Variable Identification
  P_NEG1_1_VARIABLE_IDENTIFICATION = "P_NEG1_1_VARIABLE_IDENTIFICATION",

  // Part 0: Data Preparation
  P0_1_TRANSCRIPTION_ADHERENCE = "P0_1_TRANSCRIPTION_ADHERENCE",
  P0_2_REFINE_DATA_TYPES = "P0_2_REFINE_DATA_TYPES",
  P0_3_SELECT_PROCEDURAL_UTTERANCES = "P0_3_SELECT_PROCEDURAL_UTTERANCES",

  // Part I: Specific Diachronic Analysis
  P1_1_INITIAL_SEGMENTATION = "P1_1_INITIAL_SEGMENTATION",
  P1_2_DIACHRONIC_UNIT_ID = "P1_2_DIACHRONIC_UNIT_ID",
  P1_3_REFINE_DIACHRONIC_UNITS = "P1_3_REFINE_DIACHRONIC_UNITS",
  P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE = "P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE",

  // Part II: Specific Synchronic Analysis
  P2S_1_GROUP_UTTERANCES_BY_TOPIC = "P2S_1_GROUP_UTTERANCES_BY_TOPIC",
  P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS = "P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS",
  P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE = "P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE",

  // Part III: Generic Diachronic Analysis
  P3_1_ALIGN_STRUCTURES = "P3_1_ALIGN_STRUCTURES",
  P3_2_IDENTIFY_GDUS = "P3_2_IDENTIFY_GDUS",
  P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE = "P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE",

  // Part IV: Generic Synchronic Analysis (New two-step process)
  P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES = "P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES",
  P4S_1_B_DEFINE_GSS_FROM_GROUPS = "P4S_1_B_DEFINE_GSS_FROM_GROUPS",
  // P4S_1_IDENTIFY_GENERIC_SYNCHRONIC_UNITS = "P4S_1_IDENTIFY_GENERIC_SYNCHRONIC_UNITS", // Old step, to be removed/commented

  // Part V: Refinement
  P5_1_HOLISTIC_REVIEW_REFINEMENT = "P5_1_HOLISTIC_REVIEW_REFINEMENT",

  // Part VII: Causal Structure Elicitation
  P7_1_CANDIDATE_VARIABLE_FORMALIZATION = "P7_1_CANDIDATE_VARIABLE_FORMALIZATION",
  P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS = "P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS",
  P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS = "P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS",
  P7_3B_VALIDATE_AND_CLEAN_DAG = "P7_3B_VALIDATE_AND_CLEAN_DAG",
  P7_4_ANALYZE_PATHS_AND_BIASES = "P7_4_ANALYZE_PATHS_AND_BIASES",
  P7_5_GENERATE_FORMAL_HYPOTHESES = "P7_5_GENERATE_FORMAL_HYPOTHESES",

  // Part VI: Report Generation
  P6_1_GENERATE_MARKDOWN_REPORT = "P6_1_GENERATE_MARKDOWN_REPORT",

  // Meta states
  IDLE = "IDLE",
  ALL_TRANSCRIPTS_VARIABLE_ID_DONE = "ALL_TRANSCRIPTS_VARIABLE_ID_DONE",
  ALL_TRANSCRIPTS_DATA_PREP_DONE = "ALL_TRANSCRIPTS_DATA_PREP_DONE",
  ALL_TRANSCRIPTS_SPECIFIC_DIACHRONIC_DONE = "ALL_TRANSCRIPTS_SPECIFIC_DIACHRONIC_DONE",
  ALL_TRANSCRIPTS_SPECIFIC_SYNCHRONIC_DONE = "ALL_TRANSCRIPTS_SPECIFIC_SYNCHRONIC_DONE",
  ALL_GENERIC_DIACHRONIC_DONE = "ALL_GENERIC_DIACHRONIC_DONE",
  ALL_GENERIC_SYNCHRONIC_DONE = "ALL_GENERIC_SYNCHRONIC_DONE",
  ALL_REFINEMENT_DONE = "ALL_REFINEMENT_DONE",
  ALL_CAUSAL_MODELING_DONE = "ALL_CAUSAL_MODELING_DONE",
  COMPLETE = "COMPLETE",
}

// Synchronic structures for Mermaid transformation (original JSON structure for processing)
export type SynchronicStructureP2S = P2S_3_Output['specific_synchronic_structure'];
export type SynchronicStructureP4S = P4S_1_Output['generic_synchronic_structure']; // This will be P4S_1_B's output structure
export type SynchronicStructureType = SynchronicStructureP2S | SynchronicStructureP4S;


// AppState for Saving/Loading
export interface AppState {
  version: string;
  rawTranscripts: RawTranscript[];
  processedDataArray: Array<[string, TranscriptProcessedData]>; // Map converted to array for JSON
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
  // processStartTime is not saved as it's transient for the current session's timer
}