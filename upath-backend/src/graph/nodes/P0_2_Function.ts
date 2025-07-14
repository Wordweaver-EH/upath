import { P0_2_Schema } from '../schemas/P0_2_Schema';
import { UPathMVPState } from '../langgraph/annotations';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * P0_2 Refine Data Types - LangGraph Function Implementation
 * Categorizes transcript lines into procedural_information, experiential_content, or ambiguous_or_mixed
 */
export async function p0_2_node(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log('[LangGraph] Executing P0_2 Refine Data Types');
  
  // Validate inputs
  if (!state.stepOutputs || !state.stepOutputs.P_NEG1_1) {
    throw new Error('Missing P_NEG1_1 output for P0_2');
  }

  if (!state.stepOutputs.P0_1) {
    throw new Error('Missing P0_1 output for P0_2');
  }

  const p0_1_output = state.stepOutputs.P0_1;
  
  if (!p0_1_output.line_numbered_transcript || p0_1_output.line_numbered_transcript.length === 0) {
    throw new Error('No transcript lines to refine in P0_1 output');
  }

  // Build prompt
  const prompt = buildP0_2_Prompt(p0_1_output);
  
  // Call LLM with structured output
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: state.settings?.model || 'gemini-2.5-flash'
  });

  const response = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: state.settings?.temperature ?? 0,
      responseMimeType: 'application/json',
      // Add seed if defined and valid (following frontend pattern)
      ...(state.settings?.seed !== undefined && !isNaN(state.settings.seed) && state.settings.seed > 0 && { seed: state.settings.seed })
    }
  });

  // Parse and validate response
  const responseText = response.response.text();
  let parsedResponse;
  
  try {
    parsedResponse = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${responseText}`);
  }

  // Validate against schema
  const validatedResult = P0_2_Schema.parse(parsedResponse);

  return {
    stepOutputs: {
      ...state.stepOutputs,
      P0_2: validatedResult
    },
    currentPhase: "P0_2",
    status: 'running'
  };
}

function buildP0_2_Prompt(p0_1_output: any): string {
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