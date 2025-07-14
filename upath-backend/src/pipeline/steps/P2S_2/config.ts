/**
 * P2S_2 Identify Specific Synchronic Units - Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../graph/types';

export const stepConfig: StepConfig = {
  id: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
  title: 'Identify Specific Synchronic Units',
  part: 'Part II_S: Specific Synchronic Analysis',
  isJsonOutput: true,
  dependencies: [
    StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
    StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
  ],
};