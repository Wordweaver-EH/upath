import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P4S_1_B_Output, P4S_1_A_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P4S_1_B_DefineGSSFromGroupsNode extends BaseNode {
  id = StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P4S_1_B] Starting GSS definition from grouped SSS nodes');
    
    // Get current GDU being processed
    const currentGduId = state.metadata?.current_gdu_id;
    if (!currentGduId) {
      throw new Error('current_gdu_id not found in metadata');
    }
    
    // Get P4S_1_A output
    const p4s1aOutput = state.stepOutputs?.[StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES] as P4S_1_A_Output;
    if (!p4s1aOutput) {
      throw new Error('P4S_1_A output not found');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    console.log(`[P4S_1_B] Processing ${p4s1aOutput.grouped_data.length} grouped SSS nodes for GDU: ${currentGduId}`);
    
    // If no grouped data, return empty GSS
    if (p4s1aOutput.grouped_data.length === 0) {
      return {
        ...state,
        currentStep: this.id,
        lastCompletedStep: this.id,
        stepOutputs: {
          ...state.stepOutputs,
          [this.id]: {
            analyzed_gdu: currentGduId,
            generic_synchronic_structure: {
              generic_nodes_categories: [],
              generic_network_links: [],
              instantiation_notes: {}
            },
            dependent_variable_focus: globalDvFocus
          }
        },
        metadata: {
          ...state.metadata,
          lastUpdateTime: Date.now()
        }
      };
    }
    
    // Define GSS from grouped SSS nodes
    const result = await this.defineGSSFromGroups(
      currentGduId,
      p4s1aOutput.grouped_data,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateGSSOutput(result, p4s1aOutput.grouped_data);
    
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
  
  private async defineGSSFromGroups(
    currentGduId: string,
    groupedData: P4S_1_A_Output['grouped_data'],
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P4S_1_B_Output> {
    const model = context.llmClient as GenerativeModel;
    
    // Create TSV format for grouped SSS nodes
    const groupedNodesTsv = groupedData.map(node =>
      `${node.sss_node_id}\t${node.transcript_id}\t${node.phase_name}\t${node.sss_node_label}\t${node.group_id}\t${node.group_rationale}`
    ).join('\n');
    
    // Extract unique group IDs
    const uniqueGroups = [...new Set(groupedData.map(node => node.group_id))];
    
    const prompt = `You are defining a Generic Synchronic Structure (GSS) from grouped Specific Synchronic Structure (SSS) nodes for the Generic Diachronic Unit: "${currentGduId}".

TASK: Transform the grouped SSS nodes into abstract generic node categories and define their relationships.

GROUPED SSS NODES (TSV format):
sss_node_id\ttranscript_id\tphase_name\tsss_node_label\tgroup_id\tgroup_rationale
${groupedNodesTsv}

UNIQUE GROUPS IDENTIFIED: ${uniqueGroups.join(', ')}

GSS DEFINITION REQUIREMENTS:
1. Create abstract generic node categories that represent the cognitive/experiential functions
2. Define relationships between categories (feeds_into, enables, supports, etc.)
3. Map which SSS nodes instantiate each category
4. Focus on dependent variables: ${globalDvFocus.join(', ')}

ABSTRACTION PRINCIPLES:
- Move from specific instances to generic cognitive functions
- Identify functional relationships between categories
- Maintain connection to dependent variables
- Create reusable categories for cross-transcript analysis

OUTPUT FORMAT (JSON):
{
  "analyzed_gdu": "${currentGduId}",
  "generic_synchronic_structure": {
    "generic_nodes_categories": [
      {
        "category_id": "unique_category_name",
        "definition": "abstract definition of cognitive function",
        "abstraction_level": "High|Medium|Low"
      }
    ],
    "generic_network_links": [
      {
        "from_category": "source_category_id",
        "to_category": "target_category_id", 
        "relationship_type": "feeds_into|enables|supports|etc",
        "description": "explanation of relationship"
      }
    ],
    "instantiation_notes": {
      "category_id": ["list", "of", "sss_node_ids", "that", "instantiate", "this", "category"]
    }
  },
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Ensure every group ID has a corresponding generic category and all SSS nodes are mapped to categories.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P4S_1_B_Output;
        return parsed;
      } catch (error) {
        console.error('[P4S_1_B] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P4S_1_B response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P4S_1_B LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateGSSOutput(
    result: P4S_1_B_Output,
    groupedData: P4S_1_A_Output['grouped_data']
  ): void {
    const gss = result.generic_synchronic_structure;
    
    // Check all categories have required fields
    for (const category of gss.generic_nodes_categories) {
      if (!category.category_id || !category.definition || !category.abstraction_level) {
        throw new Error(`Generic category missing required fields: ${category.category_id}`);
      }
    }
    
    // Check all network links reference valid categories
    const categoryIds = new Set(gss.generic_nodes_categories.map(c => c.category_id));
    for (const link of gss.generic_network_links) {
      if (!categoryIds.has(link.from_category)) {
        throw new Error(`Network link references non-existent from_category: ${link.from_category}`);
      }
      if (!categoryIds.has(link.to_category)) {
        throw new Error(`Network link references non-existent to_category: ${link.to_category}`);
      }
      if (!link.relationship_type || !link.description) {
        throw new Error(`Network link missing required fields: ${link.from_category} -> ${link.to_category}`);
      }
    }
    
    // Check instantiation notes reference valid categories
    for (const categoryId of Object.keys(gss.instantiation_notes)) {
      if (!categoryIds.has(categoryId)) {
        throw new Error(`Instantiation note references non-existent category: ${categoryId}`);
      }
    }
    
    // Check all SSS nodes are mapped to some category
    const inputSSSNodeIds = new Set(groupedData.map(node => node.sss_node_id));
    const mappedSSSNodeIds = new Set();
    
    for (const sssNodeIds of Object.values(gss.instantiation_notes)) {
      for (const sssNodeId of sssNodeIds) {
        mappedSSSNodeIds.add(sssNodeId);
      }
    }
    
    for (const inputSSSNodeId of inputSSSNodeIds) {
      if (!mappedSSSNodeIds.has(inputSSSNodeId)) {
        throw new Error(`SSS node not mapped to any category: ${inputSSSNodeId}`);
      }
    }
    
    // Check no extra SSS nodes in mapping
    for (const mappedSSSNodeId of mappedSSSNodeIds) {
      if (!inputSSSNodeIds.has(mappedSSSNodeId)) {
        throw new Error(`Extra SSS node in mapping that wasn't in input: ${mappedSSSNodeId}`);
      }
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}