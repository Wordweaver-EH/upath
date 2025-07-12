// Step output types - matching frontend types

// Part -1: Variable Identification

export interface P_NEG1_1_Output {
  transcript_id: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

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

export interface SelectedProceduralUtterance {
  original_line_num: string;
  utterance_text: string;
  selection_justification: string;
}

export interface P0_3_Output {
  transcript_id: string;
  selected_procedural_utterances: SelectedProceduralUtterance[];
  discarded_info_summary: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

// Part I: Specific Diachronic Analysis

export interface FineGrainedSegment {
  segment_id: string;
  text: string;
  temporal_marker: string | null;
  action_type: string;
}

export interface SegmentedUtterance {
  original_line_num: string;
  original_utterance: string;
  segments: FineGrainedSegment[];
}

export interface P1_1_Output {
  transcript_id?: string;
  segmented_utterances: SegmentedUtterance[];
  total_segments: number;
  segmentation_summary: string;
  independent_variable_details?: string;
  dependent_variable_focus?: string[];
}

export interface DiachronicUnit {
  unit_id: string;
  description: string;
  source_segment_ids: string[];
}

export interface P1_2_Output {
  transcript_id?: string;
  diachronic_units: DiachronicUnit[];
  unit_metadata: {
    total_units: number;
    grouping_criteria: string;
  };
  independent_variable_details?: string;
  dependent_variable_focus?: string[];
}

export interface MicroGesture {
  gesture_id: string;
  description: string;
  line_numbers: number[];
  utterance_ids: string[];
}

export interface RefinedDiachronicUnit {
  unit_id: string;
  name: string;
  description: string;
  temporal_phase: string; // e.g., "Beginning", "Core Event", "Ending"
  confidence: number; // 0.0 to 1.0
  source_p1_2_du_ids: string[]; // IDs from P1_2 that this refined unit is based on
}

export interface P1_3_Output {
  transcript_id?: string;
  refined_diachronic_units: RefinedDiachronicUnit[];
  independent_variable_details?: string;
  dependent_variable_focus?: string[];
}

export interface SpecificDiachronicPhase {
  phase_name: string;
  description: string;
  units_involved: string[];
}

export interface SpecificDiachronicStructure {
  summary: string;
  phases: SpecificDiachronicPhase[];
  visualization_hint: string;
  iv_preliminary_observation: string;
}

export interface P1_4_Output {
  transcript_id: string;
  specific_diachronic_structure: SpecificDiachronicStructure;
  independent_variable_details: string;
  dependent_variable_focus: string[];
  mermaid_syntax_specific_diachronic: string;
}

// Part II: Specific Synchronic Analysis

export interface SelectedUtterance {
  original_line_num: string;
  utterance_text: string;
  speaker: string;
  selection_justification: string;
}

export interface SynchronicThematicGroup {
  group_label: string;
  justification: string;
  utterances: Array<{
    original_line_num: string;
    utterance_text: string;
  }>;
}

export interface P2S_1_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  synchronic_thematic_groups: SynchronicThematicGroup[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface SpecificSynchronicUnit {
  unit_name: string;
  level: number;
  abstraction_op: string;
  intensional_definition: string;
  utterances?: Array<{
    original_line_num: string;
    utterance_text: string;
  }>;
  constituent_lower_units?: string[];
}

export interface P2S_2_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  specific_synchronic_units_hierarchy: SpecificSynchronicUnit[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface NetworkNode {
  id: string;
  label: string;
  source_isu_id: string;
}

export interface NetworkLink {
  from: string;
  to: string;
  type: string;
}

export interface SpecificSynchronicStructure {
  representation_type: string;
  description: string;
  network_nodes: NetworkNode[];
  network_links: NetworkLink[];
}

export interface P2S_3_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  specific_synchronic_structure: SpecificSynchronicStructure;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

// Part III: Generic Diachronic Analysis

export interface P3_1_Output {
  aligned_structures_report: string;
  common_patterns_summary: string;
  key_differences: string[];
  dependent_variable_focus: string[];
}

export interface GenericDiachronicUnit {
  gdu_id: string;
  definition: string;
  supporting_transcripts_count: number;
  iv_variation_notes?: string;
  contributing_refined_du_ids: Array<{
    transcript_id: string;
    refined_du_id: string;
  }>;
}

export interface P3_2_Output {
  identified_gdus: GenericDiachronicUnit[];
  criteria_for_gdu_identification: string;
  dependent_variable_focus: string[];
  tot_rdus: number;
}

export interface GenericDiachronicStructureDefinition {
  name: string;
  description: string;
  core_gdus: string[];
  optional_gdus: string[];
  typical_sequence: string[];
}

export interface P3_3_Output {
  generic_diachronic_structure_definition: GenericDiachronicStructureDefinition;
  variants_summary: string;
  confidence_level: 'High' | 'Medium' | 'Low';
  dependent_variable_focus: string[];
}

// Part IV: Generic Synchronic Analysis

export interface SSSNodeGroupData {
  sss_node_id: string;
  transcript_id: string;
  phase_name: string;
  sss_node_label: string;
  group_id: string;
  group_rationale: string;
}

export interface P4S_1_A_Output {
  analyzed_gdu: string;
  grouped_data: SSSNodeGroupData[];
  dependent_variable_focus: string[];
}

export interface GenericNodeCategory {
  category_id: string;
  definition: string;
  abstraction_level: string;
}

export interface GenericNetworkLink {
  from_category: string;
  to_category: string;
  relationship_type: string;
  description: string;
}

export interface GenericSynchronicStructure {
  generic_nodes_categories: GenericNodeCategory[];
  generic_network_links: GenericNetworkLink[];
  instantiation_notes: Record<string, string[]>; // category_id -> sss_node_ids
}

export interface P4S_1_B_Output {
  analyzed_gdu: string;
  generic_synchronic_structure: GenericSynchronicStructure;
  dependent_variable_focus: string[];
}

// Part V: Comparative Analysis and Refinement

export interface IVPattern {
  iv_value: string;
  pattern_description: string;
  supporting_transcript_ids: string[];
  gds_alignment_notes: string;
}

export interface DVOutcomePattern {
  dv_name: string;
  pattern_across_iv_levels: string;
}

export interface P5_1_Output {
  comparative_analysis_summary: string;
  identified_iv_patterns: IVPattern[];
  iv_effect_on_gds: string;
  dv_outcome_patterns: DVOutcomePattern[];
  methodological_insights: string[];
  dependent_variable_focus: string[];
}

export interface RefinementRecommendation {
  area: string;
  recommendation: string;
  rationale: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface P5_2_Output {
  holistic_assessment: string;
  refinement_recommendations: RefinementRecommendation[];
  final_confidence_rating: 'High' | 'Medium' | 'Low';
  study_limitations: string[];
  future_research_directions: string[];
  dependent_variable_focus: string[];
}

// Final Completion

// Part VII: Causal Modeling

export interface CandidateVariable {
  variable_id: string;
  variable_name: string;
  definition: string;
  measurement_approach: string;
  data_source: string; // Which analysis phase/node this comes from
}

export interface P7_1_Output {
  candidate_variables: CandidateVariable[];
  iv_formalization: {
    variable_id: string;
    levels: string[];
    operationalization: string;
  };
  dv_formalizations: Array<{
    variable_id: string;
    measurement_indicators: string[];
    operationalization: string;
  }>;
  dependent_variable_focus: string[];
}

export interface CausalLink {
  from_variable_id: string;
  to_variable_id: string;
  relationship_type: 'direct_cause' | 'indirect_cause' | 'moderates' | 'mediates' | 'correlates';
  confidence: 'High' | 'Medium' | 'Low';
  evidence_basis: string;
  temporal_precedence: boolean;
}

export interface P7_2_Output {
  proposed_causal_links: CausalLink[];
  link_justifications: Array<{
    link_id: string;
    theoretical_basis: string;
    empirical_support: string;
  }>;
  dependent_variable_focus: string[];
}

export interface CausalDAG {
  variables: CandidateVariable[];
  causal_links: CausalLink[];
  identified_patterns: Array<{
    pattern_type: 'chain' | 'fork' | 'collider' | 'cycle';
    involved_variables: string[];
    description: string;
  }>;
}

export interface P7_3_Output {
  causal_dag: CausalDAG;
  dag_validation_notes: string;
  identified_confounders: string[];
  dependent_variable_focus: string[];
}

export interface P7_3B_Output {
  validated_dag: CausalDAG;
  removed_links: Array<{
    link: CausalLink;
    removal_reason: string;
  }>;
  dag_quality_assessment: {
    overall_rating: 'High' | 'Medium' | 'Low';
    completeness: number; // 0-1
    coherence: number; // 0-1
  };
  dependent_variable_focus: string[];
}

export interface CausalPath {
  path_id: string;
  variables_sequence: string[];
  path_type: 'direct' | 'mediated' | 'confounded';
  effect_strength: 'Strong' | 'Medium' | 'Weak';
  potential_biases: string[];
}

export interface P7_4_Output {
  identified_causal_paths: CausalPath[];
  bias_analysis: Array<{
    bias_type: string;
    affected_paths: string[];
    mitigation_strategies: string[];
  }>;
  path_significance_ranking: string[]; // Ordered path_ids by importance
  dependent_variable_focus: string[];
}

export interface FormalHypothesis {
  hypothesis_id: string;
  hypothesis_statement: string;
  involved_variables: string[];
  causal_claim: string;
  testable_predictions: string[];
  statistical_approach: string;
}

export interface P7_5_Output {
  formal_hypotheses: FormalHypothesis[];
  causal_model_summary: string;
  research_implications: string[];
  methodological_recommendations: string[];
  dependent_variable_focus: string[];
}

export interface CompleteOutput {
  completion_status: 'success';
  analysis_complete: true;
  final_confidence_rating: 'High' | 'Medium' | 'Low';
  holistic_assessment: string;
  refinement_recommendations: RefinementRecommendation[];
  study_limitations: string[];
  future_research_directions: string[];
  total_processing_time_ms: number;
  completion_timestamp: string;
  dependent_variable_focus: string[];
}

// Additional output types will be added as we implement more nodes

// Union type for all possible step outputs
export type StepOutput = 
  | P_NEG1_1_Output
  | P0_1_Output 
  | P0_2_Output 
  | P0_3_Output
  | P1_1_Output
  | P1_2_Output
  | P1_3_Output
  | P1_4_Output
  | P2S_1_Output
  | P2S_2_Output
  | P2S_3_Output
  | P3_1_Output
  | P3_2_Output
  | P3_3_Output
  | P4S_1_A_Output
  | P4S_1_B_Output
  | P5_1_Output
  | P5_2_Output
  | P7_1_Output
  | P7_2_Output
  | P7_3_Output
  | P7_3B_Output
  | P7_4_Output
  | P7_5_Output
  | CompleteOutput
  // Additional step outputs will be added as we implement more nodes
  | Record<string, any>; // Fallback for untyped outputs