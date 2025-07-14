/**
 * P1_2 Diachronic Unit Identification - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P1_2_Input } from './types';

/**
 * Generate prompt for P1_2 step
 * Exactly matches the working prototype's prompt template for DU identification
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P1_2_Input): string => {
  // Input is P1_1_Output (exactly matches prototype)
  const { transcript_id, segmented_utterances, independent_variable_details, dependent_variable_focus } = inputData;

  // Count total segments for context
  const totalSegments = segmented_utterances.reduce((sum, utt) => sum + utt.segments.length, 0);

  // Exact prompt template from the working prototype
  return `You are a micro-phenomenological analyst. Your task is to group segments from P1.1 into "Diachronic Units (DUs)" based on temporal and thematic relationships.

Input:
JSON output from P1.1 for transcript ID ${transcript_id}.
P1.1 Output: ${JSON.stringify(inputData, null, 2)}

Instructions:
1. **Review Segments**: Examine all \`segments\` from the P1.1 output (${totalSegments} total segments across ${segmented_utterances.length} utterances).
2. **Group into Diachronic Units (DUs)**:
   * Identify groups of one or more consecutive or thematically related and temporally close segments that form a coherent "moment" or "step" in the experience.
   * Each DU should have a unique \`unit_id\` (e.g., "du_1", "du_2").
   * Provide a concise \`description\` for each DU based on its content.
   * List the \`source_segment_ids\` (from P1.1) that constitute the DU, with each segment ideally belonging to only one DU.
3. **Aim for a reasonable number of DUs** that capture the main temporal beats of the experience, avoiding over- or under-segmentation.
4. **Preserve IV/DV**: The \`independent_variable_details\` and \`dependent_variable_focus\` from the P1.1 input MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Brief description of what happens in this temporal unit...",
      "source_segment_ids": ["utt_X_seg_Y", "utt_X_seg_Z", "utt_A_seg_B"]
    },
    {
      "unit_id": "du_2", 
      "description": "Brief description of the next temporal unit...",
      "source_segment_ids": ["utt_C_seg_D", "utt_E_seg_F"]
    }
    // ... more DUs as needed
  ],
  "independent_variable_details": "${independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus)}
}`;
};