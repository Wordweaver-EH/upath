/**
 * P_NEG1_1 Variable Identification - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P_NEG1_1_Input } from './types';

/**
 * Generate prompt for P_NEG1_1 step
 * Enhanced with dynamic variable discovery while maintaining backward compatibility
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P_NEG1_1_Input): string => {
  const { filename_or_id, raw_transcript_text_from_file, dependent_variable_focus_list } = inputData;

  // Enhanced prompt template with dynamic variable discovery
  return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${filename_or_id}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(dependent_variable_focus_list)}

Instructions:
1.  Identify Independent Variable (IV) / Condition:
    *   Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
    *   Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."

2.  Dynamic Variable Discovery (NEW):
    *   Examine the first line of the transcript for ANY key-value pairs or structured information
    *   Common patterns include: "Participant 1", "Score 4/5", "Suggestion A", "Session Pre", "Group Control", etc.
    *   Extract each discovered variable as a name-value pair with confidence (0-1)
    *   Examples:
       - "Participant 1, Suggestion 3 (Scored 4/5)" → 
         [{"name": "Participant", "value": "1", "confidence": 0.9},
          {"name": "Suggestion", "value": "3", "confidence": 0.95},
          {"name": "Score", "value": "4", "confidence": 0.9}]
       - "Subject B - Pre-test - Rating: High" →
         [{"name": "Subject", "value": "B", "confidence": 0.9},
          {"name": "Session", "value": "Pre-test", "confidence": 0.85},
          {"name": "Rating", "value": "High", "confidence": 0.9}]
    *   If no variables are found, return an empty array

3.  Legacy Header Parsing (for backward compatibility):
    *   If the header matches "Participant X, Suggestion Y (Scored Z/W)" pattern:
    *   Extract suggestion number (e.g., "1" from "Suggestion 1") as \`event_value\`
    *   Extract score (e.g., "4" from "Scored 4/5") as \`iv_value\`
    *   Save the complete first line as \`raw_header\`
    *   If the header doesn't match this specific pattern, omit the \`parsed_header\` field entirely

4.  Record DV Focus:
    *   The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${filename_or_id}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus_list)},
  "discovered_variables": [
    {"name": "variable_name", "value": "variable_value", "confidence": 0.9}
  ],
  "parsed_header": {
    "iv_value": "extracted score value (e.g., '4')",
    "event_value": "extracted suggestion number (e.g., '1')",
    "raw_header": "complete first line text"
  }
}

NOTES: 
- Always include \`discovered_variables\` array (empty if no variables found)
- Only include the \`parsed_header\` field if you can clearly identify both suggestion number and score from the first line. If the pattern is unclear or missing, omit this field entirely.

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${filename_or_id}
User-specified Dependent Variable Focus: ${JSON.stringify(dependent_variable_focus_list)}
Content:
${raw_transcript_text_from_file}`;
};