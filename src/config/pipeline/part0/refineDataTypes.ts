import { StepId, P0_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P0_2_REFINE_DATA_TYPES_CONFIG: StepConfig = {
  id: StepId.P0_2_REFINE_DATA_TYPES,
  title: "P0.2: Refining Data - Identifying Information Types",
  part: "Part0",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P0.2." };
    const p0_1_data = allProcessedData?.get(currentTranscript.id)?.p0_1_output;
    if (!p0_1_data) return { data: null, error: `Missing P0.1 output for transcript ${currentTranscript.id}` };
    
    // Parse the line-numbered transcript to extract line numbers and text
    const parsedLines = p0_1_data.line_numbered_transcript.map(line => {
      // Extract line number (format: "1: ...")
      const lineMatch = line.match(/^(\d+):\s*(.*)$/);
      if (!lineMatch) {
        return { lineNumber: '', speaker: '', text: line };
      }
      
      const [, lineNumber, rest] = lineMatch;
      
      // Check for speaker (format: "Speaker Name: ..." or "P1: ...")
      const speakerMatch = rest.match(/^([^:]+):\s*(.*)$/);
      if (speakerMatch) {
        const [, speaker, text] = speakerMatch;
        // Check if this is actually a speaker and not just a colon in the text
        if (speaker.match(/^[A-Z]\d+$/) || speaker.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/) || speaker.length < 30) {
          return { lineNumber, speaker: speaker.trim(), text: text.trim() };
        }
      }
      
      // No speaker found, treat as regular text
      return { lineNumber, speaker: '', text: rest };
    });
    
    return { 
      data: {
        ...p0_1_data,
        parsed_lines: parsedLines
      }
    };
  },
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      refined_data_transcript: {
        type: "array",
        items: {
          type: "object",
          properties: {
            line_num: { type: "integer" },
            speaker: { type: "string" },
            text: { type: "string" },
            information_tags: { type: "array", items: { type: "string" } },
            decision_notes: { type: "string" }
          },
          required: ["line_num", "text", "information_tags"]
        }
      }
    },
    required: ["transcript_id", "refined_data_transcript"]
  },
  generatePrompt: (input: P0_1_Output & { parsed_lines: Array<{ lineNumber: string; speaker: string; text: string }> }) => `You are a micro-phenomenological data preparation analyst. Your task is to refine the line-numbered transcript by identifying different types of information.
Input:
The parsed transcript lines for transcript ID ${input.transcript_id}.
${JSON.stringify({ 
  transcript_id: input.transcript_id,
  parsed_lines: input.parsed_lines,
  transcription_convention_notes: input.transcription_convention_notes,
  initial_impressions_log: input.initial_impressions_log
}, null, 2)}

Instructions:
1. Re-read and categorize each parsed line:
   For each line in parsed_lines, determine if it primarily contains:
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
  "transcript_id": "${input.transcript_id}",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "speaker": "P1",
      "text": "text content without line number or speaker prefix",
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
}
`,
};