/**
 * P1_2 Diachronic Unit Identification - Type Definitions
 * Exactly matches the working prototype's P1_2 interfaces
 */

import { P1_1_Output } from '../P1_1/types';

/**
 * Input type for P1_2 step
 * Receives output from P1_1_INITIAL_SEGMENTATION
 */
export type P1_2_Input = P1_1_Output;

/**
 * Diachronic Unit structure from prototype
 * Represents a coherent "moment" or "step" in the experience
 */
export interface DiachronicUnitP1_2 {
  /** Unique identifier for the diachronic unit (e.g., "du_1", "du_2") */
  unit_id: string;
  
  /** Concise description of the unit based on its content */
  description: string;
  
  /** Array of segment_id strings from P1.1 that form this DU */
  source_segment_ids: string[];
}

/**
 * Output structure for P1_2 step
 * Exactly matches the prototype's P1_2_Output interface
 */
export interface P1_2_Output {
  /** Transcript identifier (copied from input) */
  transcript_id: string;
  
  /** Array of diachronic units grouping the segments from P1.1 */
  diachronic_units: DiachronicUnitP1_2[];
  
  /** Independent variable details (preserved from P1.1) */
  independent_variable_details: string;
  
  /** Dependent variable focus (preserved from P1.1) */
  dependent_variable_focus: string[];
}

/**
 * Type guard to check if data is valid P1_2_Input
 */
export function isP1_2_Input(data: any): data is P1_2_Input {
  return (
    data &&
    typeof data.transcript_id === 'string' &&
    Array.isArray(data.segmented_utterances) &&
    typeof data.independent_variable_details === 'string' &&
    Array.isArray(data.dependent_variable_focus)
  );
}

/**
 * Type guard to check if data is valid P1_2_Output
 */
export function isP1_2_Output(data: any): data is P1_2_Output {
  return (
    data &&
    typeof data.transcript_id === 'string' &&
    Array.isArray(data.diachronic_units) &&
    typeof data.independent_variable_details === 'string' &&
    Array.isArray(data.dependent_variable_focus) &&
    data.diachronic_units.every((du: any) =>
      typeof du.unit_id === 'string' &&
      typeof du.description === 'string' &&
      Array.isArray(du.source_segment_ids)
    )
  );
}