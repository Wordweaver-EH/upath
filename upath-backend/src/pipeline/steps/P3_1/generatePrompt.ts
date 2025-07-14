/**
 * P3_1 Align Structures - Prompt Generation
 * EXACT COPY of working prototype's prompt template from constants.tsx
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P3_1_Input } from './types';

/**
 * Generate prompt for P3_1 step
 * EXACT COPY of working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P3_1_Input): string => {
  // EXACT prompt template from the working prototype
  return `You are a Generic Diachronic Analysis assistant. Task: Align multiple Specific Diachronic Structures (SDS) and analyze IV correlations.
Input:
An array of all P1.4 outputs (\`all_specific_diachronic_structures\`). Each element includes \`transcript_id\`, \`filename\`, \`independent_variable_details\`, \`dependent_variable_focus\`, and the \`specific_diachronic_structure\` object (which contains \`summary\`, \`phases\`, etc.).
The global \`dependent_variable_focus\` is also provided.
${JSON.stringify(inputData, null, 2)}

Instructions:
1.  Compare SDSs: Analyze the provided SDSs. Look for common sequences of phases, recurring patterns of DUs within phases (referenced by their IDs in \`units_involved\` within each phase), and variations in structure (e.g., missing/additional phases, different DU emphasis).
2.  Correlate with IVs: For each SDS, its \`independent_variable_details\` is provided. Systematically compare structures from transcripts with different IVs. Identify how IVs might correlate with structural variations. Note patterns (e.g., 'Participants with low scores consistently show shorter initial phases and more DUs related to uncertainty.').
3.  Summarize Findings: Report on common patterns, key differences, and observed IV correlations.
Output:
A JSON object adhering EXACTLY to the following structure:
{
  "aligned_structures_report": "Detailed comparison of structures, highlighting similarities and differences.",
  "common_patterns_summary": "Summary of common diachronic patterns observed across transcripts.",
  "key_differences": ["List of significant structural differences noted, possibly linked to IVs."],
  "dependent_variable_focus": ${JSON.stringify(inputData.global_dv_focus)}
}`;
};