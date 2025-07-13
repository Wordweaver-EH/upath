/**
 * P0_2 Refine Data Types Step Configuration
 * Exactly matches the working prototype's step config
 */

import { StepId } from '../../../graph/types';
import { StepConfig } from '../../core/interfaces';

/**
 * Step configuration for P0_2_REFINE_DATA_TYPES
 * Exactly matches the working prototype configuration
 * IMPORTANT: This is the first step with dependencies!
 */
export const stepConfig: StepConfig = {
  id: StepId.P0_2_REFINE_DATA_TYPES,
  title: "P0.2: Refining Data - Identifying Information Types",
  part: "Part0",
  isJsonOutput: true,
  dependencies: [StepId.P0_1_TRANSCRIPTION_ADHERENCE], // Depends on P0_1 output
};