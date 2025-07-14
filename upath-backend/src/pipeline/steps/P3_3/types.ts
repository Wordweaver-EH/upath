/**
 * P3_3 Define Generic Diachronic Structure - Type Definitions
 * Exactly matches the working prototype's type definitions
 */

/**
 * Input structure for P3_3 step
 * Exactly matches the working prototype's input structure
 */
export interface P3_3_Input {
  p3_1_output: {
    aligned_structures_report: string;
    common_patterns_summary: string;
    key_differences: string[];
    dependent_variable_focus: string[];
  };
  p3_2_output: {
    identified_gdus: {
      gdu_id: string;
      definition: string;
      supporting_transcripts_count: number;
      iv_variation_notes?: string;
      contributing_refined_du_ids: {
        transcript_id: string;
        refined_du_id: string;
      }[];
    }[];
    criteria_for_gdu_identification: string;
    dependent_variable_focus: string[];
    tot_rdus: number;
  };
  global_dv_focus: string[];
}

/**
 * Output structure for P3_3 step
 * Exactly matches the working prototype's output structure
 */
export interface P3_3_Output {
  generic_diachronic_structure_definition: GenericDiachronicStructureDefinition;
  variants_summary: string;
  confidence_level?: string;
  dependent_variable_focus: string[];
  mermaid_syntax_generic_diachronic?: string; // Generated later by system
}

/**
 * Generic Diachronic Structure Definition
 * Exactly matches the working prototype's GDS structure
 */
export interface GenericDiachronicStructureDefinition {
  name: string;
  description: string;
  core_gdus: string[]; // Array of gdu_id strings from P3.2 input
  optional_gdus?: string[]; // Optional array of gdu_id strings
  typical_sequence?: string[]; // Optional array of gdu_id strings in temporal order
}