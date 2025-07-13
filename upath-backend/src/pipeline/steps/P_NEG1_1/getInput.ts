/**
 * P_NEG1_1 Variable Identification - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P_NEG1_1_Input } from './types';

/**
 * Prepare input data for P_NEG1_1 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, userDvFocus } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P_NEG1_1 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id, 
      contentLength: currentTranscript.content?.length 
    } : null
  );
  console.log(`[P_NEG1_1 getInput] userDvFocus:`, userDvFocus);

  // Validation (exactly matches prototype logic)
  if (!currentTranscript?.content || !userDvFocus?.dv_focus || userDvFocus.dv_focus.length === 0) {
    console.error(`[P_NEG1_1 getInput] Validation failed - transcript content: ${!!currentTranscript?.content}, userDvFocus exists: ${!!userDvFocus}, dv_focus exists: ${!!userDvFocus?.dv_focus}, dv_focus length: ${userDvFocus?.dv_focus?.length || 0}`);
    return { 
      data: null, 
      error: "Missing transcript content or DV focus for P-1.1." 
    };
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P_NEG1_1_Input = {
    filename_or_id: currentTranscript.filename || currentTranscript.id,
    raw_transcript_text_from_file: currentTranscript.content,
    dependent_variable_focus_list: userDvFocus.dv_focus,
  };

  return {
    data: inputData,
  };
}