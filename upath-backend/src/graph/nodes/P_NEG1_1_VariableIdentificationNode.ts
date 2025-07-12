import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P_NEG1_1_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P_NEG1_1_VariableIdentificationNode extends BaseNode {
  id = StepId.P_NEG1_1_VARIABLE_IDENTIFICATION;
  name = 'Variable Identification';

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    this.validateInputs(state);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.processWithLLM(state, context);
      } catch (error) {
        lastError = error as Error;
        context.logger.error(`P_NEG1_1 execution failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`);
        
        if (attempt < maxRetries) {
          const baseDelay = process.env.NODE_ENV === 'test' ? 10 : 1000;
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Unknown error in P_NEG1_1 execution');
  }

  validateInputs(state: GraphState): void {
    const { transcripts, userDvFocus } = state;
    
    if (!transcripts || transcripts.length === 0 || !transcripts[0].content) {
      throw new Error('Missing transcript content for P_NEG1_1');
    }

    if (!userDvFocus) {
      throw new Error('Missing user DV focus for P_NEG1_1');
    }

    if (!userDvFocus.dv_focus || userDvFocus.dv_focus.length === 0) {
      throw new Error('Empty DV focus array for P_NEG1_1');
    }
  }

  private async processWithLLM(
    state: GraphState, 
    context: ExecutionContext
  ): Promise<Partial<GraphState>> {
    const transcript = state.transcripts[0];
    const prompt = this.buildPrompt(transcript, state.userDvFocus!);
    
    context.logger.info(`Executing ${this.name} for transcript: ${transcript.id}`);
    
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

    const result = this.parseResponse(response, transcript.id);
    
    return {
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: result
      }
    };
  }

  private buildPrompt(transcript: RawTranscript, userDvFocus: { dv_focus: string[] }): string {
    const filenameOrId = transcript.filename || transcript.id;
    
    return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${filenameOrId}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(userDvFocus.dv_focus)}

Instructions:
1.  Identify Independent Variable (IV) / Condition:
    *   Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
    *   Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."
2.  Record DV Focus:
    *   The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${filenameOrId}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(userDvFocus.dv_focus)}
}

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${filenameOrId}
User-specified Dependent Variable Focus: ${JSON.stringify(userDvFocus.dv_focus)}
Content:
${transcript.content}`;
  }

  private parseResponse(response: any, transcriptId: string): P_NEG1_1_Output {
    try {
      const text = response.response.text();
      const parsed = JSON.parse(text);
      
      // Validate required fields
      if (!parsed.transcript_id || !parsed.independent_variable_details || !parsed.dependent_variable_focus) {
        throw new Error('Missing required fields in P_NEG1_1 response');
      }

      // Validate dependent_variable_focus is an array
      if (!Array.isArray(parsed.dependent_variable_focus)) {
        throw new Error('dependent_variable_focus must be an array');
      }

      return {
        transcript_id: parsed.transcript_id,
        independent_variable_details: parsed.independent_variable_details,
        dependent_variable_focus: parsed.dependent_variable_focus
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new LLMResponseError(
          `Failed to parse JSON response in ${this.name}`,
          response.response.text(),
          error
        );
      }
      throw error;
    }
  }
}

interface RawTranscript {
  id: string;
  filename?: string;
  content: string;
}