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
  generatePrompt: (input: P0_2_Output & { p_neg1_1_output: P_neg1_1_Output }) => `You are a micro-phenomenological analyst. Your task is to evaluate ALL utterances from the refined data transcript and determine which are crucial for understanding the diachronic (temporal) structure of the *experience itself*. The sequence and content of the described experience is of importance rather than the order it was reported in in the interview. 
Input:
The JSON output from P0.2 (refined data transcript) and P-1.1 (IV/DV info) for transcript ID ${input.transcript_id}.
P0.2 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1.  Temporal Structure: Focus only on utterances that reveal the temporal unfolding of the lived experience.
2.  Procedural Priority: Interviewer questions and meta-comments should be **excluded**, UNLESS they provide irreplaceable context for understanding the timing of a participant's description. A question like "And what happened next?" is almost always excluded if the participant's answer contains a temporal marker like "Next, I...".
3.  Evaluation Criteria for EACH utterance: Ask yourself: "Is this a **direct, concrete description** of the singular experience, or is it a generalization, theory, or conversational filler?"
    *   **INCLUDE** only direct descriptions of actions, sensations, or cognitions within the specific event.
    *   **EXCLUDE** participant's theories about *why* something happened.
    *   **EXCLUDE** participant's generalizations about what they *usually* do or feel.
    *   **EXCLUDE** judgments about the experience (e.g., "that was weird").
    *   An utterance must contribute to the temporal map and phenomenological content of the experience to be included.
4.  IMPORTANT: Output minified JSON with no unnecessary whitespace. Be extremely concise.
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from P-1.1 MUST be copied verbatim into the output.

Output:
A MINIFIED JSON object (no extra whitespace) adhering EXACTLY to the following structure:
{"transcript_id":"${input.transcript_id}","selected_procedural_utterances":[{"original_line_num":"1","speaker":"P1","utterance_text":"full text...","selection_justification":"brief reason here","included":false},{"original_line_num":"2","speaker":"Kevin Sheldrake","utterance_text":"full text...","selection_justification":"another brief reason","included":true}],"independent_variable_details":"${input.p_neg1_1_output.independent_variable_details}","dependent_variable_focus":${JSON.stringify(input.p_neg1_1_output.dependent_variable_focus)}}
`,
};