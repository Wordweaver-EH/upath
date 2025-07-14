/**
 * P4S_1_B Define GSS from Groups - Type Definitions
 * Exactly matches the working prototype's type definitions
 */

/**
 * Input structure for P4S_1_B step
 * Exactly matches the working prototype's input structure
 */
export interface P4S_1_B_Input {
  p4s_1_a_data: {
    analyzed_gdu: string;
    sss_node_groups: SSSNodeGroup[];
    dependent_variable_focus: string[];
  };
  global_dv_focus: string[];
}

/**
 * SSS Node Group structure from P4S_1_A output
 * Exactly matches the working prototype's SSS node group structure
 */
export interface SSSNodeGroup {
  group_id: string;
  group_rationale: string;
  contributing_sss_nodes: ContributingSSSNode[];
}

/**
 * Contributing SSS node structure
 * Exactly matches the working prototype's contributing node structure
 */
export interface ContributingSSSNode {
  transcript_id: string;
  sss_node_id: string;
  phase_name: string;
  sss_node_label: string;
}

/**
 * Output structure for P4S_1_B step (P4S_1_Output)
 * Exactly matches the working prototype's output structure
 */
export interface P4S_1_B_Output {
  analyzed_gdu: string;
  generic_synchronic_structure: GenericSynchronicStructure;
  variations_notes?: string;
  dependent_variable_focus: string[];
}

/**
 * Generic Synchronic Structure definition
 * Exactly matches the working prototype's GSS structure
 */
export interface GenericSynchronicStructure {
  representation_type: string; // e.g., "Semantic Network"
  description: string;
  generic_nodes_categories: P4S_1_GenericNode[];
  generic_network_links: P4S_1_GenericLink[];
  instantiation_notes?: P4S_1_InstantiationNote[];
}

/**
 * Generic node category structure
 * Exactly matches the working prototype's generic node structure
 */
export interface P4S_1_GenericNode {
  id: string; // e.g., "gss_cat_CognitiveProcessing"
  label: string; // Abstraction of group_rationale
}

/**
 * Generic network link structure
 * Exactly matches the working prototype's generic link structure
 */
export interface P4S_1_GenericLink {
  from: string; // generic_category_id
  to: string; // generic_category_id
  type: string; // e.g., "is_related_to"
}

/**
 * Instantiation note structure for traceability
 * Exactly matches the working prototype's instantiation note structure
 */
export interface P4S_1_InstantiationNote {
  generic_category_id: string; // Must match a generic node ID
  textual_description: string;
  example_specific_nodes: ExampleSpecificNode[]; // MANDATORY - must be populated from input
}

/**
 * Example specific node for traceability
 * Exactly matches the working prototype's example node structure
 */
export interface ExampleSpecificNode {
  transcript_id: string;
  sss_node_id: string;
  phase_name: string;
}