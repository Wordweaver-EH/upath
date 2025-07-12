import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P7_5_Output, P7_4_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P7_5_GenerateFormalHypothesesNode extends BaseNode {
  id = StepId.P7_5_GENERATE_FORMAL_HYPOTHESES;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P7_5] Starting formal hypothesis generation');
    
    // Get P7_4 output (Path Analysis) with type validation
    const p7_4Data = state.stepOutputs?.[StepId.P7_4_ANALYZE_PATHS_AND_BIASES];
    if (!p7_4Data || typeof p7_4Data !== 'object' || !('identified_causal_paths' in p7_4Data)) {
      throw new Error('P7_4 output not found or invalid');
    }
    const p7_4Output = p7_4Data as P7_4_Output;
    
    console.log('[P7_5] Generating formal testable hypotheses from validated causal model');
    
    // Generate formal hypotheses
    const result = await this.generateFormalHypotheses(
      p7_4Output,
      context
    );
    
    // Validate the result
    this.validateHypothesesOutput(result);
    
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
  
  private async generateFormalHypotheses(
    pathAnalysis: P7_4_Output,
    context: ExecutionContext
  ): Promise<P7_5_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are generating formal testable hypotheses from validated causal model. Transform the causal path analysis into specific, measurable hypotheses that can guide empirical research.

IDENTIFIED CAUSAL PATHS:
${pathAnalysis.identified_causal_paths.map(path => 
  `- Path ID: ${path.path_id}
    Variables: ${path.variables_sequence.join(' → ')}
    Type: ${path.path_type}
    Effect Strength: ${path.effect_strength}
    Potential Biases: ${path.potential_biases.join(', ')}`
).join('\n')}

BIAS ANALYSIS:
${pathAnalysis.bias_analysis.map(bias => 
  `- Bias Type: ${bias.bias_type}
    Affected Paths: ${bias.affected_paths.join(', ')}
    Mitigation Strategies: ${bias.mitigation_strategies.join('; ')}`
).join('\n')}

PATH SIGNIFICANCE RANKING:
${pathAnalysis.path_significance_ranking.map((pathId, index) => 
  `${index + 1}. ${pathId}`
).join('\n')}

FORMAL HYPOTHESIS GENERATION TASK:
1. Convert significant causal paths into testable hypotheses
2. Specify clear predictions for each hypothesis
3. Recommend statistical approaches for testing
4. Provide overall causal model summary
5. Identify research implications and methodological recommendations

HYPOTHESIS DEVELOPMENT CRITERIA:
- Specificity: Clear, measurable predictions
- Testability: Feasible with available methods
- Falsifiability: Can be proven wrong empirically
- Theoretical grounding: Based on validated causal model
- Statistical power: Adequate for detecting effects

HYPOTHESIS TYPES TO CONSIDER:
- Main effect hypotheses: Direct causal relationships
- Mediation hypotheses: Indirect effects through mediators
- Moderation hypotheses: Conditional effects
- Interaction hypotheses: Complex causal patterns

STATISTICAL APPROACHES:
- Regression analysis for direct effects
- Mediation analysis for indirect effects
- Moderation analysis for conditional effects
- Structural equation modeling for complex models
- Experimental designs for causal inference

OUTPUT FORMAT (JSON):
{
  "formal_hypotheses": [
    {
      "hypothesis_id": "H1_descriptive_name",
      "hypothesis_statement": "Formal statement of the expected relationship",
      "involved_variables": ["independent_var", "dependent_var", "mediator_var"],
      "causal_claim": "Specific causal claim being tested",
      "testable_predictions": [
        "Specific prediction 1",
        "Specific prediction 2",
        "Specific prediction 3"
      ],
      "statistical_approach": "Recommended statistical method for testing"
    }
  ],
  "causal_model_summary": "Comprehensive summary of the validated causal model and its key findings",
  "research_implications": [
    "Theoretical implication 1",
    "Practical implication 2",
    "Methodological implication 3"
  ],
  "methodological_recommendations": [
    "Design recommendation 1",
    "Measurement recommendation 2",
    "Analysis recommendation 3"
  ],
  "dependent_variable_focus": ${JSON.stringify(pathAnalysis.dependent_variable_focus)}
}

Prioritize hypotheses that address the most significant causal pathways and can be tested with robust methodologies.`;

    return this.callLLMAndParseJSON<P7_5_Output>(
      model,
      prompt,
      this.id,
      (parsed) => {
        this.validateHypothesesOutput(parsed);
        return parsed;
      }
    );
  }
  
  private validateHypothesesOutput(result: P7_5_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'formal_hypotheses',
      'causal_model_summary',
      'research_implications',
      'methodological_recommendations',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate formal hypotheses
    if (!Array.isArray(result.formal_hypotheses)) {
      throw new Error('formal_hypotheses must be an array');
    }
    
    for (const hypothesis of result.formal_hypotheses) {
      const hypothesisFields = [
        'hypothesis_id',
        'hypothesis_statement',
        'involved_variables',
        'causal_claim',
        'testable_predictions',
        'statistical_approach'
      ];
      
      for (const field of hypothesisFields) {
        if (!(field in hypothesis)) {
          throw new Error(`Hypothesis missing required field: ${field}`);
        }
      }
      
      // Validate arrays within hypothesis
      if (!Array.isArray(hypothesis.involved_variables)) {
        throw new Error('involved_variables must be an array');
      }
      
      if (!Array.isArray(hypothesis.testable_predictions)) {
        throw new Error('testable_predictions must be an array');
      }
      
      // Validate string fields
      if (typeof hypothesis.hypothesis_id !== 'string') {
        throw new Error('hypothesis_id must be a string');
      }
      
      if (typeof hypothesis.hypothesis_statement !== 'string') {
        throw new Error('hypothesis_statement must be a string');
      }
      
      if (typeof hypothesis.causal_claim !== 'string') {
        throw new Error('causal_claim must be a string');
      }
      
      if (typeof hypothesis.statistical_approach !== 'string') {
        throw new Error('statistical_approach must be a string');
      }
    }
    
    // Validate causal model summary
    if (typeof result.causal_model_summary !== 'string') {
      throw new Error('causal_model_summary must be a string');
    }
    
    // Validate research implications
    if (!Array.isArray(result.research_implications)) {
      throw new Error('research_implications must be an array');
    }
    
    // Validate methodological recommendations
    if (!Array.isArray(result.methodological_recommendations)) {
      throw new Error('methodological_recommendations must be an array');
    }
    
    // Validate dependent variable focus
    if (!Array.isArray(result.dependent_variable_focus)) {
      throw new Error('dependent_variable_focus must be an array');
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}