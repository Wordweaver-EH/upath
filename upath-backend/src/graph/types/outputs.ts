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
  original_description: string;
  refined_description: string;
  micro_gestures: MicroGesture[];
  temporal_markers: string[];
  source_segment_ids: string[];
  temporal_phase?: string; // e.g., "Beginning", "Core Event", "Ending"
  confidence?: number; // 0.0 to 1.0
}

export interface P1_3_Output {
  transcript_id?: string;
  refined_diachronic_units: RefinedDiachronicUnit[];
  refinement_metadata: {
    total_micro_gestures: number;
    refinement_approach: string;
    temporal_flow: string;
  };
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
  // Additional step outputs will be added as we implement more nodes
  | Record<string, any>; // Fallback for untyped outputs