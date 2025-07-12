import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P2S_1_Output, P2S_2_Output, SpecificSynchronicUnit } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { GenerativeModel } from '@google/generative-ai';

export class P2S_2_IdentifySpecificSynchronicUnitsNode extends BaseNode {
  id = StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P2S_2] Starting execution for phase:', state.metadata?.currentPhaseName);
    
    // Validate current phase is set
    const currentPhaseName = state.metadata?.currentPhaseName;
    if (!currentPhaseName) {
      throw new Error('Missing currentPhaseName in metadata for P2S.2');
    }
    
    // Get P2S_1 output
    const p2s1Output = state.stepOutputs?.[StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC] as P2S_1_Output | undefined;
    if (!p2s1Output) {
      throw new Error(`P2S_1 output not found for phase '${currentPhaseName}'`);
    }
    
    // Generate ISU hierarchy
    const result = await this.identifySpecificSynchronicUnits(
      p2s1Output,
      currentPhaseName,
      context
    );
    
    // Validate the ISU hierarchy
    this.validateISUHierarchy(result.specific_synchronic_units_hierarchy);
    
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
  
  private async identifySpecificSynchronicUnits(
    p2s1Output: P2S_1_Output,
    currentPhaseName: string,
    context: ExecutionContext
  ): Promise<P2S_2_Output> {
    const model = context.llmClient as GenerativeModel;
    
    const prompt = `You are analyzing the synchronic thematic groups from phase "${currentPhaseName}" to identify Specific Synchronic Units (SSUs).

CONTEXT:
- Transcript ID: ${p2s1Output.transcript_id}
- Analyzing diachronic unit: ${p2s1Output.analyzed_diachronic_unit}
- Independent Variable: ${p2s1Output.independent_variable_details}
- Dependent Variables: ${p2s1Output.dependent_variable_focus.join(', ')}

SYNCHRONIC THEMATIC GROUPS:
${JSON.stringify(p2s1Output.synchronic_thematic_groups, null, 2)}

TASK: Create a hierarchy of Incipient Synchronic Units (ISUs) based on the thematic groups.

RULES FOR ISU HIERARCHY:
1. Level 0 ISUs: Must be grounded directly in utterances (have "utterances" field)
2. Level 1+ ISUs: Must reference constituent lower-level units (have "constituent_lower_units" field)
3. Each utterance should be included in at least one Level 0 ISU
4. Higher levels abstract from lower levels using operations like:
   - Generalization: Abstracting common features
   - Aggregation: Combining related units
   - Specialization: Identifying specific variants
   - Composition: Building complex units from simpler ones

OUTPUT FORMAT (JSON):
{
  "transcript_id": "string",
  "analyzed_diachronic_unit": "string",
  "specific_synchronic_units_hierarchy": [
    {
      "unit_name": "ISU_<descriptive_name>",
      "level": <0 for grounded, 1+ for abstracted>,
      "abstraction_op": "<operation used to create this unit>",
      "intensional_definition": "<precise definition of what this unit represents>",
      "utterances": [  // ONLY for Level 0
        {
          "original_line_num": "string",
          "utterance_text": "string"
        }
      ],
      "constituent_lower_units": ["ISU_name1", "ISU_name2"]  // ONLY for Level 1+
    }
  ],
  "independent_variable_details": "string",
  "dependent_variable_focus": ["string"]
}

Ensure all utterances from the thematic groups are represented in the Level 0 ISUs.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      try {
        const parsed = JSON.parse(responseText) as P2S_2_Output;
        return parsed;
      } catch (error) {
        console.error('[P2S_2] Failed to parse LLM response:', error);
        throw new LLMResponseError(
          `Failed to parse P2S_2 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseText
        );
      }
    } catch (error) {
      if (error instanceof LLMResponseError) {
        throw error;
      }
      throw new Error(`P2S_2 LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private validateISUHierarchy(units: SpecificSynchronicUnit[]): void {
    for (const unit of units) {
      // Level 0 must have utterances
      if (unit.level === 0 && (!unit.utterances || unit.utterances.length === 0)) {
        throw new Error(`Level 0 ISU must have utterances: ${unit.unit_name}`);
      }
      
      // Level 1+ must have constituent_lower_units
      if (unit.level > 0 && (!unit.constituent_lower_units || unit.constituent_lower_units.length === 0)) {
        throw new Error(`Level 1+ ISU must have constituent_lower_units: ${unit.unit_name}`);
      }
      
      // Should not have both utterances and constituent_lower_units
      if (unit.utterances && unit.utterances.length > 0 && 
          unit.constituent_lower_units && unit.constituent_lower_units.length > 0) {
        throw new Error(`ISU cannot have both utterances and constituent_lower_units: ${unit.unit_name}`);
      }
    }
  }
  
  protected isRecoverable(error: Error): boolean {
    // LLM errors are recoverable, validation errors are not
    return error instanceof LLMResponseError;
  }
}