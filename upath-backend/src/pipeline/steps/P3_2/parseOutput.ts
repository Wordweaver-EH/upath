/**
 * P3_2 Identify Generic Diachronic Units - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior with validateAndCleanP3_2_Output
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P3_2_Output, P3_2_IdentifiedGdu, ContributingRefinedDu } from './types';

/**
 * Parse and validate output for P3_2 step
 * Exactly matches the working prototype's parsing logic with duplicate handling
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P3_2_Output => {
  console.log(`[P3_2 parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!Array.isArray(rawOutput.identified_gdus)) {
    throw new Error('P3_2 output missing required field: identified_gdus (must be array)');
  }

  if (!rawOutput.criteria_for_gdu_identification) {
    throw new Error('P3_2 output missing required field: criteria_for_gdu_identification');
  }

  if (!Array.isArray(rawOutput.dependent_variable_focus)) {
    throw new Error('P3_2 output field dependent_variable_focus must be an array');
  }

  if (typeof rawOutput.tot_rdus !== 'number') {
    throw new Error('P3_2 output field tot_rdus must be a number');
  }

  // Validate each GDU structure (matches prototype GDU validation)
  const validatedGdus: P3_2_IdentifiedGdu[] = [];
  const seenRduIds = new Set<string>(); // For duplicate detection

  for (let i = 0; i < rawOutput.identified_gdus.length; i++) {
    const gdu = rawOutput.identified_gdus[i];

    // Validate required GDU fields
    if (!gdu.gdu_id) {
      throw new Error(`P3_2 GDU at index ${i} missing required field: gdu_id`);
    }

    if (!gdu.definition) {
      throw new Error(`P3_2 GDU at index ${i} missing required field: definition`);
    }

    if (typeof gdu.supporting_transcripts_count !== 'number') {
      throw new Error(`P3_2 GDU at index ${i} field supporting_transcripts_count must be a number`);
    }

    if (!Array.isArray(gdu.contributing_refined_du_ids)) {
      throw new Error(`P3_2 GDU at index ${i} field contributing_refined_du_ids must be an array`);
    }

    // Validate and clean contributing refined DU IDs (matches prototype duplicate handling)
    const cleanedContributingIds: ContributingRefinedDu[] = [];

    for (const contribution of gdu.contributing_refined_du_ids) {
      if (!contribution.transcript_id || !contribution.refined_du_id) {
        throw new Error(`P3_2 GDU '${gdu.gdu_id}' has invalid contributing_refined_du_ids entry: missing transcript_id or refined_du_id`);
      }

      const rduKey = `${contribution.transcript_id}:${contribution.refined_du_id}`;

      // Check for duplicates (first-assignment-wins rule from prototype)
      if (seenRduIds.has(rduKey)) {
        console.warn(`[P3_2 parseOutput] Duplicate RDU assignment detected: ${rduKey} already assigned to another GDU. Skipping duplicate (first-assignment-wins).`);
        continue;
      }

      seenRduIds.add(rduKey);
      cleanedContributingIds.push({
        transcript_id: contribution.transcript_id,
        refined_du_id: contribution.refined_du_id,
      });
    }

    // Create validated GDU with cleaned contributions
    const validatedGdu: P3_2_IdentifiedGdu = {
      gdu_id: gdu.gdu_id,
      definition: gdu.definition,
      supporting_transcripts_count: gdu.supporting_transcripts_count,
      contributing_refined_du_ids: cleanedContributingIds,
    };

    // Include optional iv_variation_notes if present
    if (gdu.iv_variation_notes) {
      validatedGdu.iv_variation_notes = gdu.iv_variation_notes;
    }

    validatedGdus.push(validatedGdu);
  }

  // Return validated and cleaned output (matches prototype structure)
  const validatedOutput: P3_2_Output = {
    identified_gdus: validatedGdus,
    criteria_for_gdu_identification: rawOutput.criteria_for_gdu_identification,
    dependent_variable_focus: rawOutput.dependent_variable_focus,
    tot_rdus: rawOutput.tot_rdus,
  };

  console.log(`[P3_2 parseOutput] Successfully validated output with ${validatedGdus.length} GDUs and ${seenRduIds.size} unique refined DU assignments`);

  return validatedOutput;
};