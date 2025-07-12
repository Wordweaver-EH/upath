import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P0_1_Output, RawTranscript } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P0_1_TranscriptionAdherenceNode extends BaseNode {
  id = StepId.P0_1_TRANSCRIPTION_ADHERENCE;

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    const { transcripts } = state;
    
    // Validate we have transcripts
    if (!transcripts || transcripts.length === 0) {
      throw new Error('No transcripts provided');
    }

    // For now, process only the first transcript
    // In the future, we might process multiple transcripts
    const transcript = transcripts[0];
    
    if (!transcript.content || transcript.content.trim() === '') {
      throw new Error('Empty transcript content');
    }

    // Build the prompt
    const prompt = this.buildPrompt(transcript);

    // Call the LLM
    const response = await context.llmClient.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: context.settings.temperature || 0.1,
        responseMimeType: 'application/json'
      }
    });

    // Parse the response
    const responseText = response.response.text();
    let output: P0_1_Output;
    
    try {
      output = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse LLM JSON response: ${error.message}`,
        responseText
      );
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

    // Additional validation specific to this node
    if (!state.transcripts || state.transcripts.length === 0) {
      throw new Error('No transcripts provided');
    }

    // Check for empty transcripts
    const hasValidTranscript = state.transcripts.some(t => 
      t.content && t.content.trim().length > 0
    );

    if (!hasValidTranscript) {
      throw new Error('Empty transcript content');
    }
  }

  protected isRecoverable(error: Error): boolean {
    // Check for non-recoverable patterns first
    const nonRecoverablePatterns = [
      /no transcripts provided/i,
      /empty transcript/i
    ];

    if (nonRecoverablePatterns.some(pattern => pattern.test(error.message))) {
      return false;
    }

    // Use parent's logic for other cases
    return super.isRecoverable(error);
  }

  buildPrompt(transcript: RawTranscript): string {
    return `# TRANSCRIPTION ADHERENCE CHECK

You are analyzing a transcript to ensure it follows proper transcription conventions and to extract initial insights.

## Transcript to Analyze:
${transcript.content}

## Your Tasks:

1. **Create Line-Numbered Transcript**: 
   - Add line numbers to each line starting from 1
   - Maintain speaker labels (e.g., "Interviewer:", "Participant:")
   - Preserve the exact text including pauses, fillers, and informal language

2. **Assess Transcription Conventions**:
   - Check for consistent speaker labeling
   - Note punctuation and formatting patterns
   - Identify any transcription symbols or conventions used

3. **Initial Impressions**:
   - Note the general topic and flow of conversation
   - Identify any procedural descriptions or step-by-step processes mentioned
   - Flag any data quality issues

## Output Format:
Please provide your analysis in the following JSON format:

{
  "transcript_id": "${transcript.id}",
  "line_numbered_transcript": [
    "1: [First line with speaker label]",
    "2: [Second line with speaker label]",
    // ... continue for all lines
  ],
  "transcription_convention_notes": "Description of conventions observed",
  "initial_impressions_log": "Brief summary of content and any procedural elements identified"
}

Ensure the JSON is valid and properly formatted.`;
  }
}