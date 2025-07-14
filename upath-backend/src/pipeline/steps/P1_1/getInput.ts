/**
 * P1_1 Initial Segmentation - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P1_1_Input } from './types';
import { P0_3_Output } from '../P0_3/types';

/**
 * Prepare input data for P1_1 step
 * Exactly matches the working prototype's getInput logic
 * This step depends on P0_3 output for procedural utterances
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, processedData } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P1_1 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id 
    } : null
  );
  console.log(`[P1_1 getInput] processedData size:`, processedData?.size || 0);

  // Validation - check current transcript ID (exactly matches prototype logic)
  if (!currentTranscript?.id) {
    console.error(`[P1_1 getInput] Validation failed - missing current transcript ID`);
    return { 
      data: null, 
      error: "Missing current transcript ID for P1.1." 
    };
  }

  // Retrieve P0_3 output from processed data (exactly matches prototype logic)
  const transcriptProcessedData = processedData?.get(currentTranscript.id);
  const p0_3_data = transcriptProcessedData?.p0_3_output as P0_3_Output;

  console.log(`[P1_1 getInput] P0_3 data found:`, !!p0_3_data);
  console.log(`[P1_1 getInput] P0_3 transcript_id:`, p0_3_data?.transcript_id);
  console.log(`[P1_1 getInput] P0_3 utterances count:`, p0_3_data?.selected_procedural_utterances?.length || 0);

  // Validation - check P0_3 dependency (exactly matches prototype logic)
  if (!p0_3_data) {
    console.error(`[P1_1 getInput] Missing P0.3 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Missing P0.3 output for transcript ${currentTranscript.id}` 
    };
  }

  // Additional validation - ensure P0_3 data structure is correct
  if (!p0_3_data.transcript_id || !Array.isArray(p0_3_data.selected_procedural_utterances)) {
    console.error(`[P1_1 getInput] Invalid P0_3 output structure for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Invalid P0_3 output structure for transcript ${currentTranscript.id}` 
    };
  }

  if (p0_3_data.selected_procedural_utterances.length === 0) {
    console.error(`[P1_1 getInput] P0_3 output has no procedural utterances for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `P0_3 output has no procedural utterances for transcript ${currentTranscript.id}` 
    };
  }

  // Additional validation - ensure IV/DV data is preserved
  if (!p0_3_data.independent_variable_details || !Array.isArray(p0_3_data.dependent_variable_focus)) {
    console.error(`[P1_1 getInput] P0_3 output missing IV/DV details for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `P0_3 output missing IV/DV details for transcript ${currentTranscript.id}` 
    };
  }

  // Return P0_3 data as input for P1_1 (exactly matches prototype structure)
  const inputData: P1_1_Input = p0_3_data;

  console.log(`[P1_1 getInput] Successfully prepared input for P1_1 with ${p0_3_data.selected_procedural_utterances.length} utterances`);

  return {
    data: inputData,
  };
}