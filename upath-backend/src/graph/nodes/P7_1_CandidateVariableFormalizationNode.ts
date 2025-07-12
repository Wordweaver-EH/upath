import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P7_1_Output, P5_1_Output, P5_2_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { MissingInputError, ValidationError } from '../errors/CommonErrors';
import { GenerativeModel } from '@google/generative-ai';

export class P7_1_CandidateVariableFormalizationNode extends BaseNode {
  id = StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P7_1] Starting candidate variable formalization for causal modeling');
    
    // Get P5_2 output (Holistic Refinement) with type validation
    const p5_2Data = state.stepOutputs?.[StepId.P5_2_HOLISTIC_REFINEMENT];
    if (!p5_2Data || typeof p5_2Data !== 'object' || !('holistic_assessment' in p5_2Data)) {
      throw new MissingInputError('P5_2 output not found or invalid', StepId.P5_2_HOLISTIC_REFINEMENT);
    }
    const p5_2Output = p5_2Data as P5_2_Output;
    
    // Get P5_1 output (Comparative Analysis) with type validation
    const p5_1Data = state.stepOutputs?.[StepId.P5_1_IV_COMPARATIVE_ANALYSIS];
    if (!p5_1Data || typeof p5_1Data !== 'object' || !('comparative_analysis_summary' in p5_1Data)) {
      throw new MissingInputError('P5_1 output not found or invalid', StepId.P5_1_IV_COMPARATIVE_ANALYSIS);
    }
    const p5_1Output = p5_1Data as P5_1_Output;
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    console.log('[P7_1] Formalizing variables from comparative analysis findings');
    
    // Formalize candidate variables
    const result = await this.formalizeCandidateVariables(
      p5_1Output,
      p5_2Output,
      globalDvFocus,
      context
    );
    
    // Validate the result
    this.validateFormalizationOutput(result);
    
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
  
  private async formalizeCandidateVariables(
    comparativeAnalysis: P5_1_Output,
    holisticRefinement: P5_2_Output,
    globalDvFocus: string[],
    context: ExecutionContext
  ): Promise<P7_1_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are formalizing candidate variables for causal modeling based on the comprehensive diachronic cognitive analysis. Extract and formalize all potential causal variables from the analysis findings.

COMPARATIVE ANALYSIS FINDINGS:
${comparativeAnalysis.comparative_analysis_summary}

IV EFFECT ON GENERIC STRUCTURE:
${comparativeAnalysis.iv_effect_on_gds}

IV PATTERNS IDENTIFIED:
${comparativeAnalysis.identified_iv_patterns.map(pattern => 
  `- ${pattern.iv_value}: ${pattern.pattern_description} (${pattern.supporting_transcript_ids.length} transcripts)`
).join('\n')}

DV OUTCOME PATTERNS:
${comparativeAnalysis.dv_outcome_patterns.map(pattern =>
  `- ${pattern.dv_name}: ${pattern.pattern_across_iv_levels}`
).join('\n')}

HOLISTIC ASSESSMENT:
${holisticRefinement.holistic_assessment}

FINAL CONFIDENCE: ${holisticRefinement.final_confidence_rating}

VARIABLE FORMALIZATION TASK:
1. Identify all candidate variables that could be part of a causal model
2. Formalize the independent variable(s) with clear operationalization
3. Formalize dependent variables with measurement approaches
4. Consider mediating, moderating, and confounding variables
5. Link each variable to its evidence source in the analysis

VARIABLE CATEGORIES TO CONSIDER:
- Independent Variables: Experimental manipulations or natural variations
- Dependent Variables: Outcome measures (focus on: ${globalDvFocus.join(', ')})
- Mediating Variables: Processes that explain the IV-DV relationship
- Moderating Variables: Factors that change the strength of relationships
- Confounding Variables: Potential alternative explanations

FORMALIZATION REQUIREMENTS:
- Each variable needs clear operational definition
- Specify measurement approach based on analysis findings
- Reference the analysis source (which phase/finding supports it)
- Ensure variables are measurable and testable

OUTPUT FORMAT (JSON):
{
  "candidate_variables": [
    {
      "variable_id": "unique_variable_identifier",
      "variable_name": "Human-readable variable name",
      "definition": "Clear conceptual definition based on analysis",
      "measurement_approach": "How this variable would be measured/operationalized",
      "data_source": "Which analysis phase/finding supports this variable"
    }
  ],
  "iv_formalization": {
    "variable_id": "primary_independent_variable_id",
    "levels": ["list", "of", "iv", "levels"],
    "operationalization": "detailed description of how IV is manipulated/measured"
  },
  "dv_formalizations": [
    {
      "variable_id": "dependent_variable_id",
      "measurement_indicators": ["specific", "measurable", "indicators"],
      "operationalization": "detailed description of measurement approach"
    }
  ],
  "dependent_variable_focus": ${JSON.stringify(globalDvFocus)}
}

Extract variables that have clear evidence basis from the analysis and can form a coherent causal model.`;

    return this.callLLMAndParseJSON<P7_1_Output>(
      model,
      prompt,
      this.id,
      (parsed) => {
        this.validateFormalizationOutput(parsed);
        return parsed;
      }
    );
  }
  
  private validateFormalizationOutput(result: P7_1_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'candidate_variables',
      'iv_formalization',
      'dv_formalizations',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate candidate variables
    if (!Array.isArray(result.candidate_variables)) {
      throw new Error('candidate_variables must be an array');
    }
    
    for (const variable of result.candidate_variables) {
      const reqFields = ['variable_id', 'variable_name', 'definition', 'measurement_approach', 'data_source'];
      for (const field of reqFields) {
        if (!(field in variable)) {
          throw new Error(`Candidate variable missing required fields: ${variable.variable_id || 'unknown'}`);
        }
      }
    }
    
    // Validate IV formalization
    const ivFields = ['variable_id', 'levels', 'operationalization'];
    for (const field of ivFields) {
      if (!(field in result.iv_formalization)) {
        throw new Error(`IV formalization missing required field: ${field}`);
      }
    }
    
    if (!Array.isArray(result.iv_formalization.levels)) {
      throw new Error('IV formalization levels must be an array');
    }
    
    // Validate DV formalizations
    if (!Array.isArray(result.dv_formalizations)) {
      throw new Error('dv_formalizations must be an array');
    }
    
    for (const dvFormalization of result.dv_formalizations) {
      const dvFields = ['variable_id', 'measurement_indicators', 'operationalization'];
      for (const field of dvFields) {
        if (!(field in dvFormalization)) {
          throw new Error(`DV formalization missing required field: ${field}`);
        }
      }
      
      if (!Array.isArray(dvFormalization.measurement_indicators)) {
        throw new Error('DV measurement_indicators must be an array');
      }
    }
    
    // Check that all formalized variables exist in candidate variables
    const candidateIds = new Set(result.candidate_variables.map(v => v.variable_id));
    
    if (!candidateIds.has(result.iv_formalization.variable_id)) {
      throw new Error(`IV formalization references non-existent variable: ${result.iv_formalization.variable_id}`);
    }
    
    for (const dvFormalization of result.dv_formalizations) {
      if (!candidateIds.has(dvFormalization.variable_id)) {
        throw new Error(`DV formalization references non-existent variable: ${dvFormalization.variable_id}`);
      }
    }
    
    // Validate array fields
    if (!Array.isArray(result.dependent_variable_focus)) {
      throw new Error('dependent_variable_focus must be an array');
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}