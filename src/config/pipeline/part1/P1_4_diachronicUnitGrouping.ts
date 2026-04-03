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
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      diachronic_units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unit_id: { type: "string" },
            description: { type: "string" },
            source_segment_ids: { type: "array", items: { type: "string" } }
          },
          required: ["unit_id", "description", "source_segment_ids"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "diachronic_units", "independent_variable_details", "dependent_variable_focus"]
  },
  generatePrompt: (input: P1_3_Output) => `You are a micro-phenomenological analyst performing diachronic unit grouping. You will be given a chronologically ordered list of segments from an interview. Your task is to group consecutive segments into Diachronic Units (DUs).

A DU represents a single coherent experiential state — one 'beat' in the participant's stream of experience. Segments are in chronological order of the original experience (not interview order).

IMPORTANT — When to create a new DU:
Create a new DU whenever the participant's WAY OF ENGAGING with the experience shifts, even if the topic has not changed. Types of shifts that require a new DU:
- Agency shift: the participant moves from actively doing something to passively receiving (or vice versa)
- A new sensory or perceptual quality emerges
- Something spontaneous or involuntary occurs
- The participant pauses to reflect or evaluate mid-experience

When in doubt about whether two segments belong in the same DU, prefer to split them into separate DUs.

Input:
The fully sorted list of all segments from step P1.3 for transcript ID ${input.transcript_id}.
Sorted segments: ${JSON.stringify(input.sorted_segments, null, 2)}

Instructions:
1. Read the segments in the order provided. They have already been sorted by experience chronology.
2. For each segment, ask: does this describe the same experiential state as the previous segment, or has the participant's mode of engagement shifted?
3. Create a new DU whenever a shift occurs.
4. No DU should contain segments from only the interviewer.
5. Provide a concise \`description\` for each DU that captures what the participant is experiencing in that moment. Avoid abstract theoretical labels.
6. Each DU should have a unique \`unit_id\` (e.g., "du_1", "du_2", etc.).
7. List the \`source_segment_ids\` that constitute each DU.

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
      "description": "Actively trying to push distracting thoughts aside",
      "source_segment_ids": ["utt_6_1_seg_1", "utt_8_1_seg_0"]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}`
};