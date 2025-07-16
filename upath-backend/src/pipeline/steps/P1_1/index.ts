/**
 * P1_1 Initial Segmentation Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P1_1 Initial Segmentation Step Module
 * First step in Part1 (Specific Diachronic Analysis) that segments procedural utterances into minimal action units
 * 
 * This module exactly matches the working prototype's P1_1 implementation:
 * - Uses P0_3_Output as input (procedural utterances from Part0)
 * - Uses the same prompt template for temporal segmentation
 * - Uses the same validation logic for SegmentedUtterance structures
 * - Uses the same error handling patterns
 * - Validates segment_id formats ("utt_X_seg_Y")
 * - Validates temporal_cues arrays
 * - Preserves IV/DV details from P0_3 step
 * - Ensures segment uniqueness within utterances
 */
export const P1_1_StepModule: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
};

// Export types for external use
export * from './types';

// Export individual functions for testing
export { stepConfig, getInput, generatePrompt, parseOutput };

// Auto-register step
import { stepRegistry } from '../../core/registry';
stepRegistry.register(P1_1_StepModule);