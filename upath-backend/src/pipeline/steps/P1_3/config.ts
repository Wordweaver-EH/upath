/**
 * P1_3 Refine Diachronic Units - Step Configuration
 * Exactly matches the working prototype's STEP_CONFIGS[StepId.P1_3_REFINE_DIACHRONIC_UNITS]
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

/**
 * P1_3 Refine Diachronic Units Configuration
 * Refines DUs from P1.2 by merging/splitting and assigns temporal phases
 * 
 * From prototype research:
 * - ID: P1_3_REFINE_DIACHRONIC_UNITS
 * - Title: "P1.3: Refine Diachronic Units"
 * - Part: "PartI_Dia" (Part I: Specific Diachronic Analysis)
 * - JSON Output: true (produces structured JSON output)
 * - Dependencies: [P1_2_DIACHRONIC_UNIT_ID] (requires P1.2 output)
 * - Assigns temporal phases: "Beginning", "Early-Middle", "Core Event", "Late-Middle", "Ending", "Reflection", "Transition", "Other"
 * - Adds confidence scores (0.0 to 1.0) for each refined DU
 */
export const stepConfig: StepConfig = {
  id: StepId.P1_3_REFINE_DIACHRONIC_UNITS,
  title: 'P1.3: Refine Diachronic Units',
  part: 'Part1',
  isJsonOutput: true,
  dependencies: [StepId.P1_2_DIACHRONIC_UNIT_ID],
};

// Additional metadata for step tracking (not part of StepConfig interface)
export const stepMetadata = {
  description: 'Refines DUs from P1.2 by merging/splitting based on experiential flow and assigns temporal phases with confidence scores',
  expectedInputType: 'P1_2_Output',
  expectedOutputType: 'P1_3_Output',
  processingType: 'refinement',
  requiresLLM: true,
  estimatedDuration: 'medium', // DU refinement and phase assignment requires analysis
};