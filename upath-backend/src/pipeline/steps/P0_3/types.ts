/**
 * P0_3 Select Procedural Utterances Step Types
 * Exactly matches the working prototype interfaces
 */

import { P0_2_Output } from '../P0_2/types';
import { P_NEG1_1_Output } from '../P_NEG1_1/types';

/**
 * Input data structure for P0_3 step
 * Combines P0_2_Output and P_NEG1_1_Output (first step with multiple dependencies!)
 */
export type P0_3_Input = P0_2_Output & { p_neg1_1_output: P_NEG1_1_Output };

/**
 * Individual selected utterance structure
 * Exactly matches the working prototype's SelectedUtterance interface
 */
export interface SelectedUtterance {
  original_line_num: string; // Can be "X.Y" for split lines
  utterance_text: string;
  selection_justification?: string;
}

/**
 * Output data structure for P0_3 step
 * Exactly matches the working prototype's P0_3_Output interface
 */
export interface P0_3_Output {
  transcript_id: string;
  selected_procedural_utterances: SelectedUtterance[];
  discarded_info_summary?: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}