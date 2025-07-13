/**
 * P0_1 Transcription Adherence Step Types
 * Exactly matches the working prototype interfaces
 */

/**
 * Input data structure for P0_1 step
 * Prepared by getInput function
 */
export interface P0_1_Input {
  filename_or_id: string;
  raw_transcript_text_from_file: string;
}

/**
 * Output data structure for P0_1 step
 * Exactly matches the working prototype's P0_1_Output interface
 */
export interface P0_1_Output {
  transcript_id: string;
  line_numbered_transcript: string[];
  transcription_convention_notes: string;
  initial_impressions_log: string;
}