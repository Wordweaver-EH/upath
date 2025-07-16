/**
 * P_NEG1_1 Variable Identification Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P_NEG1_1 Variable Identification Step Module
 * First step in the µ-PATH pipeline that identifies potential independent variables
 * 
 * This module exactly matches the working prototype's P_NEG1_1 implementation:
 * - Uses the same input/output structure
 * - Uses the same prompt template
 * - Uses the same validation logic
 * - Uses the same error handling patterns
 */
export const P_NEG1_1_StepModule: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
};

// Auto-register step
import { stepRegistry } from '../../core/registry';
stepRegistry.register(P_NEG1_1_StepModule);

// Export types for external use
export * from './types';

// Export individual functions for testing
export { stepConfig, getInput, generatePrompt, parseOutput };