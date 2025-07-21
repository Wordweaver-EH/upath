import { StepId, P1_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_2_COARSE_PHASE_TAGGING_CONFIG: StepConfig = {
  id: StepId.P1_2_COARSE_PHASE_TAGGING,
  title: "P1.2: Coarse Phase Tagging",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.2." };
    const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    return { data: p1_1_data };
  },
  generatePrompt: (input: P1_1_Output) => `You are a data analyst. Your task is to classify interview segments into broad temporal phases.

Input:
A list of all segmented utterances from the transcript.
P1.1 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1. For each segment, analyze its text and temporal cues.
2. Assign a \`coarse_phase\` tag from the following FIXED list: \`Initial State\`, \`Core Experience\`, \`Final Action\`, \`Post-Hoc Reflection\`.
3. \`Initial State\`: Segments describing the participant's mindset, beliefs, or actions right at the beginning or just before the main experience. Cues: "at the start", "before".
4. \`Core Experience\`: Segments describing the main, sustained part of the experience. Cues: "during", "still", "whenever", "kept".
5. \`Final Action\`: Segments describing a distinct action taken to conclude or test the experience. Cues: "at the end", "then I tried to".
6. \`Post-Hoc Reflection\`: Segments where the participant is looking back, comparing, or analyzing the experience after it has concluded.

Output:
A JSON object containing the original segments, each with an added \`coarse_phase\` tag:
{
  "transcript_id": "${input.transcript_id}",
  "phase_tagged_utterances": [
    {
      "original_utterance": {
        "line_number": "5.1",
        "speaker": "P",
        "text": "...",
        "utterance_type": "Procedural",
        "included": true
      },
      "segments": [
        {
          "segment_id": "utt_5_1_seg_0",
          "segment_text": "...",
          "temporal_cues": ["..."],
          "coarse_phase": "Initial State"
        }
      ]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
};