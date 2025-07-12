import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P3_1_Output, P3_2_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P3_2_IdentifyGDUsNode extends BaseNode {
  id = StepId.P3_2_IDENTIFY_GDUS;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P3_2] Starting GDU identification');
    
    // Get P3_1 output
    const p3_1Output = state.stepOutputs?.[StepId.P3_1_ALIGN_STRUCTURES] as P3_1_Output | undefined;
    if (!p3_1Output) {
      throw new Error('P3_1 output not found');
    }
    
    // Get all refined DUs from metadata
    const allRefinedDUs = state.metadata?.all_refined_dus_with_iv_and_ids;
    if (!allRefinedDUs) {
      throw new Error('all_refined_dus_with_iv_and_ids not found in metadata');
    }
    
    if (allRefinedDUs.length === 0) {
      throw new Error('At least 1 RDU is needed for GDU identification');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || p3_1Output.dependent_variable_focus;
    
    // Identify GDUs
    const result = await this.identifyGDUs(
      p3_1Output,
      allRefinedDUs,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateGDUOutput(result, allRefinedDUs);
    
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
  
  private async identifyGDUs(
    p3_1Output: P3_1_Output,
    allRefinedDUs: Array<{
      transcript_id: string;
      refined_du_id: string;
      name: string;
      description: string;
      temporal_phase: string;
      confidence: number;
      iv_details: string;
    }>,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P3_2_Output> {
    const model = context.llmClient as GenerativeModel;
    
    // Create TSV format for efficient processing
    const rduTsv = allRefinedDUs.map(rdu => 
      `${rdu.transcript_id}\t${rdu.refined_du_id}\t${rdu.name}\t${rdu.description}\t${rdu.temporal_phase}\t${rdu.iv_details}`
    ).join('\n');
    
    const prompt = `You are identifying Generic Diachronic Units (GDUs) by clustering semantically similar Refined Diachronic Units (RDUs) from multiple transcripts.

CONTEXT FROM P3.1 ALIGNMENT:
- Aligned Structures Report: ${p3_1Output.aligned_structures_report}
- Common Patterns: ${p3_1Output.common_patterns_summary}
- Key Differences: ${p3_1Output.key_differences.join('; ')}

REFINED DIACHRONIC UNITS TO CLUSTER (TSV format):
transcript_id	refined_du_id	name	description	temporal_phase	iv_details
${rduTsv}

TASK: Create Generic Diachronic Units (GDUs) by clustering functionally similar RDUs across transcripts.

CLUSTERING CRITERIA:
1. Semantic similarity of function/purpose
2. Temporal positioning patterns
3. Cross-transcript consistency
4. Independent Variable variations

RULES:
- Every RDU must be assigned to exactly one GDU
- GDUs should capture common experiential functions
- Note IV variations within each GDU
- Use meaningful GDU IDs (e.g., "GDU_Orientation", "GDU_CoreExploration")

OUTPUT FORMAT (JSON):
{
  "identified_gdus": [
    {
      "gdu_id": "GDU_<descriptive_name>",
      "definition": "<single sentence definition>",
      "supporting_transcripts_count": <number of unique transcripts>,
      "iv_variation_notes": "<how this GDU varies with IVs>",
      "contributing_refined_du_ids": [
        {"transcript_id": "string", "refined_du_id": "string"}
      ]
    }
  ],
  "criteria_for_gdu_identification": "<brief description of clustering criteria used>",
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)},
  "tot_rdus": ${allRefinedDUs.length}
}

Ensure every RDU from the TSV is assigned to exactly one GDU.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P3_2_Output;
        return parsed;
      } catch (error) {
        console.error('[P3_2] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P3_2 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P3_2 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateGDUOutput(
    result: P3_2_Output,
    allRefinedDUs: Array<{
      transcript_id: string;
      refined_du_id: string;
      name: string;
      description: string;
      temporal_phase: string;
      confidence: number;
      iv_details: string;
    }>
  ): void {
    // Check RDU count matches
    if (result.tot_rdus !== allRefinedDUs.length) {
      throw new Error(`RDU count mismatch: expected ${allRefinedDUs.length}, got ${result.tot_rdus}`);
    }
    
    // Collect all assigned RDUs
    const assignedRdus = new Set<string>();
    for (const gdu of result.identified_gdus) {
      for (const contributingRdu of gdu.contributing_refined_du_ids) {
        const rduKey = `${contributingRdu.transcript_id}:${contributingRdu.refined_du_id}`;
        if (assignedRdus.has(rduKey)) {
          throw new Error(`RDU ${rduKey} is assigned to multiple GDUs`);
        }
        assignedRdus.add(rduKey);
      }
    }
    
    // Check all RDUs are assigned
    for (const rdu of allRefinedDUs) {
      const rduKey = `${rdu.transcript_id}:${rdu.refined_du_id}`;
      if (!assignedRdus.has(rduKey)) {
        throw new Error(`Not all RDUs are assigned to GDUs: missing ${rduKey}`);
      }
    }
    
    // Check for valid GDU structure
    if (result.identified_gdus.length === 0) {
      throw new Error('At least one GDU must be identified');
    }
    
    for (const gdu of result.identified_gdus) {
      if (!gdu.gdu_id || !gdu.definition || gdu.contributing_refined_du_ids.length === 0) {
        throw new Error(`Invalid GDU structure: ${gdu.gdu_id}`);
      }
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}