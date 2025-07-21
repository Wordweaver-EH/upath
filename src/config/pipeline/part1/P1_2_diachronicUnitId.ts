import { StepId, P1_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_2_DIACHRONIC_UNIT_ID_CONFIG: StepConfig = {
  id: StepId.P1_2_DIACHRONIC_UNIT_ID,
  title: "P1.2: Diachronic Unit Identification (DU)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.2." };
    const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    return { data: p1_1_data };
  },
  generatePrompt: (input: P1_1_Output) => `You are a micro-phenomenological analyst. Your task is to group the segments from P1.1 into initial Diachronic Units (DUs). A DU represents a meaningful "moment" or "phase" in the described experience.
Input:
JSON output from P1.1 for transcript ID ${input.transcript_id}.
P1.1 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1.  Review Segments: Examine all \`segments\` generated in P1.1.
2.  Group into Diachronic Units (DUs):
    *   Identify groups of one or more consecutive (or thematically related and temporally close) segments that form a coherent "moment" or "step" in the experience. These are your DUs.
    *   Each DU should have a unique \`unit_id\` (e.g., "du_1", "du_2").
    *   Provide a concise \`description\` for each DU, capturing its essence. This description should be based on the content of the source segments.
    *   List the \`source_segment_ids\` (from P1.1 segment_id) that constitute this DU. A segment should ideally belong to only one DU.
3.  Aim for a reasonable number of DUs that capture the main temporal beats of the experience. Avoid over-segmentation into too many DUs or under-segmentation into too few.
4.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.1 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial orienting and noticing the object.",
      "source_segment_ids": ["utt_5_1_seg_0", "utt_6_1_seg_0", "utt_6_1_seg_1"]
    },
    {
      "unit_id": "du_2",
      "description": "Detailed examination of the object's texture.",
      "source_segment_ids": ["utt_8_1_seg_0"]
    }
    // ... more diachronic units
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
};