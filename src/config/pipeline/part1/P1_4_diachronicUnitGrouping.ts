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
  generatePrompt: (input: P1_3_Output) => `You are a micro-phenomenological analyst. You will be given a chronologically ordered list of segments from an interview. Your task is to group consecutive segments into Diachronic Units (DUs). A DU represents a coherent, meaningful phase or 'moment' within the participant's stream of experience. It is a single 'beat' or 'scene' in their experiential narrative. All segments within one DU should be thematically unified or explicitly or implicitly reported as simultaneous. The transition between DUs marks a shift in the nature of the experience. This shift may be explicit with temporal and causal cues or be an implicit shift that indicates a new momentary experience arising due to an experiential shift, e.g. shift in focus, sensation, intention, cognition. The DU and segments are in chronological order of phenomenology, i.e. they are sorted according to how they happened in the original experience as opposed to the order they were reported in in the interview.

Input:
The fully sorted list of all segments from step P1.3 for transcript ID ${input.transcript_id}.
Sorted segments: ${JSON.stringify(input.sorted_segments, null, 2)}

Instructions:
1. Read the segments in the order provided. They have already been sorted chronologically.
2. Group consecutive segments that describe the same continuous moment, action, or thought process.
3. Create a new DU whenever there is a clear break or transition to a new moment.
4. No DU should have segments from only the interviewer.
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