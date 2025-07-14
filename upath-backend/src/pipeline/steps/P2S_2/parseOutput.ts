/**
 * P2S_2 Identify Specific Synchronic Units - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P2S_2_Output } from './types';

/**
 * Parse and validate output for P2S_2 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P2S_2_Output => {
  console.log(`[P2S_2 parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!rawOutput.transcript_id) {
    throw new Error('P2S_2 output missing required field: transcript_id');
  }

  if (!rawOutput.analyzed_diachronic_unit) {
    throw new Error('P2S_2 output missing required field: analyzed_diachronic_unit');
  }

  if (!Array.isArray(rawOutput.specific_synchronic_units_hierarchy)) {
    throw new Error('P2S_2 output field specific_synchronic_units_hierarchy must be an array');
  }

  if (!rawOutput.independent_variable_details) {
    throw new Error('P2S_2 output missing required field: independent_variable_details');
  }

  if (!Array.isArray(rawOutput.dependent_variable_focus)) {
    throw new Error('P2S_2 output field dependent_variable_focus must be an array');
  }

  // Validate specific_synchronic_units_hierarchy structure
  for (let i = 0; i < rawOutput.specific_synchronic_units_hierarchy.length; i++) {
    const isu = rawOutput.specific_synchronic_units_hierarchy[i];
    
    if (!isu.unit_name) {
      throw new Error(`P2S_2 specific_synchronic_units_hierarchy[${i}] missing required field: unit_name`);
    }

    if (typeof isu.level !== 'number') {
      throw new Error(`P2S_2 specific_synchronic_units_hierarchy[${i}] field 'level' must be a number`);
    }

    if (!isu.abstraction_op) {
      throw new Error(`P2S_2 specific_synchronic_units_hierarchy[${i}] missing required field: abstraction_op`);
    }

    if (!isu.intensional_definition) {
      throw new Error(`P2S_2 specific_synchronic_units_hierarchy[${i}] missing required field: intensional_definition`);
    }

    // Validate Level 0 ISU requirements
    if (isu.level === 0) {
      if (!Array.isArray(isu.utterances) || isu.utterances.length === 0) {
        throw new Error(`P2S_2 Level 0 ISU '${isu.unit_name}' must have non-empty utterances array`);
      }

      // Validate utterances structure
      for (let j = 0; j < isu.utterances.length; j++) {
        const utterance = isu.utterances[j];
        
        if (!utterance.original_line_num) {
          throw new Error(`P2S_2 ISU '${isu.unit_name}' utterances[${j}] missing required field: original_line_num`);
        }

        if (!utterance.utterance_text) {
          throw new Error(`P2S_2 ISU '${isu.unit_name}' utterances[${j}] missing required field: utterance_text`);
        }
      }
    }

    // Validate Level > 0 ISU requirements
    if (isu.level > 0) {
      if (!Array.isArray(isu.constituent_lower_units) || isu.constituent_lower_units.length === 0) {
        throw new Error(`P2S_2 Level ${isu.level} ISU '${isu.unit_name}' must have non-empty constituent_lower_units array`);
      }
    }
  }

  // Return validated and structured output (matches prototype structure)
  const validatedOutput: P2S_2_Output = {
    transcript_id: rawOutput.transcript_id,
    analyzed_diachronic_unit: rawOutput.analyzed_diachronic_unit,
    specific_synchronic_units_hierarchy: rawOutput.specific_synchronic_units_hierarchy.map((isu: any) => ({
      unit_name: isu.unit_name,
      level: isu.level,
      abstraction_op: isu.abstraction_op,
      intensional_definition: isu.intensional_definition,
      ...(isu.utterances && { utterances: isu.utterances }),
      ...(isu.constituent_lower_units && { constituent_lower_units: isu.constituent_lower_units }),
    })),
    independent_variable_details: rawOutput.independent_variable_details,
    dependent_variable_focus: rawOutput.dependent_variable_focus,
  };

  console.log(`[P2S_2 parseOutput] Successfully validated output with ${validatedOutput.specific_synchronic_units_hierarchy.length} ISUs`);

  return validatedOutput;
};