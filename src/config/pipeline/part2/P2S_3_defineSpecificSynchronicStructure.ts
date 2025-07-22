import { StepId, P2S_2_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  title: "P2S.3: Define Specific Synchronic Structure (SSS)",
  part: "PartII_Sync",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentPhaseName?: string) => {
    if (!currentTranscript || !allProcessedData) return { data: null, error: "Missing current transcript or processed data for P2S.3" };
    const transcriptData = allProcessedData.get(currentTranscript.id);
    if (!transcriptData) return { data: null, error: `No processed data found for transcript ${currentTranscript.id}` };
    const p2s_phase_data = transcriptData.p2s_outputs_by_phase?.[currentPhaseName || ''];
    if (!p2s_phase_data?.p2s_2_output) return { data: null, error: `P2S.2 output not found for phase "${currentPhaseName}" in P2S.3` };
    return { data: p2s_phase_data.p2s_2_output }; // P2S.2 output contains ISUs with unit_names
  },
  generatePrompt: (input: P2S_2_Output) => `You are a micro-phenomenological analyst. Task: Final step of Specific Synchronic Analysis - Define the Specific Synchronic Structure (SSS) as a semantic network.
Input:
JSON output from P2S.2 (ISU hierarchy, where each ISU has a unique \`unit_name\`) for transcript ID ${input.transcript_id} and diachronic unit/phase "${input.analyzed_diachronic_unit}".
${JSON.stringify(input, null, 2)}

Instructions:
1.  Model ISUs as Network: Transform the \`specific_synchronic_units_hierarchy\` from P2S.2 into a semantic network. ISUs become nodes. Relationships (hierarchical, associative) become links.
2.  Define Nodes: Each node in \`network_nodes\` corresponds to an ISU from P2S.2.
    *   \`id\`: A unique ID for this SSS network node (e.g., "sss_node_VisualQualityVivid"). Can be based on the ISU's \`unit_name\`.
    *   \`label\`: A descriptive label for the node, typically the ISU's \`unit_name\` or \`intensional_definition\`.
    *   \`source_isu_id\`: The \`unit_name\` of the ISU from P2S.2 that this network node represents. This is crucial for traceability.
3.  Define Links: Identify relationships between ISUs. Types include:
    *   Hierarchical (parent-child from P2S.2)
    *   Associative (e.g., "influences", "precedes", "co-occurs with")
    *   Causal (if one ISU leads to another)
4.  Overall Structure Description: Summarize the SSS for this phase/unit.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}",
  "network_nodes": [
    {
      "id": "sss_node_UniqueID1",
      "label": "Descriptive Label",
      "source_isu_id": "ISU unit_name from P2S.2"
    }
    // ... more nodes
  ],
  "network_links": [
    {
      "source": "sss_node_ID1",
      "target": "sss_node_ID2",
      "relationship": "hierarchical|associative|causal|etc",
      "description": "Brief description of the relationship"
    }
    // ... more links
  ],
  "overall_structure_description": "Summary of the SSS for phase '${input.analyzed_diachronic_unit}'"
}
`,
};