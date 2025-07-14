/**
 * P1_3 Refine Diachronic Units - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P1_3_Output, RefinedDiachronicUnitP1_3, isValidTemporalPhase } from './types';
import { getErrorMessage } from '../../../types/errors';

/**
 * Parse and validate JSON output for P1_3 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P1_3_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P1_3 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError: unknown) {
      console.error(`[P1_3 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${getErrorMessage(parseError)}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!Array.isArray(parsedData.refined_diachronic_units)) {
      validationErrors.push('Missing or invalid refined_diachronic_units array');
    } else {
      // Validate refined_diachronic_units array structure
      if (parsedData.refined_diachronic_units.length === 0) {
        validationErrors.push('refined_diachronic_units cannot be empty');
      } else {
        // Validate each RefinedDiachronicUnitP1_3 object
        parsedData.refined_diachronic_units.forEach((rdu: any, index: number) => {
          const rduErrors: string[] = [];

          if (!rdu.unit_id || typeof rdu.unit_id !== 'string') {
            rduErrors.push('unit_id must be a non-empty string');
          } else {
            // Validate unit_id format (should be like "rdu_1", "rdu_2")
            if (!/^rdu_\d+$/.test(rdu.unit_id)) {
              rduErrors.push('unit_id must follow format "rdu_N" where N is a number');
            }
          }

          if (!rdu.description || typeof rdu.description !== 'string') {
            rduErrors.push('description must be a non-empty string');
          }

          if (!Array.isArray(rdu.source_p1_2_du_ids)) {
            rduErrors.push('source_p1_2_du_ids must be an array');
          } else {
            if (rdu.source_p1_2_du_ids.length === 0) {
              rduErrors.push('source_p1_2_du_ids cannot be empty');
            } else {
              // Validate source DU ID format (should be like "du_1", "du_2")
              const invalidSourceIds = rdu.source_p1_2_du_ids.filter((duId: any) => 
                typeof duId !== 'string' || !/^du_\d+$/.test(duId)
              );
              if (invalidSourceIds.length > 0) {
                rduErrors.push(`Invalid source_p1_2_du_ids format: ${invalidSourceIds.join(', ')}`);
              }
            }
          }

          if (!rdu.temporal_phase || typeof rdu.temporal_phase !== 'string') {
            rduErrors.push('temporal_phase must be a non-empty string');
          } else {
            if (!isValidTemporalPhase(rdu.temporal_phase)) {
              rduErrors.push(`Invalid temporal_phase: "${rdu.temporal_phase}". Must be one of: Beginning, Early-Middle, Core Event, Late-Middle, Ending, Reflection, Transition, Other`);
            }
          }

          if (typeof rdu.confidence !== 'number') {
            rduErrors.push('confidence must be a number');
          } else {
            if (rdu.confidence < 0.0 || rdu.confidence > 1.0) {
              rduErrors.push('confidence must be between 0.0 and 1.0');
            }
          }

          if (rduErrors.length > 0) {
            validationErrors.push(`Refined DU ${index + 1} (${rdu.unit_id || 'unknown'}): ${rduErrors.join('; ')}`);
          }
        });

        // Validate unit_id uniqueness
        const unitIds = parsedData.refined_diachronic_units.map((rdu: any) => rdu.unit_id);
        const duplicateIds = unitIds.filter((id: string, idx: number) => unitIds.indexOf(id) !== idx);
        if (duplicateIds.length > 0) {
          validationErrors.push(`Duplicate unit_ids: ${duplicateIds.join(', ')}`);
        }

        // Validate source_p1_2_du_ids uniqueness (each P1.2 DU should only contribute to one refined DU)
        const allSourceIds: string[] = [];
        parsedData.refined_diachronic_units.forEach((rdu: any) => {
          if (Array.isArray(rdu.source_p1_2_du_ids)) {
            allSourceIds.push(...rdu.source_p1_2_du_ids);
          }
        });
        const duplicateSourceIds = allSourceIds.filter((id: string, idx: number) => allSourceIds.indexOf(id) !== idx);
        if (duplicateSourceIds.length > 0) {
          validationErrors.push(`P1.2 DUs assigned to multiple refined DUs: ${duplicateSourceIds.join(', ')}`);
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
      console.error(`[P1_3 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const refinedDiachronicUnits: RefinedDiachronicUnitP1_3[] = parsedData.refined_diachronic_units.map((rdu: any) => ({
      unit_id: rdu.unit_id.trim(),
      description: rdu.description.trim(),
      source_p1_2_du_ids: rdu.source_p1_2_du_ids.map((duId: string) => duId.trim()),
      temporal_phase: rdu.temporal_phase.trim(),
      confidence: Math.round(rdu.confidence * 100) / 100, // Round to 2 decimal places
    }));

    const output: P1_3_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      refined_diachronic_units: refinedDiachronicUnits,
      independent_variable_details: parsedData.independent_variable_details.trim(),
      dependent_variable_focus: parsedData.dependent_variable_focus.map((item: string) => item.trim()),
    };

    // Additional content validation (matches prototype quality checks)
    const totalRefinedDUs = output.refined_diachronic_units.length;
    const totalSourceDUs = output.refined_diachronic_units.reduce((sum, rdu) => sum + rdu.source_p1_2_du_ids.length, 0);
    
    if (totalRefinedDUs < 1) {
      throw new Error('refined_diachronic_units must contain at least one unit');
    }

    if (totalSourceDUs < 1) {
      throw new Error('must have at least one source P1.2 DU referenced');
    }

    // Analyze temporal phase distribution
    const phaseDistribution: { [key: string]: number } = {};
    output.refined_diachronic_units.forEach(rdu => {
      phaseDistribution[rdu.temporal_phase] = (phaseDistribution[rdu.temporal_phase] || 0) + 1;
    });

    // Calculate confidence statistics
    const confidenceScores = output.refined_diachronic_units.map(rdu => rdu.confidence);
    const avgConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    const minConfidence = Math.min(...confidenceScores);
    const maxConfidence = Math.max(...confidenceScores);

    console.log(`[P1_3 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);
    console.log(`[P1_3 parseOutput] Refined diachronic units: ${totalRefinedDUs}`);
    console.log(`[P1_3 parseOutput] Source P1.2 DUs referenced: ${totalSourceDUs}`);
    console.log(`[P1_3 parseOutput] Temporal phase distribution:`, JSON.stringify(phaseDistribution));
    console.log(`[P1_3 parseOutput] Confidence stats - Avg: ${avgConfidence.toFixed(2)}, Min: ${minConfidence}, Max: ${maxConfidence}`);
    console.log(`[P1_3 parseOutput] Preserved IV details: ${!!output.independent_variable_details}`);
    console.log(`[P1_3 parseOutput] Preserved DV focus count: ${output.dependent_variable_focus.length}`);

    return output;

  } catch (error: unknown) {
    console.error(`[P1_3 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${getErrorMessage(error)}`);
  }
};