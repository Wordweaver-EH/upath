/**
 * P0_1 Transcription Adherence Step Configuration
 * Exactly matches the working prototype's step config
 */

import { StepId } from '../../../types';
import { StepConfig } from '../../core/interfaces';

/**
 * Step configuration for P0_1_TRANSCRIPTION_ADHERENCE
 * Exactly matches the working prototype configuration
 */
export const stepConfig: StepConfig = {
  id: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
  title: "P0.1: Transcription Adherence & Line Numbering",
  part: "Part0",
  isJsonOutput: true,
  // First step in Part0, no dependencies within Part0
};