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
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      phase_tagged_utterances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_utterance: {
              type: "object",
              properties: {
                original_line_num: { type: "string" },
                utterance_text: { type: "string" }
              },
              required: ["original_line_num", "utterance_text"]
            },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" },
                  temporal_cues: { type: "array", items: { type: "string" } },
                  coarse_phase: {
                    type: "string",
                    enum: ["Initial State", "Core Experience", "Final Action", "Post-Hoc Reflection"]
                  }
                },
                required: ["segment_id", "segment_text", "coarse_phase"]
              }
            }
          },
          required: ["original_utterance", "segments"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "phase_tagged_utterances", "independent_variable_details", "dependent_variable_focus"]
  },
  generatePrompt: (input: P1_1_Output) => `You are a micro-phenomenological data analyst classifying interview segments into four distinct temporal phases. Your task is to determine if the speaker is describing an event **from within** the chronological timeline of the actual experience [Initial State, Core Experience, Final Action] or **is analyzing the experience as a whole** from the interview chair [Post-Hoc Reflection].

CRITICAL: Before classifying a segment, read the full original_utterance.text to understand its complete context. For very short, affirmative, or negative segments (e.g., 'Yeah,' 'No,' 'I don't think so'), the coarse_phase should be inherited from the temporal context established by the interviewer's preceding question or the surrounding context.

Input:
A list of utterances, each containing one or more segments.

Instructions:
For each segment, assign a 'coarse_phase' tag from this FIXED list: [Initial State, Core Experience, Final Action, Post-Hoc Reflection].

## Classification Guide

*   **Initial State:** Describes the participant's state or actions at the very beginning of the event.

*   **Core Experience:** Describes the main, ongoing part of the experience. This includes any thoughts, feelings, or emotional reactions that happened *during* this central phase.

*   **Final Action:** Describes the concluding phase and any specific action of the experience. This includes any thoughts, feelings, or emotional reactions that happened *concurrently with or immediately resulted from* that final action.

*   **Post-Hoc Reflection:** The participant has stepped outside the timeline of the experience and is speaking from the present moment of the interview. They are no longer narrating the event, but are **analyzing, summarizing, or explaining it as a whole.** These are utterances that cannot be used to reconstruct the timeline. This is the case ONLY if the utterance does not fit any concrete temporal bucket [initial, core, final]. This maybe because they are:
    *   Comparing it to a *different* experience.
    *   Giving a summary judgment of the *entire* event.

## The Deciding Question

To distinguish the phases, ask: **"Is the participant *narrating* a moment from the timeline, or are they *analyzing* the experience from the outside?"**

-   **Narration belongs** in \`Initial State\`, \`Core Experience\`, or \`Final Action\`. A description of a feeling (e.g., "it was surprising because...") or even in the moment analysis that happened during the experience is part of the narration.
-   **Analysis belongs** in \`Post-Hoc Reflection\`if it doesn't refer to sense-making that happened during the experience and is happening after it.

Note: Prior filtering may have likely removed most post-hoc reflections before you recieve this, you may have no or very few utterances that fit this category. This tag is for any remaining commentary that does not fit the experiential timeline.

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