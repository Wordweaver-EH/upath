/**
 * P1_1 Initial Segmentation Step Types
 * Exactly matches the working prototype interfaces
 */

import { P0_3_Output, SelectedUtterance } from '../P0_3/types';

/**
 * Input data structure for P1_1 step
 * Uses P0_3_Output as input (step dependency)
 */
export type P1_1_Input = P0_3_Output;

/**
 * Individual segment structure within an utterance
 * Exactly matches the working prototype's SegmentedUtteranceSegment interface
 */
export interface SegmentedUtteranceSegment {
  segment_id: string; // e.g., utt_LINE.NUM_seg_INDEX
  segment_text: string;
  temporal_cues?: string[];
}

/**
 * Segmented utterance structure
 * Contains original utterance and its segments
 */
export interface SegmentedUtterance {
  original_utterance: SelectedUtterance;
  segments: SegmentedUtteranceSegment[];
}

/**
 * Output data structure for P1_1 step
 * Exactly matches the working prototype's P1_1_Output interface
 */
export interface P1_1_Output {
  transcript_id: string;
  segmented_utterances: SegmentedUtterance[];
  independent_variable_details: string;
  dependent_variable_focus: string[];
}