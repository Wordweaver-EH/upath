/**
 * P4S_1_B Define GSS from Groups - Step Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';

export const stepConfig: StepConfig = {
  // Exactly matches the working prototype's step configuration
  id: 'P4S_1_B_DEFINE_GSS_FROM_GROUPS',
  name: 'Define GSS from Groups',
  description: 'Define Generic Synchronic Structure from grouped SSS nodes with traceability',
  part: 4,
  subpart: 'S',
  dependencies: ['P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES'],
  requiresApiKey: true,
  
  // Matching prototype's execution requirements
  inputRequirements: [
    'P4S.1A output (grouped SSS nodes for current GDU)',
    'Cross-transcript semantic groups with rationale',
    'Contributing SSS nodes with traceability data'
  ],
  
  outputDescription: 'Generic Synchronic Structure with generic categories, links, and instantiation notes',
  
  // Matching prototype's validation requirements
  validation: {
    required_input_fields: ['p4s_1_a_data', 'global_dv_focus'],
    required_output_fields: ['analyzed_gdu', 'generic_synchronic_structure', 'dependent_variable_focus']
  }
};