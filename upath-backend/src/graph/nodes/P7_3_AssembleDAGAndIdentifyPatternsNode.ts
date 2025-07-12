import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P7_3_Output, P7_2_Output, P7_1_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P7_3_AssembleDAGAndIdentifyPatternsNode extends BaseNode {
  id = StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P7_3] Starting DAG assembly and pattern identification');
    
    // Get P7_2 output (Pairwise Causal Links) with type validation
    const p7_2Data = state.stepOutputs?.[StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS];
    if (!p7_2Data || typeof p7_2Data !== 'object' || !('proposed_causal_links' in p7_2Data)) {
      throw new Error('P7_2 output not found or invalid');
    }
    const p7_2Output = p7_2Data as P7_2_Output;
    
    // Get P7_1 output (Candidate Variables) with type validation
    const p7_1Data = state.stepOutputs?.[StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION];
    if (!p7_1Data || typeof p7_1Data !== 'object' || !('candidate_variables' in p7_1Data)) {
      throw new Error('P7_1 output not found or invalid');
    }
    const p7_1Output = p7_1Data as P7_1_Output;
    
    console.log('[P7_3] Assembling variables and links into coherent DAG, identifying structural patterns');
    
    // Assemble DAG and identify patterns
    const result = await this.assembleDAGAndIdentifyPatterns(
      p7_1Output,
      p7_2Output,
      context
    );
    
    // Validate the result
    this.validateDAGOutput(result);
    
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
  
  private async assembleDAGAndIdentifyPatterns(
    candidateVariables: P7_1_Output,
    causalLinks: P7_2_Output,
    context: ExecutionContext
  ): Promise<P7_3_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are assembling variables and links into coherent DAG, identifying structural patterns like chains, forks, colliders. Create a comprehensive directed acyclic graph from the proposed causal relationships.

CANDIDATE VARIABLES:
${candidateVariables.candidate_variables.map(variable => 
  `- ${variable.variable_id}: ${variable.variable_name}
    Definition: ${variable.definition}
    Measurement: ${variable.measurement_approach}
    Source: ${variable.data_source}`
).join('\n')}

PROPOSED CAUSAL LINKS:
${causalLinks.proposed_causal_links.map(link => 
  `- ${link.from_variable_id} → ${link.to_variable_id}
    Type: ${link.relationship_type}
    Confidence: ${link.confidence}
    Evidence: ${link.evidence_basis}
    Temporal Precedence: ${link.temporal_precedence}`
).join('\n')}

LINK JUSTIFICATIONS:
${causalLinks.link_justifications.map(justification => 
  `- ${justification.link_id}
    Theoretical: ${justification.theoretical_basis}
    Empirical: ${justification.empirical_support}`
).join('\n')}

DAG ASSEMBLY TASK:
1. Combine variables and causal links into a coherent directed graph
2. Identify structural patterns in the causal relationships
3. Detect potential confounders not yet included
4. Validate DAG structure for cycles and inconsistencies
5. Assess overall DAG coherence and completeness

STRUCTURAL PATTERNS TO IDENTIFY:
- Chain: Linear sequence A → B → C
- Fork: Common cause A → B, A → C  
- Collider: Common effect A → C, B → C
- Cycle: Circular dependency (should be flagged as problematic)

CONFOUNDER IDENTIFICATION:
- Variables that could affect multiple nodes in the DAG
- Unmeasured factors that might bias relationships
- Background variables that influence IV-DV relationships

DAG VALIDATION CHECKS:
- No cycles (must be acyclic)
- All links connect existing variables
- Structural coherence and logical flow
- Temporal ordering consistency

OUTPUT FORMAT (JSON):
{
  "causal_dag": {
    "variables": [
      {
        "variable_id": "variable_identifier",
        "variable_name": "Human-readable variable name",
        "definition": "Clear conceptual definition",
        "measurement_approach": "How variable is measured",
        "data_source": "Source of variable evidence"
      }
    ],
    "causal_links": [
      {
        "from_variable_id": "source_variable",
        "to_variable_id": "target_variable",
        "relationship_type": "direct_cause|indirect_cause|moderates|mediates|correlates",
        "confidence": "High|Medium|Low",
        "evidence_basis": "Supporting evidence description",
        "temporal_precedence": true|false
      }
    ],
    "identified_patterns": [
      {
        "pattern_type": "chain|fork|collider|cycle",
        "involved_variables": ["var1", "var2", "var3"],
        "description": "Description of the pattern and its implications"
      }
    ]
  },
  "dag_validation_notes": "Assessment of DAG structure, cycles, and coherence",
  "identified_confounders": ["potential_confounder1", "potential_confounder2"],
  "dependent_variable_focus": ${JSON.stringify(candidateVariables.dependent_variable_focus)}
}

Ensure the DAG is logically coherent and represents a valid causal model structure.`;

    return this.callLLMAndParseJSON<P7_3_Output>(
      model,
      prompt,
      this.id,
      (parsed) => {
        this.validateDAGOutput(parsed);
        return parsed;
      }
    );
  }
  
  private validateDAGOutput(result: P7_3_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'causal_dag',
      'dag_validation_notes',
      'identified_confounders',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate causal DAG structure
    const dag = result.causal_dag;
    if (!dag || typeof dag !== 'object') {
      throw new Error('causal_dag must be an object');
    }
    
    const dagFields = ['variables', 'causal_links', 'identified_patterns'];
    for (const field of dagFields) {
      if (!(field in dag)) {
        throw new Error(`DAG missing required field: ${field}`);
      }
    }
    
    // Validate variables
    if (!Array.isArray(dag.variables)) {
      throw new Error('DAG variables must be an array');
    }
    
    for (const variable of dag.variables) {
      const variableFields = ['variable_id', 'variable_name', 'definition', 'measurement_approach', 'data_source'];
      for (const field of variableFields) {
        if (!(field in variable)) {
          throw new Error(`Variable missing required field: ${field}`);
        }
      }
    }
    
    // Validate causal links
    if (!Array.isArray(dag.causal_links)) {
      throw new Error('DAG causal_links must be an array');
    }
    
    for (const link of dag.causal_links) {
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
    
    // Validate identified patterns
    if (!Array.isArray(dag.identified_patterns)) {
      throw new Error('DAG identified_patterns must be an array');
    }
    
    for (const pattern of dag.identified_patterns) {
      const patternFields = ['pattern_type', 'involved_variables', 'description'];
      for (const field of patternFields) {
        if (!(field in pattern)) {
          throw new Error(`Pattern missing required field: ${field}`);
        }
      }
      
      // Validate pattern type
      const validPatternTypes = ['chain', 'fork', 'collider', 'cycle'];
      if (!validPatternTypes.includes(pattern.pattern_type)) {
        throw new Error(`Invalid pattern_type: ${pattern.pattern_type}`);
      }
      
      // Validate involved variables
      if (!Array.isArray(pattern.involved_variables)) {
        throw new Error('Pattern involved_variables must be an array');
      }
    }
    
    // Validate other fields
    if (typeof result.dag_validation_notes !== 'string') {
      throw new Error('dag_validation_notes must be a string');
    }
    
    if (!Array.isArray(result.identified_confounders)) {
      throw new Error('identified_confounders must be an array');
    }
    
    // REFERENTIAL INTEGRITY CHECKS
    // Create set of all valid variable IDs from the DAG
    const variableIds = new Set(result.causal_dag.variables.map(v => v.variable_id));
    
    // Check that all causal links reference existing variables
    for (const link of result.causal_dag.causal_links) {
      if (!variableIds.has(link.from_variable_id)) {
        throw new Error(`Causal link refers to non-existent from_variable_id: ${link.from_variable_id}`);
      }
      if (!variableIds.has(link.to_variable_id)) {
        throw new Error(`Causal link refers to non-existent to_variable_id: ${link.to_variable_id}`);
      }
    }
    
    // Check that all patterns reference existing variables
    for (const pattern of result.causal_dag.identified_patterns) {
      for (const varId of pattern.involved_variables) {
        if (!variableIds.has(varId)) {
          throw new Error(`Pattern ${pattern.pattern_type} refers to non-existent variable_id: ${varId}`);
        }
      }
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