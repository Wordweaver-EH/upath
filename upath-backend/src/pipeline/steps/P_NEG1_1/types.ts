/**
 * P_NEG1_1 Variable Identification Step Types
 * Exactly matches the working prototype interfaces
 */

/**
 * Input data structure for P_NEG1_1 step
 * Prepared by getInput function
 */
export interface P_NEG1_1_Input {
  filename_or_id: string;
  raw_transcript_text_from_file: string;
  dependent_variable_focus_list: string[];
}

/**
 * Output data structure for P_NEG1_1 step
 * Exactly matches the working prototype's P_neg1_1_Output interface
 */
export interface P_NEG1_1_Output {
  transcript_id: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}