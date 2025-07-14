/**
 * P3_1 Align Structures - Type Definitions
 * Exactly matches the working prototype's type structure
 */

/**
 * Specific Diachronic Structure from P1_4 output
 * Used in cross-transcript analysis
 */
export interface SpecificDiachronicStructure {
  summary: string;
  phases: SpecificDiachronicPhase[];
  visualization_hint: string;
  iv_preliminary_observation: string;
}

/**
 * Diachronic phase structure
 */
export interface SpecificDiachronicPhase {
  phase_name: string;
  description: string;
  units_involved: string[]; // unit_ids from P1.3
}

/**
 * Complete structure data for one transcript
 * Matches prototype's structure collection logic
 */
export interface TranscriptStructureData {
  transcript_id: string;
  filename: string;
  independent_variable_details: string;
  dependent_variable_focus: string[];
  specific_diachronic_structure: SpecificDiachronicStructure;
}

/**
 * Input interface for P3_1 step
 * Matches prototype's getInput function return structure
 */
export interface P3_1_Input {
  all_specific_diachronic_structures: TranscriptStructureData[];
  global_dv_focus: string[];
}

/**
 * Output interface for P3_1 step
 * Exactly matches prototype's P3_1_Output type
 */
export interface P3_1_Output {
  aligned_structures_report: string;
  common_patterns_summary: string;
  key_differences: string[];
  dependent_variable_focus: string[];
}