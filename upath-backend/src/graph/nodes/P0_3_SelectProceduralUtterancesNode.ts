import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P0_2_Output, P0_3_Output, P_NEG1_1_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P0_3_SelectProceduralUtterancesNode extends BaseNode {
  id = StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES;

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Get P0_2 and P_NEG1_1 outputs
    const p0_2_output = state.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
    const p_neg1_1_output = state.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] as P_NEG1_1_Output;
    
    if (!p0_2_output) {
      throw new Error('P0_2 output not found - cannot select procedural utterances');
    }

    if (!p_neg1_1_output) {
      throw new Error('P_NEG1_1 output not found - cannot proceed without IV/DV context');
    }

    if (!p0_2_output.refined_data_transcript || p0_2_output.refined_data_transcript.length === 0) {
      throw new Error('No refined transcript lines to process');
    }

    // Build the prompt
    const prompt = this.buildPrompt(p0_2_output, p_neg1_1_output);

    // Call the LLM
    const response = await context.llmClient.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: context.settings.temperature || 0.2,
        responseMimeType: 'application/json'
      }
    });

    // Parse and validate the response
    const responseText = response.response.text();
    let output: P0_3_Output;
    
    try {
      output = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse LLM JSON response: ${error.message}`,
        responseText
      );
    }

    // Basic validation
    if (!output.selected_procedural_utterances) {
      throw new Error('Invalid response: missing selected_procedural_utterances');
    }

    // Update state
    return {
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: output
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: Date.now()
      },
      progress: context.progress?.percentage
    };
  }

  protected validateInputOrThrow(state: GraphState): void {
    // Call parent validation first
    super.validateInputOrThrow(state);

    // Check for P0_2 output
    if (!state.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES]) {
      throw new Error('P0_2 output not found');
    }

    // Check for P_NEG1_1 output
    if (!state.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]) {
      throw new Error('P_NEG1_1 output not found');
    }

    const p0_2_output = state.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
    
    if (!p0_2_output.refined_data_transcript || p0_2_output.refined_data_transcript.length === 0) {
      throw new Error('No refined transcript lines to process');
    }
  }

  protected isRecoverable(error: Error): boolean {
    // Check for non-recoverable patterns first
    const nonRecoverablePatterns = [
      /p0_2 output not found/i,
      /p_neg1_1 output not found/i,
      /no refined transcript/i,
      /missing selected_procedural_utterances/i
    ];

    if (nonRecoverablePatterns.some(pattern => pattern.test(error.message))) {
      return false;
    }

    // Use parent's logic for other cases
    return super.isRecoverable(error);
  }

  buildPrompt(p0_2_output: P0_2_Output, p_neg1_1_output: P_NEG1_1_Output): string {
    return `You are a micro-phenomenological analyst. Your task is to select utterances crucial for understanding the diachronic (temporal) structure of the *experience itself*, focusing on the participant's procedural account of their experience.
Input:
The JSON output from P0.2 (refined data transcript) and P-1.1 (IV/DV info) for transcript ID ${p0_2_output.transcript_id}.
P0.2 Output: ${JSON.stringify({ transcript_id: p0_2_output.transcript_id, refined_data_transcript: p0_2_output.refined_data_transcript }, null, 2)}
P-1.1 Output: ${JSON.stringify(p_neg1_1_output, null, 2)}

Instructions:
1.  Focus: The goal is to isolate the participant's narrative of *how the experience unfolded*. This means selecting utterances that describe actions, steps, or stages in the experience.
2.  Selection Criteria:
    *   Prioritize lines tagged "experiential_content".
    *   From these, select utterances that indicate a sequence, action, or a part of the experiential process. These are "procedural utterances" in the context of the experience itself.
    *   Interviewer questions, participant's meta-comments on the interview *process* (unless they also reveal experiential process), or purely descriptive (static) experiential content should generally be EXCLUDED from this selection, *unless* they are essential for understanding the flow of the described experience.
    *   If a single original line was very long and contained multiple distinct procedural steps, you MAY split it and represent each as a separate selected utterance. If you do this, use a format like "LINE_NUM.SUB_INDEX" for \`original_line_num\` (e.g., "23.1", "23.2").
3.  Justification: For each selected utterance, provide a brief \`selection_justification\` explaining why it's considered procedural to the experience.
4.  Discarded Info Summary: Briefly summarize what kind of information was generally discarded (e.g., "Interviewer prompts, participant's self-corrections not directly related to experiential flow").
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from P-1.1 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${p0_2_output.transcript_id}",
  "selected_procedural_utterances": [
    {
      "original_line_num": "string (e.g., '5' or '5.1')",
      "utterance_text": "text of the selected utterance...",
      "selection_justification": "Brief justification for selection."
    }
    // ... more utterances
  ],
  "discarded_info_summary": "Summary of discarded info.",
  "independent_variable_details": "${p_neg1_1_output.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(p_neg1_1_output.dependent_variable_focus)}
}`;
  }
}