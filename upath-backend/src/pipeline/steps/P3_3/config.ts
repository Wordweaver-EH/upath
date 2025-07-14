/**
 * P3_3 Define Generic Diachronic Structure - Step Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';

export const stepConfig: StepConfig = {
  // Exactly matches the working prototype's step configuration
  id: 'P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE',
  name: 'Define Generic Diachronic Structure',
  description: 'Define the Generic Diachronic Structure using GDUs and IV insights',
  part: 3,
  subpart: null,
  dependencies: ['P3_1_ALIGN_STRUCTURES', 'P3_2_IDENTIFY_GDUS'],
  requiresApiKey: true,
  
  // Matching prototype's execution requirements
  inputRequirements: [
    'P3.1 output (aligned structures report)',
    'P3.2 output (identified GDUs)',
    'Global dependent variable focus'
  ],
  
  outputDescription: 'Generic Diachronic Structure definition with core/optional GDUs and sequences',
  
  // Matching prototype's validation requirements
  validation: {
    required_input_fields: ['p3_1_output', 'p3_2_output', 'global_dv_focus'],
    required_output_fields: ['generic_diachronic_structure_definition', 'variants_summary', 'dependent_variable_focus']
  }
};