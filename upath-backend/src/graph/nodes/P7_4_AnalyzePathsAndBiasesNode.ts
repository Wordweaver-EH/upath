import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P7_4_Output, P7_3B_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P7_4_AnalyzePathsAndBiasesNode extends BaseNode {
  id = StepId.P7_4_ANALYZE_PATHS_AND_BIASES;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P7_4] Starting causal path analysis and bias identification');
    
    // Get P7_3B output (Validated DAG) with type validation
    const p7_3bData = state.stepOutputs?.[StepId.P7_3B_VALIDATE_AND_CLEAN_DAG];
    if (!p7_3bData || typeof p7_3bData !== 'object' || !('validated_dag' in p7_3bData)) {
      throw new Error('P7_3B output not found or invalid');
    }
    const p7_3bOutput = p7_3bData as P7_3B_Output;
    
    console.log('[P7_4] Analyzing causal paths through DAG, identifying confounding and bias sources');
    
    // Analyze paths and biases
    const result = await this.analyzePathsAndBiases(
      p7_3bOutput,
      context
    );
    
    // Validate the result
    this.validatePathsAndBiasesOutput(result);
    
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
  
  private async analyzePathsAndBiases(
    validatedDAG: P7_3B_Output,
    context: ExecutionContext
  ): Promise<P7_4_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are analyzing causal paths through DAG, identifying confounding and bias sources. Systematically trace all causal pathways and assess potential sources of bias that could affect causal inference.

VALIDATED DAG STRUCTURE:
Variables (${validatedDAG.validated_dag.variables.length}):
${validatedDAG.validated_dag.variables.map(variable => 
  `- ${variable.variable_id}: ${variable.variable_name}
    Definition: ${variable.definition}
    Measurement: ${variable.measurement_approach}
    Source: ${variable.data_source}`
).join('\n')}

Causal Links (${validatedDAG.validated_dag.causal_links.length}):
${validatedDAG.validated_dag.causal_links.map(link => 
  `- ${link.from_variable_id} → ${link.to_variable_id}
    Type: ${link.relationship_type}
    Confidence: ${link.confidence}
    Evidence: ${link.evidence_basis}
    Temporal Precedence: ${link.temporal_precedence}`
).join('\n')}

Identified Patterns:
${validatedDAG.validated_dag.identified_patterns.map(pattern => 
  `- ${pattern.pattern_type}: ${pattern.involved_variables.join(' → ')}
    Description: ${pattern.description}`
).join('\n')}

DAG QUALITY ASSESSMENT:
- Overall Rating: ${validatedDAG.dag_quality_assessment.overall_rating}
- Completeness: ${validatedDAG.dag_quality_assessment.completeness}
- Coherence: ${validatedDAG.dag_quality_assessment.coherence}

REMOVED LINKS (Potential Bias Sources):
${validatedDAG.removed_links.map(removed => 
  `- ${removed.link.from_variable_id} → ${removed.link.to_variable_id}
    Reason: ${removed.removal_reason}`
).join('\n')}

CAUSAL PATH ANALYSIS TASK:
1. Identify all distinct causal pathways from independent to dependent variables
2. Classify paths by type (direct, mediated, confounded)
3. Assess effect strength for each pathway
4. Identify potential biases affecting each path
5. Rank paths by significance and research importance

PATH TYPES TO IDENTIFY:
- Direct: Simple A → B relationship
- Mediated: A → M → B (through mediating variable)
- Confounded: A → B with common cause C → A, C → B

BIAS TYPES TO CONSIDER:
- Selection bias: Non-representative sampling affecting relationships
- Measurement bias: Systematic errors in variable measurement
- Confounding bias: Unmeasured variables affecting relationships
- Temporal bias: Incorrect temporal ordering assumptions
- Attrition bias: Loss of participants affecting conclusions

EFFECT STRENGTH ASSESSMENT:
- Strong: Clear, consistent evidence across multiple sources
- Medium: Moderate evidence with some limitations
- Weak: Limited or inconsistent evidence

PATH SIGNIFICANCE RANKING CRITERIA:
- Theoretical importance for the research question
- Empirical strength of evidence
- Methodological feasibility for testing
- Potential for bias mitigation

OUTPUT FORMAT (JSON):
{
  "identified_causal_paths": [
    {
      "path_id": "unique_path_identifier",
      "variables_sequence": ["start_var", "intermediate_var", "end_var"],
      "path_type": "direct|mediated|confounded",
      "effect_strength": "Strong|Medium|Weak",
      "potential_biases": ["bias_type1", "bias_type2"]
    }
  ],
  "bias_analysis": [
    {
      "bias_type": "selection_bias|measurement_bias|confounding_bias|temporal_bias|attrition_bias",
      "affected_paths": ["path_id1", "path_id2"],
      "mitigation_strategies": ["strategy1", "strategy2", "strategy3"]
    }
  ],
  "path_significance_ranking": ["path_id1", "path_id2", "path_id3"],
  "dependent_variable_focus": ${JSON.stringify(validatedDAG.dependent_variable_focus)}
}

Focus on identifying actionable insights for causal inference and bias mitigation.`;

    return this.callLLMAndParseJSON<P7_4_Output>(
      model,
      prompt,
      this.id,
      (parsed) => {
        this.validatePathsAndBiasesOutput(parsed);
        return parsed;
      }
    );
  }
  
  private validatePathsAndBiasesOutput(result: P7_4_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'identified_causal_paths',
      'bias_analysis',
      'path_significance_ranking',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate identified causal paths
    if (!Array.isArray(result.identified_causal_paths)) {
      throw new Error('identified_causal_paths must be an array');
    }
    
    for (const path of result.identified_causal_paths) {
      const pathFields = ['path_id', 'variables_sequence', 'path_type', 'effect_strength', 'potential_biases'];
      for (const field of pathFields) {
        if (!(field in path)) {
          throw new Error(`Causal path missing required field: ${field}`);
        }
      }
      
      // Validate variables sequence
      if (!Array.isArray(path.variables_sequence)) {
        throw new Error('variables_sequence must be an array');
      }
      
      // Validate path type
      const validPathTypes = ['direct', 'mediated', 'confounded'];
      if (!validPathTypes.includes(path.path_type)) {
        throw new Error(`Invalid path_type: ${path.path_type}`);
      }
      
      // Validate effect strength
      const validEffectStrengths = ['Strong', 'Medium', 'Weak'];
      if (!validEffectStrengths.includes(path.effect_strength)) {
        throw new Error(`Invalid effect_strength: ${path.effect_strength}`);
      }
      
      // Validate potential biases
      if (!Array.isArray(path.potential_biases)) {
        throw new Error('potential_biases must be an array');
      }
    }
    
    // Validate bias analysis
    if (!Array.isArray(result.bias_analysis)) {
      throw new Error('bias_analysis must be an array');
    }
    
    for (const bias of result.bias_analysis) {
      const biasFields = ['bias_type', 'affected_paths', 'mitigation_strategies'];
      for (const field of biasFields) {
        if (!(field in bias)) {
          throw new Error(`Bias analysis missing required field: ${field}`);
        }
      }
      
      // Validate affected paths
      if (!Array.isArray(bias.affected_paths)) {
        throw new Error('affected_paths must be an array');
      }
      
      // Validate mitigation strategies
      if (!Array.isArray(bias.mitigation_strategies)) {
        throw new Error('mitigation_strategies must be an array');
      }
    }
    
    // Validate path significance ranking
    if (!Array.isArray(result.path_significance_ranking)) {
      throw new Error('path_significance_ranking must be an array');
    }
    
    // REFERENTIAL INTEGRITY CHECKS
    // Create set of all path IDs from identified causal paths
    const pathIds = new Set(result.identified_causal_paths.map(p => p.path_id));
    
    // Check that bias analysis refers to existing path IDs
    for (const bias of result.bias_analysis) {
      for (const affectedPathId of bias.affected_paths) {
        if (!pathIds.has(affectedPathId)) {
          throw new Error(`Bias analysis for ${bias.bias_type} refers to non-existent path_id: ${affectedPathId}`);
        }
      }
    }
    
    // Check that path significance ranking refers to existing path IDs
    for (const rankedPathId of result.path_significance_ranking) {
      if (!pathIds.has(rankedPathId)) {
        throw new Error(`Path significance ranking refers to non-existent path_id: ${rankedPathId}`);
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