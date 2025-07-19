import { StepId } from '../../../../types';
import { StepConfig } from '../types';

export const P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG: StepConfig = {
  id: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
  title: "P-1.1: Variable Identification",
  part: "PartNeg1",
  isJsonOutput: true,
  getInput: (currentTranscript, _allProcessedData, _genericState, _apiKeyPresent, userDvFocus) => {
    console.log(`[P-1.1 getInput] currentTranscript:`, currentTranscript ? { id: currentTranscript.id, contentLength: currentTranscript.content?.length } : null);
    console.log(`[P-1.1 getInput] userDvFocus:`, userDvFocus);
    
    if (!currentTranscript?.content || !userDvFocus?.dv_focus || userDvFocus.dv_focus.length === 0) {
      console.error(`[P-1.1 getInput] Validation failed - transcript content: ${!!currentTranscript?.content}, userDvFocus exists: ${!!userDvFocus}, dv_focus exists: ${!!userDvFocus?.dv_focus}, dv_focus length: ${userDvFocus?.dv_focus?.length || 0}`);
      return { data: null, error: "Missing transcript content or DV focus for P-1.1." };
    }
    return {
      data: {
        filename_or_id: currentTranscript.filename || currentTranscript.id,
        raw_transcript_text_from_file: currentTranscript.content,
        dependent_variable_focus_list: userDvFocus.dv_focus,
      },
    };
  },
  generatePrompt: (input) => `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${input.filename_or_id}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(input.dependent_variable_focus_list)}

Instructions:
1.  Identify Independent Variable (IV) / Condition:
    *   Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
    *   Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."
2.  Record DV Focus:
    *   The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.filename_or_id}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus_list)}
}

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${input.filename_or_id}
User-specified Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus_list)}
Content:
${input.raw_transcript_text_from_file}
`,
};