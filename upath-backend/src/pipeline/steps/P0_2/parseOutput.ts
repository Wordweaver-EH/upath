/**
 * P0_2 Refine Data Types - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P0_2_Output, RefinedLine } from './types';

/**
 * Parse and validate JSON output for P0_2 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P0_2_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P0_2 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError) {
      console.error(`[P0_2 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${parseError.message}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!Array.isArray(parsedData.refined_data_transcript)) {
      validationErrors.push('Missing or invalid refined_data_transcript array');
    } else {
      // Validate refined_data_transcript array structure
      if (parsedData.refined_data_transcript.length === 0) {
        validationErrors.push('refined_data_transcript cannot be empty');
      } else {
        // Validate each RefinedLine object
        parsedData.refined_data_transcript.forEach((line: any, index: number) => {
          const lineErrors: string[] = [];

          if (typeof line.line_num !== 'number' || line.line_num < 1) {
            lineErrors.push(`line_num must be a positive number`);
          }

          if (!line.text || typeof line.text !== 'string') {
            lineErrors.push(`text must be a non-empty string`);
          }

          if (!Array.isArray(line.information_tags)) {
            lineErrors.push(`information_tags must be an array`);
          } else {
            // Validate information_tags values
            const validTags = ['procedural_information', 'experiential_content', 'ambiguous_or_mixed'];
            const invalidTags = line.information_tags.filter((tag: any) => 
              typeof tag !== 'string' || !validTags.includes(tag)
            );
            if (invalidTags.length > 0) {
              lineErrors.push(`information_tags must contain only valid tags: ${validTags.join(', ')}`);
            }
            if (line.information_tags.length === 0) {
              lineErrors.push(`information_tags cannot be empty`);
            }
          }

          if (line.decision_notes !== null && line.decision_notes !== undefined && typeof line.decision_notes !== 'string') {
            lineErrors.push(`decision_notes must be a string or null`);
          }

          if (lineErrors.length > 0) {
            validationErrors.push(`Line ${index + 1}: ${lineErrors.join(', ')}`);
          }
        });

        // Validate line numbering sequence
        const lineNumbers = parsedData.refined_data_transcript.map((line: any) => line.line_num);
        const expectedNumbers = Array.from({ length: lineNumbers.length }, (_, i) => i + 1);
        const missingNumbers = expectedNumbers.filter(num => !lineNumbers.includes(num));
        const duplicateNumbers = lineNumbers.filter((num: number, index: number) => lineNumbers.indexOf(num) !== index);

        if (missingNumbers.length > 0) {
          validationErrors.push(`Missing line numbers: ${missingNumbers.join(', ')}`);
        }
        if (duplicateNumbers.length > 0) {
          validationErrors.push(`Duplicate line numbers: ${duplicateNumbers.join(', ')}`);
        }
      }
    }

    if (validationErrors.length > 0) {
      console.error(`[P0_2 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const refinedLines: RefinedLine[] = parsedData.refined_data_transcript.map((line: any) => ({
      line_num: line.line_num,
      text: line.text.trim(),
      information_tags: line.information_tags.map((tag: string) => tag.trim()),
      decision_notes: line.decision_notes ? line.decision_notes.trim() : undefined,
    }));

    const output: P0_2_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      refined_data_transcript: refinedLines,
    };

    // Additional content validation (matches prototype quality checks)
    const totalLines = output.refined_data_transcript.length;
    if (totalLines < 1) {
      throw new Error('refined_data_transcript must contain at least one line');
    }

    // Check for reasonable tag distribution
    const tagCounts = {
      procedural_information: 0,
      experiential_content: 0,
      ambiguous_or_mixed: 0,
    };

    output.refined_data_transcript.forEach(line => {
      line.information_tags.forEach(tag => {
        if (tag in tagCounts) {
          tagCounts[tag as keyof typeof tagCounts]++;
        }
      });
    });

    console.log(`[P0_2 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);
    console.log(`[P0_2 parseOutput] Lines processed: ${totalLines}`);
    console.log(`[P0_2 parseOutput] Tag distribution:`, tagCounts);

    return output;

  } catch (error) {
    console.error(`[P0_2 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${error.message}`);
  }
};