# Part 1: Specific Diachronic Analysis

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

**Purpose**: Tags each segment with its phase type in the temporal unfolding of experience.

**Input**: P1.1 output (segmented utterances)

**Processing**:
1. Analyzes each segment for phase indicators
2. Assigns phase tags based on experiential progression
3. Common phases include:
   - `Initial_Engagement`: First contact with the experience
   - `Exploration`: Active investigation or deepening
   - `Transition`: Changes or shifts in experience
   - `Resolution`: Completion or integration
   - `Reflection`: Looking back or making sense

**Output** (`P1_2_Output`):
```typescript
{
  transcript_id: string,
  phase_tagged_utterances: [
    {
      original_utterance: SelectedUtterance,
      segments: [
        {
          segment_id: string,
          segment_text: string,
          phase_tag: string,         // e.g., "Exploration"
          tag_justification: string  // Why this phase was assigned
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

**Purpose**: Groups related segments into larger temporal units (DUs) that represent coherent experiential episodes.

**Input**: P1.3 output (sorted segments)

**Processing**:
1. Identifies thematically coherent segment clusters
2. Creates Diachronic Units (DUs) representing experiential episodes
3. Names units descriptively (e.g., "Initial_Anxiety_Recognition")
4. Maps source segments to each DU
5. These DUs become the processing units for Part 2

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

### Phase Types
- Not prescriptive - emerge from the data
- Common patterns: engagement → exploration → transition → resolution
- May vary based on the type of experience being analyzed

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