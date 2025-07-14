/**
 * P1_2 Diachronic Unit Identification - Step Configuration
 * Exactly matches the working prototype's STEP_CONFIGS[StepId.P1_2_DIACHRONIC_UNIT_ID]
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../types';

/**
 * P1_2 Diachronic Unit Identification Configuration
 * Groups segments from P1.1 into coherent "Diachronic Units (DUs)" 
 * 
 * From prototype research:
 * - ID: P1_2_DIACHRONIC_UNIT_ID
 * - Title: "P1.2: Diachronic Unit Identification (DU)"
 * - Part: "PartI_Dia" (Part I: Specific Diachronic Analysis)
 * - JSON Output: true (produces structured JSON output)
 * - Dependencies: [P1_1_INITIAL_SEGMENTATION] (requires P1.1 output)
 */
export const stepConfig: StepConfig = {
  id: StepId.P1_2_DIACHRONIC_UNIT_ID,
  title: 'P1.2: Diachronic Unit Identification (DU)',
  part: 'Part1',
  isJsonOutput: true,
  dependencies: [StepId.P1_1_INITIAL_SEGMENTATION],
  
  // Additional metadata for step tracking
  description: 'Groups segments from P1.1 into coherent "Diachronic Units (DUs)" based on temporal and thematic relationships',
  expectedInputType: 'P1_1_Output',
  expectedOutputType: 'P1_2_Output',
  
  // Processing characteristics
  processingType: 'grouping',
  requiresLLM: true,
  estimatedDuration: 'medium', // DU grouping requires analysis
};