/**
 * P1_3 Refine Diachronic Units - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { GetInputFunction, StepInputParams, StepInputResult } from '../../core/interfaces';
import { P1_3_Input } from './types';
import { P1_2_Output } from '../P1_2/types';

/**
 * Get input data for P1_3 step
 * Retrieves P1_2_Output from transcript processed data
 * Exactly matches the prototype's dependency resolution pattern
 */
export const getInput: GetInputFunction = (params: StepInputParams): StepInputResult => {
  const { currentTranscript, processedData } = params;
  const transcriptProcessedData = processedData?.get(currentTranscript.id);

  // Debug logging (matches prototype pattern)
  console.log(`[P1_3 getInput] Processing transcript: ${currentTranscript?.id || 'unknown'}`);
  console.log(`[P1_3 getInput] Available processed data keys: ${Object.keys(transcriptProcessedData || {}).join(', ')}`);

  // Validation: Check if transcript exists
  if (!currentTranscript) {
    return {
      data: null,
      error: 'No transcript provided for P1_3 processing'
    };
  }

  // Validation: Check if P1_2 output exists (required dependency)
  const p1_2_data = transcriptProcessedData?.p1_2_output as P1_2_Output;
  if (!p1_2_data) {
    return {
      data: null,
      error: `Missing P1.2 output for transcript ${currentTranscript.id}. P1_3 requires P1_2_DIACHRONIC_UNIT_ID to be completed first.`
    };
  }

  // Validation: Check P1_2 data structure (exactly matches prototype validation)
  if (!p1_2_data.transcript_id || !Array.isArray(p1_2_data.diachronic_units)) {
    return {
      data: null,
      error: `Invalid P1.2 output structure for transcript ${currentTranscript.id}. Missing transcript_id or diachronic_units.`
    };
  }

  // Validation: Check that P1_2 has DUs to refine
  if (p1_2_data.diachronic_units.length === 0) {
    return {
      data: null,
      error: `P1.2 output contains no diachronic units for transcript ${currentTranscript.id}. Cannot proceed with DU refinement.`
    };
  }

  // Validation: Check IV/DV preservation from P1_2
  if (!p1_2_data.independent_variable_details || !Array.isArray(p1_2_data.dependent_variable_focus)) {
    return {
      data: null,
      error: `P1.2 output missing IV/DV details for transcript ${currentTranscript.id}. Cannot preserve variables for P1_3.`
    };
  }

  // Validation: Check DU structure integrity
  const invalidDUs = p1_2_data.diachronic_units.filter(du => 
    !du.unit_id || !du.description || !Array.isArray(du.source_segment_ids) || du.source_segment_ids.length === 0
  );
  if (invalidDUs.length > 0) {
    return {
      data: null,
      error: `P1.2 output contains ${invalidDUs.length} invalid diachronic unit(s) for transcript ${currentTranscript.id}. DUs must have unit_id, description, and source_segment_ids.`
    };
  }

  // Success: Return P1_2 output as P1_3 input (exact copy from prototype)
  const totalDUs = p1_2_data.diachronic_units.length;
  const totalSegments = p1_2_data.diachronic_units.reduce((sum, du) => sum + du.source_segment_ids.length, 0);

  console.log(`[P1_3 getInput] Successfully prepared input for transcript: ${p1_2_data.transcript_id}`);
  console.log(`[P1_3 getInput] Diachronic units to refine: ${totalDUs}`);
  console.log(`[P1_3 getInput] Total segments in DUs: ${totalSegments}`);
  console.log(`[P1_3 getInput] IV details available: ${!!p1_2_data.independent_variable_details}`);
  console.log(`[P1_3 getInput] DV focus count: ${p1_2_data.dependent_variable_focus.length}`);

  const input: P1_3_Input = {
    transcript_id: p1_2_data.transcript_id,
    diachronic_units: p1_2_data.diachronic_units,
    independent_variable_details: p1_2_data.independent_variable_details,
    dependent_variable_focus: p1_2_data.dependent_variable_focus,
  };

  return {
    data: input
  };
};