import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P7_3B_Output, P7_3_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P7_3B_ValidateAndCleanDAGNode extends BaseNode {
  id = StepId.P7_3B_VALIDATE_AND_CLEAN_DAG;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P7_3B] Starting DAG validation and cleaning');
    
    // Get P7_3 output (DAG Assembly) with type validation
    const p7_3Data = state.stepOutputs?.[StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS];
    if (!p7_3Data || typeof p7_3Data !== 'object' || !('causal_dag' in p7_3Data)) {
      throw new Error('P7_3 output not found or invalid');
    }
    const p7_3Output = p7_3Data as P7_3_Output;
    
    console.log('[P7_3B] Validating DAG for cycles, spurious links, and overall coherence; cleaning and optimizing');
    
    // Validate and clean DAG
    const result = await this.validateAndCleanDAG(
      p7_3Output,
      context
    );
    
    // Validate the result
    this.validateCleanDAGOutput(result);
    
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
  
  private async validateAndCleanDAG(
    dagOutput: P7_3_Output,
    context: ExecutionContext
  ): Promise<P7_3B_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are validating a DAG for cycles, spurious links, and overall coherence. Clean and optimize the causal model structure for maximum validity and interpretability.

CURRENT DAG STRUCTURE:
Variables (${dagOutput.causal_dag.variables.length}):
${dagOutput.causal_dag.variables.map(variable => 
  `- ${variable.variable_id}: ${variable.variable_name}
    Definition: ${variable.definition}
    Measurement: ${variable.measurement_approach}
    Source: ${variable.data_source}`
).join('\n')}

Causal Links (${dagOutput.causal_dag.causal_links.length}):
${dagOutput.causal_dag.causal_links.map(link => 
  `- ${link.from_variable_id} → ${link.to_variable_id}
    Type: ${link.relationship_type}
    Confidence: ${link.confidence}
    Evidence: ${link.evidence_basis}
    Temporal Precedence: ${link.temporal_precedence}`
).join('\n')}

Identified Patterns:
${dagOutput.causal_dag.identified_patterns.map(pattern => 
  `- ${pattern.pattern_type}: ${pattern.involved_variables.join(' → ')}
    Description: ${pattern.description}`
).join('\n')}

VALIDATION NOTES FROM P7_3:
${dagOutput.dag_validation_notes}

IDENTIFIED CONFOUNDERS:
${dagOutput.identified_confounders.join(', ')}

DAG VALIDATION AND CLEANING TASK:
1. Cycle Detection: Identify and resolve any circular dependencies
2. Link Validation: Assess each causal link for theoretical and empirical justification
3. Spurious Link Removal: Remove links with insufficient evidence or theoretical basis
4. Coherence Assessment: Evaluate overall DAG logical consistency
5. Optimization: Simplify structure while preserving essential causal relationships

VALIDATION CRITERIA:
- Theoretical justification strength
- Empirical evidence quality
- Temporal precedence validity
- Measurement feasibility
- Overall model parsimony

LINK REMOVAL CONSIDERATIONS:
- Low confidence links with weak theoretical basis
- Correlational relationships without causal mechanism
- Links that create cycles or logical inconsistencies
- Redundant links that don't add explanatory value

QUALITY ASSESSMENT DIMENSIONS:
- Completeness: How well the DAG captures the phenomenon (0-1)
- Coherence: Internal logical consistency and theoretical alignment (0-1)
- Overall Rating: High/Medium/Low based on validation results

OUTPUT FORMAT (JSON):
{
  "validated_dag": {
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
  "removed_links": [
    {
      "link": {
        "from_variable_id": "removed_source",
        "to_variable_id": "removed_target",
        "relationship_type": "correlates",
        "confidence": "Low",
        "evidence_basis": "Insufficient evidence",
        "temporal_precedence": false
      },
      "removal_reason": "Detailed explanation for why this link was removed"
    }
  ],
  "dag_quality_assessment": {
    "overall_rating": "High|Medium|Low",
    "completeness": 0.85,
    "coherence": 0.90
  },
  "dependent_variable_focus": ${JSON.stringify(dagOutput.dependent_variable_focus)}
}

Prioritize theoretical validity and empirical justification over model complexity.`;

    return this.callLLMAndParseJSON<P7_3B_Output>(
      model,
      prompt,
      this.id,
      (parsed) => {
        this.validateCleanDAGOutput(parsed);
        return parsed;
      }
    );
  }
  
  private validateCleanDAGOutput(result: P7_3B_Output): void {
    // Check required top-level fields
    const requiredFields = [
      'validated_dag',
      'removed_links',
      'dag_quality_assessment',
      'dependent_variable_focus'
    ];
    
    for (const field of requiredFields) {
      if (!(field in result)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate validated DAG structure (same validation as P7_3 DAG)
    const dag = result.validated_dag;
    if (!dag || typeof dag !== 'object') {
      throw new Error('validated_dag must be an object');
    }
    
    const dagFields = ['variables', 'causal_links', 'identified_patterns'];
    for (const field of dagFields) {
      if (!(field in dag)) {
        throw new Error(`Validated DAG missing required field: ${field}`);
      }
    }
    
    // Validate variables
    if (!Array.isArray(dag.variables)) {
      throw new Error('Validated DAG variables must be an array');
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
      throw new Error('Validated DAG causal_links must be an array');
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
      throw new Error('Validated DAG identified_patterns must be an array');
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
    
    // Validate removed links
    if (!Array.isArray(result.removed_links)) {
      throw new Error('removed_links must be an array');
    }
    
    for (const removedLink of result.removed_links) {
      const removedLinkFields = ['link', 'removal_reason'];
      for (const field of removedLinkFields) {
        if (!(field in removedLink)) {
          throw new Error(`Removed link missing required field: ${field}`);
        }
      }
      
      // Validate the link structure within removed link
      const link = removedLink.link;
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
          throw new Error(`Removed link's link missing required field: ${field}`);
        }
      }
    }
    
    // Validate DAG quality assessment
    const qualityAssessment = result.dag_quality_assessment;
    if (!qualityAssessment || typeof qualityAssessment !== 'object') {
      throw new Error('dag_quality_assessment must be an object');
    }
    
    const qualityFields = ['overall_rating', 'completeness', 'coherence'];
    for (const field of qualityFields) {
      if (!(field in qualityAssessment)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate overall rating
    const validRatings = ['High', 'Medium', 'Low'];
    if (!validRatings.includes(qualityAssessment.overall_rating)) {
      throw new Error(`Invalid overall_rating: ${qualityAssessment.overall_rating}`);
    }
    
    // Validate completeness and coherence (0-1 range)
    if (typeof qualityAssessment.completeness !== 'number' || 
        qualityAssessment.completeness < 0 || 
        qualityAssessment.completeness > 1) {
      throw new Error('completeness must be a number between 0 and 1');
    }
    
    if (typeof qualityAssessment.coherence !== 'number' || 
        qualityAssessment.coherence < 0 || 
        qualityAssessment.coherence > 1) {
      throw new Error('coherence must be a number between 0 and 1');
    }
    
    // REFERENTIAL INTEGRITY CHECKS
    // Create set of all valid variable IDs from the validated DAG
    const variableIds = new Set(dag.variables.map(v => v.variable_id));
    
    // Check that all causal links reference existing variables
    for (const link of dag.causal_links) {
      if (!variableIds.has(link.from_variable_id)) {
        throw new Error(`Causal link refers to non-existent from_variable_id: ${link.from_variable_id}`);
      }
      if (!variableIds.has(link.to_variable_id)) {
        throw new Error(`Causal link refers to non-existent to_variable_id: ${link.to_variable_id}`);
      }
    }
    
    // Check that all patterns reference existing variables
    for (const pattern of dag.identified_patterns) {
      for (const varId of pattern.involved_variables) {
        if (!variableIds.has(varId)) {
          throw new Error(`Pattern ${pattern.pattern_type} refers to non-existent variable_id: ${varId}`);
        }
      }
    }
    
    // Check that removed links also reference valid variables (they should be from original DAG)
    for (const removedLink of result.removed_links) {
      const link = removedLink.link;
      // Note: We don't validate against current variableIds since removed links might reference
      // variables that were also removed. This is acceptable as they're just historical records.
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