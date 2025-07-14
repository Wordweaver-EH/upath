/**
 * P3_2 Identify Generic Diachronic Units - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P3_2_Input, RefinedDusWithMetadata } from './types';

/**
 * Prepare input data for P3_2 step (original approach)
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { processedData, userDvFocus, apiKeyPresent, genericState } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P3_2 getInput] Processing ${processedData.size} transcripts`);
  console.log(`[P3_2 getInput] API key present:`, apiKeyPresent);
  console.log(`[P3_2 getInput] User DV focus:`, userDvFocus);
  console.log(`[P3_2 getInput] Generic state keys:`, Object.keys(genericState || {}));

  // Validation (exactly matches prototype logic)
  if (!apiKeyPresent) {
    console.error(`[P3_2 getInput] Validation failed - API key not present`);
    return { 
      data: null, 
      error: "API key required for P3.2 analysis." 
    };
  }

  if (!processedData || processedData.size === 0) {
    console.error(`[P3_2 getInput] Validation failed - no processed data available`);
    return { 
      data: null, 
      error: "No processed transcript data available for P3.2." 
    };
  }

  // Check for P3.1 output (dependency requirement)
  if (!genericState?.p3_1_output) {
    console.error(`[P3_2 getInput] Validation failed - P3.1 output not available`);
    return { 
      data: null, 
      error: "P3.1 output required for P3.2 analysis. Please run P3.1 first." 
    };
  }

  // Collect all P1_3 outputs (Refined Diachronic Units)
  const allRefinedDusWithMetadata: RefinedDusWithMetadata[] = [];
  let totalRdus = 0;

  for (const [transcriptId, transcriptData] of processedData) {
    const p1_3_output = transcriptData.p1_3_output;

    if (p1_3_output && p1_3_output.refined_diachronic_units) {
      // Construct refined DUs metadata (matches prototype collection logic)
      const refinedDusData: RefinedDusWithMetadata = {
        transcript_id: transcriptId,
        filename: transcriptData.filename || transcriptId, // Use filename if available, fallback to ID
        independent_variable_details: p1_3_output.independent_variable_details || 'Not specified',
        refined_diachronic_units: p1_3_output.refined_diachronic_units,
      };

      allRefinedDusWithMetadata.push(refinedDusData);
      totalRdus += p1_3_output.refined_diachronic_units.length;
      console.log(`[P3_2 getInput] Collected ${p1_3_output.refined_diachronic_units.length} refined DUs for transcript ${transcriptId}`);
    } else {
      console.warn(`[P3_2 getInput] No P1.3 output found for transcript ${transcriptId}`);
    }
  }

  // Validation: Must have refined DUs to cluster
  if (allRefinedDusWithMetadata.length === 0) {
    console.error(`[P3_2 getInput] No P1.3 outputs found in any transcript`);
    return { 
      data: null, 
      error: "No P1.3 outputs found for GDU identification." 
    };
  }

  if (totalRdus === 0) {
    console.error(`[P3_2 getInput] No refined diachronic units found`);
    return { 
      data: null, 
      error: "No refined diachronic units found for clustering into GDUs." 
    };
  }

  // Prepare input data (exactly matches prototype structure for original approach)
  const inputData: P3_2_Input = {
    p3_1_output: genericState.p3_1_output,
    all_refined_dus_with_iv_and_ids: allRefinedDusWithMetadata,
    global_dv_focus: userDvFocus?.dv_focus || [],
    tot_rdus: totalRdus,
  };

  console.log(`[P3_2 getInput] Successfully prepared input with ${allRefinedDusWithMetadata.length} transcript(s) and ${totalRdus} total refined DUs`);

  return {
    data: inputData,
  };
}