import { StepId, P0_3_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_1_INITIAL_SEGMENTATION_CONFIG: StepConfig = {
  id: StepId.P1_1_INITIAL_SEGMENTATION,
  title: "P1.1: Initial Segmentation of Procedural Utterances",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.1." };
    const p0_3_data = allProcessedData?.get(currentTranscript.id)?.p0_3_output;
    if (!p0_3_data) return { data: null, error: `Missing P0.3 output for transcript ${currentTranscript.id}` };
    return { data: p0_3_data };
  },
  generatePrompt: (input: P0_3_Output) => {
    // Filter to only include utterances where included === true
    const includedUtterances = input.selected_procedural_utterances.filter(u => u.included);
    const filteredInput = {
      ...input,
      selected_procedural_utterances: includedUtterances
    };
    
    return `You are a micro-phenomenological analyst. Your task is to segment the selected procedural utterances based on temporal cues, focusing on the described experience's unfolding.
Input:
JSON output from P0.3 for transcript ID ${input.transcript_id} (showing only INCLUDED utterances).
P0.3 Output: ${JSON.stringify(filteredInput, null, 2)}

Instructions:
1. Focus on "Action Units": Read each selected procedural utterance. Identify "minimal action units" or "elementary acts" within them. An utterance might contain one or multiple such segments.

2. Temporal Cues: Look for explicit or implicit temporal markers that delineate these segments.
   
   EXPLICIT temporal markers include:
   - Time words: "then", "after", "before", "suddenly", "meanwhile", "finally"
   - Beginning markers: "at the start", "initially", "first"
   - Sequence markers: "next", "subsequently", "afterwards"
   
   IMPLICIT temporal markers include:
   - Sequence of distinct verbs: "I noticed... I felt... I realized..."
   - Progression indicators: "The sensation grew stronger", "It gradually faded", "It was building"
   - Transition markers: "My attention shifted", "The quality changed", "It transformed into"
   - Causal language (causation implies temporal sequence):
     * "Because of this, I..." (cause precedes effect)
     * "This led to..." (one thing follows another)
     * "As a result..." (consequence follows cause)
     * "Which made me..." (causal chain shows temporal flow)
     * "So I..." (therefore, subsequently)
3.  Segment Creation:
    *   For each original utterance, create an array of \`segments\`.
    *   Each segment should have a unique \`segment_id\` (e.g., "utt_ORIGINAL_LINE_NUM_seg_INDEX", like "utt_5.1_seg_0", "utt_5.1_seg_1"). Ensure ORIGINAL_LINE_NUM is safe for an ID (replace '.' with '_').
    *   \`segment_text\` should be the text of that minimal action unit.
    *   \`temporal_cues\` should be an array of strings listing any temporal words/phrases identified *within or at the beginning of* that specific segment that justify its distinctness or position.
4.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P0.3 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "segmented_utterances": [
    {
      "original_utterance": { // Copied from P0.3 input
        "original_line_num": "string",
        "utterance_text": "text of the original utterance...",
        "selection_justification": "Brief justification for selection."
      },
      "segments": [
        {
          "segment_id": "utt_59_seg_0",
          "segment_text": "Just yeah, just I had a at the start. I had, like a brief images of... glue.",
          "temporal_cues": ["at the start"]
        }
      ]
    }
    // ... more segmented utterances
  ],
  "independent_variable_details": "${filteredInput.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(filteredInput.dependent_variable_focus)}
}
`;
  },
};