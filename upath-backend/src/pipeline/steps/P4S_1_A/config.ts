/**
 * P4S_1_A Identify and Group SSS Nodes - Step Configuration
 * Updated to match current StepConfig interface
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
  title: 'P4S.1.A: Identify and Group SSS Nodes',
  part: 'Part4S',
  isJsonOutput: true,
  dependencies: [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE],
};

// Additional metadata for step tracking (not part of StepConfig interface)
export const stepMetadata = {
  description: 'Collect and classify SSS nodes across transcripts for a specific GDU into cross-transcript semantic groups',
  requiresApiKey: true,
  inputRequirements: [
    'P3.3 output (core GDUs for synchronic analysis)',
    'P2S.3 outputs (specific synchronic structures from all transcripts)',
    'P2S.2 outputs (ISU hierarchies for grounding validation)',
    'Current GDU for analysis'
  ],
  outputDescription: 'Cross-transcript semantic groups of utterance-grounded SSS nodes',
  validation: {
    required_input_fields: ['gdu_to_analyze_id', 'gdu_definition', 'nodes_tsv', 'structures_mermaid', 'global_dv_focus'],
    required_output_fields: ['analyzed_gdu', 'grouped_data']
  }
};