/**
 * P1_3 Refine Diachronic Units - Type Definitions
 * Exactly matches the working prototype's P1_3 interfaces
 */

import { P1_2_Output } from '../P1_2/types';

/**
 * Input type for P1_3 step
 * Receives output from P1_2_DIACHRONIC_UNIT_ID
 */
export type P1_3_Input = P1_2_Output;

/**
 * Temporal phase options from prototype
 * Fixed list of temporal phases for standardized analysis
 */
export type TemporalPhase = 
  | 'Beginning'
  | 'Early-Middle'
  | 'Core Event'
  | 'Late-Middle'
  | 'Ending'
  | 'Reflection'
  | 'Transition'
  | 'Other';

/**
 * Refined Diachronic Unit structure from prototype
 * Represents a refined "moment" or "step" with temporal phase and confidence
 */
export interface RefinedDiachronicUnitP1_3 {
  /** Unique identifier for the refined diachronic unit (e.g., "rdu_1", "rdu_2") */
  unit_id: string;
  
  /** Concise description of the refined unit based on its content */
  description: string;
  
  /** Array of unit_id strings from P1.2 DUs that contributed to this refined DU */
  source_p1_2_du_ids: string[];
  
  /** Assigned temporal phase from the fixed list */
  temporal_phase: TemporalPhase;
  
  /** Confidence score (0.0 to 1.0) for the refinement quality */
  confidence: number;
}

/**
 * Output structure for P1_3 step
 * Exactly matches the prototype's P1_3_Output interface
 */
export interface P1_3_Output {
  /** Transcript identifier (copied from input) */
  transcript_id: string;
  
  /** Array of refined diachronic units with temporal phases and confidence scores */
  refined_diachronic_units: RefinedDiachronicUnitP1_3[];
  
  /** Independent variable details (preserved from P1.2) */
  independent_variable_details: string;
  
  /** Dependent variable focus (preserved from P1.2) */
  dependent_variable_focus: string[];
}

/**
 * Type guard to check if data is valid P1_3_Input
 */
export function isP1_3_Input(data: any): data is P1_3_Input {
  return (
    data &&
    typeof data.transcript_id === 'string' &&
    Array.isArray(data.diachronic_units) &&
    typeof data.independent_variable_details === 'string' &&
    Array.isArray(data.dependent_variable_focus)
  );
}

/**
 * Type guard to check if data is valid P1_3_Output
 */
export function isP1_3_Output(data: any): data is P1_3_Output {
  return (
    data &&
    typeof data.transcript_id === 'string' &&
    Array.isArray(data.refined_diachronic_units) &&
    typeof data.independent_variable_details === 'string' &&
    Array.isArray(data.dependent_variable_focus) &&
    data.refined_diachronic_units.every((rdu: any) =>
      typeof rdu.unit_id === 'string' &&
      typeof rdu.description === 'string' &&
      Array.isArray(rdu.source_p1_2_du_ids) &&
      typeof rdu.temporal_phase === 'string' &&
      typeof rdu.confidence === 'number' &&
      rdu.confidence >= 0.0 && rdu.confidence <= 1.0
    )
  );
}

/**
 * Validate temporal phase value
 */
export function isValidTemporalPhase(phase: string): phase is TemporalPhase {
  const validPhases: TemporalPhase[] = [
    'Beginning', 'Early-Middle', 'Core Event', 'Late-Middle', 
    'Ending', 'Reflection', 'Transition', 'Other'
  ];
  return validPhases.includes(phase as TemporalPhase);
}