/**
 * P1_4 Construct Specific Diachronic Structure - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { GetInputFunction, StepInputParams, StepInputResult } from '../../core/interfaces';
import { P1_4_Input } from './types';
import { P1_3_Output } from '../P1_3/types';

/**
 * Get input data for P1_4 step
 * Retrieves P1_3_Output from transcript processed data
 * Exactly matches the prototype's dependency resolution pattern
 */
export const getInput: GetInputFunction = (params: StepInputParams): StepInputResult => {
  const { currentTranscript, processedData } = params;
  const transcriptProcessedData = processedData?.get(currentTranscript.id);

  // Debug logging (matches prototype pattern)
  console.log(`[P1_4 getInput] Processing transcript: ${currentTranscript?.id || 'unknown'}`);
  console.log(`[P1_4 getInput] Available processed data keys: ${Object.keys(transcriptProcessedData || {}).join(', ')}`);

  // Validation: Check if transcript exists
  if (!currentTranscript) {
    return {
      data: null,
      error: 'No transcript provided for P1_4 processing'
    };
  }

  // Validation: Check if P1_3 output exists (required dependency)
  const p1_3_data = transcriptProcessedData?.p1_3_output as P1_3_Output;
  if (!p1_3_data) {
    return {
      data: null,
      error: `Missing P1.3 output for transcript ${currentTranscript.id}. P1_4 requires P1_3_REFINE_DIACHRONIC_UNITS to be completed first.`
    };
  }

  // Validation: Check P1_3 data structure (exactly matches prototype validation)
  if (!p1_3_data.transcript_id || !Array.isArray(p1_3_data.refined_diachronic_units)) {
    return {
      data: null,
      error: `Invalid P1.3 output structure for transcript ${currentTranscript.id}. Missing transcript_id or refined_diachronic_units.`
    };
  }

  // Validation: Check that P1_3 has refined DUs to construct structure from
  if (p1_3_data.refined_diachronic_units.length === 0) {
    return {
      data: null,
      error: `P1.3 output contains no refined diachronic units for transcript ${currentTranscript.id}. Cannot proceed with SDS construction.`
    };
  }

  // Validation: Check IV/DV preservation from P1_3
  if (!p1_3_data.independent_variable_details || !Array.isArray(p1_3_data.dependent_variable_focus)) {
    return {
      data: null,
      error: `P1.3 output missing IV/DV details for transcript ${currentTranscript.id}. Cannot preserve variables for P1_4.`
    };
  }

  // Validation: Check refined DU structure integrity
  const invalidRDUs = p1_3_data.refined_diachronic_units.filter(rdu => 
    !rdu.unit_id || 
    !rdu.description || 
    !rdu.temporal_phase || 
    !Array.isArray(rdu.source_p1_2_du_ids) || 
    rdu.source_p1_2_du_ids.length === 0 ||
    typeof rdu.confidence !== 'number' ||
    rdu.confidence < 0.0 || rdu.confidence > 1.0
  );
  if (invalidRDUs.length > 0) {
    return {
      data: null,
      error: `P1.3 output contains ${invalidRDUs.length} invalid refined DU(s) for transcript ${currentTranscript.id}. RDUs must have unit_id, description, temporal_phase, source_p1_2_du_ids, and valid confidence.`
    };
  }

  // Analyze temporal phase distribution for structure construction
  const phaseDistribution: { [key: string]: number } = {};
  p1_3_data.refined_diachronic_units.forEach(rdu => {
    phaseDistribution[rdu.temporal_phase] = (phaseDistribution[rdu.temporal_phase] || 0) + 1;
  });

  // Success: Return P1_3 output as P1_4 input (exact copy from prototype)
  const totalRefinedDUs = p1_3_data.refined_diachronic_units.length;
  const totalPhases = Object.keys(phaseDistribution).length;

  console.log(`[P1_4 getInput] Successfully prepared input for transcript: ${p1_3_data.transcript_id}`);
  console.log(`[P1_4 getInput] Refined diachronic units to structure: ${totalRefinedDUs}`);
  console.log(`[P1_4 getInput] Temporal phases identified: ${totalPhases}`);
  console.log(`[P1_4 getInput] Phase distribution:`, JSON.stringify(phaseDistribution));
  console.log(`[P1_4 getInput] IV details available: ${!!p1_3_data.independent_variable_details}`);
  console.log(`[P1_4 getInput] DV focus count: ${p1_3_data.dependent_variable_focus.length}`);

  const input: P1_4_Input = {
    transcript_id: p1_3_data.transcript_id,
    refined_diachronic_units: p1_3_data.refined_diachronic_units,
    independent_variable_details: p1_3_data.independent_variable_details,
    dependent_variable_focus: p1_3_data.dependent_variable_focus,
  };

  return {
    data: input
  };
};