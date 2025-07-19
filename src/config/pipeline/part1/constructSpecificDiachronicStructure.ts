import { StepId, P1_3_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  title: "P1.4: Construct Specific Diachronic Structure (SDS)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.4." };
    const p1_3_data = allProcessedData?.get(currentTranscript.id)?.p1_3_output;
    if (!p1_3_data) return { data: null, error: `Missing P1.3 output for transcript ${currentTranscript.id}` };
    return { data: p1_3_data };
  },
  generatePrompt: (input: P1_3_Output) => `You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) for this transcript based on the refined DUs and their temporal phases.
Input:
JSON output from P1.3 for transcript ID ${input.transcript_id}.
P1.3 Output: ${JSON.stringify(input, null, 2)}
User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}
Independent Variable details: ${input.independent_variable_details}

Instructions:
1.  Define Specific Diachronic Phases:
    *   Group the refined DUs from P1.3 by their assigned \`temporal_phase\`.
    *   For each unique temporal phase present in the P1.3 output, create a \`SpecificDiachronicPhase\` object.
    *   \`phase_name\` should be the temporal phase (e.g., "Beginning", "Core Event").
    *   \`description\` should be a brief summary of what happens in this phase, derived from the descriptions of the DUs within it.
    *   \`units_involved\` must be an array of \`unit_id\`s from P1.3 that belong to this phase.
2.  Structure Summary: Provide an overall \`summary\` of the entire Specific Diachronic Structure.
3.  Visualization Hint: Optionally, provide a \`visualization_hint\` (e.g., "Linear", "Cyclical elements present", "Branching paths noted") based on the flow of phases.
4.  IV Preliminary Observation: Based on the \`independent_variable_details\` provided in the input, make a very brief, preliminary observation IF any immediate connection seems apparent between the IV and the overall diachronic structure observed. If no connection is obvious, state "No immediate IV connection apparent at this stage." This is a speculative note.
5.  Mermaid Syntax for Gantt Chart:
    *   Generate Mermaid.js syntax for a Gantt chart representing the SDS.
    *   The Gantt chart should display the \`SpecificDiachronicPhase\` objects as tasks.
    *   The title of the Gantt chart should be descriptive, like "Specific Diachronic Structure for ${input.transcript_id}".
    *   Use the \`phase_name\` for task labels. Task IDs should be derived from \`phase_name\` (sanitized for Mermaid).
    *   Order tasks by their natural temporal progression (Beginning, Early-Middle, etc.).
    *   The duration of each phase task can be heuristically based on the number of \`units_involved\` (e.g., 1 day per unit, or a fixed small duration like 2d or 3d if number of units is fairly consistent).
    *   Ensure \`dateFormat X\` and \`axisFormat %s\` are used for relative sequencing.
    Example segment for one phase: \`Beginning Phase :bgn_phase, 0, 3d\` (label:id, start_day_index, duration_days)
6.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.3 MUST be copied verbatim into the main output JSON.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "specific_diachronic_structure": {
    "summary": "Overall summary of the experience's diachronic flow.",
    "phases": [
      {
        "phase_name": "Beginning",
        "description": "Summary of the beginning phase.",
        "units_involved": ["rdu_1"] // unit_ids from P1.3
      },
      {
        "phase_name": "Core Event",
        "description": "Summary of the core event phase.",
        "units_involved": ["rdu_2", "rdu_3"]
      }
      // ... more phases
    ],
    "visualization_hint": "e.g., Linear progression",
    "iv_preliminary_observation": "Brief note on potential IV connection or N/A."
  },
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)},
  "mermaid_syntax_specific_diachronic": "gantt\\ndateFormat X\\ntitle Specific Diachronic Structure for ${input.transcript_id}\\naxisFormat %s\\n\\nsection Phases\\nBeginning :ph_beginning, 0, 2d\\nCore Event :ph_core, 2, 3d\\nEnding :ph_ending, 5, 1d"
}
`,
};