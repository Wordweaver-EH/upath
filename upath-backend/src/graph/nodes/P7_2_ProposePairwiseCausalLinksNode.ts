import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P7_2_Output, P7_1_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P7_2_ProposePairwiseCausalLinksNode extends BaseNode {
  id = StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P7_2] Starting pairwise causal link proposal');
    
    // Get P7_1 output (Candidate Variable Formalization) with type validation
    const p7_1Data = state.stepOutputs?.[StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION];
    if (!p7_1Data || typeof p7_1Data !== 'object' || !('candidate_variables' in p7_1Data)) {
      throw new Error('P7_1 output not found or invalid');
    }
    const p7_1Output = p7_1Data as P7_1_Output;
    
    console.log('[P7_2] Proposing causal relationships between formalized variables');
    
    // Propose pairwise causal links
    const result = await this.proposeCausalLinks(
      p7_1Output,
      context
    );
    
    // Validate the result
    this.validateCausalLinksOutput(result);
    
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
  
  private async proposeCausalLinks(
    candidateVariables: P7_1_Output,
    context: ExecutionContext
  ): Promise<P7_2_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are proposing causal links between formalized variables based on temporal precedence and theoretical basis. Analyze the candidate variables and propose pairwise causal relationships.

CANDIDATE VARIABLES:
${candidateVariables.candidate_variables.map(variable => 
  `- ${variable.variable_id}: ${variable.variable_name}
    Definition: ${variable.definition}
    Measurement: ${variable.measurement_approach}
    Source: ${variable.data_source}`
).join('\n')}

INDEPENDENT VARIABLE FORMALIZATION:
- Variable: ${candidateVariables.iv_formalization.variable_id}
- Levels: ${candidateVariables.iv_formalization.levels.join(', ')}
- Operationalization: ${candidateVariables.iv_formalization.operationalization}

DEPENDENT VARIABLE FORMALIZATIONS:
${candidateVariables.dv_formalizations.map(dv => 
  `- Variable: ${dv.variable_id}
    Indicators: ${dv.measurement_indicators.join(', ')}
    Operationalization: ${dv.operationalization}`
).join('\n')}

CAUSAL LINK PROPOSAL TASK:
1. Identify potential causal relationships between variables
2. Assess temporal precedence (cause must precede effect)
3. Consider theoretical basis for each relationship
4. Evaluate empirical support from the variable definitions
5. Determine relationship types and confidence levels

RELATIONSHIP TYPES TO CONSIDER:
- direct_cause: Direct causal influence (A → B)
- indirect_cause: Mediated causal influence (A → M → B)
- moderates: Variable affects strength of relationship (A × M → B)
- mediates: Variable explains mechanism (A → M → B)
- correlates: Associated but not necessarily causal

CONFIDENCE LEVELS:
- High: Strong theoretical and empirical support
- Medium: Moderate support with some limitations
- Low: Weak support or speculative relationship

TEMPORAL PRECEDENCE CONSIDERATIONS:
- Independent variables typically precede dependent variables
- Consider the measurement approach and data source timing
- Ensure logical sequence of causal influence

OUTPUT FORMAT (JSON):
{
  "proposed_causal_links": [
    {
      "from_variable_id": "source_variable_identifier",
      "to_variable_id": "target_variable_identifier",
      "relationship_type": "direct_cause|indirect_cause|moderates|mediates|correlates",
      "confidence": "High|Medium|Low",
      "evidence_basis": "Description of supporting evidence",
      "temporal_precedence": true|false
    }
  ],
  "link_justifications": [
    {
      "link_id": "from_variable->to_variable",
      "theoretical_basis": "Theoretical framework supporting this relationship",
      "empirical_support": "Empirical evidence from variable formalization"
    }
  ],
  "dependent_variable_focus": ${JSON.stringify(candidateVariables.dependent_variable_focus)}
}

Focus on proposing meaningful causal relationships that can form a coherent causal model for hypothesis testing.`;

    return this.callLLMAndParseJSON<P7_2_Output>(
      model,
      prompt,
      this.id,
      (parsed) => {
        this.validateCausalLinksOutput(parsed);
        return parsed;
      }
    );
  }
  
  private validateCausalLinksOutput(result: P7_2_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'proposed_causal_links',
      'link_justifications',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate proposed causal links
    if (!Array.isArray(result.proposed_causal_links)) {
      throw new Error('proposed_causal_links must be an array');
    }
    
    for (const link of result.proposed_causal_links) {
      const linkFields = [
        'from_variable_id',
        'to_variable_id', 
        'relationship_type',
        'confidence',
        'evidence_basis',
        'temporal_precedence'
      ];
      
      for (const field of linkFields) {
        if (!(field in link)) {
          throw new Error(`Causal link missing required field: ${field}`);
        }
      }
      
      // Validate relationship type
      const validRelationshipTypes = ['direct_cause', 'indirect_cause', 'moderates', 'mediates', 'correlates'];
      if (!validRelationshipTypes.includes(link.relationship_type)) {
        throw new Error(`Invalid relationship_type: ${link.relationship_type}`);
      }
      
      // Validate confidence level
      const validConfidenceLevels = ['High', 'Medium', 'Low'];
      if (!validConfidenceLevels.includes(link.confidence)) {
        throw new Error(`Invalid confidence level: ${link.confidence}`);
      }
      
      // Validate temporal precedence
      if (typeof link.temporal_precedence !== 'boolean') {
        throw new Error('temporal_precedence must be a boolean');
      }
    }
    
    // Validate link justifications
    if (!Array.isArray(result.link_justifications)) {
      throw new Error('link_justifications must be an array');
    }
    
    for (const justification of result.link_justifications) {
      const justificationFields = ['link_id', 'theoretical_basis', 'empirical_support'];
      for (const field of justificationFields) {
        if (!(field in justification)) {
          throw new Error(`Link justification missing required field: ${field}`);
        }
      }
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