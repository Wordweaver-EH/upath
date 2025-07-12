import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P0_1_Output, P0_2_Output, RefinedLine } from '../types/outputs';

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
    const output: P0_2_Output = JSON.parse(responseText);

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
    const transcriptLines = p0_1_output.line_numbered_transcript.join('\n');

    return `# DATA TYPE REFINEMENT

You are analyzing a line-numbered transcript to identify and tag different types of information in each utterance.

## Line-Numbered Transcript (from line_numbered_transcript):
${transcriptLines}

## Your Task:

Analyze each line and assign appropriate information tags based on the content:

### Information Tags:
- **I-tag**: Informational utterances that provide context, descriptions, or explanations
- **L-tag**: Leading questions or statements that guide the conversation
- **P-tag**: Procedural utterances that describe steps, actions, or processes

### Guidelines:
1. Each line can have multiple tags if it contains multiple types of information
2. Some lines may have no tags if they are purely conversational fillers
3. Focus on the semantic content, not just the speaker role
4. Procedural content (P-tag) is especially important to identify accurately

## Output Format:
Please provide your analysis in the following JSON format:

{
  "transcript_id": "${p0_1_output.transcript_id}",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "text": "[The text from line 1]",
      "information_tags": ["array", "of", "tags"],
      "decision_notes": "Optional: Brief explanation of tagging decision"
    },
    // ... continue for all lines
  ]
}

### Example Output:
{
  "transcript_id": "example-123",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "text": "Interviewer: Can you describe how you prepare the materials?",
      "information_tags": ["L-tag"],
      "decision_notes": "Leading question asking for procedural information"
    },
    {
      "line_num": 2,
      "text": "Participant: First, I gather all the documents from the filing cabinet.",
      "information_tags": ["P-tag"],
      "decision_notes": "Describes first step in the process"
    }
  ]
}

Ensure the JSON is valid and includes all lines from the transcript.`;
  }
}