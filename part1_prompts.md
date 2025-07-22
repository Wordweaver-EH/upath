# Part 1 Pipeline Prompts

## P0.3: Select Utterances

```
You are a qualitative researcher analyzing interview transcripts. Your task is to select utterances from the transcript that contain experiential content. Specifically, focus on utterances that describe subjective experiences, feelings, sensations, thoughts, or actions taken by the participants.

Input:
${JSON.stringify(input.lines, null, 2)}

Instructions:
1. Review each utterance in the transcript.
2. Select utterances that contain experiential content (e.g., "I felt...", "I noticed...", "I was thinking...", "I decided to...").
3. Include utterances that describe internal states, sensory experiences, emotions, thoughts, or deliberate actions.
4. Exclude utterances that are purely factual, theoretical, or interviewer questions (unless they contain experiential content from the interviewer).
5. Preserve the original line numbers and utterance text exactly as they appear.

Output format:
{
  "transcript_id": "${input.transcript_id}",
  "selected_utterances": [
    {
      "original_line_num": "line number from original",
      "utterance_text": "exact text of selected utterance",
      "experiential_markers": ["list", "of", "experiential", "indicators", "found"]
    }
  ]
}

Provide only the JSON output, no additional commentary.
```

## P1.1: Initial Segmentation

```
You are a qualitative researcher trained in micro-phenomenological analysis. Your task is to segment interview utterances into smaller, meaningful units that capture distinct moments or aspects of experience.

Input:
${JSON.stringify(input.selected_utterances, null, 2)}

Instructions:
1. For each utterance, identify natural breakpoints where:
   - The focus of attention shifts
   - A new action or mental process begins
   - The temporal reference changes
   - A new sensory modality is introduced
   
2. Create segments that are:
   - Self-contained units of meaning
   - Typically 1-3 clauses long
   - Focused on a single aspect of experience
   
3. Assign each segment a unique ID in the format: utt_[utterance_line]_[transcript_id]_seg_[segment_number]
   
4. Preserve the original utterance structure and reference.

Output format:
{
  "transcript_id": "${input.transcript_id}",
  "segmented_utterances": [
    {
      "original_utterance": {
        "original_line_num": "line number",
        "utterance_text": "full original text"
      },
      "segments": [
        {
          "segment_id": "unique segment identifier",
          "segment_text": "text of this segment",
          "segmentation_rationale": "brief explanation of why this is a distinct segment"
        }
      ]
    }
  ]
}

Provide only the JSON output, no additional commentary.
```

## P1.2: Coarse Phase Tagging

```
You are a micro-phenomenological data analyst. Your task is to classify interview segments into broad temporal phases by considering the context of the original utterance they came from.

CRITICAL: Read the ENTIRE original utterance text for context before classifying each segment. The segment's meaning often depends on the full utterance context.

Input:
${JSON.stringify(input.segmented_utterances, null, 2)}

Instructions:
1. FIRST, read the complete original utterance text to understand the full context
2. THEN classify each segment into one of these temporal phases based on BOTH the segment content AND its context within the original utterance:

   - Initial State: Describes conditions, states, or awareness BEFORE the main experience
   - Core Experience: The central phenomenon, main action, or focal experience
   - Final Action: Concluding actions, decisions, or movements that complete the experience
   - Post-Hoc Reflection: Later thoughts, interpretations, or meta-commentary about the experience

3. Consider temporal markers and narrative flow when the segment text alone is ambiguous
4. Use the utterance context to disambiguate when segments could fit multiple categories

Temporal Cues to Consider:
- "Before/initially/at first" → Initial State
- "Then/when/as/during" → Core Experience  
- "Finally/eventually/decided to" → Final Action
- "Looking back/I think/now I realize" → Post-Hoc Reflection

Output format:
{
  "transcript_id": "${input.transcript_id}",
  "phase_tagged_segments": [
    {
      "segment_id": "segment identifier",
      "segment_text": "segment text",
      "coarse_phase": "one of: Initial State, Core Experience, Final Action, Post-Hoc Reflection",
      "phase_rationale": "explanation referencing both segment AND utterance context",
      "original_utterance": {
        "original_line_num": "line number",
        "utterance_text": "full original utterance for context"
      }
    }
  ]
}

Example:
Original utterance: "I was feeling tired, and then I noticed this beautiful sunset, so I stopped walking and just watched it for a while."

Segments:
- "I was feeling tired" → Initial State (describes state before main experience)
- "and then I noticed this beautiful sunset" → Core Experience (the main phenomenon)
- "so I stopped walking and just watched it for a while" → Final Action (the concluding action)

IMPORTANT: Always consider how the segment fits within the narrative flow of the complete utterance.

Provide only the JSON output, no additional commentary.
```

## P1.3: Intra-Phase Sorting

```
You are a micro-phenomenological analyst. Your task is to sort segments within each phase chronologically based on their experiential sequence.

Input:
${JSON.stringify(input.phase_tagged_segments, null, 2)}

Instructions:
1. Group segments by their coarse phase
2. Within each phase group, order segments chronologically based on:
   - Explicit temporal markers ("first", "then", "after", "before")
   - Implicit experiential sequence (perception → thought → action)
   - Causal relationships (cause precedes effect)
   - Natural flow of attention or awareness

3. Assign a chronological_index starting from 1 within THE ENTIRE TRANSCRIPT (not per phase)
4. Preserve all existing segment data

Output format:
{
  "transcript_id": "${input.transcript_id}",
  "sorted_segments": [
    {
      "segment_id": "segment identifier",
      "segment_text": "segment text",
      "coarse_phase": "phase name",
      "chronological_index": 1,
      "placement_justification": "why this segment comes at this position",
      "original_utterance": {
        "original_line_num": "line number",
        "utterance_text": "full utterance"
      }
    }
  ],
  "phase_statistics": {
    "Initial State": { "count": 0, "indices": [] },
    "Core Experience": { "count": 0, "indices": [] },
    "Final Action": { "count": 0, "indices": [] },
    "Post-Hoc Reflection": { "count": 0, "indices": [] }
  },
  "independent_variable_details": "${input.independent_variable_details || 'Not specified'}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus || [])}
}

Sort ALL segments into a single chronological sequence, ordered by when they occurred experientially.

Provide only the JSON output, no additional commentary.
```

## P1.4: Diachronic Unit Grouping

```
You are a micro-phenomenological analyst. You will be given a chronologically ordered list of segments from an interview. Your task is to group consecutive segments into Diachronic Units (DUs).

Input:
The fully sorted list of all segments from step P1.3 for transcript ID ${input.transcript_id}.
Sorted segments: ${JSON.stringify(input.sorted_segments, null, 2)}

Instructions:
1. Read the segments in the order provided. They have already been sorted chronologically.
2. Group consecutive segments that describe the same continuous moment, action, or thought process.
3. Create a new DU whenever there is a clear break or transition to a new moment (e.g., a shift from sensation to action, or from one thought to a subsequent, different thought).
4. Provide a concise `description` for each DU that captures the essence of that moment.
5. Each DU should have a unique `unit_id` (e.g., "du_1", "du_2", etc.).
6. List the `source_segment_ids` that constitute each DU.

Output:
A JSON object containing a list of Diachronic Units:
{
  "transcript_id": "${input.transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial awareness and orientation to the experience",
      "source_segment_ids": ["utt_5_1_seg_0", "utt_6_1_seg_0"]
    },
    {
      "unit_id": "du_2", 
      "description": "Sustained attention and deepening of the sensory experience",
      "source_segment_ids": ["utt_6_1_seg_1", "utt_8_1_seg_0", "utt_8_1_seg_1"]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
```

## P1.5: Construct Specific Diachronic Structure (Programmatic)

*Note: P1.5 is a programmatic step that automatically groups DUs into phases. It doesn't use an LLM prompt.*

The algorithm:
1. If 0 DUs: No phases
2. If 1-3 DUs: Single phase called "Main Experience"
3. If 4+ DUs: Divide into three phases:
   - Initial Phase (first third)
   - Development Phase (middle third)
   - Concluding Phase (final third)

Each phase gets a description by concatenating the descriptions of its constituent DUs.