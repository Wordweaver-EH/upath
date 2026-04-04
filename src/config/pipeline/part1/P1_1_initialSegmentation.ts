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
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      segmented_utterances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_utterance: {
              type: "object",
              properties: {
                original_line_num: { type: "string" },
                utterance_text: { type: "string" },
                selection_justification: { type: "string" }
              },
              required: ["original_line_num", "utterance_text"]
            },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" },
                  temporal_cues: { type: "array", items: { type: "string" } }
                },
                required: ["segment_id", "segment_text"]
              }
            }
          },
          required: ["original_utterance", "segments"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "segmented_utterances", "independent_variable_details", "dependent_variable_focus"]
  },
  generatePrompt: (input: P0_3_Output) => {
    // Filter to only include utterances where included === true
    const includedUtterances = input.selected_procedural_utterances.filter(u => u.included);
    const filteredInput = {
      ...input,
      selected_procedural_utterances: includedUtterances
    };
    
    return `You are a micro-phenomenological analyst. Your task is to segment selected procedural utterances into minimal experiential units.

Input:
JSON output from P0.3 for transcript ID ${input.transcript_id} (showing only INCLUDED utterances).
P0.3 Output: ${JSON.stringify(filteredInput, null, 2)}

## Default Rule: One utterance = one segment

Most utterances describe a single experiential moment and should remain as one segment. Only split when you are certain an utterance contains two or more clearly distinct sequential moments.

## When to split an utterance (STRICT criteria — ALL must apply):

Split ONLY when the utterance describes events that are:
1. **Temporally separate** — one thing finishes, then another begins (not simultaneous or continuous)
2. **Experientially distinct** — a different quality of experience, not just more detail about the same moment
3. **Clearly demarcated** — there is an explicit temporal marker ("then", "after that", "suddenly", "and then") OR the shift is so obvious it would be jarring to keep them together

## What does NOT warrant a split:

- Causal language alone ("because of this", "so I", "which made me", "this led to") — cause and effect are often experienced as a single moment
- A sequence of verbs describing the same sustained activity ("I was focusing and listening and trying to...")
- A speaker re-describing or elaborating on the same moment
- Short affirmative/negative additions ("yeah", "I think so") that accompany the main description
- Any doubt — if uncertain whether to split, keep as one segment

## Temporal cue types (only use these as split justification):

EXPLICIT (strong signal): "then", "after", "before", "suddenly", "meanwhile", "finally", "at that point", "at the start", "next"

IMPLICIT (weak signal — only use when the experiential shift is also clear):
- A participant explicitly noting an attention shift: "My focus moved to...", "I became aware of something different"
- A clearly new sensation or state beginning: "Then I felt..." after a clearly completed prior phase

Instructions:
1. For each utterance, default to one segment. Ask: "Does this utterance clearly describe two or more sequential, distinct experiential moments?" If not, keep as one segment.
2. If splitting, each segment should have a unique \`segment_id\` (e.g., "utt_ORIGINAL_LINE_NUM_seg_INDEX", like "utt_5_1_seg_0"). Replace '.' with '_' in line numbers.
3. \`segment_text\` = the text of that minimal experiential unit.
4. \`temporal_cues\` = explicit temporal words/phrases that justify the split (or empty array if no split).
5. Preserve IV/DV verbatim from input.

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