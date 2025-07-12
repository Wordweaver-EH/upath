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
  // Additional step outputs will be added as we implement more nodes
  | Record<string, any>; // Fallback for untyped outputs