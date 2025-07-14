/**
 * P_NEG1_1 Variable Identification - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P_NEG1_1_Input } from './types';

/**
 * Generate prompt for P_NEG1_1 step
 * EXACT COPY of working prototype's prompt template from constants.tsx
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P_NEG1_1_Input): string => {
  const { filename_or_id, raw_transcript_text_from_file, dependent_variable_focus_list } = inputData;

  // Enhanced prompt template with header parsing for bucketing support
  return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${filename_or_id}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(dependent_variable_focus_list)}

Instructions:
1.  Identify Independent Variable (IV) / Condition:
    *   Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
    *   Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."
2.  Parse Header Components (if present):
    *   Look for patterns like "Participant X, Suggestion Y (Scored Z/W)" in the first line
    *   Extract suggestion number (e.g., "1" from "Suggestion 1") as \`event_value\`
    *   Extract score (e.g., "4" from "Scored 4/5") as \`iv_value\`
    *   Save the complete first line as \`raw_header\`
    *   If the header doesn't match this pattern, omit the \`parsed_header\` field entirely
3.  Record DV Focus:
    *   The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${filename_or_id}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus_list)},
  "parsed_header": {
    "iv_value": "extracted score value (e.g., '4')",
    "event_value": "extracted suggestion number (e.g., '1')",
    "raw_header": "complete first line text"
  }
}

NOTE: Only include the \`parsed_header\` field if you can clearly identify both suggestion number and score from the first line. If the pattern is unclear or missing, omit this field entirely.

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${filename_or_id}
User-specified Dependent Variable Focus: ${JSON.stringify(dependent_variable_focus_list)}
Content:
${raw_transcript_text_from_file}`;
};