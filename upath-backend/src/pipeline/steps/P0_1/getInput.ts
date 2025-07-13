/**
 * P0_1 Transcription Adherence - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P0_1_Input } from './types';

/**
 * Prepare input data for P0_1 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P0_1 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id, 
      contentLength: currentTranscript.content?.length 
    } : null
  );

  // Validation (exactly matches prototype logic)
  if (!currentTranscript?.content) {
    console.error(`[P0_1 getInput] Validation failed - transcript content: ${!!currentTranscript?.content}`);
    return { 
      data: null, 
      error: "Missing transcript content for P0.1." 
    };
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P0_1_Input = {
    filename_or_id: currentTranscript.filename || currentTranscript.id,
    raw_transcript_text_from_file: currentTranscript.content,
  };

  return {
    data: inputData,
  };
}