/**
 * P3_2 Identify Generic Diachronic Units - Step Configuration
 * Updated to match current StepConfig interface
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P3_2_IDENTIFY_GDUS,
  title: 'P3.2: Identify Generic Diachronic Units',
  part: 'Part3',
  isJsonOutput: true,
  dependencies: [StepId.P3_1_ALIGN_STRUCTURES],
};

// Additional metadata for step tracking (not part of StepConfig interface)
export const stepMetadata = {
  description: 'Cluster refined DUs into GDUs with traceability and IV consideration',
  requiresApiKey: true,
  inputRequirements: [
    'P3.1 output (aligned structures report)',
    'P1.3 outputs (refined diachronic units from all transcripts)',
    'User dependent variable focus'
  ],
  outputDescription: 'Generic Diachronic Units with traceability to refined DUs',
  validation: {
    required_input_fields: ['p3_1_output', 'all_refined_dus_with_iv_and_ids', 'global_dv_focus', 'tot_rdus'],
    required_output_fields: ['identified_gdus', 'criteria_for_gdu_identification', 'dependent_variable_focus', 'tot_rdus']
  }
};