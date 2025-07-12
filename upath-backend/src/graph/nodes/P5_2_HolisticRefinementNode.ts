import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P5_2_Output, P5_1_Output, P3_3_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P5_2_HolisticRefinementNode extends BaseNode {
  id = StepId.P5_2_HOLISTIC_REFINEMENT;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P5_2] Starting holistic refinement and final assessment');
    
    // Get P5_1 output (Comparative Analysis)
    const p5_1Output = state.stepOutputs?.[StepId.P5_1_IV_COMPARATIVE_ANALYSIS] as P5_1_Output;
    if (!p5_1Output) {
      throw new Error('P5_1 output not found');
    }
    
    // Get P3_3 output (Generic Diachronic Structure)
    const p3_3Output = state.stepOutputs?.[StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE] as P3_3_Output;
    if (!p3_3Output) {
      throw new Error('P3_3 output not found');
    }
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    console.log('[P5_2] Performing holistic assessment of entire analysis pipeline');
    
    // Perform holistic refinement
    const result = await this.performHolisticRefinement(
      p5_1Output,
      p3_3Output,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateRefinementOutput(result);
    
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
  
  private async performHolisticRefinement(
    comparativeAnalysis: P5_1_Output,
    genericStructure: P3_3_Output,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P5_2_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are conducting a final holistic assessment and refinement of the entire diachronic cognitive analysis. Review all findings and provide comprehensive refinement recommendations.

COMPARATIVE ANALYSIS FINDINGS:
${comparativeAnalysis.comparative_analysis_summary}

IV EFFECT ON GENERIC STRUCTURE:
${comparativeAnalysis.iv_effect_on_gds}

IV PATTERNS IDENTIFIED:
${comparativeAnalysis.identified_iv_patterns.map(pattern => 
  `- ${pattern.iv_value}: ${pattern.pattern_description} (${pattern.supporting_transcript_ids.join(', ')})`
).join('\n')}

DV OUTCOME PATTERNS:
${comparativeAnalysis.dv_outcome_patterns.map(pattern =>
  `- ${pattern.dv_name}: ${pattern.pattern_across_iv_levels}`
).join('\n')}

METHODOLOGICAL INSIGHTS:
${comparativeAnalysis.methodological_insights.map(insight => `- ${insight}`).join('\n')}

GENERIC DIACHRONIC STRUCTURE:
Name: ${genericStructure.generic_diachronic_structure_definition.name}
Description: ${genericStructure.generic_diachronic_structure_definition.description}
Core GDUs: ${genericStructure.generic_diachronic_structure_definition.core_gdus.join(', ')}
Optional GDUs: ${genericStructure.generic_diachronic_structure_definition.optional_gdus.join(', ')}
Sequence: ${genericStructure.generic_diachronic_structure_definition.typical_sequence.join(' → ')}
Variants: ${genericStructure.variants_summary}
Confidence: ${genericStructure.confidence_level}

HOLISTIC ASSESSMENT TASK:
1. Evaluate the overall coherence and validity of the analysis
2. Identify areas for methodological refinement
3. Assess the reliability and generalizability of findings
4. Recommend improvements for future studies
5. Provide final confidence rating for the entire analysis

FOCUS AREAS:
- Dependent Variables: ${globalDvFocus.join(', ')}
- Analysis Pipeline Effectiveness
- Generic Structure Validity
- IV Manipulation Success
- Future Research Opportunities

OUTPUT FORMAT (JSON):
{
  "holistic_assessment": "comprehensive evaluation of the entire analysis pipeline, its strengths, coherence, and overall validity",
  "refinement_recommendations": [
    {
      "area": "specific area needing refinement (e.g., 'Generic Diachronic Structure', 'Data Collection', 'Analysis Method')",
      "recommendation": "specific actionable recommendation",
      "rationale": "justification for this recommendation based on findings",
      "priority": "High|Medium|Low"
    }
  ],
  "final_confidence_rating": "High|Medium|Low",
  "study_limitations": [
    "limitation 1 based on the analysis",
    "limitation 2 based on findings"
  ],
  "future_research_directions": [
    "specific future research direction 1",
    "specific future research direction 2"
  ],
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Provide evidence-based recommendations that would enhance the validity and utility of this analytical approach.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P5_2_Output;
        return parsed;
      } catch (error) {
        console.error('[P5_2] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P5_2 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P5_2 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateRefinementOutput(result: P5_2_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'holistic_assessment',
      'refinement_recommendations',
      'final_confidence_rating',
      'study_limitations',
      'future_research_directions',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate refinement recommendations
    if (!Array.isArray(result.refinement_recommendations)) {
      throw new Error('refinement_recommendations must be an array');
    }
    
    for (const recommendation of result.refinement_recommendations) {
      const reqFields = ['area', 'recommendation', 'rationale', 'priority'];
      for (const field of reqFields) {
        if (!(field in recommendation)) {
          throw new Error(`Refinement recommendation missing required fields: ${recommendation.area}`);
        }
      }
      
      // Validate priority values
      if (!['High', 'Medium', 'Low'].includes(recommendation.priority)) {
        throw new Error(`Invalid priority value: ${recommendation.priority}`);
      }
    }
    
    // Validate confidence rating
    if (!['High', 'Medium', 'Low'].includes(result.final_confidence_rating)) {
      throw new Error(`Invalid confidence rating: ${result.final_confidence_rating}`);
    }
    
    // Validate arrays
    const arrayFields = ['study_limitations', 'future_research_directions', 'dependent_variable_focus'];
    for (const field of arrayFields) {
      if (!Array.isArray(result[field as keyof P5_2_Output])) {
        throw new Error(`${field} must be an array`);
      }
    }
    
    // Validate string fields are not empty
    if (!result.holistic_assessment || result.holistic_assessment.trim().length === 0) {
      throw new Error('holistic_assessment cannot be empty');
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}