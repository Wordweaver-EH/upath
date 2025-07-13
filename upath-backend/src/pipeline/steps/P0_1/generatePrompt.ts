/**
 * P0_1 Transcription Adherence - Prompt Generation
 * Exactly matches the working prototype's generatePrompt function
 */

import { GeneratePromptFunction } from '../../core/interfaces';
import { P0_1_Input } from './types';

/**
 * Generate prompt for P0_1 step
 * Exactly matches the working prototype's prompt template
 */
export const generatePrompt: GeneratePromptFunction = (inputData: P0_1_Input): string => {
  const { filename_or_id, raw_transcript_text_from_file } = inputData;

  // Exact prompt template from the working prototype
  return `You are a micro-phenomenological data preparation assistant. Your first task is to process a raw interview transcript file.
Input:
Raw text content of a single interview transcript file.
Transcript Filename/ID: ${filename_or_id}

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
  "transcript_id": "${filename_or_id}",
  "line_numbered_transcript": ["1: text of line 1...", "2: text of line 2..."],
  "transcription_convention_notes": "Your notes here.",
  "initial_impressions_log": "Your brief impressions here."
}

BEGIN PROCESSING RAW TRANSCRIPT:
Transcript ID: ${filename_or_id}
Content:
${raw_transcript_text_from_file}`;
};