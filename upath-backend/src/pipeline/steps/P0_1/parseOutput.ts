/**
 * P0_1 Transcription Adherence - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P0_1_Output } from './types';

/**
 * Parse and validate JSON output for P0_1 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P0_1_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P0_1 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError) {
      console.error(`[P0_1 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${parseError.message}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!Array.isArray(parsedData.line_numbered_transcript)) {
      validationErrors.push('Missing or invalid line_numbered_transcript array');
    } else {
      // Validate each item in line_numbered_transcript is a string
      const invalidItems = parsedData.line_numbered_transcript.filter((item: any) => typeof item !== 'string');
      if (invalidItems.length > 0) {
        validationErrors.push('line_numbered_transcript must contain only strings');
      }
      
      // Validate that we have at least one line
      if (parsedData.line_numbered_transcript.length === 0) {
        validationErrors.push('line_numbered_transcript cannot be empty');
      }
    }

    if (!parsedData.transcription_convention_notes || typeof parsedData.transcription_convention_notes !== 'string') {
      validationErrors.push('Missing or invalid transcription_convention_notes');
    }

    if (!parsedData.initial_impressions_log || typeof parsedData.initial_impressions_log !== 'string') {
      validationErrors.push('Missing or invalid initial_impressions_log');
    }

    if (validationErrors.length > 0) {
      console.error(`[P0_1 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const output: P0_1_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      line_numbered_transcript: parsedData.line_numbered_transcript.map((line: string) => line.trim()),
      transcription_convention_notes: parsedData.transcription_convention_notes.trim(),
      initial_impressions_log: parsedData.initial_impressions_log.trim(),
    };

    // Additional content validation (matches prototype quality checks)
    if (output.transcription_convention_notes.length < 5) {
      throw new Error('transcription_convention_notes is too short (minimum 5 characters)');
    }

    if (output.initial_impressions_log.length < 5) {
      throw new Error('initial_impressions_log is too short (minimum 5 characters)');
    }

    // Validate line numbering format (check that lines start with numbers)
    const invalidLines = output.line_numbered_transcript.filter((line, index) => {
      const expectedLineNumber = index + 1;
      const lineNumberRegex = new RegExp(`^${expectedLineNumber}:\\s`);
      return !lineNumberRegex.test(line);
    });

    if (invalidLines.length > 0) {
      console.warn(`[P0_1 parseOutput] Some lines may not follow expected numbering format. First few: ${invalidLines.slice(0, 3).join(', ')}`);
      // This is a warning, not an error - we'll accept the output but log the issue
    }

    console.log(`[P0_1 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id} with ${output.line_numbered_transcript.length} lines`);

    return output;

  } catch (error) {
    console.error(`[P0_1 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${error.message}`);
  }
};