import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P5_1_Output, P3_3_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P5_1_ComparativeAnalysisNode extends BaseNode {
  id = StepId.P5_1_IV_COMPARATIVE_ANALYSIS;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P5_1] Starting IV comparative analysis');
    
    // Get P3_3 output (Generic Diachronic Structure)
    const p3_3Output = state.stepOutputs?.[StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE] as P3_3_Output;
    if (!p3_3Output) {
      throw new Error('P3_3 output not found');
    }
    
    // Get all specific diachronic structures
    const allSpecificStructures = state.metadata?.all_specific_diachronic_structures;
    if (!allSpecificStructures || allSpecificStructures.length === 0) {
      throw new Error('all_specific_diachronic_structures not found in metadata');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    console.log(`[P5_1] Analyzing ${allSpecificStructures.length} specific structures against generic structure`);
    
    // Perform comparative analysis
    const result = await this.performComparativeAnalysis(
      p3_3Output,
      allSpecificStructures,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateComparativeOutput(result);
    
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
  
  private async performComparativeAnalysis(
    gds: P3_3_Output,
    specificStructures: Array<{
      transcript_id: string;
      filename: string;
      independent_variable_details: string;
      dependent_variable_focus: string[];
      specific_diachronic_structure: any;
    }>,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P5_1_Output> {
    const model = context.llmClient as GenerativeModel;
    
    // Create TSV format for specific structures with IV details
    const structuresTsv = specificStructures.map(struct => 
      `${struct.transcript_id}\t${struct.filename}\t${struct.independent_variable_details}\t${JSON.stringify(struct.dependent_variable_focus)}\t${struct.specific_diachronic_structure.summary}\t${struct.specific_diachronic_structure.iv_preliminary_observation}`
    ).join('\n');
    
    // Extract unique IV values
    const uniqueIVs = [...new Set(specificStructures.map(s => s.independent_variable_details))];
    
    const prompt = `You are performing comparative analysis of specific diachronic structures against the generic diachronic structure to understand how the independent variable affects cognitive processes.

GENERIC DIACHRONIC STRUCTURE:
Name: ${gds.generic_diachronic_structure_definition.name}
Description: ${gds.generic_diachronic_structure_definition.description}
Core GDUs: ${gds.generic_diachronic_structure_definition.core_gdus.join(', ')}
Optional GDUs: ${gds.generic_diachronic_structure_definition.optional_gdus.join(', ')}
Typical Sequence: ${gds.generic_diachronic_structure_definition.typical_sequence.join(' → ')}
Variants Summary: ${gds.variants_summary}
Confidence: ${gds.confidence_level}

SPECIFIC STRUCTURES TO COMPARE (TSV format):
transcript_id\tfilename\tindependent_variable_details\tdependent_variable_focus\tstructure_summary\tiv_preliminary_observation
${structuresTsv}

UNIQUE IV VALUES: ${uniqueIVs.join(', ')}

COMPARATIVE ANALYSIS TASK:
1. Identify patterns in how different IV levels affect the generic structure
2. Analyze how IV variations influence specific phases/GDUs
3. Examine dependent variable outcomes across IV conditions
4. Extract methodological insights about the analysis approach

ANALYSIS FOCUS:
- Dependent Variables: ${globalDvFocus.join(', ')}
- Independent Variable Effects on Generic Structure
- Cross-condition patterns and variations
- Cognitive process modulations

OUTPUT FORMAT (JSON):
{
  "comparative_analysis_summary": "comprehensive summary of how IV affects the generic diachronic structure",
  "identified_iv_patterns": [
    {
      "iv_value": "specific IV condition/level",
      "pattern_description": "how this IV level manifests in the diachronic structure",
      "supporting_transcript_ids": ["list", "of", "transcript_ids"],
      "gds_alignment_notes": "how this pattern aligns with or deviates from the generic structure"
    }
  ],
  "iv_effect_on_gds": "overall assessment of how the IV modulates the generic diachronic structure",
  "dv_outcome_patterns": [
    {
      "dv_name": "dependent variable name",
      "pattern_across_iv_levels": "how this DV changes across different IV conditions"
    }
  ],
  "methodological_insights": [
    "insight about the analysis methodology",
    "another insight about patterns discovered"
  ],
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Ensure all transcript IDs are correctly referenced and patterns are evidence-based.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P5_1_Output;
        return parsed;
      } catch (error) {
        console.error('[P5_1] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P5_1 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P5_1 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateComparativeOutput(result: P5_1_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'comparative_analysis_summary',
      'identified_iv_patterns',
      'iv_effect_on_gds',
      'dv_outcome_patterns',
      'methodological_insights',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate IV patterns
    if (!Array.isArray(result.identified_iv_patterns)) {
      throw new Error('identified_iv_patterns must be an array');
    }
    
    for (const pattern of result.identified_iv_patterns) {
      if (!pattern.iv_value || !pattern.pattern_description || 
          !pattern.supporting_transcript_ids || !pattern.gds_alignment_notes) {
        throw new Error(`IV pattern missing required fields: ${pattern.iv_value}`);
      }
      
      if (!Array.isArray(pattern.supporting_transcript_ids)) {
        throw new Error(`supporting_transcript_ids must be an array for pattern: ${pattern.iv_value}`);
      }
    }
    
    // Validate DV outcome patterns
    if (!Array.isArray(result.dv_outcome_patterns)) {
      throw new Error('dv_outcome_patterns must be an array');
    }
    
    for (const dvPattern of result.dv_outcome_patterns) {
      if (!dvPattern.dv_name || !dvPattern.pattern_across_iv_levels) {
        throw new Error(`DV pattern missing required fields: ${dvPattern.dv_name}`);
      }
    }
    
    // Validate methodological insights
    if (!Array.isArray(result.methodological_insights)) {
      throw new Error('methodological_insights must be an array');
    }
    
    if (!Array.isArray(result.dependent_variable_focus)) {
      throw new Error('dependent_variable_focus must be an array');
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}