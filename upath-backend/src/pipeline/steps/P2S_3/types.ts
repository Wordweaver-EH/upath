/**
 * P2S_3 Define Specific Synchronic Structure - Type Definitions
 * Exactly matches the working prototype's type structure
 */

import { P2S_2_Output } from '../P2S_2/types';

/**
 * Input interface for P2S_3 step
 * Uses P2S_2_Output directly as input
 */
export interface P2S_3_Input extends P2S_2_Output {}

/**
 * Network node in the semantic network
 * Matches prototype's SSS network node structure
 */
export interface SSSNetworkNode {
  id: string; // Unique ID for this SSS node
  label: string; // Descriptive label
  source_isu_id: string; // unit_name from P2S.2 ISU
}

/**
 * Network link connecting nodes
 * Matches prototype's SSS network link structure
 */
export interface SSSNetworkLink {
  from: string; // SSS node ID
  to: string; // SSS node ID
  type: string; // Relationship type
}

/**
 * Specific Synchronic Structure as semantic network
 * Matches prototype's SSS structure
 */
export interface SpecificSynchronicStructure {
  representation_type: 'Semantic Network';
  description: string;
  network_nodes: SSSNetworkNode[];
  network_links: SSSNetworkLink[];
}

/**
 * Output interface for P2S_3 step
 * Exactly matches prototype's P2S_3_Output type
 */
export interface P2S_3_Output {
  transcript_id: string;
  analyzed_diachronic_unit: string;
  specific_synchronic_structure: SpecificSynchronicStructure;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}