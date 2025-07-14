/**
 * P4S_1_A Identify and Group SSS Nodes - Type Definitions
 * Exactly matches the working prototype's type definitions
 */

/**
 * Input structure for P4S_1_A step
 * Exactly matches the working prototype's input structure
 */
export interface P4S_1_A_Input {
  gdu_to_analyze_id: string;
  gdu_definition: string;
  nodes_tsv: string; // TSV format: transcript_id, phase_name, sss_node_id, sss_node_label, isu_definition
  structures_mermaid: string; // Mermaid syntax showing grounded SSS node relationships
  global_dv_focus: string[];
}

/**
 * SSS Node TSV row structure
 * Exactly matches the working prototype's TSV structure
 */
export interface SssNodeTsvRow {
  transcript_id: string;
  phase_name: string;
  sss_node_id: string;
  sss_node_label: string;
  isu_definition: string;
}

/**
 * Output structure for P4S_1_A step
 * Exactly matches the working prototype's output structure
 */
export interface P4S_1_A_Output {
  analyzed_gdu: string;
  grouped_data: GroupedSssNode[];
  classification_notes?: string;
}

/**
 * Individual grouped SSS node structure
 * Exactly matches the working prototype's grouped node structure
 */
export interface GroupedSssNode {
  sss_node_id: string; // Must be exactly copied from TSV
  transcript_id: string; // Must be exactly copied from TSV
  phase_name: string; // Must be exactly copied from TSV
  sss_node_label: string; // Must be exactly copied from TSV
  group_id: string; // semantic group name or "N/A"
  group_rationale: string; // Brief explanation of grouping decision
}

/**
 * SSS Node metadata for internal processing
 * Used for collecting and validating SSS nodes
 */
export interface SssNodeMetadata {
  transcript_id: string;
  phase_name: string;
  sss_node_id: string;
  sss_node_label: string;
  isu_definition: string;
  isGrounded: boolean;
}