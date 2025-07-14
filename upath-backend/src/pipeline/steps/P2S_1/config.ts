/**
 * P2S_1 Group Utterances by Topic - Configuration
 * Exactly matches the working prototype's step configuration
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

export const stepConfig: StepConfig = {
  id: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
  title: 'Group Utterances by Topic',
  part: 'Part II_S: Specific Synchronic Analysis',
  isJsonOutput: true,
  dependencies: [
    StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
    StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  ],
};