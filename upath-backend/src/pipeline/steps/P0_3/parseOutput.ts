/**
 * P0_3 Select Procedural Utterances - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P0_3_Output, SelectedUtterance } from './types';
import { getErrorMessage } from '../../../types/errors';

/**
 * Parse and validate JSON output for P0_3 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P0_3_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P0_3 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError: unknown) {
      console.error(`[P0_3 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${getErrorMessage(parseError)}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!Array.isArray(parsedData.selected_procedural_utterances)) {
      validationErrors.push('Missing or invalid selected_procedural_utterances array');
    } else {
      // Validate selected_procedural_utterances array structure
      if (parsedData.selected_procedural_utterances.length === 0) {
        validationErrors.push('selected_procedural_utterances cannot be empty');
      } else {
        // Validate each SelectedUtterance object
        parsedData.selected_procedural_utterances.forEach((utterance: any, index: number) => {
          const utteranceErrors: string[] = [];

          if (!utterance.original_line_num || typeof utterance.original_line_num !== 'string') {
            utteranceErrors.push(`original_line_num must be a non-empty string`);
          }

          if (!utterance.utterance_text || typeof utterance.utterance_text !== 'string') {
            utteranceErrors.push(`utterance_text must be a non-empty string`);
          }

          if (utterance.selection_justification !== undefined && 
              utterance.selection_justification !== null && 
              typeof utterance.selection_justification !== 'string') {
            utteranceErrors.push(`selection_justification must be a string or undefined`);
          }

          if (utteranceErrors.length > 0) {
            validationErrors.push(`Utterance ${index + 1}: ${utteranceErrors.join(', ')}`);
          }
        });

        // Validate line number format (should be numbers or "X.Y" format)
        const invalidLineNums = parsedData.selected_procedural_utterances.filter((utterance: any) => {
          const lineNum = utterance.original_line_num;
          // Accept formats like "5", "23.1", "23.2", etc.
          return !/^\d+(\.\d+)?$/.test(lineNum);
        });

        if (invalidLineNums.length > 0) {
          validationErrors.push(`Invalid line number format in utterances. Expected format: "5" or "5.1"`);
        }
      }
    }

    if (parsedData.discarded_info_summary !== undefined && 
        parsedData.discarded_info_summary !== null && 
        typeof parsedData.discarded_info_summary !== 'string') {
      validationErrors.push('discarded_info_summary must be a string, null, or undefined');
    }

    if (!parsedData.independent_variable_details || typeof parsedData.independent_variable_details !== 'string') {
      validationErrors.push('Missing or invalid independent_variable_details');
    }

    if (!Array.isArray(parsedData.dependent_variable_focus)) {
      validationErrors.push('Missing or invalid dependent_variable_focus array');
    } else {
      // Validate dependent_variable_focus items are strings
      const invalidDvItems = parsedData.dependent_variable_focus.filter((item: any) => typeof item !== 'string');
      if (invalidDvItems.length > 0) {
        validationErrors.push('dependent_variable_focus must contain only strings');
      }
      if (parsedData.dependent_variable_focus.length === 0) {
        validationErrors.push('dependent_variable_focus cannot be empty');
      }
    }

    if (validationErrors.length > 0) {
      console.error(`[P0_3 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const selectedUtterances: SelectedUtterance[] = parsedData.selected_procedural_utterances.map((utterance: any) => ({
      original_line_num: utterance.original_line_num.trim(),
      utterance_text: utterance.utterance_text.trim(),
      selection_justification: utterance.selection_justification ? utterance.selection_justification.trim() : undefined,
    }));

    const output: P0_3_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      selected_procedural_utterances: selectedUtterances,
      discarded_info_summary: parsedData.discarded_info_summary ? parsedData.discarded_info_summary.trim() : undefined,
      independent_variable_details: parsedData.independent_variable_details.trim(),
      dependent_variable_focus: parsedData.dependent_variable_focus.map((item: string) => item.trim()),
    };

    // Additional content validation (matches prototype quality checks)
    const totalUtterances = output.selected_procedural_utterances.length;
    if (totalUtterances < 1) {
      throw new Error('selected_procedural_utterances must contain at least one utterance');
    }

    // Check for reasonable selection criteria
    const utterancesWithJustification = output.selected_procedural_utterances.filter(u => u.selection_justification).length;
    
    console.log(`[P0_3 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);
    console.log(`[P0_3 parseOutput] Selected utterances: ${totalUtterances}`);
    console.log(`[P0_3 parseOutput] Utterances with justification: ${utterancesWithJustification}/${totalUtterances}`);
    console.log(`[P0_3 parseOutput] Preserved IV details: ${!!output.independent_variable_details}`);
    console.log(`[P0_3 parseOutput] Preserved DV focus count: ${output.dependent_variable_focus.length}`);

    return output;

  } catch (error: unknown) {
    console.error(`[P0_3 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${getErrorMessage(error)}`);
  }
};