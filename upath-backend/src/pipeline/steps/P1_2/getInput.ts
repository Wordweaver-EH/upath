/**
 * P1_2 Diachronic Unit Identification - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { GetInputFunction, StepInputParams, StepInputResult } from '../../core/interfaces';
import { P1_2_Input } from './types';
import { P1_1_Output } from '../P1_1/types';

/**
 * Get input data for P1_2 step
 * Retrieves P1_1_Output from transcript processed data
 * Exactly matches the prototype's dependency resolution pattern
 */
export const getInput: GetInputFunction = (params: StepInputParams): StepInputResult => {
  const { currentTranscript, processedData } = params;
  const transcriptProcessedData = processedData?.get(currentTranscript.id);

  // Debug logging (matches prototype pattern)
  console.log(`[P1_2 getInput] Processing transcript: ${currentTranscript?.id || 'unknown'}`);
  console.log(`[P1_2 getInput] Available processed data keys: ${Object.keys(transcriptProcessedData || {}).join(', ')}`);

  // Validation: Check if transcript exists
  if (!currentTranscript) {
    return {
      data: null,
      error: 'No transcript provided for P1_2 processing'
    };
  }

  // Validation: Check if P1_1 output exists (required dependency)
  const p1_1_data = transcriptProcessedData?.p1_1_output as P1_1_Output;
  if (!p1_1_data) {
    return {
      data: null,
      error: `Missing P1.1 output for transcript ${currentTranscript.id}. P1_2 requires P1_1_INITIAL_SEGMENTATION to be completed first.`
    };
  }

  // Validation: Check P1_1 data structure (exactly matches prototype validation)
  if (!p1_1_data.transcript_id || !Array.isArray(p1_1_data.segmented_utterances)) {
    return {
      data: null,
      error: `Invalid P1.1 output structure for transcript ${currentTranscript.id}. Missing transcript_id or segmented_utterances.`
    };
  }

  // Validation: Check that P1_1 has segments to process
  const totalSegments = p1_1_data.segmented_utterances.reduce((sum, utt) => sum + utt.segments.length, 0);
  if (totalSegments === 0) {
    return {
      data: null,
      error: `P1.1 output contains no segments for transcript ${currentTranscript.id}. Cannot proceed with DU identification.`
    };
  }

  // Validation: Check IV/DV preservation from P1_1
  if (!p1_1_data.independent_variable_details || !Array.isArray(p1_1_data.dependent_variable_focus)) {
    return {
      data: null,
      error: `P1.1 output missing IV/DV details for transcript ${currentTranscript.id}. Cannot preserve variables for P1_2.`
    };
  }

  // Success: Return P1_1 output as P1_2 input (exact copy from prototype)
  console.log(`[P1_2 getInput] Successfully prepared input for transcript: ${p1_1_data.transcript_id}`);
  console.log(`[P1_2 getInput] Total segmented utterances: ${p1_1_data.segmented_utterances.length}`);
  console.log(`[P1_2 getInput] Total segments to group: ${totalSegments}`);
  console.log(`[P1_2 getInput] IV details available: ${!!p1_1_data.independent_variable_details}`);
  console.log(`[P1_2 getInput] DV focus count: ${p1_1_data.dependent_variable_focus.length}`);

  const input: P1_2_Input = {
    transcript_id: p1_1_data.transcript_id,
    segmented_utterances: p1_1_data.segmented_utterances,
    independent_variable_details: p1_1_data.independent_variable_details,
    dependent_variable_focus: p1_1_data.dependent_variable_focus,
  };

  return {
    data: input
  };
};