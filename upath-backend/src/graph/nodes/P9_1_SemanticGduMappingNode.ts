import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P9_1_Output, GenericDiachronicUnit } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';
import { ValidationError } from '../errors/CommonErrors';

export interface P9_1_Input {
  run_a_gdus: GenericDiachronicUnit[];
  run_b_gdus: GenericDiachronicUnit[];
  temperature?: number;
  seed?: number;
}

/**
 * P9_1_SEMANTIC_GDU_MAPPING Node
 * 
 * Creates semantic mappings between Generic Diachronic Units (GDUs) from two different 
 * analysis runs for Inter-Rater Reliability (IRR) analysis.
 * 
 * This node replaces the frontend IRR functionality that was calling Gemini API directly,
 * maintaining security by keeping API keys in the backend.
 */
export class P9_1_SemanticGduMappingNode extends BaseNode {
  id = StepId.P9_1_SEMANTIC_GDU_MAPPING;

  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[P9_1] Starting semantic GDU mapping for IRR analysis');
    
    // This node requires special input validation since it doesn't follow the normal pipeline
    // The inputs should be provided in the state under a special key for IRR analysis
    const inputs = (state as any).irr_inputs as P9_1_Input;
    
    if (!inputs) {
      throw new ValidationError('IRR inputs not provided for P9_1 analysis');
    }

    this.validateInputs(inputs);

    const { run_a_gdus, run_b_gdus, temperature = 0.7, seed } = inputs;

    // Build the prompt for semantic mapping
    const runAList = run_a_gdus.map((gdu, idx) => 
      `${idx + 1}. ${gdu.gdu_id}: ${gdu.definition}`
    ).join('\n');

    const runBList = run_b_gdus.map((gdu, idx) => 
      `${idx + 1}. ${gdu.gdu_id}: ${gdu.definition}`
    ).join('\n');

    const prompt = `You are tasked with creating a semantic mapping between Generic Diachronic Units (GDUs) from two different analysis runs of micro-phenomenological data.

## Run A GDUs:
${runAList}

## Run B GDUs:
${runBList}

## Task:
Create a mapping between semantically similar GDUs across the two runs. Some GDUs may have no match in the other run.

Provide your response as a JSON object with this structure:
{
  "gdu_mappings": [
    {
      "run_a_gdu": "GDU name from Run A or null",
      "run_b_gdu": "GDU name from Run B or null",
      "semantic_similarity": number between 0 and 1,
      "mapping_justification": "Brief explanation"
    }
  ]
}

## Guidelines:
- Include all GDUs from both runs in the mapping
- Use null for unmatched GDUs
- semantic_similarity: 1.0 = identical, 0.0 = completely different
- Consider conceptual similarity, not just word matching
- Prioritize definitional similarity over statistical similarity
- mapping_justification: Brief explanation of why these GDUs are semantically similar or why no match exists`;

    // Apply HIL enhancement if provided
    const enhancedPrompt = this.buildHilEnhancedPrompt(prompt, context);

    // Call the LLM
    const response = await context.llmClient.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: enhancedPrompt }]
      }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json'
      }
    });

    // Parse the response
    const responseText = response.response.text();
    let llmResponse: any;
    
    try {
      llmResponse = JSON.parse(responseText);
    } catch (error) {
      console.error('[P9_1] Failed to parse LLM JSON response:', error);
      throw new LLMResponseError('Failed to parse P9_1 response', responseText);
    }

    // Validate the LLM response structure
    if (!llmResponse.gdu_mappings || !Array.isArray(llmResponse.gdu_mappings)) {
      throw new LLMResponseError(
        'LLM response missing gdu_mappings array',
        responseText
      );
    }

    // Create Maps for O(1) lookups instead of O(n) array.find()
    const gduAMap = new Map(run_a_gdus.map(g => [g.gdu_id, g]));
    const gduBMap = new Map(run_b_gdus.map(g => [g.gdu_id, g]));

    // Transform the LLM response to match our expected structure
    const gdu_mappings = llmResponse.gdu_mappings.map((mapping: any, idx: number) => {
      if (!mapping.run_a_gdu && !mapping.run_b_gdu) {
        throw new LLMResponseError(
          `Mapping ${idx} must have at least one non-null GDU`,
          JSON.stringify(mapping)
        );
      }

      // Find the corresponding GDU objects for additional metadata using O(1) Map lookup
      const gduA = mapping.run_a_gdu ? gduAMap.get(mapping.run_a_gdu) : null;
      const gduB = mapping.run_b_gdu ? gduBMap.get(mapping.run_b_gdu) : null;

      return {
        run_a_gdu_id: mapping.run_a_gdu || '',
        run_a_definition: gduA?.definition || '',
        run_a_contributing_rdu_count: gduA?.contributing_refined_du_ids.length || 0,
        run_b_gdu_id: mapping.run_b_gdu,
        run_b_definition: gduB?.definition || null,
        run_b_contributing_rdu_count: gduB?.contributing_refined_du_ids.length || 0,
        semantic_similarity_score: mapping.semantic_similarity || 0,
        mapping_justification: mapping.mapping_justification || ''
      };
    });

    // Validate that all GDUs are represented
    const mappedRunAGdus = new Set(gdu_mappings.map(m => m.run_a_gdu_id).filter(id => id));
    const mappedRunBGdus = new Set(gdu_mappings.map(m => m.run_b_gdu_id).filter(id => id));
    
    const allRunAGdus = new Set(run_a_gdus.map(g => g.gdu_id));
    const allRunBGdus = new Set(run_b_gdus.map(g => g.gdu_id));

    // Check for missing GDUs and add them as unmapped entries
    const unmappedRunA = [...allRunAGdus].filter(id => !mappedRunAGdus.has(id));
    const unmappedRunB = [...allRunBGdus].filter(id => !mappedRunBGdus.has(id));

    // Add unmapped GDUs as null mappings (using Map for O(1) lookups)
    for (const gduId of unmappedRunA) {
      const gdu = gduAMap.get(gduId)!;
      gdu_mappings.push({
        run_a_gdu_id: gduId,
        run_a_definition: gdu.definition,
        run_a_contributing_rdu_count: gdu.contributing_refined_du_ids.length,
        run_b_gdu_id: null,
        run_b_definition: null,
        run_b_contributing_rdu_count: 0,
        semantic_similarity_score: 0,
        mapping_justification: 'No semantic match found in Run B'
      });
    }

    for (const gduId of unmappedRunB) {
      const gdu = gduBMap.get(gduId)!;
      gdu_mappings.push({
        run_a_gdu_id: '',
        run_a_definition: '',
        run_a_contributing_rdu_count: 0,
        run_b_gdu_id: gduId,
        run_b_definition: gdu.definition,
        run_b_contributing_rdu_count: gdu.contributing_refined_du_ids.length,
        semantic_similarity_score: 0,
        mapping_justification: 'No semantic match found in Run A'
      });
    }

    const output: P9_1_Output = {
      gdu_mappings
    };

    // Update state with the mapping results
    const newState = {
      ...state,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: output
      }
    };

    console.log(`[P9_1] Generated semantic mapping for ${output.gdu_mappings.length} GDU pairs`);
    return newState;
  }

  private validateInputs(inputs: P9_1_Input): void {
    if (!inputs.run_a_gdus || !Array.isArray(inputs.run_a_gdus)) {
      throw new ValidationError('run_a_gdus must be an array of GDUs');
    }
    
    if (!inputs.run_b_gdus || !Array.isArray(inputs.run_b_gdus)) {
      throw new ValidationError('run_b_gdus must be an array of GDUs');
    }

    if (inputs.run_a_gdus.length === 0) {
      throw new ValidationError('run_a_gdus cannot be empty');
    }

    if (inputs.run_b_gdus.length === 0) {
      throw new ValidationError('run_b_gdus cannot be empty');
    }

    // Validate GDU structure
    inputs.run_a_gdus.forEach((gdu, idx) => {
      if (!gdu.gdu_id || !gdu.definition) {
        throw new ValidationError(`run_a_gdus[${idx}] missing required fields: gdu_id, definition`);
      }
    });

    inputs.run_b_gdus.forEach((gdu, idx) => {
      if (!gdu.gdu_id || !gdu.definition) {
        throw new ValidationError(`run_b_gdus[${idx}] missing required fields: gdu_id, definition`);
      }
    });

    if (inputs.temperature !== undefined && (inputs.temperature < 0 || inputs.temperature > 1)) {
      throw new ValidationError('temperature must be between 0 and 1');
    }
  }
}