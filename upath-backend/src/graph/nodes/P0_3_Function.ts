import { P0_3_Schema } from '../schemas/P0_3_Schema';
import { UPathMVPState } from '../langgraph/annotations';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * P0_3 Select Procedural Utterances - LangGraph Function Implementation
 * Selects utterances describing temporal/procedural aspects of the experience
 */
export async function p0_3_node(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log('[LangGraph] Executing P0_3 Select Procedural Utterances');
  
  // Validate inputs
  if (!state.stepOutputs || !state.stepOutputs.P0_2) {
    throw new Error('Missing P0_2 output for P0_3');
  }

  if (!state.stepOutputs.P_NEG1_1) {
    throw new Error('Missing P_NEG1_1 output for P0_3');
  }

  const p0_2_output = state.stepOutputs.P0_2;
  const p_neg1_1_output = state.stepOutputs.P_NEG1_1;
  
  if (!p0_2_output.refined_data_transcript || p0_2_output.refined_data_transcript.length === 0) {
    throw new Error('No refined transcript lines to process in P0_2 output');
  }

  // Build prompt
  const prompt = buildP0_3_Prompt(p0_2_output, p_neg1_1_output);
  
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
  const validatedResult = P0_3_Schema.parse(parsedResponse);

  return {
    stepOutputs: {
      ...state.stepOutputs,
      P0_3: validatedResult
    },
    currentPhase: "P0_3",
    status: 'running'
  };
}

function buildP0_3_Prompt(p0_2_output: any, p_neg1_1_output: any): string {
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