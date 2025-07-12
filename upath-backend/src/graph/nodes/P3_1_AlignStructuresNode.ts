import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P3_1_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P3_1_AlignStructuresNode extends BaseNode {
  id = StepId.P3_1_ALIGN_STRUCTURES;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P3_1] Starting structure alignment');
    
    // Get all specific diachronic structures from metadata
    const allStructures = state.metadata?.all_specific_diachronic_structures;
    if (!allStructures) {
      throw new Error('all_specific_diachronic_structures not found in metadata');
    }
    
    if (allStructures.length < 2) {
      throw new Error('At least 2 structures are needed for alignment');
    }
    
    // Check if any structures have phases
    const hasPhases = allStructures.some(s => 
      s.specific_diachronic_structure.phases && 
      s.specific_diachronic_structure.phases.length > 0
    );
    
    if (!hasPhases) {
      throw new Error('No phases found in any structure for alignment');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    // Perform alignment analysis
    const result = await this.alignStructures(
      allStructures,
      globalDvFocus,
      context
    );
    
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
  
  private async alignStructures(
    allStructures: Array<{
      transcript_id: string;
      filename: string;
      independent_variable_details: string;
      dependent_variable_focus: string[];
      specific_diachronic_structure: {
        summary: string;
        phases: Array<{
          phase_name: string;
          description: string;
          units_involved: string[];
        }>;
        visualization_hint: string;
        iv_preliminary_observation: string;
      };
    }>,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P3_1_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are a Generic Diachronic Analysis assistant. Analyze and align multiple Specific Diachronic Structures (SDS) from different transcripts.

CONTEXT:
- Number of structures to align: ${allStructures.length}
- Global Dependent Variable Focus: ${globalDvFocus.join(', ') || 'Not specified'}

STRUCTURES TO ALIGN:
${JSON.stringify(allStructures, null, 2)}

TASK: Compare all Specific Diachronic Structures to identify:
1. Common phase sequences across transcripts
2. Recurring patterns in progression
3. Structural variations (missing or extra phases)
4. Correlations with Independent Variables

ANALYSIS REQUIREMENTS:
- Systematically compare structures from transcripts with different IVs
- Identify how IVs might correlate with observed structural differences
- Look for phase order variations, phase presence/absence, and phase characteristics

OUTPUT FORMAT (JSON):
{
  "aligned_structures_report": "<detailed comparison of structures, highlighting similarities and differences>",
  "common_patterns_summary": "<summary of common diachronic patterns across all transcripts>",
  "key_differences": [
    "<significant structural difference 1, especially IV-linked>",
    "<significant structural difference 2>",
    ...
  ],
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Provide comprehensive analysis focusing on structural alignment and IV correlations.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P3_1_Output;
        return parsed;
      } catch (error) {
        console.error('[P3_1] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P3_1 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P3_1 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}