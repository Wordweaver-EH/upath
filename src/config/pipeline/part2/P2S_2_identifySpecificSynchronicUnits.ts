import { StepId, P2S_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG: StepConfig = {
  id: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
  title: "P2S.2: Identify Specific Synchronic Units (ISUs)",
  part: "PartII_Sync",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentPhaseName) => {
    if (!currentTranscript?.id || !currentPhaseName) return { data: null, error: "Missing current transcript ID or phase name for P2S.2." };
    const p2s_1_data_for_phase = allProcessedData?.get(currentTranscript.id)?.p2s_outputs_by_phase?.[currentPhaseName]?.p2s_1_output;
    const p0_3_data = allProcessedData?.get(currentTranscript.id)?.p0_3_output; // For IV/DV

    if (!p2s_1_data_for_phase || !p0_3_data) return { data: null, error: `Missing P2S.1 output for phase '${currentPhaseName}' or P0.3 data for transcript ${currentTranscript.id}` };
    
    return {
      data: {
        ...p2s_1_data_for_phase, 
        independent_variable_details: p0_3_data.independent_variable_details,
        dependent_variable_focus: p0_3_data.dependent_variable_focus,
      },
    };
  },
  generatePrompt: (input: P2S_1_Output & { independent_variable_details: string; dependent_variable_focus: string[]; }) => `You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups from P2S.1 for a GIVEN DIACHRONIC PHASE.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Phase Being Analyzed: "${input.analyzed_diachronic_unit}"
- IV Details: "${input.independent_variable_details}"
- DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
- JSON output from P2S.1 (thematic groups):
${JSON.stringify(input, null, 2)}

Instructions:
1.  Review Thematic Groups: Each group from P2S.1 represents utterances sharing a topic within the phase "${input.analyzed_diachronic_unit}".
2.  Define ISUs: For each thematic group, define one or more ISUs. An ISU is a conceptual unit capturing a synchronic experiential element. It's more abstract than the raw utterances.
3.  Extensional Definition: List the specific utterances (by original_line_num) that instantiate this ISU.
4.  Intensional Definition: Provide a conceptual definition of the ISU—what experiential quality or state it represents.
5.  Sub-ISUs (if applicable): If an ISU has clear sub-components, define them hierarchically.
6.  Unique Naming: Each ISU (and sub-ISU) must have a unique \`unit_name\` that's descriptive and meaningful.

Output:
A JSON object adhering EXACTLY to the following structure (NO extra text):
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}",
  "specific_synchronic_units_hierarchy": [
    {
      "unit_name": "UniqueDescriptiveName1",
      "extensional_definition": ["line_num1", "line_num2"],
      "intensional_definition": "Conceptual description of this ISU",
      "sub_units": [] // Empty array if no sub-units, or array of ISUs with same structure
    }
    // ... more ISUs
  ]
}
`,
};