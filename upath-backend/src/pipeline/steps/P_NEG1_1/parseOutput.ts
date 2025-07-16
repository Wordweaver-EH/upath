/**
 * P_NEG1_1 Variable Identification - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P_NEG1_1_Output } from './types';
import { getErrorMessage } from '../../../types/errors';

/**
 * Parse and validate JSON output for P_NEG1_1 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P_NEG1_1_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P_NEG1_1 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError: unknown) {
      console.error(`[P_NEG1_1 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${getErrorMessage(parseError)}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!parsedData.independent_variable_details || typeof parsedData.independent_variable_details !== 'string') {
      validationErrors.push('Missing or invalid independent_variable_details');
    }

    if (!Array.isArray(parsedData.dependent_variable_focus)) {
      validationErrors.push('Missing or invalid dependent_variable_focus array');
    } else {
      // Validate each item in dependent_variable_focus is a string
      const invalidItems = parsedData.dependent_variable_focus.filter((item: any) => typeof item !== 'string');
      if (invalidItems.length > 0) {
        validationErrors.push('dependent_variable_focus must contain only strings');
      }
    }

    // Validate optional discovered_variables array (for dynamic variable discovery)
    if (parsedData.discovered_variables !== undefined) {
      if (!Array.isArray(parsedData.discovered_variables)) {
        validationErrors.push('discovered_variables must be an array if present');
      } else {
        // Validate each discovered variable
        parsedData.discovered_variables.forEach((variable: any, index: number) => {
          if (typeof variable !== 'object' || variable === null) {
            validationErrors.push(`discovered_variables[${index}] must be an object`);
          } else {
            if (!variable.name || typeof variable.name !== 'string') {
              validationErrors.push(`discovered_variables[${index}].name must be a non-empty string`);
            }
            if (!variable.value || typeof variable.value !== 'string') {
              validationErrors.push(`discovered_variables[${index}].value must be a non-empty string`);
            }
            if (variable.confidence !== undefined && (typeof variable.confidence !== 'number' || variable.confidence < 0 || variable.confidence > 1)) {
              validationErrors.push(`discovered_variables[${index}].confidence must be a number between 0 and 1 if present`);
            }
          }
        });
      }
    }

    // Validate optional parsed_header field (for backward compatibility)
    if (parsedData.parsed_header !== undefined) {
      if (typeof parsedData.parsed_header !== 'object' || parsedData.parsed_header === null) {
        validationErrors.push('parsed_header must be an object if present');
      } else {
        const { iv_value, event_value, raw_header } = parsedData.parsed_header;
        
        if (!iv_value || typeof iv_value !== 'string') {
          validationErrors.push('parsed_header.iv_value must be a non-empty string');
        }
        
        if (!event_value || typeof event_value !== 'string') {
          validationErrors.push('parsed_header.event_value must be a non-empty string');
        }
        
        if (!raw_header || typeof raw_header !== 'string') {
          validationErrors.push('parsed_header.raw_header must be a non-empty string');
        }
      }
    }

    if (validationErrors.length > 0) {
      console.error(`[P_NEG1_1 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const output: P_NEG1_1_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      independent_variable_details: parsedData.independent_variable_details.trim(),
      dependent_variable_focus: parsedData.dependent_variable_focus.map((item: string) => item.trim()),
    };

    // Add discovered_variables if present (for dynamic variable discovery)
    if (parsedData.discovered_variables && Array.isArray(parsedData.discovered_variables)) {
      output.discovered_variables = parsedData.discovered_variables.map((variable: any) => ({
        name: variable.name.trim(),
        value: variable.value.trim(),
        confidence: variable.confidence !== undefined ? variable.confidence : undefined
      }));
    }

    // Add parsed_header if present (for backward compatibility)
    if (parsedData.parsed_header) {
      output.parsed_header = {
        iv_value: parsedData.parsed_header.iv_value.trim(),
        event_value: parsedData.parsed_header.event_value.trim(),
        raw_header: parsedData.parsed_header.raw_header.trim(),
      };
    }

    // Additional content validation (matches prototype quality checks)
    if (output.independent_variable_details.length < 20) {
      throw new Error('independent_variable_details is too short (minimum 20 characters)');
    }

    if (output.dependent_variable_focus.length === 0) {
      throw new Error('dependent_variable_focus cannot be empty');
    }

    console.log(`[P_NEG1_1 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);

    return output;

  } catch (error: unknown) {
    console.error(`[P_NEG1_1 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${getErrorMessage(error)}`);
  }
};