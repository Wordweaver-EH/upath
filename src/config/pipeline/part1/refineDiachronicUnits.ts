import { StepId, P1_2_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_3_REFINE_DIACHRONIC_UNITS_CONFIG: StepConfig = {
  id: StepId.P1_3_REFINE_DIACHRONIC_UNITS,
  title: "P1.3: Refine Diachronic Units & Assign Temporal Phase",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.3." };
    const p1_2_data = allProcessedData?.get(currentTranscript.id)?.p1_2_output;
    if (!p1_2_data) return { data: null, error: `Missing P1.2 output for transcript ${currentTranscript.id}` };
    return { data: p1_2_data };
  },
  generatePrompt: (input: P1_2_Output) => `You are a micro-phenomenological analyst. Your task is to refine the Diachronic Units (DUs) from P1.2 and assign a temporal phase to each.
Input:
JSON output from P1.2 for transcript ID ${input.transcript_id}.
P1.2 Output: ${JSON.stringify(input, null, 2)}
User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:
1.  Review DUs: Examine the DUs identified in P1.2.
2.  Refine DUs:
    *   Consider if any DUs from P1.2 should be merged or split based on a deeper understanding of the experiential flow.
    *   The output \`refined_diachronic_units\` will be a new list. Each refined DU should have a unique \`unit_id\` (can be same as P1.2 ID if not changed, or new if merged/split).
    *   Maintain a concise \`description\`.
    *   The \`source_p1_2_du_ids\` field MUST list the \`unit_id\`(s) from the P1.2 DUs that form this refined DU.
3.  Assign Temporal Phase: For each *refined* DU, assign a \`temporal_phase\` from the following FIXED list that best describes its position in the overall experiential arc:
    *   "Beginning"
    *   "Early-Middle"
    *   "Core Event" (if there's a clear central moment)
    *   "Late-Middle"
    *   "Ending"
    *   "Reflection" (if the DU is about looking back on the experience)
    *   "Transition" (if the DU primarily marks a shift between other phases)
    *   "Other" (use sparingly, if no other category fits)
4.  Confidence: Assign a \`confidence\` score (0.0 to 1.0) for each refined DU, reflecting how clear and well-defined it seems.
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.2 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "refined_diachronic_units": [
    {
      "unit_id": "rdu_1", // Can be same as P1.2 ID or new
      "description": "Initial orienting and noticing the object (refined).",
      "source_p1_2_du_ids": ["du_1"], // ID(s) from P1.2 DUs
      "temporal_phase": "Beginning",
      "confidence": 0.9
    },
    {
      "unit_id": "rdu_2",
      "description": "Detailed examination and interaction.",
      "source_p1_2_du_ids": ["du_2", "du_3"], // Example of merged DUs
      "temporal_phase": "Core Event",
      "confidence": 0.85
    }
    // ... more refined diachronic units
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
};