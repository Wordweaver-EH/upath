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

*   **Initial State:** The participant's state BEFORE the main phenomenon described in the DV begins. This phase ends the moment the participant first notices any direct effect of the suggestion or stimulus. If a segment describes setting up, preparing, having expectations, or managing thoughts *prior to* any perceptual/physical change, it is Initial State.

*   **Core Experience:** The main, ongoing part of the experience — from the first onset of the phenomenon until the concluding event. Includes thoughts, feelings, and reactions that arose *during* this central phase.

*   **Final Action:** The concluding event itself — the moment the main phenomenon reaches its end state or culmination (e.g., hands actually touching, sound clearly heard or confirmed absent, a decisive action taken). Includes any thoughts or feelings that arose *concurrently with or immediately from* that specific culminating event.

*   **Post-Hoc Reflection:** The participant has stepped outside the timeline and is speaking from the present interview moment — analyzing, summarizing, or comparing the *entire* experience. Use this ONLY if the utterance cannot be placed in any concrete temporal bucket. Signs: comparing to a *different* experience, giving a summary judgment of the whole event, speaking in present tense about their general traits.

## Critical: Temporal Discourse Markers Are NOT Phase Cues

Words like "firstly", "initially", "at first", "first thing" describe **sequence within whatever phase the segment belongs to** — they do NOT automatically indicate Initial State. Always ask: *Is this segment describing something that happened before the main phenomenon started, or is it describing the participant's first reaction TO the phenomenon once it had already begun?* If it is the latter, it belongs in Core Experience or Final Action depending on when that reaction occurred.

Example: "firstly I was like, oh this is fine" said about feeling hands pulling together → **Final Action**, not Initial State.

## The Deciding Question

Ask: **"Has the main phenomenon described in the DV started yet?"**

- If NO → Initial State
- If YES, and the culminating event hasn't happened yet → Core Experience
- If YES, and this describes the culminating event itself → Final Action
- If the participant is no longer narrating the experience at all → Post-Hoc Reflection

Note: Prior filtering may have likely removed most post-hoc reflections before you receive this. You may have no or very few utterances that fit this category.

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