import { P_NEG1_1_Schema } from '../schemas/P_NEG1_1_Schema';
import { UPathMVPState } from '../langgraph/annotations';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * P_NEG1_1 Variable Identification - LangGraph Function Implementation
 * Extracts Independent Variables from transcript headers and records Dependent Variable focus
 */
export async function p_neg1_1_node(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log('[LangGraph] Executing P_NEG1_1 Variable Identification');
  
  // Validate inputs
  if (!state.transcripts || state.transcripts.length === 0) {
    throw new Error('Missing transcript content for P_NEG1_1');
  }
  
  const transcript = state.transcripts[0];
  if (!transcript.content) {
    throw new Error('Empty transcript content for P_NEG1_1');
  }
  
  if (!state.userDvFocus || !state.userDvFocus.dv_focus || state.userDvFocus.dv_focus.length === 0) {
    throw new Error('Missing user DV focus for P_NEG1_1');
  }
  
  // Build prompt
  const prompt = buildP_NEG1_1_Prompt(transcript, state.userDvFocus.dv_focus);
  
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
  const validatedResult = P_NEG1_1_Schema.parse(parsedResponse);
  
  return {
    stepOutputs: {
      ...state.stepOutputs,
      P_NEG1_1: validatedResult
    },
    currentPhase: "P_NEG1_1",
    status: 'running'
  };
}

function buildP_NEG1_1_Prompt(transcript: any, userDvFocus: string[]): string {
  const filenameOrId = transcript.filename || transcript.id;
  
  return `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${filenameOrId}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(userDvFocus)}

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
  "dependent_variable_focus": ${JSON.stringify(userDvFocus)}
}

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${filenameOrId}
User-specified Dependent Variable Focus: ${JSON.stringify(userDvFocus)}
Content:
${transcript.content}`;
}