/**
 * P1_4 Construct Specific Diachronic Structure - Type Definitions
 * Exactly matches the working prototype's P1_4 interfaces
 */

import { P1_3_Output } from '../P1_3/types';

/**
 * Input type for P1_4 step
 * Receives output from P1_3_REFINE_DIACHRONIC_UNITS
 */
export type P1_4_Input = P1_3_Output;

/**
 * Specific Diachronic Phase structure from prototype
 * Represents a phase in the diachronic structure grouped by temporal_phase
 */
export interface SpecificDiachronicPhase {
  /** Name of the phase (typically matches temporal_phase) */
  phase_name: string;
  
  /** Description of what happens in this phase */
  description: string;
  
  /** Array of unit_id strings from P1.3 refined DUs that belong to this phase */
  units_involved: string[];
}

/**
 * Specific Diachronic Structure Type from prototype
 * Complete structure representing the temporal flow of the experience
 */
export interface SpecificDiachronicStructureType {
  /** Overall summary of the diachronic flow */
  summary: string;
  
  /** Array of phases representing the temporal structure */
  phases: SpecificDiachronicPhase[];
  
  /** Optional hint for visualization (e.g., "Linear", "Cyclical") */
  visualization_hint?: string;
  
  /** Brief preliminary observation about potential IV connection */
  iv_preliminary_observation: string;
}

/**
 * Output structure for P1_4 step
 * Exactly matches the prototype's P1_4_Output interface
 */
export interface P1_4_Output {
  /** Transcript identifier (copied from input) */
  transcript_id: string;
  
  /** The constructed Specific Diachronic Structure */
  specific_diachronic_structure: SpecificDiachronicStructureType;
  
  /** Independent variable details (preserved from P1.3) */
  independent_variable_details: string;
  
  /** Dependent variable focus (preserved from P1.3) */
  dependent_variable_focus: string[];
  
  /** Generated Mermaid Gantt chart syntax for visualization */
  mermaid_syntax_specific_diachronic: string;
}

/**
 * Type guard to check if data is valid P1_4_Input
 */
export function isP1_4_Input(data: any): data is P1_4_Input {
  return (
    data &&
    typeof data.transcript_id === 'string' &&
    Array.isArray(data.refined_diachronic_units) &&
    typeof data.independent_variable_details === 'string' &&
    Array.isArray(data.dependent_variable_focus)
  );
}

/**
 * Type guard to check if data is valid P1_4_Output
 */
export function isP1_4_Output(data: any): data is P1_4_Output {
  return (
    data &&
    typeof data.transcript_id === 'string' &&
    data.specific_diachronic_structure &&
    typeof data.specific_diachronic_structure.summary === 'string' &&
    Array.isArray(data.specific_diachronic_structure.phases) &&
    typeof data.specific_diachronic_structure.iv_preliminary_observation === 'string' &&
    typeof data.independent_variable_details === 'string' &&
    Array.isArray(data.dependent_variable_focus) &&
    typeof data.mermaid_syntax_specific_diachronic === 'string' &&
    data.specific_diachronic_structure.phases.every((phase: any) =>
      typeof phase.phase_name === 'string' &&
      typeof phase.description === 'string' &&
      Array.isArray(phase.units_involved)
    )
  );
}

/**
 * Validate visualization hint value
 */
export function isValidVisualizationHint(hint: string): boolean {
  const validHints = ['Linear', 'Cyclical', 'Branching', 'Layered', 'Spiral', 'Other'];
  return validHints.includes(hint);
}