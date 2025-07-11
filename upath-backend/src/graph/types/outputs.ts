// Step output types - matching frontend types

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
  original_line_num: string;
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

// Additional output types will be added as we implement more nodes
// For now, keeping just the first 3 to start implementation

// Union type for all possible step outputs
export type StepOutput = 
  | P0_1_Output 
  | P0_2_Output 
  | P0_3_Output
  // Additional step outputs will be added as we implement more nodes
  | Record<string, any>; // Fallback for untyped outputs