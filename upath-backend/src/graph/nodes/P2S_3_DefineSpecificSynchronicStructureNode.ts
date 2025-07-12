import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P2S_2_Output, P2S_3_Output, SpecificSynchronicStructure } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P2S_3_DefineSpecificSynchronicStructureNode extends BaseNode {
  id = StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P2S_3] Starting execution for phase:', state.metadata?.currentPhaseName);
    
    // Validate current phase is set
    const currentPhaseName = state.metadata?.currentPhaseName;
    if (!currentPhaseName) {
      throw new Error('Missing currentPhaseName in metadata for P2S.3');
    }
    
    // Get P2S_2 output
    const p2s2Output = state.stepOutputs?.[StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS] as P2S_2_Output | undefined;
    if (!p2s2Output) {
      throw new Error(`P2S_2 output not found for phase '${currentPhaseName}'`);
    }
    
    // Generate synchronic structure
    const result = await this.defineSpecificSynchronicStructure(
      p2s2Output,
      currentPhaseName,
      context
    );
    
    // Validate the network structure
    this.validateNetworkStructure(result.specific_synchronic_structure, p2s2Output);
    
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
  
  private async defineSpecificSynchronicStructure(
    p2s2Output: P2S_2_Output,
    currentPhaseName: string,
    context: ExecutionContext
  ): Promise<P2S_3_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are defining a Specific Synchronic Structure (SSS) for phase "${currentPhaseName}" based on the ISU hierarchy.

CONTEXT:
- Transcript ID: ${p2s2Output.transcript_id}
- Analyzing diachronic unit: ${p2s2Output.analyzed_diachronic_unit}
- Independent Variable: ${p2s2Output.independent_variable_details}
- Dependent Variables: ${p2s2Output.dependent_variable_focus.join(', ')}

ISU HIERARCHY:
${JSON.stringify(p2s2Output.specific_synchronic_units_hierarchy, null, 2)}

TASK: Create a network representation of the synchronic structure showing relationships between ISUs.

REQUIREMENTS:
1. Every ISU must be represented as a network node
2. Links should reflect the hierarchical relationships:
   - Level 0 ISUs link to their parent Level 1 ISUs
   - Level 1 ISUs link to their parent Level 2 ISUs, etc.
3. Link types should describe the abstraction operation (generalization, aggregation, etc.)
4. Node IDs should be simple (n0, n1, n2, etc.) but must map to specific ISUs

OUTPUT FORMAT (JSON):
{
  "transcript_id": "string",
  "analyzed_diachronic_unit": "string",
  "specific_synchronic_structure": {
    "representation_type": "network",
    "description": "<brief description of the structure>",
    "network_nodes": [
      {
        "id": "n<number>",
        "label": "<human-readable label>",
        "source_isu_id": "<ISU unit_name from P2S_2>"
      }
    ],
    "network_links": [
      {
        "from": "n<number>",
        "to": "n<number>",
        "type": "<relationship type>"
      }
    ]
  },
  "independent_variable_details": "string",
  "dependent_variable_focus": ["string"]
}

Ensure all ISUs are included and the network accurately represents the hierarchy.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P2S_3_Output;
        return parsed;
      } catch (error) {
        console.error('[P2S_3] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P2S_3 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P2S_3 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateNetworkStructure(
    structure: SpecificSynchronicStructure,
    p2s2Output: P2S_2_Output
  ): void {
    // Check all ISUs are represented
    const isuIds = new Set(p2s2Output.specific_synchronic_units_hierarchy.map(u => u.unit_name));
    const networkIsuIds = new Set(structure.network_nodes.map(n => n.source_isu_id));
    
    if (isuIds.size !== networkIsuIds.size) {
      throw new Error('Not all ISUs are represented in the network');
    }
    
    for (const isuId of isuIds) {
      if (!networkIsuIds.has(isuId)) {
        throw new Error(`ISU ${isuId} is not represented in the network`);
      }
    }
    
    // Check all links reference valid nodes
    const nodeIds = new Set(structure.network_nodes.map(n => n.id));
    
    for (const link of structure.network_links) {
      if (!nodeIds.has(link.from)) {
        throw new Error(`Network link references non-existent node: ${link.from}`);
      }
      if (!nodeIds.has(link.to)) {
        throw new Error(`Network link references non-existent node: ${link.to}`);
      }
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}