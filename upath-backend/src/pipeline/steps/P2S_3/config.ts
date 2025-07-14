/**
 * P2S_3 Define Specific Synchronic Structure - Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  title: 'Define Specific Synchronic Structure',
  part: 'Part II_S: Specific Synchronic Analysis',
  isJsonOutput: true,
  dependencies: [
    StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
  ],
};