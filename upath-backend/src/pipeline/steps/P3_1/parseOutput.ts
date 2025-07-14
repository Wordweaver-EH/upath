/**
 * P3_1 Align Structures - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P3_1_Output } from './types';

/**
 * Parse and validate output for P3_1 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P3_1_Output => {
  console.log(`[P3_1 parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!rawOutput.aligned_structures_report) {
    throw new Error('P3_1 output missing required field: aligned_structures_report');
  }

  if (!rawOutput.common_patterns_summary) {
    throw new Error('P3_1 output missing required field: common_patterns_summary');
  }

  if (!Array.isArray(rawOutput.key_differences)) {
    throw new Error('P3_1 output field key_differences must be an array');
  }

  if (!Array.isArray(rawOutput.dependent_variable_focus)) {
    throw new Error('P3_1 output field dependent_variable_focus must be an array');
  }

  // Return validated and structured output (matches prototype structure)
  const validatedOutput: P3_1_Output = {
    aligned_structures_report: rawOutput.aligned_structures_report,
    common_patterns_summary: rawOutput.common_patterns_summary,
    key_differences: rawOutput.key_differences,
    dependent_variable_focus: rawOutput.dependent_variable_focus,
  };

  console.log(`[P3_1 parseOutput] Successfully validated output with ${validatedOutput.key_differences.length} key differences identified`);

  return validatedOutput;
};