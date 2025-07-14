/**
 * P3_1 Align Structures - Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P3_1_ALIGN_STRUCTURES,
  title: 'Align Structures',
  part: 'Part III: Generic Diachronic Analysis',
  isJsonOutput: true,
  dependencies: [
    StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
    // Note: This step requires ALL transcripts to have completed P1_4
    // The dependency logic is handled in the pipeline orchestration
  ],
};