/**
 * P1_4 Construct Specific Diachronic Structure Step Module
 * Complete step implementation that exactly matches the working prototype
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

/**
 * P1_4 Construct Specific Diachronic Structure Step Module
 * Final step in Part1 (Specific Diachronic Analysis) that constructs the SDS with Mermaid visualization
 * 
 * This module exactly matches the working prototype's P1_4 implementation:
 * - Uses P1_3_Output as input (refined diachronic units with temporal phases)
 * - Uses the same prompt template for SDS construction and Mermaid Gantt chart generation
 * - Uses the same validation logic for SpecificDiachronicStructureType and SpecificDiachronicPhase
 * - Uses the same error handling patterns
 * - Groups refined DUs by temporal_phase into coherent phases
 * - Validates phase_name uniqueness and unit assignment uniqueness
 * - Validates Mermaid syntax structure (must contain 'gantt' and 'title')
 * - Validates visualization_hint from fixed list (Linear, Cyclical, etc.)
 * - Creates IV preliminary observations connecting IV to diachronic structure
 * - Preserves IV/DV details from P1.3 step
 * - Completes Part1 analysis - this step sets isFullyProcessedSpecificDiachronic flag
 * - Prepares phases_for_p2s_processing for Part2S (Specific Synchronic Analysis)
 */
export const P1_4_StepModule: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
};

// Export types for external use
export * from './types';

// Export individual functions for testing
export { stepConfig, getInput, generatePrompt, parseOutput };