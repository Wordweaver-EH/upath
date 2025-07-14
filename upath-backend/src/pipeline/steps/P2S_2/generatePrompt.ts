/**
 * P2S_2 Identify Specific Synchronic Units - Prompt Generation
 * EXACT COPY of working prototype's prompt template from constants.tsx
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P2S_2_Input } from './types';

/**
 * Generate prompt for P2S_2 step
 * EXACT COPY of working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P2S_2_Input): string => {
  const { transcript_id, analyzed_diachronic_unit, synchronic_thematic_groups, independent_variable_details, dependent_variable_focus } = inputData;

  // EXACT prompt template from the working prototype
  return `You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups from P2S.1 for a GIVEN DIACHRONIC PHASE.
Input:
- Transcript ID: ${transcript_id}
- Diachronic Phase Being Analyzed: "${analyzed_diachronic_unit}"
- Thematic Groups from P2S.1 for this Phase:
${JSON.stringify(synchronic_thematic_groups, null, 2)}
- Independent Variable details: ${independent_variable_details}
- User-defined Dependent Variable Focus: ${JSON.stringify(dependent_variable_focus)}

Instructions:
1.  Focus: Transform thematic groups into a hierarchy of Incipient Synchronic Units (ISUs). An ISU is an abstraction representing a stable element of the experience within this phase.
2.  Abstraction Process (Iterative):
    *   Start with utterances in thematic groups.
    *   Level 0 ISUs: Directly represent a recurring, specific experiential detail from one or more utterances within a thematic group.
    *   Higher-Level ISUs (Level 1, 2, etc.): Formed by abstracting/generalizing from Level 0 ISUs or other lower-level ISUs.
    *   Abstraction Operations (\`abstraction_op\`): Specify the operation used (e.g., "Generalization", "Aggregation", "Structural Resemblance", "Functional Equivalence").
3.  ISU Definition:
    *   \`unit_name\`: A unique, descriptive name for the ISU (e.g., "VisualFocusOnTexture", "FeelingOfExpansion"). This name will serve as its ID. Ensure it's stable and referenceable.
    *   \`level\`: Abstraction level (0, 1, 2...).
    *   \`intensional_definition\`: A clear, concise definition of what the ISU represents.
    *   \`utterances\`: REQUIRED for Level 0 ISUs. This array MUST NOT be empty. An ISU at Level 0 can only be defined if it is directly grounded by one or more specific utterances (copied from input P2S.1 thematic groups). Each utterance object must have \`original_line_num\` and \`utterance_text\`. For Level > 0 ISUs, this field is optional or can be empty.
    *   \`constituent_lower_units\`: REQUIRED for Level > 0 ISUs. This array MUST NOT be empty. An ISU at Level > 0 can only be defined if it is formed by abstracting from one or more existing lower-level ISUs. List the \`unit_name\` strings of these lower-level ISUs. For Level 0 ISUs, this field should be empty or omitted.
4.  Grounding First: Before defining any ISU, first identify its grounding: specific utterances for Level 0 ISUs, or constituent lower-level ISU names for Level > 0 ISUs. If sufficient grounding cannot be found, do not create the ISU.
5.  Hierarchy: The final list of \`specific_synchronic_units_hierarchy\` should include all ISUs, from Level 0 up to the highest level of abstraction achieved for this phase.
6.  Preserve IV/DV: Copy \`independent_variable_details\` and \`dependent_variable_focus\` verbatim.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "analyzed_diachronic_unit": "${analyzed_diachronic_unit}",
  "specific_synchronic_units_hierarchy": [
    {
      "unit_name": "ISU_VisualDetail_ColorA",
      "level": 0,
      "abstraction_op": "Direct Description",
      "intensional_definition": "The specific color A was perceived.",
      "utterances": [{"original_line_num": "10.1", "utterance_text": "text..."}]
    },
    {
      "unit_name": "ISU_GeneralVisualAspects",
      "level": 1,
      "abstraction_op": "Generalization",
      "intensional_definition": "General visual characteristics were noted.",
      "constituent_lower_units": ["ISU_VisualDetail_ColorA"]
    }
    // ... more ISUs
  ],
  "independent_variable_details": "${independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus)}
}`;
};