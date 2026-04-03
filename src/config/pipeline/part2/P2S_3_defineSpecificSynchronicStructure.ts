import { StepId, P2S_2_Output, P2S_3_Output } from '../../../../types';
import { StepConfig } from '../types';
import { transformSynchronicToMermaid } from '../../../utils/visualizationHelper';

export const P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  title: "P2S.3: Define Specific Synchronic Structure (SSS) within a Diachronic Unit",
  part: "PartII_Sync",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentDuId?: string) => {
    if (!currentTranscript?.id) {
      console.error('[P2S_3 Debug] Missing transcript ID');
      return { data: null, error: "Missing current transcript ID for P2S.3" };
    }
    
    if (!currentDuId) {
      console.error('[P2S_3 Debug] Missing DU ID');
      return { data: null, error: "Missing current DU ID for P2S.3" };
    }
    
    if (!allProcessedData) {
      return { data: null, error: "Missing processed data for P2S.3" };
    }
    
    const transcriptData = allProcessedData.get(currentTranscript.id);
    if (!transcriptData) {
      return { data: null, error: `No processed data found for transcript ${currentTranscript.id}` };
    }
    
    const p2s_du_data = transcriptData.p2s_outputs_by_du?.[currentDuId];
    if (!p2s_du_data?.p2s_2_output) {
      return { data: null, error: `P2S.2 output not found for DU "${currentDuId}" in P2S.3` };
    }
    
    // Validate P2S.2 output structure
    const p2s_2_output = p2s_du_data.p2s_2_output;
    if (!p2s_2_output.specific_synchronic_units_hierarchy || !Array.isArray(p2s_2_output.specific_synchronic_units_hierarchy)) {
      return { data: null, error: `Invalid P2S.2 output structure: missing or invalid specific_synchronic_units_hierarchy for DU '${currentDuId}'` };
    }
    
    if (p2s_2_output.specific_synchronic_units_hierarchy.length === 0) {
      console.warn(`[P2S_3 Debug] Empty specific_synchronic_units_hierarchy for DU '${currentDuId}'`);
    }
    
    return { data: p2s_2_output };
  },
  generatePrompt: (input: P2S_2_Output) => `You are a micro-phenomenological analyst. Task: Final step of Specific Synchronic Analysis - Define the Specific Synchronic Structure (SSS) as a semantic network.
Input:
JSON output from P2S.2 (ISU hierarchy, where each ISU has a unique \`unit_name\`) for transcript ID ${input.transcript_id} and diachronic unit "${input.analyzed_du_id}".
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
4.  Overall Structure Description: Summarize the SSS for this DU.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_du_id": "${input.analyzed_du_id}",
  "specific_synchronic_structure": {
    "representation_type": "Semantic Network",
    "description": "Summary of the SSS for DU '${input.analyzed_du_id}'",
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
        "from": "sss_node_ID1",
        "to": "sss_node_ID2",
        "type": "hierarchical|associative|causal|etc"
      }
      // ... more links
    ]
  },
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  saveToTranscript: (transcript, output, duId) => {
    if (!duId) {
      console.error('[P2S.3] No DU ID provided to saveToTranscript');
      return transcript;
    }
    
    // Generate mermaid syntax for the synchronic structure
    let mermaidSyntax: string | undefined;
    if (output && (output as P2S_3_Output).specific_synchronic_structure) {
      mermaidSyntax = transformSynchronicToMermaid((output as P2S_3_Output).specific_synchronic_structure, duId);
    }
    
    const p2sOutputs = transcript.p2s_outputs_by_du || {};
    p2sOutputs[duId] = {
      ...p2sOutputs[duId],
      p2s_3_output: output,
      p2s_3_error: undefined,
      ...(mermaidSyntax && { p2s_3_mermaid_syntax: mermaidSyntax })
    };
    
    return {
      ...transcript,
      p2s_outputs_by_du: p2sOutputs
    };
  }
};