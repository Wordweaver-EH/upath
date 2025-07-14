/**
 * P2S_3 Define Specific Synchronic Structure - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P2S_3_Input } from './types';

/**
 * Prepare input data for P2S_3 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, processedData, currentPhaseName } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P2S_3 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id 
    } : null
  );
  console.log(`[P2S_3 getInput] currentPhaseName:`, currentPhaseName);

  // Validation (exactly matches prototype logic)
  if (!currentTranscript?.id || !currentPhaseName) {
    console.error(`[P2S_3 getInput] Validation failed - missing transcript ID or phase name`);
    return { 
      data: null, 
      error: "Missing current transcript ID or phase name for P2S.3." 
    };
  }

  // Get required outputs from previous steps
  const transcriptData = processedData.get(currentTranscript.id);
  if (!transcriptData) {
    console.error(`[P2S_3 getInput] No processed data found for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `No processed data found for transcript ${currentTranscript.id}` 
    };
  }

  // Get P2S_2 output for this specific phase
  const p2s_2_data_for_phase = transcriptData.p2s_outputs_by_phase?.[currentPhaseName]?.p2s_2_output;

  if (!p2s_2_data_for_phase) {
    console.error(`[P2S_3 getInput] Missing P2S.2 output for phase '${currentPhaseName}'`);
    return { 
      data: null, 
      error: `Missing P2S.2 output for phase '${currentPhaseName}' for transcript ${currentTranscript.id}` 
    };
  }

  // Prepare input data (P2S_2 output becomes P2S_3 input directly)
  const inputData: P2S_3_Input = p2s_2_data_for_phase;

  console.log(`[P2S_3 getInput] Successfully prepared input for phase '${currentPhaseName}' with ${inputData.specific_synchronic_units_hierarchy.length} ISUs`);

  return {
    data: inputData,
  };
}