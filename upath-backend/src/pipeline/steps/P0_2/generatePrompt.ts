/**
 * P0_2 Refine Data Types - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P0_2_Input } from './types';

/**
 * Generate prompt for P0_2 step
 * Exactly matches the working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P0_2_Input): string => {
  // Input is P0_1_Output (exactly matches prototype)
  const { transcript_id, line_numbered_transcript, transcription_convention_notes, initial_impressions_log } = inputData;

  // Reconstruct P0_1_Output for JSON display in prompt (matches prototype)
  const p0_1_output = {
    transcript_id,
    line_numbered_transcript,
    transcription_convention_notes,
    initial_impressions_log,
  };

  // Exact prompt template from the working prototype
  return `You are a micro-phenomenological data preparation analyst. Your task is to refine the line-numbered transcript by identifying different types of information.
Input:
The JSON output from the previous step (Prompt 0.1) for transcript ID ${transcript_id}.
${JSON.stringify(p0_1_output, null, 2)}

Instructions:
1. Re-read and categorize each line:
   For each numbered line, determine if it primarily contains:
    - "procedural_information": Utterances related to the interview process itself (e.g., interviewer's questions, participant's reflections on the question or process, meta-comments).
    - "experiential_content": Utterances directly describing the lived experience being investigated.
    - "ambiguous_or_mixed": Lines that are hard to categorize or contain both.
2. Tagging:
   Based on this, assign one or more \`information_tags\` to each line (e.g., ["procedural_information"], ["experiential_content"], ["procedural_information", "experiential_content"]).
3. Decision Notes (Optional):
   If a line is particularly complex or its categorization is non-obvious, add a brief \`decision_notes\` explaining your reasoning.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "text": "text of line 1...",
      "information_tags": ["tag1", "tag2"],
      "decision_notes": "Optional notes for line 1."
    },
    {
      "line_num": 2,
      "text": "text of line 2...",
      "information_tags": ["tag1"],
      "decision_notes": null
    }
    // ... and so on for all lines
  ]
}`;
};