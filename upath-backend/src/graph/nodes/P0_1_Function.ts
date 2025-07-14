import { P0_1_Schema } from '../schemas/P0_1_Schema';
import { UPathMVPState } from '../langgraph/annotations';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * P0_1 Transcription Adherence - LangGraph Function Implementation
 * Processes raw transcript by verifying conventions, adding line numbers, and logging initial impressions
 */
export async function p0_1_node(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log('[LangGraph] Executing P0_1 Transcription Adherence');
  
  // Validate inputs
  if (!state.transcripts || state.transcripts.length === 0) {
    throw new Error('No transcripts provided for P0_1');
  }
  
  const transcript = state.transcripts[0];
  if (!transcript.content || transcript.content.trim().length === 0) {
    throw new Error('Empty transcript content for P0_1');
  }
  
  // Build prompt using frontend prototype format
  const prompt = buildP0_1_Prompt(transcript);
  
  // Call LLM
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
      responseMimeType: 'application/json'
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
  const validatedResult = P0_1_Schema.parse(parsedResponse);
  
  return {
    stepOutputs: {
      ...state.stepOutputs,
      P0_1: validatedResult
    },
    currentPhase: "P0_1",
    status: 'running'
  };
}

function buildP0_1_Prompt(transcript: any): string {
  const filenameOrId = transcript.filename || transcript.id;
  
  return `You are a micro-phenomenological data preparation assistant. Your first task is to process a raw interview transcript file.
Input:
Raw text content of a single interview transcript file.
Transcript Filename/ID: ${filenameOrId}

Instructions:
1. Verify Transcription Conventions (as much as possible from text):
   Check if the transcript appears to be verbatim and orthographic.
   Note any apparent deviations (e.g., summarized, para-verbal/non-verbal cues missing). This is a best-effort check.
2. Automatic Line Numbering:
   Assign a unique, sequential line number to each line of the transcript. Start numbering from 1.
3. Initial Impression Log (Optional but Recommended by Paper §18):
   Read through the transcript once. Record any very initial impressions regarding evocation quality or nature of described experience. Keep brief and marked as preliminary.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${filenameOrId}",
  "line_numbered_transcript": ["1: text of line 1...", "2: text of line 2..."],
  "transcription_convention_notes": "Your notes here.",
  "initial_impressions_log": "Your brief impressions here."
}

BEGIN PROCESSING RAW TRANSCRIPT:
Transcript ID: ${filenameOrId}
Content:
${transcript.content}`;
}