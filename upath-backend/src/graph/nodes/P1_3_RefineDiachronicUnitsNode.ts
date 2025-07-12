import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P0_3_Output, P1_1_Output, P1_2_Output, P1_3_Output } from '../types/outputs';
import { GenerateContentRequest } from '@google/generative-ai';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P1_3_RefineDiachronicUnitsNode extends BaseNode {
  id = StepId.P1_3_REFINE_DIACHRONIC_UNITS;
  name = 'Refine Diachronic Units';

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Validate inputs
    this.validateInputs(state);

    // Process with LLM with retry logic
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.processWithLLM(state, context);
      } catch (error) {
        lastError = error as Error;
        context.logger.error(`P1_3 execution failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`);
        
        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          // Use shorter delays for testing (can be overridden in production)
          const baseDelay = process.env.NODE_ENV === 'test' ? 10 : 1000;
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError || new Error('Unknown error in P1_3 execution');
  }

  private validateInputs(state: GraphState): void {
    // Validate P1_2 output exists
    const p1_2Output = state.stepOutputs[StepId.P1_2_DIACHRONIC_UNIT_ID] as P1_2_Output | undefined;
    if (!p1_2Output) {
      throw new Error('P1_2 output not found');
    }
    if (!p1_2Output.diachronic_units || p1_2Output.diachronic_units.length === 0) {
      throw new Error('No diachronic units to refine');
    }

    // Validate P1_1 output exists (needed for segment details)
    const p1_1Output = state.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output | undefined;
    if (!p1_1Output) {
      throw new Error('P1_1 output not found');
    }

    // Validate P0_3 output exists (needed for procedural utterances)
    const p0_3Output = state.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output | undefined;
    if (!p0_3Output) {
      throw new Error('P0_3 output not found');
    }
  }

  private async processWithLLM(
    state: GraphState,
    context: ExecutionContext
  ): Promise<Partial<GraphState>> {
    const p1_2Output = state.stepOutputs[StepId.P1_2_DIACHRONIC_UNIT_ID] as P1_2_Output;
    const p1_1Output = state.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output;
    const p0_3Output = state.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;

    const prompt = this.buildPrompt(p1_2Output, p1_1Output, p0_3Output);
    const request: GenerateContentRequest = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: context.settings?.temperature ?? 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      }
    };

    let result;
    try {
      result = await context.llmClient.generateContent(request);
    } catch (error) {
      // Re-throw the original error for proper error handling
      throw error;
    }
    
    const responseText = result.response.text();

    let output: P1_3_Output;
    try {
      output = JSON.parse(responseText) as P1_3_Output;
      this.validateOutput(output);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse P1_3 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseText
      );
    }

    context.logger.info(
      `P1_3 successfully refined ${output.refined_diachronic_units.length} diachronic units ` +
      `with ${output.refinement_metadata.total_micro_gestures} micro-gestures`
    );

    // Add IV/DV from P1_2 to the output
    const outputWithContext: P1_3_Output = {
      ...output,
      transcript_id: p1_2Output.transcript_id,
      independent_variable_details: p1_2Output.independent_variable_details,
      dependent_variable_focus: p1_2Output.dependent_variable_focus
    };

    return {
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: outputWithContext
      }
    };
  }

  private buildPrompt(
    p1_2Output: P1_2_Output,
    p1_1Output: P1_1_Output,
    p0_3Output: P0_3_Output
  ): string {
    // Extract transcript ID
    const transcriptId = p1_2Output.transcript_id || 'transcript-1';
    const independentVariable = p1_2Output.independent_variable_details || '';
    const dependentVariableFocus = p1_2Output.dependent_variable_focus || [];

    return `You are a micro-phenomenological analyst. Your task is to refine the Diachronic Units (DUs) from P1.2 and assign a temporal phase to each.
Input:
JSON output from P1.2 for transcript ID ${transcriptId}.
P1.2 Output: ${JSON.stringify(p1_2Output, null, 2)}
User-defined Dependent Variable Focus: ${JSON.stringify(dependentVariableFocus)}

Instructions:
1.  Review DUs: Examine the DUs identified in P1.2.
2.  Refine DUs:
    *   Consider if any DUs from P1.2 should be merged or split based on a deeper understanding of the experiential flow.
    *   The output \`refined_diachronic_units\` will be a new list. Each refined DU should have a unique \`unit_id\` (can be same as P1.2 ID if not changed, or new if merged/split).
    *   Maintain a concise \`refined_description\`.
    *   The \`source_segment_ids\` field MUST list the segment IDs that form this refined DU.
3.  Assign Temporal Phase: For each *refined* DU, assign a \`temporal_phase\` from the following FIXED list that best describes its position in the overall experiential arc:
    *   "Beginning"
    *   "Early-Middle"
    *   "Core Event" (if there's a clear central moment)
    *   "Late-Middle"
    *   "Ending"
    *   "Reflection" (if the DU is about looking back on the experience)
    *   "Transition" (if the DU primarily marks a shift between other phases)
    *   "Other" (use sparingly, if no other category fits)
4.  Confidence: Assign a \`confidence\` score (0.0 to 1.0) for each refined DU, reflecting how clear and well-defined it seems.
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.2 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcriptId}",
  "refined_diachronic_units": [
    {
      "unit_id": "rdu_1", // Can be same as P1.2 ID or new
      "original_description": "Initial orienting and noticing the object.",
      "refined_description": "Initial orienting and noticing the object (refined).",
      "source_segment_ids": ["seg_5_1", "seg_5_2"], // Segment IDs that form this unit
      "temporal_phase": "Beginning",
      "confidence": 0.9,
      "micro_gestures": [], // Empty array for MVP compatibility
      "temporal_markers": [] // Empty array for MVP compatibility
    },
    {
      "unit_id": "rdu_2",
      "original_description": "Examination phase",
      "refined_description": "Detailed examination and interaction.",
      "source_segment_ids": ["seg_10_1", "seg_15_1"], // Example of merged segments
      "temporal_phase": "Core Event",
      "confidence": 0.85,
      "micro_gestures": [],
      "temporal_markers": []
    }
    // ... more refined diachronic units
  ],
  "refinement_metadata": {
    "total_micro_gestures": 0,
    "refinement_approach": "Temporal phase assignment and unit refinement",
    "temporal_flow": "linear"
  },
  "independent_variable_details": "${independentVariable}",
  "dependent_variable_focus": ${JSON.stringify(dependentVariableFocus)}
}`;
  }

  private validateOutput(output: any): void {
    if (!output.refined_diachronic_units || !Array.isArray(output.refined_diachronic_units)) {
      throw new Error('Invalid response structure: missing refined_diachronic_units array');
    }

    if (!output.refinement_metadata || typeof output.refinement_metadata !== 'object') {
      throw new Error('Invalid response structure: missing refinement_metadata');
    }

    // Validate each refined unit
    for (const unit of output.refined_diachronic_units) {
      if (!unit.unit_id || !unit.refined_description || !unit.micro_gestures || !unit.temporal_markers) {
        throw new Error('Invalid refined diachronic unit structure');
      }
    }
  }
}