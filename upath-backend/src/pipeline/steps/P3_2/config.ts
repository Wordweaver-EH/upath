/**
 * P3_2 Identify Generic Diachronic Units - Step Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';

export const stepConfig: StepConfig = {
  // Exactly matches the working prototype's step configuration
  id: 'P3_2_IDENTIFY_GDUS',
  name: 'Identify Generic Diachronic Units',
  description: 'Cluster refined DUs into GDUs with traceability and IV consideration',
  part: 3,
  subpart: null,
  dependencies: ['P3_1_ALIGN_STRUCTURES'],
  requiresApiKey: true,
  
  // Matching prototype's execution requirements
  inputRequirements: [
    'P3.1 output (aligned structures report)',
    'P1.3 outputs (refined diachronic units from all transcripts)',
    'User dependent variable focus'
  ],
  
  outputDescription: 'Generic Diachronic Units with traceability to refined DUs',
  
  // Matching prototype's validation requirements
  validation: {
    required_input_fields: ['p3_1_output', 'all_refined_dus_with_iv_and_ids', 'global_dv_focus', 'tot_rdus'],
    required_output_fields: ['identified_gdus', 'criteria_for_gdu_identification', 'dependent_variable_focus', 'tot_rdus']
  }
};