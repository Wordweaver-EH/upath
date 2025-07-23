# Part 2: Specific Synchronic Analysis (P2S)

## Overview

Part 2 performs **Specific Synchronic Analysis** on individual Diachronic Units (DUs) identified in Part 1. While Part 1 analyzed temporal progression (diachronic), Part 2 focuses on the simultaneous experiential elements within each DU (synchronic). This analysis is performed iteratively for each DU from Part 1.

## Architecture

### Processing Model
- **Transcript Iteration**: Part 2 uses `per-transcript` iteration - completes ALL DUs for one transcript before moving to the next
- **DU Processing**: Within each transcript, DUs from P1.4 are processed sequentially through all three P2S steps
- **Sequential Execution**: Both transcripts and DUs are processed sequentially (not in parallel)
- **Per-DU Storage**: Outputs are stored in `p2s_outputs_by_du[duId]` structure for each transcript

### Data Flow
```
Transcript 1:
  └─ DU 1: P2S.1 → P2S.2 → P2S.3
  └─ DU 2: P2S.1 → P2S.2 → P2S.3
  └─ DU 3: P2S.1 → P2S.2 → P2S.3
  └─ (all DUs complete) → Move to Transcript 2

Transcript 2:
  └─ DU 1: P2S.1 → P2S.2 → P2S.3
  └─ DU 2: P2S.1 → P2S.2 → P2S.3
  └─ (all DUs complete) → Move to Part 3
```

### Transcript Progression Logic
- Each transcript is fully processed before moving to the next
- The orchestrator's `getNextTranscriptIteration()` handles advancement
- After completing all DUs in a transcript, the system checks for more transcripts
- Only when ALL transcripts are complete does Part 2 finish

## Steps

### P2S.1: Group Utterances by Topic

**Purpose**: Groups segments within a DU by thematic similarity relevant to the dependent variable focus.

**Input**:
- Current DU ID (from P1.4)
- Segments belonging to this DU (filtered from P1.1 using P1.4's source_segment_ids)
- Independent/Dependent variable context

**Processing**:
1. Filters all segments to only those belonging to the current DU
2. Groups segments by experiential themes
3. Creates thematic groups with justifications

**Output** (`P2S_1_Output`):
```typescript
{
  transcript_id: string,
  analyzed_du_id: string,
  synchronic_thematic_groups: [
    {
      group_label: string,          // Descriptive name for topic
      justification: string,        // Why these segments belong together
      segments: SegmentedUtteranceSegment[]
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P2S.2: Identify Specific Synchronic Units (ISUs)

**Purpose**: Abstracts thematic groups into conceptual units (ISUs) representing synchronic experiential elements.

**Input**: P2S.1 output for the current DU

**Processing**:
1. Reviews each thematic group from P2S.1
2. Defines ISUs as conceptual abstractions
3. Creates hierarchy (levels 1, 2, etc.)
4. Specifies abstraction operations (generalization, aggregation, instantiation)
5. Provides intensional definitions

**Output** (`P2S_2_Output`):
```typescript
{
  transcript_id: string,
  analyzed_du_id: string,
  specific_synchronic_units_hierarchy: [
    {
      unit_name: string,              // Unique identifier
      level: number,                  // Hierarchy level (1=top)
      abstraction_op: string,         // How it was abstracted
      intensional_definition: string, // Conceptual meaning
      segments?: SegmentedUtteranceSegment[],
      constituent_lower_units?: string[] // References to sub-units
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P2S.3: Define Specific Synchronic Structure (SSS)

**Purpose**: Transforms ISU hierarchy into a semantic network showing relationships between synchronic elements.

**Input**: P2S.2 output for the current DU

**Processing**:
1. Converts ISUs to network nodes
2. Identifies relationships (hierarchical, associative, causal)
3. Creates semantic network structure
4. Generates Mermaid diagram visualization

**Output** (`P2S_3_Output`):
```typescript
{
  transcript_id: string,
  analyzed_du_id: string,
  specific_synchronic_structure: {
    representation_type: "Semantic Network",
    description: string,
    network_nodes: [
      {
        id: string,           // SSS node ID
        label: string,        // Display label
        source_isu_id: string // Links back to P2S.2 unit_name
      }
    ],
    network_links: [
      {
        from: string,         // Node ID
        to: string,           // Node ID
        type: string          // Relationship type
      }
    ]
  },
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

## Key Concepts

### Diachronic Units (DUs)
- Temporal segments from P1.4 (e.g., "Initial_Engagement", "Deep_Exploration")
- Each DU represents a phase in the temporal unfolding of experience
- P2S analyzes what happens *within* each DU synchronically

### Synchronic Analysis
- **Synchronic**: Simultaneous, co-occurring elements at a given time
- **Diachronic**: Sequential, temporal progression over time
- P2S focuses on the "vertical slice" of experience within each DU

### ISUs (Identified Synchronic Units)
- Conceptual abstractions of experiential elements
- Not raw data but interpreted patterns
- Organized hierarchically (main units → sub-units)

### Semantic Networks
- Nodes represent ISUs
- Links show relationships (not just hierarchy)
- Captures the interconnected nature of synchronic experience

## State Management

### Storage Structure
```typescript
processedData.get(transcriptId).p2s_outputs_by_du = {
  "du_1": {
    p2s_1_output: P2S_1_Output,
    p2s_2_output: P2S_2_Output,
    p2s_3_output: P2S_3_Output,
    p2s_3_mermaid_syntax?: string
  },
  "du_2": { ... },
  // ... for each DU
}
```

### Tracking Fields
- `dus_for_p2s_processing`: Array of all DU IDs to process
- `current_du_for_p2s_processing`: Currently active DU
- `processed_dus_for_p2s`: Completed DU IDs
- `isFullyProcessedSpecificSynchronic`: All DUs processed?

## Common Issues & Solutions

### Issue: "Missing P2S.1 output for DU"
**Cause**: P2S.2 can't find P2S.1 output for the current DU
**Solution**: Ensure `p2s_outputs_by_du[duId].p2s_1_output` exists

### Issue: Infinite loops during autorun
**Cause**: State updates triggering repeated processing
**Solution**: Check transcript index changes, ensure proper DU tracking

### Issue: DUs not processing in order
**Cause**: Async state updates or orchestrator logic
**Solution**: Verify `current_du_for_p2s_processing` updates correctly

## Integration with Other Parts

### From Part 1
- Receives DU definitions from P1.4
- Uses segment data from P1.1
- Maintains IV/DV context throughout

### To Part 3
- P3 aggregates all P2S outputs across transcripts
- Creates generic patterns from specific synchronic structures
- SSS nodes become input for generic analysis

## Questions for Clarification

1. **Parallel Processing**: The current implementation processes transcripts and DUs sequentially. Would parallel processing of transcripts or DUs provide performance benefits worth the added complexity?

2. **Abstraction Operations**: Are there specific abstraction operations preferred (generalization, aggregation, instantiation), or should the AI determine freely?

3. **Network Relationships**: Should there be a controlled vocabulary for link types in P2S.3, or allow free-form relationship descriptions?

4. **Visualization**: Are there specific requirements for the Mermaid diagram generation beyond the current implementation?

5. **Error Handling**: How should partial DU processing be handled if one DU fails but others succeed?

## Development Notes

- P2S steps must complete for ALL DUs before moving to Part 3
- Each DU is independent - failure in one shouldn't block others
- Mermaid syntax generation happens in P2S.3 for visualization
- The semantic network in P2S.3 is crucial for Part 3's aggregation