/**
 * P1_4 Construct Specific Diachronic Structure - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P1_4_Input } from './types';

/**
 * Generate prompt for P1_4 step
 * Exactly matches the working prototype's prompt template for SDS construction and Mermaid generation
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P1_4_Input): string => {
  // Input is P1_3_Output (exactly matches prototype)
  const { transcript_id, refined_diachronic_units, independent_variable_details, dependent_variable_focus } = inputData;

  // Analyze phase distribution for context
  const phaseDistribution: { [key: string]: number } = {};
  refined_diachronic_units.forEach(rdu => {
    phaseDistribution[rdu.temporal_phase] = (phaseDistribution[rdu.temporal_phase] || 0) + 1;
  });

  const totalRefinedDUs = refined_diachronic_units.length;
  const totalPhases = Object.keys(phaseDistribution).length;

  // Exact prompt template from the working prototype
  return `You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) based on the refined Diachronic Units (DUs) and their temporal phases from P1.3.

Input:
JSON output from P1.3 for transcript ID ${transcript_id}.
P1.3 Output: ${JSON.stringify(inputData, null, 2)}

Instructions:
1. **Define Specific Diachronic Phases**: Group refined DUs by their \`temporal_phase\` into \`SpecificDiachronicPhase\` objects:
   * Each phase should have a \`phase_name\` (typically matches the temporal_phase)
   * Provide a \`description\` of what happens in this phase based on the DUs involved
   * List the \`units_involved\` (unit_id values from P1.3 refined DUs that belong to this phase)
   * Current phases in data: ${Object.keys(phaseDistribution).join(', ')} (${totalRefinedDUs} total refined DUs across ${totalPhases} phases)

2. **Structure Summary**: Provide an overall \`summary\` of the Specific Diachronic Structure, describing the temporal flow of the experience.

3. **Visualization Hint**: Optionally provide a \`visualization_hint\` suggesting how this structure might be visualized (e.g., "Linear", "Cyclical", "Branching", "Layered", "Spiral", "Other").

4. **IV Preliminary Observation**: Make a brief, preliminary observation about any apparent connection between the Independent Variable ("${independent_variable_details}") and the diachronic structure. Keep this concise and observational.

5. **Mermaid Syntax for Gantt Chart**: Generate Mermaid.js syntax for a Gantt chart representing the SDS:
   * Display phases as tasks with appropriate labels
   * Order phases logically based on temporal flow
   * Use reasonable durations for visualization
   * Include a title and proper Mermaid Gantt syntax

6. **Preserve IV/DV**: The \`independent_variable_details\` and \`dependent_variable_focus\` from the P1.3 input MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcript_id}",
  "specific_diachronic_structure": {
    "summary": "Overall description of the temporal flow and structure...",
    "phases": [
      {
        "phase_name": "Beginning",
        "description": "Description of what happens in the beginning phase...",
        "units_involved": ["rdu_1", "rdu_2"]
      },
      {
        "phase_name": "Core Event",
        "description": "Description of the core event phase...",
        "units_involved": ["rdu_3"]
      }
      // ... more phases as needed
    ],
    "visualization_hint": "Linear",
    "iv_preliminary_observation": "Brief observation about IV connection to structure..."
  },
  "independent_variable_details": "${independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(dependent_variable_focus)},
  "mermaid_syntax_specific_diachronic": "gantt\\n    title Specific Diachronic Structure\\n    dateFormat X\\n    axisFormat %s\\n    Beginning : 0, 3\\n    Core Event : 3, 2\\n    ..."
}`;
};