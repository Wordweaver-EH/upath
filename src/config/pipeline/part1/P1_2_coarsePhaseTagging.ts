import { StepId, P1_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_2_COARSE_PHASE_TAGGING_CONFIG: StepConfig = {
  id: StepId.P1_2_COARSE_PHASE_TAGGING,
  title: "P1.2: Coarse Phase Tagging",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.2." };
    const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    return { data: p1_1_data };
  },
  generatePrompt: (input: P1_1_Output) => `You are a micro-phenomenological data analyst. Your task is to classify interview segments into broad temporal phases by considering the context of the original utterance they came from.

CRITICAL: Read the ENTIRE original utterance text for context before classifying each segment. The utterance context often contains temporal markers that are crucial for correct classification.

Input:
A list of utterances, each containing one or more segments.

Instructions:
For each segment in the list, perform the following:
1. First, read the original_utterance.text to understand the full context
2. Then read the segment_text itself
3. Pay special attention to temporal_cues already identified in the segment
4. Assign a coarse_phase tag to the segment from the following FIXED list: Initial State, Core Experience, Final Action, Post-Hoc Reflection

Classification Guide (with additional cues):
• Initial State: The participant is describing their mindset, setup, or events right at the beginning. 
  Cues: "at the start", "when we started", "first", "initially", "before", "to begin with"
  
• Core Experience: The participant is describing the main, sustained sensations, thoughts, or feelings that occurred after the onset and before any final action. 
  Cues: "during", "still", "whenever", "kept", "while", "throughout", "as I was", "continued to"
  
• Final Action: The participant is describing a distinct action taken to conclude or test the experience, and any sensations or thoughts that happened concurrently with that action. 
  Cues: "at the end", "when I was trying to pull them apart", "finally", "then I", "to finish", "last thing"
  
• Post-Hoc Reflection: The participant is looking back on the experience from the present moment of the interview, comparing it to other times, or analyzing it. 
  Cues: "after hearing", "on the second one", "looking back", "now that I think", "compared to", "in retrospect", "I realize"

IMPORTANT: 
- Each segment MUST be assigned exactly ONE phase
- Consider both the segment content AND its position within the original utterance
- When in doubt, the original utterance context takes precedence

Input: ${JSON.stringify(input)}

Output:
A JSON object containing the original utterances and segments, with a coarse_phase tag added to each segment:
{
  "transcript_id": "${input.transcript_id}",
  "phase_tagged_utterances": [
    {
      "original_utterance": {
        "line_number": "5.1",
        "speaker": "P",
        "text": "...",
        "utterance_type": "Procedural",
        "included": true
      },
      "segments": [
        {
          "segment_id": "utt_5_1_seg_0",
          "segment_text": "...",
          "temporal_cues": ["..."],
          "coarse_phase": "Initial State"
        }
      ]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}`,
};