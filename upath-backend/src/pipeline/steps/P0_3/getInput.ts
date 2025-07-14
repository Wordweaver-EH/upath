/**
 * P0_3 Select Procedural Utterances - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P0_3_Input } from './types';
import { P0_2_Output } from '../P0_2/types';
import { P_NEG1_1_Output } from '../P_NEG1_1/types';

/**
 * Prepare input data for P0_3 step
 * Exactly matches the working prototype's getInput logic
 * This step depends on BOTH P0_2 AND P_NEG1_1 outputs - first multi-dependency step!
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, processedData } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P0_3 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id 
    } : null
  );
  console.log(`[P0_3 getInput] processedData size:`, processedData?.size || 0);

  // Validation - check current transcript ID (exactly matches prototype logic)
  if (!currentTranscript?.id) {
    console.error(`[P0_3 getInput] Validation failed - missing current transcript ID`);
    return { 
      data: null, 
      error: "Missing current transcript ID for P0.3." 
    };
  }

  // Retrieve both P0_2 and P_NEG1_1 outputs from processed data (exactly matches prototype logic)
  const transcriptProcessedData = processedData?.get(currentTranscript.id);
  const p0_2_data = transcriptProcessedData?.p0_2_output as P0_2_Output;
  const p_neg1_1_data = transcriptProcessedData?.p_neg1_1_output as P_NEG1_1_Output;

  console.log(`[P0_3 getInput] P0_2 data found:`, !!p0_2_data);
  console.log(`[P0_3 getInput] P0_2 transcript_id:`, p0_2_data?.transcript_id);
  console.log(`[P0_3 getInput] P0_2 lines count:`, p0_2_data?.refined_data_transcript?.length || 0);
  
  console.log(`[P0_3 getInput] P_NEG1_1 data found:`, !!p_neg1_1_data);
  console.log(`[P0_3 getInput] P_NEG1_1 transcript_id:`, p_neg1_1_data?.transcript_id);
  console.log(`[P0_3 getInput] P_NEG1_1 DV focus count:`, p_neg1_1_data?.dependent_variable_focus?.length || 0);

  // Validation - check BOTH dependencies (exactly matches prototype logic)
  if (!p0_2_data || !p_neg1_1_data) {
    console.error(`[P0_3 getInput] Missing dependencies for transcript ${currentTranscript.id}`);
    console.error(`[P0_3 getInput] P0_2 data: ${!!p0_2_data}, P_NEG1_1 data: ${!!p_neg1_1_data}`);
    return { 
      data: null, 
      error: `Missing P0.2 or P-1.1 output for transcript ${currentTranscript.id}` 
    };
  }

  // Additional validation - ensure P0_2 data structure is correct
  if (!p0_2_data.transcript_id || !Array.isArray(p0_2_data.refined_data_transcript)) {
    console.error(`[P0_3 getInput] Invalid P0_2 output structure for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Invalid P0.2 output structure for transcript ${currentTranscript.id}` 
    };
  }

  if (p0_2_data.refined_data_transcript.length === 0) {
    console.error(`[P0_3 getInput] P0_2 output has no lines for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `P0.2 output has no lines for transcript ${currentTranscript.id}` 
    };
  }

  // Additional validation - ensure P_NEG1_1 data structure is correct
  if (!p_neg1_1_data.transcript_id || !p_neg1_1_data.independent_variable_details || !Array.isArray(p_neg1_1_data.dependent_variable_focus)) {
    console.error(`[P0_3 getInput] Invalid P_NEG1_1 output structure for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Invalid P_NEG1_1 output structure for transcript ${currentTranscript.id}` 
    };
  }

  // Combine both outputs as input for P0_3 (exactly matches prototype structure)
  const inputData: P0_3_Input = {
    ...p0_2_data,
    p_neg1_1_output: p_neg1_1_data,
  };

  console.log(`[P0_3 getInput] Successfully prepared input for P0_3 with ${p0_2_data.refined_data_transcript.length} lines and IV/DV details`);

  return {
    data: inputData,
  };
}