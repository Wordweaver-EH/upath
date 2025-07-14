/**
 * P4S_1_A Identify and Group SSS Nodes - Prompt Generation
 * EXACT COPY of working prototype's prompt template
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P4S_1_A_Input } from './types';

/**
 * Generate prompt for P4S_1_A step
 * EXACT COPY of working prototype's generatePrompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P4S_1_A_Input): string => {
  // EXACT prompt template from the working prototype
  return `You are a Generic Synchronic Analysis assistant. Task: Classify SSS nodes into cross-transcript semantic groups for Generic Synchronic Structure (GSS) formation.

**GDU to Analyze:** ${inputData.gdu_to_analyze_id}
**GDU Definition:** ${inputData.gdu_definition}
**Global DV Focus:** ${JSON.stringify(inputData.global_dv_focus)}

**Nodes TSV (Parts List):** Utterance-grounded SSS nodes and their semantic definitions:
\`\`\`
${inputData.nodes_tsv}
\`\`\`

**Structures Mermaid (Assembly Diagram):** Relationships of nodes within their original transcript-phase structures:
\`\`\`
${inputData.structures_mermaid}
\`\`\`

**Classification Rules:**
1. **Semantic Analysis:** Use \`sss_node_label\` and \`isu_definition\` to understand each node's meaning.
2. **Cross-Transcript Requirement:** Groups must contain nodes from at least 2 different \`transcript_ids\`.
3. **Semantic Similarity:** Group nodes that represent the same generic concept across transcripts.
4. **Exclusion Option:** Assign \`group_id: "N/A"\` if a node doesn't fit any cross-transcript group.

**CRITICAL:** The \`sss_node_id\` values in your output must be exactly copied from the input TSV.

**Output:** Return a JSON object with this EXACT structure:
\`\`\`json
{
  "analyzed_gdu": "${inputData.gdu_to_analyze_id}",
  "grouped_data": [
    {
      "sss_node_id": "(exactly copied from TSV)",
      "transcript_id": "(exactly copied from TSV)",
      "phase_name": "(exactly copied from TSV)",
      "sss_node_label": "(exactly copied from TSV)",
      "group_id": "generic_concept_name_or_N/A",
      "group_rationale": "Brief explanation of why this node belongs to this group"
    }
  ],
  "classification_notes": "Optional notes about your classification decisions"
}
\`\`\`

**Verification:** Your \`grouped_data\` array must contain exactly one object for every \`sss_node_id\` from the input TSV, with no new or omitted nodes.`;
};