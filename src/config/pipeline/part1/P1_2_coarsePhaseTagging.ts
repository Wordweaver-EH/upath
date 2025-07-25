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
  generatePrompt: (input: P1_1_Output) => `You are a micro-phenomenological data analyst classifying interview segments into four distinct temporal phases. Your task is to determine if the speaker is describing an event **from within** the chronological timeline of the actual experience [Initial State, Core Experience, Final Action] or **is analyzing the experience as a whole** from the interview chair [Post-Hoc Reflection].

CRITICAL: Before classifying a segment, read the full original_utterance.text to understand its complete context.

Input:
A list of utterances, each containing one or more segments.

Instructions:
For each segment, assign a 'coarse_phase' tag from this FIXED list: [Initial State, Core Experience, Final Action, Post-Hoc Reflection].

## Classification Guide

*   **Initial State:** Describes the participant's state or actions at the very beginning of the event.

*   **Core Experience:** Describes the main, ongoing part of the experience. This includes any thoughts, feelings, or emotional reactions that happened *during* this central phase.

*   **Final Action:** Describes the concluding phase and any specific action of the experience. This includes any thoughts, feelings, or emotional reactions that happened *concurrently with or immediately resulted from* that final action.

*   **Post-Hoc Reflection:** The participant has stepped outside the timeline of the experience and is speaking from the present moment of the interview. They are no longer narrating the event, but are **analyzing, summarizing, or explaining it as a whole.** This includes:
    *   Comparing it to a *different* experience.
    *   Giving a summary judgment of the *entire* event.
    *   Any utterance that does not fit any concrete temporal bucket [initial, core, final].

## The Deciding Question

To distinguish the phases, ask: **"Is the participant *narrating* a moment from the timeline, or are they *analyzing* the experience from the outside?"**

-   **Narration belongs** in \`Initial State\`, \`Core Experience\`, or \`Final Action\`. A description of a feeling (e.g., "it was surprising because...") is part of the narration.
-   **Analysis belongs** in \`Post-Hoc Reflection\`.

Note: Prior filtering may have removed most post-hoc reflections. This tag is for any remaining commentary that does not fit the experiential timeline.

IMPORTANT: Each segment MUST be assigned exactly ONE phase.

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