/**
 * P3_3 Define Generic Diachronic Structure - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P3_3_Input } from './types';

/**
 * Prepare input data for P3_3 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { userDvFocus, apiKeyPresent, genericState } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P3_3 getInput] API key present:`, apiKeyPresent);
  console.log(`[P3_3 getInput] User DV focus:`, userDvFocus);
  console.log(`[P3_3 getInput] Generic state keys:`, Object.keys(genericState || {}));

  // Validation (exactly matches prototype logic)
  if (!apiKeyPresent) {
    console.error(`[P3_3 getInput] Validation failed - API key not present`);
    return { 
      data: null, 
      error: "API key required for P3.3 analysis." 
    };
  }

  // Check for P3.1 output (dependency requirement)
  if (!genericState?.p3_1_output) {
    console.error(`[P3_3 getInput] Validation failed - P3.1 output not available`);
    return { 
      data: null, 
      error: "P3.1 output required for P3.3 analysis. Please run P3.1 first." 
    };
  }

  // Check for P3.2 output (dependency requirement)
  if (!genericState?.p3_2_output) {
    console.error(`[P3_3 getInput] Validation failed - P3.2 output not available`);
    return { 
      data: null, 
      error: "P3.2 output required for P3.3 analysis. Please run P3.2 first." 
    };
  }

  // Validate P3.2 output has identified GDUs
  if (!genericState.p3_2_output.identified_gdus || genericState.p3_2_output.identified_gdus.length === 0) {
    console.error(`[P3_3 getInput] Validation failed - no GDUs identified in P3.2`);
    return { 
      data: null, 
      error: "No GDUs found in P3.2 output for Generic Diachronic Structure definition." 
    };
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P3_3_Input = {
    p3_1_output: genericState.p3_1_output,
    p3_2_output: genericState.p3_2_output,
    global_dv_focus: userDvFocus?.dv_focus || [],
  };

  console.log(`[P3_3 getInput] Successfully prepared input with ${genericState.p3_2_output.identified_gdus.length} GDUs from P3.2`);

  return {
    data: inputData,
  };
}