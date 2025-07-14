/**
 * P1_1 Initial Segmentation Step Configuration
 * Exactly matches the working prototype's step config
 */

import { StepId } from '../../../graph/types';
import { StepConfig } from '../../core/interfaces';

/**
 * Step configuration for P1_1_INITIAL_SEGMENTATION
 * Exactly matches the working prototype configuration
 * IMPORTANT: This is the first step in Part1 (Specific Diachronic Analysis)
 */
export const stepConfig: StepConfig = {
  id: StepId.P1_1_INITIAL_SEGMENTATION,
  title: "P1.1: Initial Segmentation",
  part: "Part1",
  isJsonOutput: true,
  dependencies: [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES], // Depends on P0_3 output
};