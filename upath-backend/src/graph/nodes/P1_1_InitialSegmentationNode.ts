import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P0_3_Output, P1_1_Output, SegmentedUtterance } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P1_1_InitialSegmentationNode extends BaseNode {
  id = StepId.P1_1_INITIAL_SEGMENTATION;

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Get P0_3 output
    const p0_3Output = state.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
    
    if (!p0_3Output) {
      throw new Error('P0_3 output not found');
    }

    if (!p0_3Output.selected_procedural_utterances || p0_3Output.selected_procedural_utterances.length === 0) {
      throw new Error('No procedural utterances to segment');
    }

    // Build the prompt
    const prompt = this.buildPrompt(p0_3Output.selected_procedural_utterances);

    // Call the LLM
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

    // Parse the response
    const responseText = response.response.text();
    let output: P1_1_Output;
    
    try {
      output = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse LLM JSON response: ${error.message}`,
        responseText
      );
    }

    // Validate response structure
    if (!output.segmented_utterances || !Array.isArray(output.segmented_utterances)) {
      throw new Error('Invalid response: missing segmented_utterances');
    }

    // Add IV/DV from P0_3 to the output
    const outputWithContext: P1_1_Output = {
      ...output,
      transcript_id: p0_3Output.transcript_id,
      independent_variable_details: p0_3Output.independent_variable_details,
      dependent_variable_focus: p0_3Output.dependent_variable_focus
    };

    return {
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [StepId.P1_1_INITIAL_SEGMENTATION]: outputWithContext
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: Date.now()
      }
    };
  }

  protected validateInputOrThrow(state: GraphState): void {
    // Call parent validation first
    super.validateInputOrThrow(state);

    // Additional validation specific to this node
    const p0_3Output = state.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
    
    if (!p0_3Output) {
      throw new Error('P0_3 output not found');
    }

    if (!p0_3Output.selected_procedural_utterances || p0_3Output.selected_procedural_utterances.length === 0) {
      throw new Error('No procedural utterances to segment');
    }
  }

  protected isRecoverable(error: Error): boolean {
    // Check for non-recoverable patterns first
    const nonRecoverablePatterns = [
      /P0_3 output not found/i,
      /No procedural utterances to segment/i,
      /Invalid response: missing segmented_utterances/i
    ];

    if (nonRecoverablePatterns.some(pattern => pattern.test(error.message))) {
      return false;
    }

    // Use parent's logic for other cases
    return super.isRecoverable(error);
  }

  buildPrompt(proceduralUtterances: any[]): string {
    return `You are a micro-phenomenological analyst. Your task is to perform fine-grained temporal segmentation on procedural utterances.

Input:
Selected procedural utterances that describe the temporal flow of an experience:
${JSON.stringify(proceduralUtterances, null, 2)}

Instructions:
1. For EACH procedural utterance:
   - Identify "minimal action units" or "elementary acts" within them.
   - An utterance might contain one or multiple such segments.
   - Use explicit or implicit temporal markers (e.g., "then", "after that", "firstly", "suddenly", sequence of verbs) to delineate segments.
   
2. Fine-grained segmentation means:
   - Break down compound actions: "I opened the door and walked in" → two segments
   - Identify sequential steps: "First I looked, then I decided" → two segments
   - Separate distinct phases: "I was thinking about it while writing" → potentially two concurrent segments
   
3. Each segment should represent a minimal, atomic action or experience unit that cannot be further decomposed temporally.

Output:
A JSON object with the following structure:
{
  "segmented_utterances": [
    {
      "original_line_num": "string (from the input)",
      "original_utterance": "full text of the utterance",
      "segments": [
        {
          "segment_id": "unique identifier like 'seg_lineNum_subIndex'",
          "text": "the segmented portion of text representing one action unit",
          "temporal_marker": "any temporal word/phrase that helped identify this segment (or null)",
          "action_type": "brief categorization (e.g., 'physical_action', 'mental_process', 'perception')"
        }
        // ... more segments from the same utterance if applicable
      ]
    }
    // ... more utterances
  ],
  "total_segments": number,
  "segmentation_summary": "Brief explanation of the segmentation approach used"
}

Example:
If the utterance is "First I gathered all the materials, then I organized them by type, and finally I started the assembly"
This should be segmented into 3 segments:
1. "First I gathered all the materials" (temporal_marker: "First")
2. "then I organized them by type" (temporal_marker: "then")  
3. "and finally I started the assembly" (temporal_marker: "finally")

IMPORTANT: This is FINE-GRAINED segmentation - look for multiple actions within single utterances.`;
  }
}