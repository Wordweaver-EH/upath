import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P3_1_Output, P3_2_Output, P3_3_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P3_3_DefineGenericDiachronicStructureNode extends BaseNode {
  id = StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P3_3] Starting Generic Diachronic Structure definition');
    
    // Get P3_1 output
    const p3_1Output = state.stepOutputs?.[StepId.P3_1_ALIGN_STRUCTURES] as P3_1_Output | undefined;
    if (!p3_1Output) {
      throw new Error('P3_1 output not found');
    }
    
    // Get P3_2 output
    const p3_2Output = state.stepOutputs?.[StepId.P3_2_IDENTIFY_GDUS] as P3_2_Output | undefined;
    if (!p3_2Output) {
      throw new Error('P3_2 output not found');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || p3_1Output.dependent_variable_focus;
    
    // Define Generic Diachronic Structure
    const result = await this.defineGenericDiachronicStructure(
      p3_1Output,
      p3_2Output,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateGDSOutput(result, p3_2Output);
    
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
  
  private async defineGenericDiachronicStructure(
    p3_1Output: P3_1_Output,
    p3_2Output: P3_2_Output,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P3_3_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are defining the Generic Diachronic Structure (GDS) based on aligned structures and identified GDUs.

STRUCTURAL ALIGNMENT RESULTS (P3.1):
- Aligned Structures Report: ${p3_1Output.aligned_structures_report}
- Common Patterns Summary: ${p3_1Output.common_patterns_summary}
- Key Differences: ${p3_1Output.key_differences.join('; ')}

IDENTIFIED GENERIC DIACHRONIC UNITS (P3.2):
${JSON.stringify(p3_2Output.identified_gdus, null, 2)}

GDU IDENTIFICATION CRITERIA: ${p3_2Output.criteria_for_gdu_identification}

TASK: Synthesize the above information to define the Generic Diachronic Structure.

DEFINITION REQUIREMENTS:
1. **Core GDUs**: Essential units that appear across most/all experiences
2. **Optional GDUs**: Units that may or may not appear depending on conditions
3. **Typical Sequence**: Most common temporal ordering of GDUs
4. **Variants**: How the structure varies with Independent Variables

ANALYSIS GUIDELINES:
- Consider GDU support across transcripts (higher support = more likely core)
- Examine IV variation notes to understand when units are optional
- Use P3.1 patterns to understand typical sequencing
- Balance universality with meaningful variation

OUTPUT FORMAT (JSON):
{
  "generic_diachronic_structure_definition": {
    "name": "<descriptive name for the experiential journey>",
    "description": "<comprehensive description of the generic experiential structure>",
    "core_gdus": ["<gdu_id1>", "<gdu_id2>"],
    "optional_gdus": ["<gdu_id3>", "<gdu_id4>"],
    "typical_sequence": ["<gdu_id1>", "<gdu_id3>", "<gdu_id2>"]
  },
  "variants_summary": "<how the structure varies based on different Independent Variables>",
  "confidence_level": "<High|Medium|Low based on consistency and support>",
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Ensure all referenced GDU IDs exist in the P3.2 output.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P3_3_Output;
        return parsed;
      } catch (error) {
        console.error('[P3_3] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P3_3 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P3_3 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateGDSOutput(result: P3_3_Output, p3_2Output: P3_2_Output): void {
    const validGduIds = new Set(p3_2Output.identified_gdus.map(gdu => gdu.gdu_id));
    
    // Validate confidence level
    const validConfidenceLevels = ['High', 'Medium', 'Low'];
    if (!validConfidenceLevels.includes(result.confidence_level)) {
      throw new Error(`Invalid confidence level: ${result.confidence_level}`);
    }
    
    // Validate core GDUs exist
    for (const coreGduId of result.generic_diachronic_structure_definition.core_gdus) {
      if (!validGduIds.has(coreGduId)) {
        throw new Error(`Core GDU ${coreGduId} not found in identified GDUs`);
      }
    }
    
    // Validate optional GDUs exist
    for (const optionalGduId of result.generic_diachronic_structure_definition.optional_gdus) {
      if (!validGduIds.has(optionalGduId)) {
        throw new Error(`Optional GDU ${optionalGduId} not found in identified GDUs`);
      }
    }
    
    // Validate typical sequence GDUs exist
    for (const sequenceGduId of result.generic_diachronic_structure_definition.typical_sequence) {
      if (!validGduIds.has(sequenceGduId)) {
        throw new Error(`Sequence GDU ${sequenceGduId} not found in identified GDUs`);
      }
    }
    
    // Validate structure has required fields
    const gds = result.generic_diachronic_structure_definition;
    if (!gds.name || !gds.description || !gds.core_gdus || !gds.typical_sequence) {
      throw new Error('Generic Diachronic Structure definition is missing required fields');
    }
    
    // Validate at least one core GDU
    if (gds.core_gdus.length === 0) {
      throw new Error('At least one core GDU must be defined');
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}