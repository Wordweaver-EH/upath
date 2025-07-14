/**
 * P3_2 Identify Generic Diachronic Units - Prompt Generation
 * EXACT COPY of working prototype's prompt template (original approach)
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P3_2_Input } from './types';

/**
 * Generate prompt for P3_2 step (original approach)
 * EXACT COPY of working prototype's generateOriginalP3_2_Prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P3_2_Input): string => {
  // EXACT prompt template from the working prototype (original approach)
  return `You are a Generic Diachronic Analysis assistant. Task: Identify Generic Diachronic Units (GDUs) from refined DUs across transcripts, considering IVs and ensuring traceability.
Input:
- P3.1 output (\`aligned_structures_report\`, etc.).
- All P1.3 outputs, provided as \`all_refined_dus_with_iv_and_ids\`. Each element contains \`transcript_id\`, \`filename\`, \`independent_variable_details\`, and \`refined_diachronic_units\` (which is an array of objects, each with \`unit_id\`, \`description\`, etc.).
- Global DV focus.
${JSON.stringify(inputData, null, 2)}

Instructions:
1.  Abstract from DUs: Review \`refined_diachronic_units\` from \`all_refined_dus_with_iv_and_ids\`. Group similar DUs across transcripts to define GDUs. A GDU is an abstraction representing a common type of diachronic unit.
2.  Define GDUs: For each GDU, provide:
    *   \`gdu_id\`: A unique identifier for the GDU (e.g., "GDU_Orientation").
    *   \`definition\`: A clear definition of what this GDU represents.
    *   \`supporting_transcripts_count\`: Number of unique transcripts contributing to this GDU.
    *   \`iv_variation_notes\` (Optional): If you notice patterns that coincidentally align with the \`independent_variable_details\` of the supporting transcripts, you may note them here as incidental observations. This is not a primary focus of the analysis.
    *   \`contributing_refined_du_ids\`: An array of objects, where each object specifies a \`transcript_id\` and the \`refined_du_id\` (this is the \`unit_id\` from the P1.3 \`refined_diachronic_units\` object) that contributes to this GDU. This is crucial for traceability.
3.  Criteria: Briefly state the criteria used for GDU abstraction and identification.

**CRITICAL CONSTRAINT**: Each refined DU (identified by transcript_id + refined_du_id) must appear in **exactly one** GDU's contributing_refined_du_ids list. No refined DU can be assigned to multiple GDUs.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "identified_gdus": [
    {
      "gdu_id": "GDU_Example",
      "definition": "Definition of the GDU.",
      "supporting_transcripts_count": 3,
      "iv_variation_notes": "Observed variations linked to IVs.",
      "contributing_refined_du_ids": [
        { "transcript_id": "transcript_A_id", "refined_du_id": "refinedDU-5_from_transcript_A" },
        { "transcript_id": "transcript_B_id", "refined_du_id": "refinedDU-2_from_transcript_B" }
      ]
    }
    // ... more GDUs
  ],
  "criteria_for_gdu_identification": "Criteria used for GDU abstraction (e.g., thematic similarity of DU descriptions, similar temporal phase).",
  "dependent_variable_focus": ${JSON.stringify(inputData.global_dv_focus)},
  "tot_rdus": ${inputData.tot_rdus}
}`;