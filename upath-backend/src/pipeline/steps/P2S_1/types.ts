/**
 * P2S_1 Group Utterances by Topic - Type Definitions
 * Exactly matches the working prototype's type structure
 */

/**
 * Input interface for P2S_1 step
 * Matches prototype's getInput function return structure
 */
export interface P2S_1_Input {
  transcript_id: string;
  analyzed_diachronic_unit: string; // The phase name being analyzed
  utterances_for_phase_analysis: SelectedUtterance[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

/**
 * Selected utterance structure from P0_3 output
 * Matches prototype's SelectedUtterance type
 */
export interface SelectedUtterance {
  original_line_num: string;
  utterance_text: string;
  selection_justification: string;
}

/**
 * Utterance reference in thematic groups
 * Simplified structure for output
 */
export interface UtteranceReference {
  original_line_num: string;
  utterance_text: string;
}

/**
 * Synchronic thematic group structure
 * Matches prototype's group structure
 */
export interface SynchronicThematicGroup {
  group_label: string;
  justification: string;
  utterances: UtteranceReference[];
}

/**
 * Output interface for P2S_1 step
 * Exactly matches prototype's P2S_1_Output type
 */
export interface P2S_1_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  synchronic_thematic_groups: SynchronicThematicGroup[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}