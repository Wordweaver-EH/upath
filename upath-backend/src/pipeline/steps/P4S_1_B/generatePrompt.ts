/**
 * P4S_1_B Define GSS from Groups - Prompt Generation
 * EXACT COPY of working prototype's prompt template
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P4S_1_B_Input } from './types';

/**
 * Generate prompt for P4S_1_B step
 * EXACT COPY of working prototype's generatePrompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P4S_1_B_Input): string => {
  // EXACT prompt template from the working prototype
  return `You are a Generic Synchronic Analysis assistant. Your task is to define a Generic Synchronic Structure (GSS) for a specific GDU by abstracting from the provided groups of SSS nodes. This is step P4S.1.B.
Input:
- Data from P4S.1.A for GDU "${inputData.p4s_1_a_data.analyzed_gdu}":
  - Analyzed GDU ID: "${inputData.p4s_1_a_data.analyzed_gdu}"
  - SSS Node Groups (\`sss_node_groups\`). Each group has a rationale and a list of \`contributing_sss_nodes\` from various transcripts:
    \`\`\`json
    ${JSON.stringify(inputData.p4s_1_a_data.sss_node_groups, null, 2)}
    \`\`\`
  - Dependent Variable Focus from P4S.1.A: ${JSON.stringify(inputData.p4s_1_a_data.dependent_variable_focus)}
- Global DV Focus (for consistency check): ${JSON.stringify(inputData.global_dv_focus)}

Instructions:
1.  **Define Generic Categories from SSS Node Groups:** For each \`SSSNodeGroup\` in the input, define a corresponding generic category in the output's \`generic_nodes_categories\`. The category's \`label\` should be an abstraction of the \`group_rationale\`. Assign a unique \`id\` (e.g., "gss_cat_CognitiveProcessing").
2.  **Define Generic Links:** Infer relationships **between the SSS node groups** to create \`generic_network_links\` between your new generic categories.
3.  **MANDATORY: Populate Instantiation Notes with Traceability:** This is the most critical step. For EACH generic category you create, you MUST create a corresponding \`instantiation_notes\` object.
    *   The \`generic_category_id\` MUST match the ID of the generic category it describes.
    *   The \`example_specific_nodes\` array in your output **MUST** be populated **directly and exactly** from the \`contributing_sss_nodes\` array of the corresponding \`SSSNodeGroup\` from the input. Copy the \`transcript_id\`, \`sss_node_id\`, and \`phase_name\` for each contributing node. **DO NOT invent, summarize, or omit these examples.** This provides a verifiable audit trail.
4.  **Optional IV Observations:** In \`variations_notes\`, if you notice patterns in the SSS node groups that coincidentally align with different Independent Variables from the source transcripts, you may note them as incidental observations. This is not a primary focus of the analysis.
5.  **Final JSON:** Ensure the final output is a single, valid JSON object adhering to the specified structure. Do not add any text or markdown outside the JSON.

Output:
A JSON object adhering EXACTLY to the following structure. The \`example_specific_nodes\` array within each \`instantiation_notes\` object MUST NOT be empty and must be populated from the input.
{
  "analyzed_gdu": "${inputData.p4s_1_a_data.analyzed_gdu}",
  "generic_synchronic_structure": {
    "representation_type": "Semantic Network",
    "description": "Description of GSS for GDU '${inputData.p4s_1_a_data.analyzed_gdu}', derived from SSS node groups.",
    "generic_nodes_categories": [
      {"id": "gss_cat_FromGroup1", "label": "Generic Concept from SSS Group 1"}
    ],
    "generic_network_links": [
      {"from": "gss_cat_FromGroup1", "to": "gss_cat_FromGroup2", "type": "is_related_to"}
    ],
    "instantiation_notes": [
      {
        "generic_category_id": "gss_cat_FromGroup1",
        "textual_description": "This category is instantiated by specific SSS nodes related to X, as identified in SSS Group Y.",
        "example_specific_nodes": [ 
          { "transcript_id": "(from input SSSNodeGroup)", "sss_node_id": "(from input SSSNodeGroup)", "phase_name": "(from input SSSNodeGroup)" }
        ]
      }
    ]
  },
  "variations_notes": "Optional: Incidental observations about patterns that coincidentally align with IVs, if any are noticed.",
  "dependent_variable_focus": ${JSON.stringify(inputData.p4s_1_a_data.dependent_variable_focus)}
}`;