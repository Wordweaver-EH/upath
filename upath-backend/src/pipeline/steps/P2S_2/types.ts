/**
 * P2S_2 Identify Specific Synchronic Units - Type Definitions
 * Exactly matches the working prototype's type structure
 */

/**
 * Input interface for P2S_2 step
 * Combines P2S_1_Output with IV/DV details from P0_3
 */
export interface P2S_2_Input {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  synchronic_thematic_groups: SynchronicThematicGroup[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

/**
 * Synchronic thematic group from P2S_1
 */
export interface SynchronicThematicGroup {
  group_label: string;
  justification: string;
  utterances: UtteranceReference[];
}

/**
 * Utterance reference structure
 */
export interface UtteranceReference {
  original_line_num: string;
  utterance_text: string;
}

/**
 * Specific Synchronic Unit (ISU) structure
 * Matches prototype's P2S_2_SynchronicUnit type
 */
export interface P2S_2_SynchronicUnit {
  unit_name: string; // Serves as ID for this ISU
  level: number;
  abstraction_op: string;
  intensional_definition: string;
  utterances?: UtteranceReference[]; // Required for Level 0 ISUs
  constituent_lower_units?: string[]; // Required for Level > 0 ISUs (unit_names)
}

/**
 * Output interface for P2S_2 step
 * Exactly matches prototype's P2S_2_Output type
 */
export interface P2S_2_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  specific_synchronic_units_hierarchy: P2S_2_SynchronicUnit[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}