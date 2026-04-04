import { StepId, P0_2_Output, P_neg1_1_Output, P0_3_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG: StepConfig = {
  id: StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
  title: "P0.3: Select Procedural Utterances for Diachronic Analysis",
  part: "Part0",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P0.3." };
    const p0_2_data = allProcessedData?.get(currentTranscript.id)?.p0_2_output;
    const p_neg1_1_data = allProcessedData?.get(currentTranscript.id)?.p_neg1_1_output;
    if (!p0_2_data || !p_neg1_1_data) return { data: null, error: `Missing P0.2 or P-1.1 output for transcript ${currentTranscript.id}` };
    return { data: { ...p0_2_data, p_neg1_1_output: p_neg1_1_data } };
  },
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      selected_procedural_utterances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_line_num: { type: "string" },
            speaker: { type: "string" },
            utterance_text: { type: "string" },
            selection_justification: { type: "string" },
            included: { type: "boolean" }
          },
          required: ["original_line_num", "utterance_text", "selection_justification", "included"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "selected_procedural_utterances", "independent_variable_details", "dependent_variable_focus"]
  },
  generatePrompt: (input: P0_2_Output & { p_neg1_1_output: P_neg1_1_Output }) => `You are a micro-phenomenological analyst. Your task is to evaluate ALL utterances from the refined data transcript and determine which are crucial for understanding the diachronic (temporal) structure of the *experience itself*. The sequence and content of the described experience is of importance rather than the order it was reported in in the interview. 
Input:
The JSON output from P0.2 (refined data transcript) and P-1.1 (IV/DV info) for transcript ID ${input.transcript_id}.
P0.2 Output: ${JSON.stringify(input, null, 2)}

Instructions:

1.  Procedural Content: Interviewer questions and meta-comments by the participant should be **excluded**. Any talk about ratings, other events outside the current focus should be excluded.
2.  Evaluation Criteria for EACH utterance: Ask yourself: "Is this a **direct, concrete description** of the experience, or is it a generalization, theory, or conversational filler that should be excluded?"
    *   **INCLUDE** every direct descriptions of actions, sensations, or cognitions within the specific event, i.e. "included":true.
    *   **INCLUDE** short participant confirmations ("Yeah", "No") that affirm or deny an interviewer's characterisation of their experience — they carry experiential content in context.
    *   **EXCLUDE** participant's theories about *why* something happened, i.e. "included":false.
    *   **EXCLUDE** participant's generalizations about what they *usually* do or feel, i.e. "included":false.
    *   **EXCLUDE** purely procedural meta-comments ("That's all I can think of", "How do I describe that?") that contain no experiential content.
    *   **DEFAULT: when in doubt, INCLUDE.** Downstream steps can handle marginally relevant utterances. Only exclude when you are certain an utterance adds no experiential content about this specific event.
6.  Preserve DATA: The \`independent_variable_details\` and \`dependent_variable_focus\` MUST be copied verbatim into the output. PRESERVE all the text from each utterance's 'text' field in the above into 'utterance_text' in your output with "included":true/false accordingly.

Output:
A MINIFIED JSON object (no extra whitespace) adhering EXACTLY to the following structure:
{"transcript_id":"${input.transcript_id}","selected_procedural_utterances":[{"original_line_num":"1","speaker":"P1","utterance_text":"full text from 'text' field...","selection_justification":"brief reason here","included":false},{"original_line_num":"2","speaker":"Kevin Sheldrake","utterance_text":"full text from 'text' field...","selection_justification":"another brief reason","included":true}],"independent_variable_details":"${input.p_neg1_1_output.independent_variable_details}","dependent_variable_focus":${JSON.stringify(input.p_neg1_1_output.dependent_variable_focus)}}
`,
};