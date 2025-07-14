/**
 * P3_3 Define Generic Diachronic Structure - Step Configuration
 * Updated to match current StepConfig interface
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
  title: 'P3.3: Define Generic Diachronic Structure',
  part: 'Part3',
  isJsonOutput: true,
  dependencies: [StepId.P3_1_ALIGN_STRUCTURES, StepId.P3_2_IDENTIFY_GDUS],
};

// Additional metadata for step tracking (not part of StepConfig interface)
export const stepMetadata = {
  description: 'Define the Generic Diachronic Structure using GDUs and IV insights',
  requiresApiKey: true,
  inputRequirements: [
    'P3.1 output (aligned structures report)',
    'P3.2 output (identified GDUs)',
    'Global dependent variable focus'
  ],
  outputDescription: 'Generic Diachronic Structure definition with core/optional GDUs and sequences',
  validation: {
    required_input_fields: ['p3_1_output', 'p3_2_output', 'global_dv_focus'],
    required_output_fields: ['generic_diachronic_structure_definition', 'variants_summary', 'dependent_variable_focus']
  }
};