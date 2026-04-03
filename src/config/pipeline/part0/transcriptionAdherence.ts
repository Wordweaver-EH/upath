import { StepId } from '../../../../types';
import { StepConfig } from '../types';

export const P0_1_TRANSCRIPTION_ADHERENCE_CONFIG: StepConfig = {
  id: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
  title: "P0.1: Transcription Adherence & Line Numbering",
  part: "Part0",
  isJsonOutput: true,
  getInput: (currentTranscript) => {
    if (!currentTranscript?.content) return { data: null, error: "Missing transcript content for P0.1." };
    return {
      data: {
        filename_or_id: currentTranscript.filename || currentTranscript.id,
        raw_transcript_text_from_file: currentTranscript.content,
      },
    };
  },
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      line_numbered_transcript: { type: "array", items: { type: "string" } },
      transcription_convention_notes: { type: "string" },
      initial_impressions_log: { type: "string" }
    },
    required: ["transcript_id", "line_numbered_transcript", "transcription_convention_notes", "initial_impressions_log"]
  },
  generatePrompt: (input) => `You are a micro-phenomenological data preparation assistant. Your first task is to process a raw interview transcript file.
Input:
Raw text content of a single interview transcript file.
Transcript Filename/ID: ${input.filename_or_id}

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
  "transcript_id": "${input.filename_or_id}",
  "line_numbered_transcript": ["1: text of line 1...", "2: text of line 2..."],
  "transcription_convention_notes": "Your notes here.",
  "initial_impressions_log": "Your brief impressions here."
}

BEGIN PROCESSING RAW TRANSCRIPT:
Transcript ID: ${input.filename_or_id}
Content:
${input.raw_transcript_text_from_file}
`,
};