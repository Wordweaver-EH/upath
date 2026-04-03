import { StepId, P1_4_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  title: "P1.5: Construct Specific Diachronic Structure (SDS)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.5." };

    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_4_data = transcriptData?.p1_4_output;

    if (!p1_4_data) return { data: null, error: `Missing P1.4 output for transcript ${currentTranscript.id}` };

    return { data: p1_4_data };
  },
  generatePrompt: (input: P1_4_Output) => `You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) for this transcript by grouping Diachronic Units into meaningful phases and identifying hinge points between phases.

Input:
Diachronic Units from P1.4 for transcript ID ${input.transcript_id}:
${JSON.stringify(input.diachronic_units, null, 2)}
Independent Variable: ${input.independent_variable_details}
Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:

1. GROUP DUs INTO PHASES:
   Read all DUs in order. Identify natural phase boundaries where the overall character of the experience changes. Phase names must be descriptive and grounded in the content (e.g., "Feeling hands pulling together", "Questioning whether the behaviour is voluntary"), not generic labels like "Beginning" or "Middle". A phase may contain one or several DUs. Every DU must belong to exactly one phase.

2. IDENTIFY HINGE POINTS:
   For each boundary between adjacent phases, identify the hinge point — the experiential shift that marks the transition. Describe what changes and, if apparent from the data, what precipitates the change.

3. SUMMARY:
   Provide an overall summary of the experience's temporal arc.

4. IV OBSERVATION:
   If any connection between the independent variable and the diachronic structure seems apparent, note it briefly. Otherwise state "No immediate IV connection apparent."

5. PASS THROUGH DUs:
   Copy the diachronic_units array from the input into the output unchanged.

Output:
A JSON object:
{
  "transcript_id": "${input.transcript_id}",
  "specific_diachronic_structure": {
    "summary": "Overall narrative arc of the experience",
    "phases": [
      {
        "phase_name": "Descriptive phase name",
        "description": "What the participant experiences during this phase",
        "units_involved": ["du_1", "du_2"]
      }
    ],
    "hinge_points": [
      {
        "from_phase": "Phase A name",
        "to_phase": "Phase B name",
        "transition_description": "What shifts experientially",
        "trigger": "What precipitates the shift"
      }
    ],
    "visualization_hint": "e.g., Linear progression",
    "iv_preliminary_observation": "Brief note or N/A"
  },
  "diachronic_units": ${JSON.stringify(input.diachronic_units)},
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      specific_diachronic_structure: {
        type: "object",
        properties: {
          summary: { type: "string" },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                phase_name: { type: "string" },
                description: { type: "string" },
                units_involved: { type: "array", items: { type: "string" } }
              },
              required: ["phase_name", "description", "units_involved"]
            }
          },
          hinge_points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from_phase: { type: "string" },
                to_phase: { type: "string" },
                transition_description: { type: "string" },
                trigger: { type: "string" }
              },
              required: ["from_phase", "to_phase", "transition_description"]
            }
          },
          visualization_hint: { type: "string" },
          iv_preliminary_observation: { type: "string" }
        },
        required: ["summary", "phases", "hinge_points"]
      },
      diachronic_units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unit_id: { type: "string" },
            description: { type: "string" },
            source_segment_ids: { type: "array", items: { type: "string" } }
          },
          required: ["unit_id", "description", "source_segment_ids"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "specific_diachronic_structure", "diachronic_units", "independent_variable_details", "dependent_variable_focus"]
  }
};
