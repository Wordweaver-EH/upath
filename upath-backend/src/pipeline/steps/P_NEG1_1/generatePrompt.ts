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

  // EXACT prompt template from the working prototype
  return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${filename_or_id}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(dependent_variable_focus_list)}

Instructions:
1.  Identify Independent Variable (IV) / Condition:
    *   Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
    *   Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."
2.  Record DV Focus:
    *   The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${filename_or_id}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus_list)}
}

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${filename_or_id}
User-specified Dependent Variable Focus: ${JSON.stringify(dependent_variable_focus_list)}
Content:
${raw_transcript_text_from_file}`;
};