/**
 * P0_2 Refine Data Types Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P0_2 Refine Data Types Step Module
 * Second step in Part0 (Data Preparation) that categorizes transcript lines by information type
 * 
 * This module exactly matches the working prototype's P0_2 implementation:
 * - Uses P0_1_Output as input (first step with dependencies!)
 * - Uses the same prompt template for line categorization
 * - Uses the same validation logic for RefinedLine structures
 * - Uses the same error handling patterns
 * - Validates information_tags against allowed values
 * - Validates line numbering sequence integrity
 */
export const P0_2_StepModule: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
  
  // Optional: Add validateAndClean function for additional post-processing
  validateAndClean: undefined, // Not used in prototype for this step
};

// Export types for external use
export * from './types';

// Export individual functions for testing
export { stepConfig, getInput, generatePrompt, parseOutput };