/**
 * P1_2 Diachronic Unit Identification Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P1_2 Diachronic Unit Identification Step Module
 * Second step in Part1 (Specific Diachronic Analysis) that groups segments into diachronic units
 * 
 * This module exactly matches the working prototype's P1_2 implementation:
 * - Uses P1_1_Output as input (segmented utterances from P1.1)
 * - Uses the same prompt template for DU identification and grouping
 * - Uses the same validation logic for DiachronicUnitP1_2 structures
 * - Uses the same error handling patterns
 * - Validates unit_id formats ("du_1", "du_2", etc.)
 * - Validates source_segment_ids references to P1.1 segments
 * - Preserves IV/DV details from P1.1 step
 * - Ensures segment uniqueness across DUs
 * - Validates reasonable DU count (grouping, not 1:1 mapping)
 */
export const P1_2_StepModule: StepModule = {
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
stepRegistry.register(P1_2_StepModule);