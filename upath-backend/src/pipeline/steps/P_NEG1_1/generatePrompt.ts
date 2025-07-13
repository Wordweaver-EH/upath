/**
 * P_NEG1_1 Variable Identification - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P_NEG1_1_Input } from './types';

/**
 * Generate prompt for P_NEG1_1 step
 * Exactly matches the working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P_NEG1_1_Input): string => {
  const { filename_or_id, raw_transcript_text_from_file, dependent_variable_focus_list } = inputData;

  // Exact prompt template from the working prototype
  return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable for analysis.

## Task Overview
You will analyze a transcript excerpt and identify ONE potential independent variable that could be manipulated or controlled in future research to study the dependent variables of interest.

## Input Data
**Transcript ID/Filename:** ${filename_or_id}

**Dependent Variable Focus List:** ${dependent_variable_focus_list.join(', ')}

**Raw Transcript Text:**
${raw_transcript_text_from_file}

## Instructions
1. **Read the transcript carefully** to understand the context and content
2. **Consider the dependent variables** listed above as the phenomena you want to study
3. **Identify ONE independent variable** that could potentially influence those dependent variables
4. **Explain your reasoning** for why this independent variable might affect the dependent variables

## Independent Variable Requirements
- Must be something that could theoretically be manipulated or controlled in research
- Should have a plausible connection to the dependent variables
- Can be extracted from or inferred from the transcript content
- Should be specific enough to be measurable but broad enough to be meaningful

## Output Format
Provide your response as a JSON object with the following structure:

{
  "transcript_id": "${filename_or_id}",
  "independent_variable_details": "Description of the identified independent variable and reasoning for why it might influence the dependent variables",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus_list)}
}

## Important Notes
- Focus on identifying just ONE high-quality independent variable
- Your reasoning should be clear and scientifically plausible
- The independent variable should be actionable for future research design
- Ensure the JSON output is valid and properly formatted`;
};