/**
 * P1_2 Diachronic Unit Identification - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P1_2_Output, DiachronicUnitP1_2 } from './types';

/**
 * Parse and validate JSON output for P1_2 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P1_2_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P1_2 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError) {
      console.error(`[P1_2 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${parseError.message}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!Array.isArray(parsedData.diachronic_units)) {
      validationErrors.push('Missing or invalid diachronic_units array');
    } else {
      // Validate diachronic_units array structure
      if (parsedData.diachronic_units.length === 0) {
        validationErrors.push('diachronic_units cannot be empty');
      } else {
        // Validate each DiachronicUnitP1_2 object
        parsedData.diachronic_units.forEach((du: any, index: number) => {
          const duErrors: string[] = [];

          if (!du.unit_id || typeof du.unit_id !== 'string') {
            duErrors.push('unit_id must be a non-empty string');
          } else {
            // Validate unit_id format (should be like "du_1", "du_2")
            if (!/^du_\d+$/.test(du.unit_id)) {
              duErrors.push('unit_id must follow format "du_N" where N is a number');
            }
          }

          if (!du.description || typeof du.description !== 'string') {
            duErrors.push('description must be a non-empty string');
          }

          if (!Array.isArray(du.source_segment_ids)) {
            duErrors.push('source_segment_ids must be an array');
          } else {
            if (du.source_segment_ids.length === 0) {
              duErrors.push('source_segment_ids cannot be empty');
            } else {
              // Validate segment_id format (should be like "utt_X_seg_Y")
              const invalidSegmentIds = du.source_segment_ids.filter((segId: any) => 
                typeof segId !== 'string' || !/^utt_.+_seg_\d+$/.test(segId)
              );
              if (invalidSegmentIds.length > 0) {
                duErrors.push(`Invalid source_segment_ids format: ${invalidSegmentIds.join(', ')}`);
              }
            }
          }

          if (duErrors.length > 0) {
            validationErrors.push(`Diachronic unit ${index + 1} (${du.unit_id || 'unknown'}): ${duErrors.join('; ')}`);
          }
        });

        // Validate unit_id uniqueness
        const unitIds = parsedData.diachronic_units.map((du: any) => du.unit_id);
        const duplicateIds = unitIds.filter((id: string, idx: number) => unitIds.indexOf(id) !== idx);
        if (duplicateIds.length > 0) {
          validationErrors.push(`Duplicate unit_ids: ${duplicateIds.join(', ')}`);
        }

        // Validate segment_id uniqueness across all DUs
        const allSegmentIds: string[] = [];
        parsedData.diachronic_units.forEach((du: any) => {
          if (Array.isArray(du.source_segment_ids)) {
            allSegmentIds.push(...du.source_segment_ids);
          }
        });
        const duplicateSegmentIds = allSegmentIds.filter((id: string, idx: number) => allSegmentIds.indexOf(id) !== idx);
        if (duplicateSegmentIds.length > 0) {
          validationErrors.push(`Segments assigned to multiple DUs: ${duplicateSegmentIds.join(', ')}`);
        }
      }
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
      console.error(`[P1_2 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const diachronicUnits: DiachronicUnitP1_2[] = parsedData.diachronic_units.map((du: any) => ({
      unit_id: du.unit_id.trim(),
      description: du.description.trim(),
      source_segment_ids: du.source_segment_ids.map((segId: string) => segId.trim()),
    }));

    const output: P1_2_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      diachronic_units: diachronicUnits,
      independent_variable_details: parsedData.independent_variable_details.trim(),
      dependent_variable_focus: parsedData.dependent_variable_focus.map((item: string) => item.trim()),
    };

    // Additional content validation (matches prototype quality checks)
    const totalDUs = output.diachronic_units.length;
    const totalSegmentsGrouped = output.diachronic_units.reduce((sum, du) => sum + du.source_segment_ids.length, 0);
    
    if (totalDUs < 1) {
      throw new Error('diachronic_units must contain at least one unit');
    }

    if (totalSegmentsGrouped < 1) {
      throw new Error('must have at least one segment grouped into DUs');
    }

    // Check for reasonable DU count (should group segments, not create 1:1 mapping)
    if (totalDUs > totalSegmentsGrouped) {
      throw new Error('More diachronic units than segments - DUs should group multiple segments');
    }

    console.log(`[P1_2 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);
    console.log(`[P1_2 parseOutput] Diachronic units created: ${totalDUs}`);
    console.log(`[P1_2 parseOutput] Total segments grouped: ${totalSegmentsGrouped}`);
    console.log(`[P1_2 parseOutput] Average segments per DU: ${(totalSegmentsGrouped / totalDUs).toFixed(1)}`);
    console.log(`[P1_2 parseOutput] Preserved IV details: ${!!output.independent_variable_details}`);
    console.log(`[P1_2 parseOutput] Preserved DV focus count: ${output.dependent_variable_focus.length}`);

    return output;

  } catch (error) {
    console.error(`[P1_2 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${error.message}`);
  }
};