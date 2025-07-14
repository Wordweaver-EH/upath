/**
 * P2S_1 Group Utterances by Topic - Prompt Generation
 * EXACT COPY of working prototype's prompt template from constants.tsx
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P2S_1_Input } from './types';

/**
 * Generate prompt for P2S_1 step
 * EXACT COPY of working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P2S_1_Input): string => {
  const { transcript_id, analyzed_diachronic_unit, utterances_for_phase_analysis, independent_variable_details, dependent_variable_focus } = inputData;

  // EXACT prompt template from the working prototype
  return `You are a micro-phenomenological analyst. Your task is to perform the first step of Specific Synchronic Analysis (P2S.1) for a GIVEN DIACHRONIC PHASE from a single transcript. This involves grouping relevant utterances by topic.
Input:
- Transcript ID: ${transcript_id}
- Diachronic Phase Being Analyzed: "${analyzed_diachronic_unit}"
- Procedural Utterances Mapped to this Diachronic Phase:
${JSON.stringify(utterances_for_phase_analysis, null, 2)}
- Independent Variable details: ${independent_variable_details}
- User-defined Dependent Variable Focus: ${JSON.stringify(dependent_variable_focus)}

Instructions:
1.  Focus ONLY on the provided \`utterances_for_phase_analysis\`.
2.  Identify thematic content within these utterances relevant to the \`dependent_variable_focus\`.
3.  Group utterances that share a common, fine-grained theme or topic. These are your \`synchronic_thematic_groups\`.
    *   Each group should have a concise \`group_label\` (e.g., "Visual details of X", "Internal sensation of Y").
    *   Provide a \`justification\` for forming the group.
    *   List the specific \`utterances\` (original_line_num, utterance_text copied exactly from input) that belong to this group. An utterance can belong to multiple groups if appropriate, but aim for specificity.
4.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "analyzed_diachronic_unit": "${analyzed_diachronic_unit}", // The phase_name being analyzed
  "synchronic_thematic_groups": [
    {
      "group_label": "Theme A about DV1",
      "justification": "These utterances all describe aspect X of DV1.",
      "utterances": [
        {"original_line_num": "10.1", "utterance_text": "text of utterance 10.1..."},
        {"original_line_num": "12", "utterance_text": "text of utterance 12..."}
      ]
    },
    {
      "group_label": "Theme B about DV2",
      "justification": "These utterances refer to experience Y of DV2.",
      "utterances": [
        {"original_line_num": "15.2", "utterance_text": "text of utterance 15.2..."}
      ]
    }
    // ... more groups
  ],
  "independent_variable_details": "${independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus)}
}`;
};