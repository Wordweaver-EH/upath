/**
 * P1_4 Construct Specific Diachronic Structure - Step Configuration
 * Exactly matches the working prototype's STEP_CONFIGS[StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]
 */

import { StepConfig } from '../../core/interfaces';
import { StepId } from '../../../graph/types';

/**
 * P1_4 Construct Specific Diachronic Structure Configuration
 * Constructs the Specific Diachronic Structure (SDS) from refined DUs with Mermaid visualization
 * 
 * From prototype research:
 * - ID: P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE
 * - Title: "P1.4: Construct Specific Diachronic Structure"
 * - Part: "PartI_Dia" (Part I: Specific Diachronic Analysis)
 * - JSON Output: true (produces structured JSON output)
 * - Dependencies: [P1_3_REFINE_DIACHRONIC_UNITS] (requires P1.3 output)
 * - Creates SpecificDiachronicPhase objects grouped by temporal_phase
 * - Generates Mermaid Gantt chart syntax for visualization
 * - Provides IV preliminary observations
 * - Completes Part1 - sets isFullyProcessedSpecificDiachronic flag
 */
export const stepConfig: StepConfig = {
  id: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  title: 'P1.4: Construct Specific Diachronic Structure',
  part: 'Part1',
  isJsonOutput: true,
  dependencies: [StepId.P1_3_REFINE_DIACHRONIC_UNITS],
  
  // Additional metadata for step tracking
  description: 'Constructs Specific Diachronic Structure (SDS) from refined DUs, grouped by temporal phases with Mermaid visualization and IV observations',
  expectedInputType: 'P1_3_Output',
  expectedOutputType: 'P1_4_Output',
  
  // Processing characteristics
  processingType: 'structure_construction',
  requiresLLM: true,
  estimatedDuration: 'medium', // SDS construction and Mermaid generation requires analysis
  
  // Special flags
  completesPartAnalysis: true, // This step completes Part1 analysis
  generatesVisualization: true, // Creates Mermaid chart syntax
};