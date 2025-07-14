/**
 * P4S_1_A Identify and Group SSS Nodes - Step Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';

export const stepConfig: StepConfig = {
  // Exactly matches the working prototype's step configuration
  id: 'P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES',
  name: 'Identify and Group SSS Nodes',
  description: 'Collect and classify SSS nodes across transcripts for a specific GDU into cross-transcript semantic groups',
  part: 4,
  subpart: 'S',
  dependencies: ['P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE'],
  requiresApiKey: true,
  
  // Matching prototype's execution requirements
  inputRequirements: [
    'P3.3 output (core GDUs for synchronic analysis)',
    'P2S.3 outputs (specific synchronic structures from all transcripts)',
    'P2S.2 outputs (ISU hierarchies for grounding validation)',
    'Current GDU for analysis'
  ],
  
  outputDescription: 'Cross-transcript semantic groups of utterance-grounded SSS nodes',
  
  // Matching prototype's validation requirements
  validation: {
    required_input_fields: ['gdu_to_analyze_id', 'gdu_definition', 'nodes_tsv', 'structures_mermaid', 'global_dv_focus'],
    required_output_fields: ['analyzed_gdu', 'grouped_data']
  }
};