/**
 * P2S_2 Identify Specific Synchronic Units - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P2S_2_Input } from './types';

/**
 * Prepare input data for P2S_2 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, processedData, currentPhaseName } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P2S_2 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id 
    } : null
  );
  console.log(`[P2S_2 getInput] currentPhaseName:`, currentPhaseName);

  // Validation (exactly matches prototype logic)
  if (!currentTranscript?.id) {
    console.error(`[P2S_2 getInput] Validation failed - missing transcript ID`);
    return { 
      data: null, 
      error: "Missing current transcript ID or phase name for P2S.2." 
    };
  }

  if (!currentPhaseName) {
    console.error(`[P2S_2 getInput] Validation failed - missing current phase name`);
    return { 
      data: null, 
      error: "Missing current transcript ID or phase name for P2S.2." 
    };
  }

  // Get required outputs from previous steps
  const transcriptData = processedData.get(currentTranscript.id);
  if (!transcriptData) {
    console.error(`[P2S_2 getInput] No processed data found for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Missing P2S.1 output for phase '${currentPhaseName}' or P0.3 data for transcript ${currentTranscript.id}` 
    };
  }

  // Get P2S_1 output for this specific phase
  const p2s_1_data_for_phase = transcriptData.p2s_outputs_by_phase?.[currentPhaseName]?.p2s_1_output;
  
  // Get P0_3 output for IV/DV details
  const p0_3_data = transcriptData.p0_3_output;

  if (!p2s_1_data_for_phase) {
    console.error(`[P2S_2 getInput] Missing P2S.1 output for phase '${currentPhaseName}'`);
    return { 
      data: null, 
      error: `Missing P2S.1 output for phase '${currentPhaseName}' or P0.3 data for transcript ${currentTranscript.id}` 
    };
  }

  if (!p0_3_data) {
    console.error(`[P2S_2 getInput] Missing P0.3 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Missing P2S.1 output for phase '${currentPhaseName}' or P0.3 data for transcript ${currentTranscript.id}` 
    };
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P2S_2_Input = {
    // Spread P2S_1 output
    ...p2s_1_data_for_phase,
    // Add IV/DV details from P0_3
    independent_variable_details: p0_3_data.independent_variable_details,
    dependent_variable_focus: p0_3_data.dependent_variable_focus,
  };

  console.log(`[P2S_2 getInput] Successfully prepared input for phase '${currentPhaseName}' with ${inputData.synchronic_thematic_groups.length} thematic groups`);

  return {
    data: inputData,
  };
}