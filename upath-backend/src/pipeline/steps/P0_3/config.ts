/**
 * P0_3 Select Procedural Utterances Step Configuration
 * Exactly matches the working prototype's step config
 */

import { StepId } from '../../../graph/types';
import { StepConfig } from '../../core/interfaces';

/**
 * Step configuration for P0_3_SELECT_PROCEDURAL_UTTERANCES
 * Exactly matches the working prototype configuration
 * IMPORTANT: This is the first step with MULTIPLE dependencies!
 */
export const stepConfig: StepConfig = {
  id: StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
  title: "P0.3: Select Procedural Utterances",
  part: "Part0",
  isJsonOutput: true,
  dependencies: [
    StepId.P0_2_REFINE_DATA_TYPES,        // For refined transcript data
    StepId.P_NEG1_1_VARIABLE_IDENTIFICATION  // For IV/DV details preservation
  ],
};