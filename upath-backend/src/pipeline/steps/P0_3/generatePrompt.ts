/**
 * P0_3 Select Procedural Utterances - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P0_3_Input } from './types';

/**
 * Generate prompt for P0_3 step
 * Exactly matches the working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P0_3_Input): string => {
  // Input combines P0_2_Output and P_NEG1_1_Output (exactly matches prototype)
  const { transcript_id, refined_data_transcript, p_neg1_1_output } = inputData;

  // Prepare data for JSON display in prompt (matches prototype structure)
  const p0_2_output = {
    transcript_id,
    refined_data_transcript,
  };

  // Exact prompt template from the working prototype
  return `You are a micro-phenomenological analyst. Your task is to select utterances crucial for understanding the diachronic (temporal) structure of the *experience itself*, focusing on the participant's procedural account of their experience.
Input:
The JSON output from P0.2 (refined data transcript) and P-1.1 (IV/DV info) for transcript ID ${transcript_id}.
P0.2 Output: ${JSON.stringify(p0_2_output, null, 2)}
P-1.1 Output: ${JSON.stringify(p_neg1_1_output, null, 2)}

Instructions:
1.  Focus: The goal is to isolate the participant's narrative of *how the experience unfolded*. This means selecting utterances that describe actions, steps, or stages in the experience.
2.  Selection Criteria:
    *   Prioritize lines tagged "experiential_content".
    *   From these, select utterances that indicate a sequence, action, or a part of the experiential process. These are "procedural utterances" in the context of the experience itself.
    *   Interviewer questions, participant's meta-comments on the interview *process* (unless they also reveal experiential process), or purely descriptive (static) experiential content should generally be EXCLUDED from this selection, *unless* they are essential for understanding the flow of the described experience.
    *   If a single original line was very long and contained multiple distinct procedural steps, you MAY split it and represent each as a separate selected utterance. If you do this, use a format like "LINE_NUM.SUB_INDEX" for \`original_line_num\` (e.g., "23.1", "23.2").
3.  Justification: For each selected utterance, provide a brief \`selection_justification\` explaining why it's considered procedural to the experience.
4.  Discarded Info Summary: Briefly summarize what kind of information was generally discarded (e.g., "Interviewer prompts, participant's self-corrections not directly related to experiential flow").
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from P-1.1 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "selected_procedural_utterances": [
    {
      "original_line_num": "string (e.g., '5' or '5.1')",
      "utterance_text": "text of the selected utterance...",
      "selection_justification": "Brief justification for selection."
    }
    // ... more utterances
  ],
  "discarded_info_summary": "Summary of discarded info.",
  "independent_variable_details": "${p_neg1_1_output.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(p_neg1_1_output.dependent_variable_focus)}
}`;
};