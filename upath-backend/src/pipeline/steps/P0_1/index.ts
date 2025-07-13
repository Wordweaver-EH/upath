/**
 * P0_1 Transcription Adherence Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P0_1 Transcription Adherence Step Module
 * First step in Part0 (Data Preparation) that handles transcription verification and line numbering
 * 
 * This module exactly matches the working prototype's P0_1 implementation:
 * - Uses the same input/output structure
 * - Uses the same prompt template
 * - Uses the same validation logic
 * - Uses the same error handling patterns
 */
export const P0_1_StepModule: StepModule = {
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