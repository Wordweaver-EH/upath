import { StepId, P1_3_Output, P1_4_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG: StepConfig = {
  id: StepId.P1_4_DIACHRONIC_UNIT_GROUPING,
  title: "P1.4: Diachronic Unit Grouping",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.4." };
    const p1_3_data = allProcessedData?.get(currentTranscript.id)?.p1_3_output;
    if (!p1_3_data) return { data: null, error: `Missing P1.3 output for transcript ${currentTranscript.id}` };
    return { data: p1_3_data };
  },
  generatePrompt: (input: P1_3_Output) => `You are a micro-phenomenological analyst. You will be given a chronologically ordered list of segments from an interview. Your task is to group consecutive segments into Diachronic Units (DUs).

Input:
The fully sorted list of all segments from step P1.3 for transcript ID ${input.transcript_id}.
Sorted segments: ${JSON.stringify(input.sorted_segments, null, 2)}

Instructions:
1. Read the segments in the order provided. They have already been sorted chronologically.
2. Group consecutive segments that describe the same continuous moment, action, or thought process.
3. Create a new DU whenever there is a clear break or transition to a new moment (e.g., a shift from sensation to action, or from one thought to a subsequent, different thought).
4. Provide a concise \`description\` for each DU that captures the essence of that moment.
5. Each DU should have a unique \`unit_id\` (e.g., "du_1", "du_2", etc.).
6. List the \`source_segment_ids\` that constitute each DU.

Output:
A JSON object containing a list of Diachronic Units:
{
  "transcript_id": "${input.transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial awareness and orientation to the experience",
      "source_segment_ids": ["utt_5_1_seg_0", "utt_6_1_seg_0"]
    },
    {
      "unit_id": "du_2", 
      "description": "Sustained attention and deepening of the sensory experience",
      "source_segment_ids": ["utt_6_1_seg_1", "utt_8_1_seg_0", "utt_8_1_seg_1"]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}`
};