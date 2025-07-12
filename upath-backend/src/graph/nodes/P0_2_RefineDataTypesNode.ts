import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P0_1_Output, P0_2_Output, RefinedLine } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P0_2_RefineDataTypesNode extends BaseNode {
  id = StepId.P0_2_REFINE_DATA_TYPES;

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Get P0_1 output
    const p0_1_output = state.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] as P0_1_Output;
    
    if (!p0_1_output) {
      throw new Error('P0_1 output not found - cannot proceed with data type refinement');
    }

    if (!p0_1_output.line_numbered_transcript || p0_1_output.line_numbered_transcript.length === 0) {
      throw new Error('No transcript lines to refine');
    }

    // Build the prompt
    const prompt = this.buildPrompt(p0_1_output);

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
    let output: P0_2_Output;
    
    try {
      output = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse LLM JSON response: ${error.message}`,
        responseText
      );
    }

    // Basic validation
    if (!output.refined_data_transcript) {
      throw new Error('Invalid response: missing refined_data_transcript');
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

    // Check for P0_1 output
    if (!state.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE]) {
      throw new Error('P0_1 output not found');
    }

    const p0_1_output = state.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] as P0_1_Output;
    
    if (!p0_1_output.line_numbered_transcript || p0_1_output.line_numbered_transcript.length === 0) {
      throw new Error('No transcript lines to refine');
    }
  }

  protected isRecoverable(error: Error): boolean {
    // Check for non-recoverable patterns first
    const nonRecoverablePatterns = [
      /p0_1 output not found/i,
      /no transcript lines/i,
      /missing refined_data_transcript/i
    ];

    if (nonRecoverablePatterns.some(pattern => pattern.test(error.message))) {
      return false;
    }

    // Use parent's logic for other cases
    return super.isRecoverable(error);
  }

  buildPrompt(p0_1_output: P0_1_Output): string {
    return `You are a micro-phenomenological data preparation analyst. Your task is to refine the line-numbered transcript by identifying different types of information.
Input:
The JSON output from the previous step (Prompt 0.1) for transcript ID ${p0_1_output.transcript_id}.
${JSON.stringify(p0_1_output, null, 2)}

Instructions:
1. Re-read and categorize each line:
   For each numbered line, determine if it primarily contains:
    - "procedural_information": Utterances related to the interview process itself (e.g., interviewer's questions, participant's reflections on the question or process, meta-comments).
    - "experiential_content": Utterances directly describing the lived experience being investigated.
    - "ambiguous_or_mixed": Lines that are hard to categorize or contain both.
2. Tagging:
   Based on this, assign one or more \`information_tags\` to each line (e.g., ["procedural_information"], ["experiential_content"], ["procedural_information", "experiential_content"]).
3. Decision Notes (Optional):
   If a line is particularly complex or its categorization is non-obvious, add a brief \`decision_notes\` explaining your reasoning.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${p0_1_output.transcript_id}",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "text": "text of line 1...",
      "information_tags": ["tag1", "tag2"],
      "decision_notes": "Optional notes for line 1."
    },
    {
      "line_num": 2,
      "text": "text of line 2...",
      "information_tags": ["tag1"],
      "decision_notes": null
    }
    // ... and so on for all lines
  ]
}`;
  }
}