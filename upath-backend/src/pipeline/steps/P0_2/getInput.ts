/**
 * P0_2 Refine Data Types - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P0_2_Input } from './types';
import { P0_1_Output } from '../P0_1/types';

/**
 * Prepare input data for P0_2 step
 * Exactly matches the working prototype's getInput logic
 * This step depends on P0_1 output - first step with dependencies!
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, processedData } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P0_2 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id 
    } : null
  );
  console.log(`[P0_2 getInput] processedData size:`, processedData?.size || 0);

  // Validation - check current transcript ID (exactly matches prototype logic)
  if (!currentTranscript?.id) {
    console.error(`[P0_2 getInput] Validation failed - missing current transcript ID`);
    return { 
      data: null, 
      error: "Missing current transcript ID for P0.2." 
    };
  }

  // Retrieve P0_1 output from processed data (exactly matches prototype logic)
  const transcriptProcessedData = processedData?.get(currentTranscript.id);
  const p0_1_data = transcriptProcessedData?.p0_1_output as P0_1_Output;

  console.log(`[P0_2 getInput] P0_1 data found:`, !!p0_1_data);
  console.log(`[P0_2 getInput] P0_1 transcript_id:`, p0_1_data?.transcript_id);
  console.log(`[P0_2 getInput] P0_1 line count:`, p0_1_data?.line_numbered_transcript?.length || 0);

  // Validation - check P0_1 dependency (exactly matches prototype logic)
  if (!p0_1_data) {
    console.error(`[P0_2 getInput] Missing P0.1 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Missing P0.1 output for transcript ${currentTranscript.id}` 
    };
  }

  // Additional validation - ensure P0_1 data structure is correct
  if (!p0_1_data.transcript_id || !Array.isArray(p0_1_data.line_numbered_transcript)) {
    console.error(`[P0_2 getInput] Invalid P0.1 output structure for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `Invalid P0.1 output structure for transcript ${currentTranscript.id}` 
    };
  }

  if (p0_1_data.line_numbered_transcript.length === 0) {
    console.error(`[P0_2 getInput] P0.1 output has no lines for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `P0.1 output has no lines for transcript ${currentTranscript.id}` 
    };
  }

  // Return P0_1 data as input for P0_2 (exactly matches prototype structure)
  const inputData: P0_2_Input = p0_1_data;

  console.log(`[P0_2 getInput] Successfully prepared input for P0_2 with ${p0_1_data.line_numbered_transcript.length} lines`);

  return {
    data: inputData,
  };
}