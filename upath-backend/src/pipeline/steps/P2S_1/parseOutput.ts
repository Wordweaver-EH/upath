/**
 * P2S_1 Group Utterances by Topic - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P2S_1_Output } from './types';

/**
 * Parse and validate output for P2S_1 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P2S_1_Output => {
  console.log(`[P2S_1 parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!rawOutput.transcript_id) {
    throw new Error('P2S_1 output missing required field: transcript_id');
  }

  if (!rawOutput.analyzed_diachronic_unit) {
    throw new Error('P2S_1 output missing required field: analyzed_diachronic_unit');
  }

  if (!Array.isArray(rawOutput.synchronic_thematic_groups)) {
    throw new Error('P2S_1 output field synchronic_thematic_groups must be an array');
  }

  if (!rawOutput.independent_variable_details) {
    throw new Error('P2S_1 output missing required field: independent_variable_details');
  }

  if (!Array.isArray(rawOutput.dependent_variable_focus)) {
    throw new Error('P2S_1 output field dependent_variable_focus must be an array');
  }

  // Validate synchronic_thematic_groups structure
  for (let i = 0; i < rawOutput.synchronic_thematic_groups.length; i++) {
    const group = rawOutput.synchronic_thematic_groups[i];
    
    if (!group.group_label) {
      throw new Error(`P2S_1 synchronic_thematic_groups[${i}] missing required field: group_label`);
    }

    if (!group.justification) {
      throw new Error(`P2S_1 synchronic_thematic_groups[${i}] missing required field: justification`);
    }

    if (!Array.isArray(group.utterances)) {
      throw new Error(`P2S_1 synchronic_thematic_groups[${i}].utterances must be an array`);
    }

    // Validate utterances structure
    for (let j = 0; j < group.utterances.length; j++) {
      const utterance = group.utterances[j];
      
      if (!utterance.original_line_num) {
        throw new Error(`P2S_1 synchronic_thematic_groups[${i}].utterances[${j}] missing required field: original_line_num`);
      }

      if (!utterance.utterance_text) {
        throw new Error(`P2S_1 synchronic_thematic_groups[${i}].utterances[${j}] missing required field: utterance_text`);
      }
    }
  }

  // Return validated and structured output (matches prototype structure)
  const validatedOutput: P2S_1_Output = {
    transcript_id: rawOutput.transcript_id,
    analyzed_diachronic_unit: rawOutput.analyzed_diachronic_unit,
    synchronic_thematic_groups: rawOutput.synchronic_thematic_groups.map((group: any) => ({
      group_label: group.group_label,
      justification: group.justification,
      utterances: group.utterances.map((utterance: any) => ({
        original_line_num: utterance.original_line_num,
        utterance_text: utterance.utterance_text,
      })),
    })),
    independent_variable_details: rawOutput.independent_variable_details,
    dependent_variable_focus: rawOutput.dependent_variable_focus,
  };

  console.log(`[P2S_1 parseOutput] Successfully validated output with ${validatedOutput.synchronic_thematic_groups.length} thematic groups`);

  return validatedOutput;
};