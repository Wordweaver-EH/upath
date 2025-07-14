/**
 * P1_3 Refine Diachronic Units Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P1_3 Refine Diachronic Units Step Module
 * Third step in Part1 (Specific Diachronic Analysis) that refines DUs and assigns temporal phases
 * 
 * This module exactly matches the working prototype's P1_3 implementation:
 * - Uses P1_2_Output as input (diachronic units from P1.2)
 * - Uses the same prompt template for DU refinement and temporal phase assignment
 * - Uses the same validation logic for RefinedDiachronicUnitP1_3 structures
 * - Uses the same error handling patterns
 * - Validates unit_id formats ("rdu_1", "rdu_2", etc.)
 * - Validates temporal phase values from fixed list (Beginning, Early-Middle, Core Event, etc.)
 * - Validates confidence scores (0.0 to 1.0)
 * - Validates source_p1_2_du_ids references to P1.2 DUs
 * - Preserves IV/DV details from P1.2 step
 * - Ensures P1.2 DU uniqueness (each can only contribute to one refined DU)
 * - Provides temporal phase distribution and confidence statistics
 */
export const P1_3_StepModule: StepModule = {
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