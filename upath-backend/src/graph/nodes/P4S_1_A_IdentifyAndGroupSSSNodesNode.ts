import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P4S_1_A_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P4S_1_A_IdentifyAndGroupSSSNodesNode extends BaseNode {
  id = StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P4S_1_A] Starting SSS node identification and grouping');
    
    // Get current GDU being processed
    const currentGduId = state.metadata?.current_gdu_id;
    if (!currentGduId) {
      throw new Error('current_gdu_id not found in metadata');
    }
    
    // Get all SSS data
    const allSSSData = state.metadata?.all_sss_data;
    if (!allSSSData) {
      throw new Error('all_sss_data not found in metadata');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    // Filter SSS nodes that contribute to this GDU
    const relevantSSSNodes = this.extractRelevantSSSNodes(allSSSData, currentGduId);
    
    console.log(`[P4S_1_A] Found ${relevantSSSNodes.length} SSS nodes for GDU: ${currentGduId}`);
    
    // If no SSS nodes found, return empty result
    if (relevantSSSNodes.length === 0) {
      return {
        ...state,
        currentStep: this.id,
        lastCompletedStep: this.id,
        stepOutputs: {
          ...state.stepOutputs,
          [this.id]: {
            analyzed_gdu: currentGduId,
            grouped_data: [],
            dependent_variable_focus: globalDvFocus
          }
        },
        metadata: {
          ...state.metadata,
          lastUpdateTime: Date.now()
        }
      };
    }
    
    // Group SSS nodes semantically
    const result = await this.identifyAndGroupSSSNodes(
      currentGduId,
      relevantSSSNodes,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateGroupingOutput(result, relevantSSSNodes);
    
    // Update state
    return {
      ...state,
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: result
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: Date.now()
      }
    };
  }
  
  private extractRelevantSSSNodes(
    allSSSData: Array<{
      transcript_id: string;
      phase_name: string;
      gdu_ids: string[];
      sss_nodes: Array<{
        sss_node_id: string;
        sss_node_label: string;
        sss_node_definition?: string;
      }>;
    }>,
    currentGduId: string
  ): Array<{
    sss_node_id: string;
    transcript_id: string;
    phase_name: string;
    sss_node_label: string;
    sss_node_definition?: string;
  }> {
    const relevantNodes: Array<{
      sss_node_id: string;
      transcript_id: string;
      phase_name: string;
      sss_node_label: string;
      sss_node_definition?: string;
    }> = [];
    
    for (const transcriptData of allSSSData) {
      // Check if this transcript/phase contributes to the current GDU
      if (transcriptData.gdu_ids.includes(currentGduId)) {
        for (const sssNode of transcriptData.sss_nodes) {
          relevantNodes.push({
            sss_node_id: sssNode.sss_node_id,
            transcript_id: transcriptData.transcript_id,
            phase_name: transcriptData.phase_name,
            sss_node_label: sssNode.sss_node_label,
            sss_node_definition: sssNode.sss_node_definition
          });
        }
      }
    }
    
    return relevantNodes;
  }
  
  private async identifyAndGroupSSSNodes(
    currentGduId: string,
    relevantSSSNodes: Array<{
      sss_node_id: string;
      transcript_id: string;
      phase_name: string;
      sss_node_label: string;
      sss_node_definition?: string;
    }>,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P4S_1_A_Output> {
    const model = context.llmClient as GenerativeModel;
    
    // Create TSV format for efficient processing
    const sssNodesTsv = relevantSSSNodes.map(node =>
      `${node.sss_node_id}\t${node.transcript_id}\t${node.phase_name}\t${node.sss_node_label}\t${node.sss_node_definition || ''}`
    ).join('\n');
    
    const prompt = `You are grouping Specific Synchronic Structure (SSS) nodes from across transcripts that all contribute to the Generic Diachronic Unit: "${currentGduId}".

TASK: Identify semantic groups among the SSS nodes and classify each node into appropriate cross-transcript groups.

SSS NODES TO GROUP (TSV format):
sss_node_id	transcript_id	phase_name	sss_node_label	sss_node_definition
${sssNodesTsv}

GROUPING CRITERIA:
1. Semantic similarity of cognitive/experiential function
2. Cross-transcript patterns (same group can appear in multiple transcripts)
3. Functional relationships to the GDU "${currentGduId}"
4. Related to dependent variables: ${globalDvFocus.join(', ')}

RULES:
- Every SSS node must be included in the output
- Assign meaningful group_id labels (e.g., "visual_attention_processes", "spatial_cognition")
- Use "N/A" for nodes that don't fit any semantic group
- Provide clear rationale for each grouping decision

OUTPUT FORMAT (JSON):
{
  "analyzed_gdu": "${currentGduId}",
  "grouped_data": [
    {
      "sss_node_id": "string",
      "transcript_id": "string", 
      "phase_name": "string",
      "sss_node_label": "string",
      "group_id": "semantic_group_name",
      "group_rationale": "brief explanation for grouping"
    }
  ],
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Ensure every SSS node from the TSV is included with appropriate grouping.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P4S_1_A_Output;
        return parsed;
      } catch (error) {
        console.error('[P4S_1_A] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P4S_1_A response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P4S_1_A LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateGroupingOutput(
    result: P4S_1_A_Output,
    relevantSSSNodes: Array<{
      sss_node_id: string;
      transcript_id: string;
      phase_name: string;
      sss_node_label: string;
      sss_node_definition?: string;
    }>
  ): void {
    // Check all input SSS nodes are included in output
    const inputNodeIds = new Set(relevantSSSNodes.map(node => node.sss_node_id));
    const outputNodeIds = new Set(result.grouped_data.map(node => node.sss_node_id));
    
    for (const inputNodeId of inputNodeIds) {
      if (!outputNodeIds.has(inputNodeId)) {
        throw new Error(`Not all SSS nodes are included in grouped output: missing ${inputNodeId}`);
      }
    }
    
    // Check no extra nodes in output
    for (const outputNodeId of outputNodeIds) {
      if (!inputNodeIds.has(outputNodeId)) {
        throw new Error(`Extra SSS node in output that wasn't in input: ${outputNodeId}`);
      }
    }
    
    // Validate each grouped node has required fields
    for (const groupedNode of result.grouped_data) {
      if (!groupedNode.sss_node_id || !groupedNode.transcript_id || 
          !groupedNode.phase_name || !groupedNode.sss_node_label || 
          !groupedNode.group_id || !groupedNode.group_rationale) {
        throw new Error(`Grouped node missing required fields: ${groupedNode.sss_node_id}`);
      }
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}