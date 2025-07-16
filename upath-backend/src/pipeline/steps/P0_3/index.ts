/**
 * P0_3 Select Procedural Utterances Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P0_3 Select Procedural Utterances Step Module
 * Third step in Part0 (Data Preparation) that selects utterances crucial for temporal experience structure
 * 
 * This module exactly matches the working prototype's P0_3 implementation:
 * - Uses BOTH P0_2_Output AND P_NEG1_1_Output as input (first multi-dependency step!)
 * - Uses the same prompt template for procedural utterance selection
 * - Uses the same validation logic for SelectedUtterance structures
 * - Uses the same error handling patterns
 * - Validates line number formats (supports "X" and "X.Y" for split lines)
 * - Preserves IV/DV details from P_NEG1_1 step
 */
export const P0_3_StepModule: StepModule = {
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
stepRegistry.register(P0_3_StepModule);