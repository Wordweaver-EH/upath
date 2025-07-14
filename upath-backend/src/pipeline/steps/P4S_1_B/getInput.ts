/**
 * P4S_1_B Define GSS from Groups - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P4S_1_B_Input } from './types';

/**
 * Prepare input data for P4S_1_B step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { userDvFocus, apiKeyPresent, genericState, currentGduId } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P4S_1_B getInput] API key present:`, apiKeyPresent);
  console.log(`[P4S_1_B getInput] User DV focus:`, userDvFocus);
  console.log(`[P4S_1_B getInput] Current GDU ID:`, currentGduId);
  console.log(`[P4S_1_B getInput] Generic state keys:`, Object.keys(genericState || {}));

  // Validation (exactly matches prototype logic)
  if (!apiKeyPresent) {
    console.error(`[P4S_1_B getInput] Validation failed - API key not present`);
    return { 
      data: null, 
      error: "API key required for P4S.1B analysis." 
    };
  }

  // Check for current GDU to analyze
  if (!currentGduId) {
    console.error(`[P4S_1_B getInput] Validation failed - no current GDU specified`);
    return { 
      data: null, 
      error: "No current GDU specified for P4S.1B analysis." 
    };
  }

  // Check for P4S.1A output for the current GDU
  if (!genericState?.p4s_1_a_outputs_by_gdu) {
    console.error(`[P4S_1_B getInput] Validation failed - no P4S.1A outputs available`);
    return { 
      data: null, 
      error: "No P4S.1A outputs available for P4S.1B analysis." 
    };
  }

  const p4s_1_a_output = genericState.p4s_1_a_outputs_by_gdu[currentGduId];
  if (!p4s_1_a_output) {
    console.error(`[P4S_1_B getInput] Validation failed - no P4S.1A output for GDU ${currentGduId}`);
    return { 
      data: null, 
      error: `No P4S.1A output found for GDU ${currentGduId}. Please run P4S.1A first.` 
    };
  }

  // Validate P4S.1A output structure
  if (!p4s_1_a_output.sss_node_groups || p4s_1_a_output.sss_node_groups.length === 0) {
    console.error(`[P4S_1_B getInput] Validation failed - no SSS node groups in P4S.1A output for GDU ${currentGduId}`);
    return { 
      data: null, 
      error: `No SSS node groups found in P4S.1A output for GDU ${currentGduId}.` 
    };
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P4S_1_B_Input = {
    p4s_1_a_data: {
      analyzed_gdu: p4s_1_a_output.analyzed_gdu,
      sss_node_groups: p4s_1_a_output.sss_node_groups,
      dependent_variable_focus: p4s_1_a_output.dependent_variable_focus || [],
    },
    global_dv_focus: userDvFocus?.dv_focus || [],
  };

  console.log(`[P4S_1_B getInput] Successfully prepared input with ${p4s_1_a_output.sss_node_groups.length} SSS node groups for GDU ${currentGduId}`);

  return {
    data: inputData,
  };
}