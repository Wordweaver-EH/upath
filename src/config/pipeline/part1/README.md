# Part 1: Specific Diachronic Analysis

## Exact Prompt Chain

### P1.1 Prompt
```
You are a micro-phenomenological analyst. Your task is to segment the selected procedural utterances based on temporal cues, focusing on the described experience's unfolding.
Input:
JSON output from P0.3 for transcript ID ${input.transcript_id} (showing only INCLUDED utterances).
P0.3 Output: ${JSON.stringify(filteredInput, null, 2)}

Instructions:
1. Focus on "Action Units": Read each selected procedural utterance. Identify "minimal action units" or "elementary acts" within them. An utterance might contain one or multiple such segments.

2. Temporal Cues: Look for explicit or implicit temporal markers that delineate these segments.
   
   EXPLICIT temporal markers include:
   - Time words: "then", "after", "before", "suddenly", "meanwhile", "finally"
   - Beginning markers: "at the start", "initially", "first"
   - Sequence markers: "next", "subsequently", "afterwards"
   
   IMPLICIT temporal markers include:
   - Sequence of distinct verbs: "I noticed... I felt... I realized..."
   - Progression indicators: "The sensation grew stronger", "It gradually faded", "It was building"
   - Transition markers: "My attention shifted", "The quality changed", "It transformed into"
   - Causal language (causation implies temporal sequence):
     * "Because of this, I..." (cause precedes effect)
     * "This led to..." (one thing follows another)
     * "As a result..." (consequence follows cause)
     * "Which made me..." (causal chain shows temporal flow)
     * "So I..." (therefore, subsequently)
3.  Segment Creation:
    *   For each original utterance, create an array of segments.
    *   Each segment should have a unique segment_id (e.g., "utt_ORIGINAL_LINE_NUM_seg_INDEX", like "utt_5.1_seg_0", "utt_5.1_seg_1"). Ensure ORIGINAL_LINE_NUM is safe for an ID (replace '.' with '_').
    *   segment_text should be the text of that minimal action unit.
    *   temporal_cues should be an array of strings listing any temporal words/phrases identified *within or at the beginning of* that specific segment that justify its distinctness or position.
4.  Preserve IV/DV: The independent_variable_details and dependent_variable_focus from the input P0.3 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "segmented_utterances": [
    {
      "original_utterance": { // Copied from P0.3 input
        "original_line_num": "string",
        "utterance_text": "text of the original utterance...",
        "selection_justification": "Brief justification for selection."
      },
      "segments": [
        {
          "segment_id": "utt_59_seg_0",
          "segment_text": "Just yeah, just I had a at the start. I had, like a brief images of... glue.",
          "temporal_cues": ["at the start"]
        }
      ]
    }
    // ... more segmented utterances
  ],
  "independent_variable_details": "${filteredInput.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(filteredInput.dependent_variable_focus)}
}
```

### P1.2 Prompt
```
You are a micro-phenomenological data analyst classifying interview segments into four distinct temporal phases. Your task is to determine if the speaker is describing an event **from within** the chronological timeline of the actual experience [Initial State, Core Experience, Final Action] or **is analyzing the experience as a whole** from the interview chair [Post-Hoc Reflection].

CRITICAL: Before classifying a segment, read the full original_utterance.text to understand its complete context.

Input:
A list of utterances, each containing one or more segments.

Instructions:
For each segment, assign a 'coarse_phase' tag from this FIXED list: [Initial State, Core Experience, Final Action, Post-Hoc Reflection].

## Classification Guide

*   **Initial State:** Describes the participant's state or actions at the very beginning of the event.

*   **Core Experience:** Describes the main, ongoing part of the experience. This includes any thoughts, feelings, or emotional reactions that happened *during* this central phase.

*   **Final Action:** Describes the concluding phase and any specific action of the experience. This includes any thoughts, feelings, or emotional reactions that happened *concurrently with or immediately resulted from* that final action.

*   **Post-Hoc Reflection:** The participant has stepped outside the timeline of the experience and is speaking from the present moment of the interview. They are no longer narrating the event, but are **analyzing, summarizing, or explaining it as a whole.** These are utterances that cannot be used to reconstruct the timeline. This includes:
    *   Comparing it to a *different* experience.
    *   Giving a summary judgment of the *entire* event.
    *   Any utterance that does not fit any concrete temporal bucket [initial, core, final].

## The Deciding Question

To distinguish the phases, ask: **"Is the participant *narrating* a moment from the timeline, or are they *analyzing* the experience from the outside?"**

-   **Narration belongs** in `Initial State`, `Core Experience`, or `Final Action`. A description of a feeling (e.g., "it was surprising because...") or even in the moment analysis that happened during the experience is part of the narration.
-   **Analysis belongs** in `Post-Hoc Reflection` if it doesn't refer to sense-making that happened during the experience and is happening after it.

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
}
```

### P1.3 Prompt (Phase-Specific)
```
You are a micro-phenomenological data analyst. You will be given a list of interview segments that all belong to the ${phaseName} phase. Your task is to re-order these segments into their correct chronological sequence.

Input:
A list of segmented utterances belonging to the ${phaseName} phase.
Phase segments: ${JSON.stringify(segments, null, 2)}

Instructions:
1. Analyze the segments to understand the fine-grained sequence of events *within this phase*.
2. Assign a chronological_index to each segment. The sequence should start from 1 for this specific list.
3. Simultaneous events should share the same index.
4. Provide a placement_justification for each segment explaining why it belongs in that position.

Output:
A JSON object containing a single, re-ordered list of the provided segments with added chronological_index and placement_justification fields:
{
  "sorted_segments": [
    {
      "segment_id": "utt_5_1_seg_0",
      "segment_text": "...",
      "temporal_cues": ["..."],
      "coarse_phase": "${phaseName}",
      "chronological_index": 1,
      "placement_justification": "This segment describes the initial moment..."
    }
  ]
}
```

### P1.4 Prompt
```
You are a micro-phenomenological analyst. You will be given a chronologically ordered list of segments from an interview. Your task is to group consecutive segments into Diachronic Units (DUs). A DU represents a coherent, meaningful phase or 'moment' within the participant's stream of experience. It is a single 'beat' or 'scene' in their experiential narrative. All segments within one DU should be thematically unified or explicitly or implicitly reported as simultaneous. The transition between DUs marks a shift in the nature of the experience. This shift may be explicit with temporal and causal cues or be an implicit shift that indicates a new momentary experience arising due to an experiential shift, e.g. shift in focus, sensation, intention, cognition. The DU and segments are in chronological order of phenomenology, i.e. they are sorted according to how they happened in the original experience as opposed to the order they were reported in in the interview.

Input:
The fully sorted list of all segments from step P1.3 for transcript ID ${input.transcript_id}.
Sorted segments: ${JSON.stringify(input.sorted_segments, null, 2)}

Instructions:
1. Read the segments in the order provided. They have already been sorted chronologically.
2. Group consecutive segments that describe the same continuous moment, action, or thought process.
3. Create a new DU whenever there is a clear break or transition to a new moment.
4. No DU should have segments from only the interviewer.
4. Provide a concise description for each DU that captures the essence of that moment.
5. Each DU should have a unique unit_id (e.g., "du_1", "du_2", etc.).
6. List the source_segment_ids that constitute each DU.

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

### P1.5: Programmatic Step (No Prompt)
**Note**: P1.5 is a programmatic step that does not use an LLM prompt. It programmatically constructs the Specific Diachronic Structure from the P1.4 output by organizing DUs into natural phases based on their chronological sequence.

## Overview

Part 1 performs **Specific Diachronic Analysis** on individual transcripts. While "synchronic" refers to simultaneous elements at a given moment, "diachronic" focuses on temporal progression - how experience unfolds over time. Part 1 analyzes each transcript to identify temporal phases, segment the experience into units, and construct a diachronic structure showing how the experience evolved.

## Architecture

### Processing Model
- **Part Iteration**: Part 1 is configured with `iteration: 'per-transcript'` in the pipeline structure
- **Transcript Processing**: Part 1 processes each transcript sequentially through all five steps
- **Sequential Execution**: Transcripts are processed one at a time (not in parallel)
- **Foundation for Part 2**: The Diachronic Units (DUs) identified in P1.4 become the basis for Part 2's synchronic analysis

### Data Flow
```
Part 0 (Data Prep) → Part 1:
  └─ Transcript 1: P1.1 → P1.2 → P1.3 → P1.4 → P1.5
  └─ Transcript 2: P1.1 → P1.2 → P1.3 → P1.4 → P1.5
  └─ ... 
  └─ Transcript N: P1.1 → P1.2 → P1.3 → P1.4 → P1.5
  └─ (all transcripts complete) → Move to Part 2
```

### Transcript Progression Logic
- Each transcript completes all Part 1 steps before the next transcript begins
- The orchestrator's `getNextTranscriptIteration()` handles advancement between transcripts
- Only when ALL transcripts complete Part 1 does the pipeline move to Part 2
- Part 2 will then start from transcript 1 again to process DUs

## Steps

### P1.1: Initial Segmentation

**Purpose**: Breaks down procedural utterances into minimal action units based on temporal cues.

**Input**: P0.3 output (selected procedural utterances marked as `included: true`)

**Processing**:
1. Identifies "minimal action units" or "elementary acts" within utterances
2. Looks for explicit temporal markers ("then", "after", "suddenly")
3. Identifies implicit temporal markers (verb sequences, transitions, causal language)
4. Creates segments with unique IDs preserving original line numbers

**Output** (`P1_1_Output`):
```typescript
{
  transcript_id: string,
  segmented_utterances: [
    {
      original_utterance: SelectedUtterance,  // From P0.3
      segments: [
        {
          segment_id: string,        // e.g., "utt_5_1_seg_0"
          segment_text: string,      // The segmented text
          temporal_cues?: string[]   // Temporal markers found
        }
      ]
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P1.2: Coarse Phase Tagging

**Purpose**: Classifies each segment based on whether the speaker is **narrating from within** the experience timeline or **analyzing from outside** in the interview chair. This crucial distinction separates lived experience from retrospective analysis.

**Input**: P1.1 output (segmented utterances)

**Processing**:
1. Analyzes each segment to determine perspective (within vs outside experience)
2. Uses "The Deciding Question": Is the participant *narrating* a moment or *analyzing* the experience?
3. Assigns one of four fixed phases:
   - `Initial State`: Beginning of the event (narrated from within)
   - `Core Experience`: Main part of experience, including concurrent thoughts/feelings
   - `Final Action`: Concluding phase with any concurrent reactions
   - `Post-Hoc Reflection`: Analyzing from interview chair, cannot reconstruct timeline
4. Key distinctions:
   - In-the-moment analysis during experience = narration (part of that phase)
   - Post-experience analysis from interview = Post-Hoc Reflection
   - Sense-making during experience vs after experience
   - Catch-all: utterances that don't fit temporal buckets = Post-Hoc Reflection

**Output** (`P1_2_Output`):
```typescript
{
  transcript_id: string,
  phase_tagged_utterances: [
    {
      original_utterance: OriginalUtterance,
      segments: [
        {
          segment_id: string,
          segment_text: string,
          temporal_cues: string[],
          coarse_phase: string      // One of the four fixed phases
        }
      ]
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P1.3: Intra-Phase Sorting

**Purpose**: Orders segments chronologically within each phase to preserve temporal sequence.

**Input**: P1.2 output (phase-tagged segments)

**Processing**:
1. Groups segments by phase
2. Sorts segments within each phase based on:
   - Explicit temporal cues
   - Narrative flow
   - Causal relationships
3. Assigns chronological indices
4. Provides justification for placement

**Output** (`P1_3_Output`):
```typescript
{
  transcript_id: string,
  sorted_segments: [
    {
      segment_id: string,
      segment_text: string,
      temporal_cues?: string[],
      coarse_phase: string,             // From P1.2
      chronological_index: number,      // Order within phase
      placement_justification: string   // Why placed here
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P1.4: Diachronic Unit Grouping

**Purpose**: Groups consecutive segments into Diachronic Units (DUs) - coherent 'moments' or 'beats' in the experiential narrative. Each DU represents a unified phase where segments are thematically related or experientially simultaneous.

**Input**: P1.3 output (chronologically sorted segments)

**Processing**:
1. Groups consecutive segments that share thematic unity or simultaneity
2. Creates new DU at each experiential shift:
   - Explicit shifts: temporal/causal cues
   - Implicit shifts: changes in focus, sensation, intention, or cognition
3. Ensures no DU contains only interviewer segments
4. Orders DUs by phenomenological chronology (not interview order)
5. Provides concise descriptions capturing each moment's essence
6. These DUs become the processing units for Part 2

**Output** (`P1_4_Output`):
```typescript
{
  transcript_id: string,
  diachronic_units: [
    {
      unit_id: string,              // e.g., "du_1"
      name: string,                 // Descriptive name
      description: string,          // What happens in this unit
      source_segment_ids: string[]  // Segments included
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P1.5: Construct Specific Diachronic Structure

**Purpose**: Synthesizes DUs into an overall temporal structure showing the complete experiential progression.

**Input**: P1.4 output (diachronic units)

**Processing**:
1. Reviews all DUs for the transcript
2. Identifies overarching phases that span multiple DUs
3. Creates a hierarchical structure of phases containing DUs
4. Generates preliminary observations about IV influence
5. Creates Mermaid diagram for visualization

**Output** (`P1_5_Output`):
```typescript
{
  transcript_id: string,
  specific_diachronic_structure: {
    summary: string,              // Overall temporal pattern
    phases: [
      {
        phase_name: string,       // High-level phase
        description: string,      
        units_involved: string[]  // DU IDs in this phase
      }
    ],
    validation_errors?: string[],
    visualization_hint?: string,
    iv_preliminary_observation?: string  // How IV influenced progression
  },
  diachronic_units: DiachronicUnit[],   // From P1.4
  independent_variable_details: string,
  dependent_variable_focus: string[],
  mermaid_syntax_specific_diachronic?: string
}
```

## Key Concepts

### Diachronic vs Synchronic
- **Diachronic**: Through time, temporal progression, sequential unfolding
- **Synchronic**: At a given time, simultaneous elements, co-occurring features
- Part 1 is diachronic - it traces how experience evolves
- Part 2 is synchronic - it analyzes what happens within each temporal unit

### Temporal Cues
- **Explicit**: Clear time words ("then", "after", "suddenly")
- **Implicit**: Verb sequences, transitions, causal language
- Critical for accurate segmentation and chronological ordering

### Diachronic Units (DUs)
- Coherent experiential episodes within the temporal flow
- Bridge between Part 1 (temporal) and Part 2 (simultaneous)
- Each DU represents a meaningful chunk of the experience
- Has two identifiers:
  - `unit_id`: Simple reference ("du_1", "du_2")
  - `name`: Descriptive label ("Initial_Anxiety_Recognition")

### Coarse Phase Types (P1.2)
- **Fixed phases** (not emergent):
  - `Initial State`: Beginning of the experience
  - `Core Experience`: Main unfolding of the experience
  - `Final Action`: Concluding phase
  - `Post-Hoc Reflection`: Analysis from the interview chair OR catch-all
- **The Narration/Analysis Distinction**:
  - Narration (within timeline): Initial State, Core Experience, Final Action
  - Analysis (outside timeline): Post-Hoc Reflection
  - Key question: "Is the participant *narrating* or *analyzing*?"
- **Examples of the Distinction**:
  - "It was surprising because..." (during the experience) = narration
  - "Looking back, it was surprising..." = analysis
  - In-moment sense-making = narration (part of experience)
  - Post-hoc sense-making = analysis (from interview chair)
  - Utterances that cannot reconstruct timeline = Post-Hoc Reflection
- **Post-Hoc as Catch-All**:
  - Primary use: analysis, summaries, comparisons
  - Secondary use: any utterance that doesn't fit temporal buckets
  - Note: Prior filtering removes most post-hoc reflections already

## State Management

### Storage Structure
```typescript
processedData.get(transcriptId) = {
  p1_1_output?: P1_1_Output,
  p1_1_error?: string,
  p1_2_output?: P1_2_Output,
  p1_2_error?: string,
  p1_3_output?: P1_3_Output,
  p1_3_error?: string,
  p1_4_output?: P1_4_Output,
  p1_4_error?: string,
  p1_5_output?: P1_5_Output,
  p1_5_error?: string,
  isFullyProcessedSpecificDiachronic: boolean,
  dus_for_p2s_processing?: string[],  // Set after P1.4
  // ... other fields
}
```

### Critical Fields for Part 2
- `dus_for_p2s_processing`: Array of DU IDs from P1.4
- Set immediately after P1.4 completes
- Used by Part 2 to iterate through DUs

## Common Issues & Solutions

### Issue: "Missing P0.3 output"
**Cause**: P1.1 can't find data preparation output
**Solution**: Ensure Part 0 completed successfully for the transcript

### Issue: Segments losing temporal order
**Cause**: Improper handling of chronological indices
**Solution**: Preserve original line numbers in segment IDs, use explicit sorting

### Issue: DUs not available for Part 2
**Cause**: `dus_for_p2s_processing` not set after P1.4
**Solution**: Verify P1.4 output includes `diachronic_units` array


## Error Handling

### Step Failures
- Each step can produce either an output or an error (stored in `p1_X_error` fields)
- If a step fails, subsequent steps cannot proceed for that transcript
- Error messages should be descriptive to help debugging
- Common errors:
  - Missing prerequisite data (e.g., P0.3 output)
  - Invalid JSON responses (especially in P1.3's multi-call approach)
  - Empty or malformed input data

### Edge Cases
- **Empty transcripts**: P1.1 will produce empty segments array
- **No temporal cues**: Segments still processed but ordering may be less reliable
- **Single segment**: Still goes through all steps, results in single-DU output
- **P1.4 produces no DUs**: P1.5 handles empty DU array gracefully
- **Very long segments**: May need truncation for LLM context limits

## Integration with Other Parts

### From Part 0
- Receives selected procedural utterances
- Only processes utterances marked as `included: true`
- Maintains IV/DV context throughout

### To Part 2
- Provides DUs that become the units of synchronic analysis
- Each DU from P1.4 will go through P2S.1, P2S.2, P2S.3
- Segment IDs link back to original utterances

### To Part 3
- Diachronic structures from all transcripts aggregated
- Temporal patterns compared across participants
- Generic diachronic patterns emerge from specific ones

## Best Practices

1. **Preserve Traceability**: Always maintain segment IDs that link back to original line numbers
2. **Respect Temporal Flow**: Don't reorder segments unless justified by explicit cues
3. **Fixed Phase Categories**: P1.2 uses exactly 4 predefined phases - don't create new ones
4. **Clear Justifications**: Always provide reasoning for chronological ordering (P1.3)
5. **DU Coherence**: Each DU should represent a meaningful experiential unit, not arbitrary groupings
6. **Handle P1.3 JSON**: Remember P1.3 returns multiple JSON objects that need combining

## Special Processing Notes

### P1.3 Multi-Call Architecture
- Unlike other steps, P1.3 makes multiple LLM calls - one per phase
- Each phase is processed independently using `generatePhaseSpecificPrompt`
- Results are parsed from multiple JSON responses and combined
- This approach ensures better chronological ordering within each phase
- Performance impact: Processing time scales with number of unique phases

### P1.5 Programmatic Processing
- P1.5 is the only step that doesn't use LLM calls
- Phase assignment is deterministic based on DU count:
  - 1-3 DUs → Single "Main Experience" phase
  - 4+ DUs → Three phases with ceil(n/3) distribution
- Validation is performed programmatically
- This ensures consistent structure across transcripts

## Development Notes

- P1.1 is the foundation - errors here cascade through all subsequent steps
- Segment IDs must be unique and traceable throughout the pipeline (periods replaced with underscores)
- Phase tagging (P1.2) uses a FIXED set of 4 phases, not emergent categories
- P1.3 makes multiple LLM calls - one per phase - which impacts performance
- DU creation (P1.4) is critical as it determines Part 2's processing units
- P1.5 is fully programmatic - no LLM calls, deterministic phase assignment
- No Mermaid diagram is currently generated despite the field existing in the type