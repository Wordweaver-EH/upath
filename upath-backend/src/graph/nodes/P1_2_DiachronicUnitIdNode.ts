import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext } from '../types';
import { StepId } from '../types/enums';
import { P1_1_Output, P1_2_Output, FineGrainedSegment } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P1_2_DiachronicUnitIdNode extends BaseNode {
  id = StepId.P1_2_DIACHRONIC_UNIT_ID;
  name = 'Diachronic Unit Identification';

  protected async validateInputOrThrow(state: GraphState): Promise<void> {
    // Check for P1_1 output
    const p1_1Output = state.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output | undefined;
    
    if (!p1_1Output) {
      throw new Error('P1_1 output not found');
    }

    if (!p1_1Output.segmented_utterances || p1_1Output.segmented_utterances.length === 0) {
      throw new Error('No segmented utterances to process');
    }
  }

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Validate input
    await this.validateInputOrThrow(state);

    const p1_1Output = state.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output;
    
    // Flatten the fine-grained segments from nested structure
    const flattenedSegments = this.flattenSegments(p1_1Output);

    // Build prompt
    const prompt = this.buildPrompt(flattenedSegments);

    // Call LLM
    const response = await context.llmClient.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: context.settings.temperature || 0.3,
        responseMimeType: 'application/json'
      }
    });

    // Parse response
    let parsedResponse: P1_2_Output;
    try {
      const responseText = response.response.text();
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError('Failed to parse LLM JSON response', error as Error);
    }

    // Validate response structure
    if (!parsedResponse.diachronic_units || !Array.isArray(parsedResponse.diachronic_units)) {
      throw new Error('Invalid response: missing diachronic_units');
    }

    if (parsedResponse.diachronic_units.length === 0) {
      throw new Error('No diachronic units identified');
    }

    // Add IV/DV from P1_1 to the output
    const outputWithContext: P1_2_Output = {
      ...parsedResponse,
      transcript_id: p1_1Output.transcript_id,
      independent_variable_details: p1_1Output.independent_variable_details,
      dependent_variable_focus: p1_1Output.dependent_variable_focus
    };

    // Update state
    return {
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: outputWithContext
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: Date.now()
      }
    };
  }

  protected isRecoverable(error: Error): boolean {
    // Validation errors are not recoverable
    if (error.message.includes('No segmented utterances to process') ||
        error.message.includes('P1_1 output not found')) {
      return false;
    }
    // LLM errors are typically recoverable
    return true;
  }

  private flattenSegments(p1_1Output: P1_1_Output): Array<{
    segment_id: string;
    text: string;
    temporal_marker: string | null;
    action_type: string;
    source_line: string;
  }> {
    const flattened: Array<{
      segment_id: string;
      text: string;
      temporal_marker: string | null;
      action_type: string;
      source_line: string;
    }> = [];

    for (const utterance of p1_1Output.segmented_utterances) {
      for (const segment of utterance.segments) {
        flattened.push({
          ...segment,
          source_line: utterance.original_line_num
        });
      }
    }

    return flattened;
  }

  private buildPrompt(segments: Array<{
    segment_id: string;
    text: string;
    temporal_marker: string | null;
    action_type: string;
    source_line: string;
  }>): string {
    const segmentsJson = JSON.stringify(segments, null, 2);

    return `You are a micro-phenomenological analyst. Your task is to group the fine-grained segments into diachronic units (temporal units that represent meaningful phases or moments in the experience).

## DIACHRONIC UNIT IDENTIFICATION TASK

These are fine-grained segments (minimal action units) extracted from procedural utterances:
${segmentsJson}

## Instructions:

1. **Review all fine-grained segments**: Each segment represents a minimal action unit or elementary act.

2. **Identify diachronic units**: Group one or more consecutive (or thematically related and temporally close) segments that form a coherent "moment" or "step" in the experience.

3. **Grouping principles**: 
   - Each diachronic unit should represent a meaningful temporal phase
   - Units typically contain multiple fine-grained segments
   - Consider temporal markers and action types when grouping
   - Adjacent segments from the same source line often belong together
   - Look for natural boundaries in the experience flow

4. **Create unit descriptions**: Each unit should have a clear description that captures the essence of that temporal phase or experiential moment.

## Output Requirements:

Return a JSON object with the following structure:
{
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Description of the temporal phase",
      "source_segment_ids": ["segment_1", "segment_2"]
    }
  ],
  "unit_metadata": {
    "total_units": 2,
    "grouping_criteria": "Explanation of how segments were grouped"
  }
}

## Example grouping patterns:
- Sequential actions that form a complete sub-task
- Preparation phase followed by execution phase
- Exploration followed by decision-making
- Setup, main activity, and wrap-up phases

IMPORTANT: 
- Use the exact segment_id values from the input (e.g., "seg_5_1", "seg_5_2")
- Each segment should appear in exactly one diachronic unit
- Provide clear, descriptive names for each diachronic unit
- The grouping should make temporal sense for the described experience
- Return ONLY valid JSON, no additional text or explanation`;
  }
}