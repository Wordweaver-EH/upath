/**
 * P3_1 Align Structures - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P3_1_Input, TranscriptStructureData } from './types';

/**
 * Prepare input data for P3_1 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { processedData, userDvFocus, apiKeyPresent } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P3_1 getInput] Processing ${processedData.size} transcripts`);
  console.log(`[P3_1 getInput] API key present:`, apiKeyPresent);
  console.log(`[P3_1 getInput] User DV focus:`, userDvFocus);

  // Validation (exactly matches prototype logic)
  if (!apiKeyPresent) {
    console.error(`[P3_1 getInput] Validation failed - API key not present`);
    return { 
      data: null, 
      error: "API key required for P3.1 analysis." 
    };
  }

  if (!processedData || processedData.size === 0) {
    console.error(`[P3_1 getInput] Validation failed - no processed data available`);
    return { 
      data: null, 
      error: "No processed transcript data available for P3.1." 
    };
  }

  // Collect all P1_4 outputs (Specific Diachronic Structures)
  const allStructures: TranscriptStructureData[] = [];

  for (const [transcriptId, transcriptData] of processedData) {
    const p1_4_output = transcriptData.p1_4_output;

    if (p1_4_output) {
      // Construct structure data (matches prototype collection logic)
      const structureData: TranscriptStructureData = {
        transcript_id: transcriptId,
        filename: transcriptData.filename || transcriptId, // Use filename if available, fallback to ID
        independent_variable_details: p1_4_output.independent_variable_details,
        dependent_variable_focus: p1_4_output.dependent_variable_focus,
        specific_diachronic_structure: p1_4_output.specific_diachronic_structure,
      };

      allStructures.push(structureData);
      console.log(`[P3_1 getInput] Collected structure for transcript ${transcriptId}`);
    } else {
      console.warn(`[P3_1 getInput] No P1.4 output found for transcript ${transcriptId}`);
    }
  }

  // Validation: Must have at least some structures
  if (allStructures.length === 0) {
    console.error(`[P3_1 getInput] No P1.4 outputs found in any transcript`);
    return { 
      data: null, 
      error: "No P1.4 outputs found for cross-transcript analysis." 
    };
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P3_1_Input = {
    all_specific_diachronic_structures: allStructures,
    global_dv_focus: userDvFocus?.dv_focus || [],
  };

  console.log(`[P3_1 getInput] Successfully prepared input with ${allStructures.length} structures`);

  return {
    data: inputData,
  };
}