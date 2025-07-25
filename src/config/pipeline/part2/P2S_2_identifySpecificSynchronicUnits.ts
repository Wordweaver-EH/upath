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
1. For each thematic group from P2S.1, identify experiential elements (not just event descriptions).

2. Create ISUs using these rules:
   - Level 1 ISU: Created when segments share a general quality that could have variations
   - Level 2 ISU: Created when segments represent a specific variation of a Level 1 ISU
   - Maximum 2 levels. Start with Level 1 unless variation requires Level 2.

3. Abstraction operations:
   - "generalization": Used when creating Level 1 from varied segments
   - "specification": Used when creating Level 2 as subset of Level 1
   - "aggregation": Used when combining multiple distinct elements

4. Each ISU must:
   - Have a unique unit_name
   - Include all relevant segments from the thematic group
   - Have an intensional_definition focused on experiential quality
   - List any Level 2 ISUs in constituent_lower_units (Level 1 only)

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