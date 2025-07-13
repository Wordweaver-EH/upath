/**
 * P0_2 Refine Data Types Step Types
 * Exactly matches the working prototype interfaces
 */

import { P0_1_Output } from '../P0_1/types';

/**
 * Input data structure for P0_2 step
 * Uses P0_1_Output as input (step dependency)
 */
export type P0_2_Input = P0_1_Output;

/**
 * Individual refined line structure
 * Exactly matches the working prototype's RefinedLine interface
 */
export interface RefinedLine {
  line_num: number;
  text: string;
  information_tags: string[];
  decision_notes?: string;
}

/**
 * Output data structure for P0_2 step
 * Exactly matches the working prototype's P0_2_Output interface
 */
export interface P0_2_Output {
  transcript_id: string;
  refined_data_transcript: RefinedLine[];
}