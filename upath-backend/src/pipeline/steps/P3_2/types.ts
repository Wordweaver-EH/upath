/**
 * P3_2 Identify Generic Diachronic Units - Type Definitions
 * Exactly matches the working prototype's type definitions
 */

/**
 * Input structure for P3_2 step (original approach)
 * Exactly matches the working prototype's input structure
 */
export interface P3_2_Input {
  p3_1_output: {
    aligned_structures_report: string;
    common_patterns_summary: string;
    key_differences: string[];
    dependent_variable_focus: string[];
  };
  all_refined_dus_with_iv_and_ids: RefinedDusWithMetadata[];
  global_dv_focus: string[];
  tot_rdus: number;
}

/**
 * Metadata structure for each transcript's refined DUs
 * Exactly matches the working prototype's metadata structure
 */
export interface RefinedDusWithMetadata {
  transcript_id: string;
  filename: string;
  independent_variable_details: string;
  refined_diachronic_units: RefinedDiachronicUnit[];
}

/**
 * Refined Diachronic Unit structure from P1_3 output
 * Exactly matches the working prototype's RDU structure
 */
export interface RefinedDiachronicUnit {
  unit_id: string;
  description: string;
  temporal_phase: string;
  [key: string]: any; // Additional fields may be present
}

/**
 * Output structure for P3_2 step
 * Exactly matches the working prototype's output structure
 */
export interface P3_2_Output {
  identified_gdus: P3_2_IdentifiedGdu[];
  criteria_for_gdu_identification: string;
  dependent_variable_focus: string[];
  tot_rdus: number;
}

/**
 * Individual GDU structure
 * Exactly matches the working prototype's GDU structure
 */
export interface P3_2_IdentifiedGdu {
  gdu_id: string;
  definition: string;
  supporting_transcripts_count: number;
  iv_variation_notes?: string; // Optional field
  contributing_refined_du_ids: ContributingRefinedDu[];
}

/**
 * Traceability structure for refined DU contributions
 * Exactly matches the working prototype's traceability structure
 */
export interface ContributingRefinedDu {
  transcript_id: string;
  refined_du_id: string;
}