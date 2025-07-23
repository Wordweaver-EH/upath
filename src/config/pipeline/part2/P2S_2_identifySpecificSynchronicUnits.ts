import { StepId, P2S_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG: StepConfig = {
  id: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
  title: "P2S.2: Identify Specific Synchronic Units (ISUs) from Segments",
  part: "PartII_Sync",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentDuId) => {
    if (!currentTranscript?.id || !currentDuId) {
      console.error('[P2S_2 Debug] Missing required data:', {
        currentTranscriptId: currentTranscript?.id,
        currentDuId: currentDuId
      });
      return { data: null, error: "Missing current transcript ID or DU ID for P2S.2." };
    }
    
    const p2s_1_data_for_du = allProcessedData?.get(currentTranscript.id)?.p2s_outputs_by_du?.[currentDuId]?.p2s_1_output;

    if (!p2s_1_data_for_du) {
      return { data: null, error: `Missing P2S.1 output for DU '${currentDuId}' for transcript ${currentTranscript.id}` };
    }
    
    // Validate P2S.1 output structure
    if (!p2s_1_data_for_du.synchronic_thematic_groups || !Array.isArray(p2s_1_data_for_du.synchronic_thematic_groups)) {
      return { data: null, error: `Invalid P2S.1 output structure: missing or invalid synchronic_thematic_groups for DU '${currentDuId}'` };
    }
    
    if (p2s_1_data_for_du.synchronic_thematic_groups.length === 0) {
      console.warn(`[P2S_2 Debug] Empty synchronic_thematic_groups for DU '${currentDuId}' - this may indicate no segments were found for this DU`);
    }
    
    return {
      data: p2s_1_data_for_du
    };
  },
  generatePrompt: (input: P2S_1_Output) => `You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups of SEGMENTS from P2S.1 for a GIVEN DIACHRONIC UNIT.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Unit Being Analyzed: "${input.analyzed_du_id}"
- IV Details: "${input.independent_variable_details}"
- DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
- Synchronic thematic groups of segments from P2S.1:
${JSON.stringify(input.synchronic_thematic_groups, null, 2)}

Instructions:
1.  Review Thematic Groups: Each group from P2S.1 represents segments sharing a topic within the DU "${input.analyzed_du_id}".
2.  Define ISUs: For each thematic group, define one or more ISUs. An ISU is a conceptual unit capturing a synchronic experiential element. It's an abstraction of the raw segments.
3.  Create Hierarchy: Organize ISUs into levels (1 for top-level, 2 for sub-units, etc.).
4.  Abstraction Operations: For each ISU, specify the abstraction operation used (e.g., "generalization", "aggregation", "instantiation").
5.  Intensional Definition: Provide a conceptual definition of the ISU—what experiential quality or state it represents.
6.  Grounding: Ground each ISU in the specific segments it is derived from.

Output:
A JSON object adhering EXACTLY to the following structure (NO extra text):
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_du_id": "${input.analyzed_du_id}",
  "specific_synchronic_units_hierarchy": [
    {
      "unit_name": "UniqueDescriptiveName1",
      "level": 1,
      "abstraction_op": "generalization",
      "intensional_definition": "Conceptual description of this ISU",
      "segments": [
        {
          "segment_id": "string",
          "segment_text": "text",
          "temporal_cues": ["..."]
        }
      ],
      "constituent_lower_units": []
    }
    // ... more ISUs
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
};