/**
 * P4S_1_B Define GSS from Groups - Step Configuration
 * Updated to match current StepConfig interface
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
  title: 'P4S.1.B: Define GSS from Groups',
  part: 'Part4S',
  isJsonOutput: true,
  dependencies: [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES],
};

// Additional metadata for step tracking (not part of StepConfig interface)
export const stepMetadata = {
  description: 'Define Generic Synchronic Structure from grouped SSS nodes with traceability',
  requiresApiKey: true,
  inputRequirements: [
    'P4S.1A output (grouped SSS nodes for current GDU)',
    'Cross-transcript semantic groups with rationale',
    'Contributing SSS nodes with traceability data'
  ],
  outputDescription: 'Generic Synchronic Structure with generic categories, links, and instantiation notes',
  validation: {
    required_input_fields: ['p4s_1_a_data', 'global_dv_focus'],
    required_output_fields: ['analyzed_gdu', 'generic_synchronic_structure', 'dependent_variable_focus']
  }
};