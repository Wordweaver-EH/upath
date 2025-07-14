/**
 * P1_3 Refine Diachronic Units - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P1_3_Input } from './types';

/**
 * Generate prompt for P1_3 step
 * Exactly matches the working prototype's prompt template for DU refinement and temporal phase assignment
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P1_3_Input): string => {
  // Input is P1_2_Output (exactly matches prototype)
  const { transcript_id, diachronic_units, independent_variable_details, dependent_variable_focus } = inputData;

  // Count DUs for context
  const totalDUs = diachronic_units.length;
  const totalSegments = diachronic_units.reduce((sum, du) => sum + du.source_segment_ids.length, 0);

  // Exact prompt template from the working prototype
  return `You are a micro-phenomenological analyst. Your task is to refine the Diachronic Units (DUs) from P1.2 and assign temporal phases to each refined unit.

Input:
JSON output from P1.2 for transcript ID ${transcript_id}.
P1.2 Output: ${JSON.stringify(inputData, null, 2)}

Instructions:
1. **Review DUs**: Examine all ${totalDUs} diachronic units from the P1.2 output (covering ${totalSegments} segments).
2. **Refine DUs**: Based on experiential flow, you may:
   * **Merge** related DUs that belong to the same experiential moment
   * **Split** DUs that contain distinct experiential phases
   * **Keep** DUs unchanged if they are already well-defined
   * Each refined DU must have a unique \`unit_id\` (e.g., "rdu_1", "rdu_2")
   * Provide a concise \`description\` for each refined DU
   * List the \`source_p1_2_du_ids\` (from P1.2) that contributed to this refined DU
3. **Assign Temporal Phase**: For each refined DU, assign ONE of these temporal phases:
   * **"Beginning"** - Initial moments, setup, or starting conditions
   * **"Early-Middle"** - Early development or progression
   * **"Core Event"** - Central, most significant moments
   * **"Late-Middle"** - Later development or progression
   * **"Ending"** - Conclusion, resolution, or final moments
   * **"Reflection"** - Retrospective thoughts or analysis
   * **"Transition"** - Movement between phases or states
   * **"Other"** - Phases that don't fit the above categories
4. **Assign Confidence**: For each refined DU, provide a confidence score (0.0 to 1.0) indicating how certain you are about the refinement and phase assignment.
5. **Preserve IV/DV**: The \`independent_variable_details\` and \`dependent_variable_focus\` from the P1.2 input MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "refined_diachronic_units": [
    {
      "unit_id": "rdu_1",
      "description": "Brief description of the refined temporal unit...",
      "source_p1_2_du_ids": ["du_1", "du_2"],
      "temporal_phase": "Beginning",
      "confidence": 0.85
    },
    {
      "unit_id": "rdu_2", 
      "description": "Brief description of the next refined unit...",
      "source_p1_2_du_ids": ["du_3"],
      "temporal_phase": "Core Event",
      "confidence": 0.92
    }
    // ... more refined DUs as needed
  ],
  "independent_variable_details": "${independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus)}
}`;
};