# Part 2: Specific Synchronic Analysis (P2S)

## Exact Prompt Chain

### P2S.1 Prompt
```
You are a micro-phenomenological analyst. Task: Group the provided SEGMENTS by topic for a GIVEN DIACHRONIC UNIT.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Unit Being Analyzed: "${input.analyzed_du_id}"
- IV Details: "${input.independent_variable_details}"
- DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
- Segments that occur within this DU:
${JSON.stringify(input.segments_for_du_analysis, null, 2)}

Instructions:
1.  Your Task: Group the provided *segments* by topic. Focus on experiential themes that are specific to the DV focus (${JSON.stringify(input.dependent_variable_focus)}).
2.  Topic Identification: Identify the main topic of each segment. Topics should be:
    *   Relevant to the dependent variable focus
    *   Specific (not generic like "feelings")
    *   Based on the content of the segments
3.  Grouping: Create groups of segments that share a similar topic. Be careful not to over-fragment; look for meaningful commonalities.
4.  No Temporal Ordering: This step focuses on thematic grouping, not temporal sequencing.
5.  Preserve the Diachronic Unit Context: Remember, these segments all come from the DU "${input.analyzed_du_id}". Your groupings should make sense within this DU's context.

Output:
A JSON object with ONLY the following structure (NO extra text or explanations):
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_du_id": "${input.analyzed_du_id}",
  "synchronic_thematic_groups": [
    {
      "group_label": "Descriptive Name for Topic Group 1",
      "justification": "Brief description of what unites these segments",
      "segments": [
        {
          "segment_id": "string",
          "segment_text": "text from input",
          "temporal_cues": ["..."]
        }
        // ... more segments in this group
      ]
    }
    // ... more groups
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
```

### P2S.2 Prompt
```
You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups of SEGMENTS from P2S.1 for a GIVEN DIACHRONIC UNIT.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Unit Being Analyzed: "${input.analyzed_du_id}"
- IV Details: "${input.independent_variable_details}"
- DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
- Synchronic thematic groups of segments from P2S.1:
${JSON.stringify(input.synchronic_thematic_groups, null, 2)}

Instructions:
1. For each thematic group from P2S.1, identify experiential elements (not just event descriptions).

2. Create ISUs using these rules:
   - Level 1 ISU: Created when segments share a general quality that could have variations
   - Level 2 ISU: Created when segments represent a specific variation of a Level 1 ISU
   - Maximum 2 levels. Start with Level 1 unless variation requires Level 2.

3. Abstraction operations:
   - "generalization": Used when creating Level 1 from varied segments
   - "specification": Used when creating Level 2 as subset of Level 1
   - "aggregation": Used when combining multiple distinct elements

4. Each ISU must:
   - Have a unique unit_name
   - Include all relevant segments from the thematic group
   - Have an intensional_definition focused on experiential quality
   - List any Level 2 ISUs in constituent_lower_units (Level 1 only)

Output:
A JSON object adhering EXACTLY to the following structure (NO extra text):
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_du_id": "${input.analyzed_du_id}",
  "specific_synchronic_units_hierarchy": [
    {
      "unit_name": "UniqueDescriptiveName1",
      "level": 1,
      "abstraction_op": "generalization",
      "intensional_definition": "Conceptual description of this ISU",
      "segments": [
        {
          "segment_id": "string",
          "segment_text": "text",
          "temporal_cues": ["..."]
        }
      ],
      "constituent_lower_units": []
    }
    // ... more ISUs
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
```

### P2S.3 Prompt
```
You are a micro-phenomenological analyst. Task: Final step of Specific Synchronic Analysis - Define the Specific Synchronic Structure (SSS) as a semantic network.
Input:
JSON output from P2S.2 (ISU hierarchy, where each ISU has a unique `unit_name`) for transcript ID ${input.transcript_id} and diachronic unit "${input.analyzed_du_id}".
${JSON.stringify(input, null, 2)}

Instructions:
1.  Model ISUs as Network: Transform the `specific_synchronic_units_hierarchy` from P2S.2 into a semantic network. ISUs become nodes. Relationships (hierarchical, associative) become links.
2.  Define Nodes: Each node in `network_nodes` corresponds to an ISU from P2S.2.
    *   `id`: A unique ID for this SSS network node (e.g., "sss_node_VisualQualityVivid"). Can be based on the ISU's `unit_name`.
    *   `label`: A descriptive label for the node, typically the ISU's `unit_name` or `intensional_definition`.
    *   `source_isu_id`: The `unit_name` of the ISU from P2S.2 that this network node represents. This is crucial for traceability.
3.  Define Links: Identify relationships between ISUs. Types include:
    *   Hierarchical (parent-child from P2S.2)
    *   Associative (e.g., "influences", "precedes", "co-occurs with")
    *   Causal (if one ISU leads to another)
4.  Overall Structure Description: Summarize the SSS for this DU.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_du_id": "${input.analyzed_du_id}",
  "specific_synchronic_structure": {
    "representation_type": "Semantic Network",
    "description": "Summary of the SSS for DU '${input.analyzed_du_id}'",
    "network_nodes": [
      {
        "id": "sss_node_UniqueID1",
        "label": "Descriptive Label",
        "source_isu_id": "ISU unit_name from P2S.2"
      }
      // ... more nodes
    ],
    "network_links": [
      {
        "from": "sss_node_ID1",
        "to": "sss_node_ID2",
        "type": "hierarchical|associative|causal|etc"
      }
      // ... more links
    ]
  },
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
```

### P2S.4: Summary Table (UI-Only Step)

P2S.4 is a display-only step that provides a consolidated view of all Part 2 Synchronic Analysis outputs. It does not involve any LLM processing or data transformation.

## Overview

Part 2 performs **Specific Synchronic Analysis** on individual Diachronic Units (DUs) identified in Part 1. While Part 1 analyzed temporal progression (diachronic), Part 2 focuses on the simultaneous experiential elements within each DU (synchronic). This analysis is performed iteratively for each DU from Part 1, concluding with a comprehensive summary table (P2S.4) that consolidates all synchronic findings for each transcript.

## Architecture

### Processing Model
- **Part Iteration**: Part 2 is configured with `iteration: 'per-transcript'` in the pipeline structure
- **Transcript Processing**: ALL transcripts complete Part 1 before ANY transcript begins Part 2
- **DU Processing**: Within each transcript, DUs from P1.4 are processed sequentially through all three P2S steps
- **Sequential Execution**: Both transcripts and DUs are processed sequentially (not in parallel)
- **Per-DU Storage**: Outputs are stored in `p2s_outputs_by_du[duId]` structure for each transcript
- **Iteration Types**: The orchestrator returns `iterationType: 'per-du'` when moving between DUs, and `iterationType: 'per-transcript'` when moving between steps or transcripts

### Data Flow
```
Transcript 1:
  └─ DU 1: P2S.1 → P2S.2 → P2S.3
  └─ DU 2: P2S.1 → P2S.2 → P2S.3
  └─ DU 3: P2S.1 → P2S.2 → P2S.3
  └─ (all DUs complete) → P2S.4 Summary Table → Move to Transcript 2

Transcript 2:
  └─ DU 1: P2S.1 → P2S.2 → P2S.3
  └─ DU 2: P2S.1 → P2S.2 → P2S.3
  └─ (all DUs complete) → P2S.4 Summary Table → Move to Part 3
```

### Transcript Progression Logic
- Each transcript is fully processed before moving to the next
- The orchestrator's `getNextPhaseIteration()` handles DU advancement within Part 2
- After completing all DUs in a transcript, the system checks for more transcripts
- When moving to the next transcript, Part 2 continues from P2S.1 for the new transcript's DUs
- Only when ALL transcripts are complete does Part 2 finish and move to Part 3

## Steps (4 Total)

### P2S.1: Group Segments by Topic within a Diachronic Unit

**Purpose**: Groups segments within a DU by thematic similarity, focusing on experiential themes specific to the dependent variable focus.

**Input**:
- Current DU ID (from P1.4)
- Segments belonging to this DU (filtered from P1.1 using P1.4's source_segment_ids)
- Independent/Dependent variable context

**Processing**:
1. Filters all segments to only those belonging to the current DU
2. Identifies main topic of each segment (relevant to DV, specific, content-based)
3. Groups segments sharing similar topics
4. Avoids over-fragmentation by finding meaningful commonalities
5. No temporal ordering - purely thematic grouping

**Output** (`P2S_1_Output`):
```typescript
{
  transcript_id: string,
  analyzed_du_id: string,
  synchronic_thematic_groups: [
    {
      group_label: string,          // Descriptive name for topic
      justification: string,        // What unites these segments
      segments: SegmentedUtteranceSegment[]  // Array of segments with id, text, temporal_cues
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P2S.2: Identify Specific Synchronic Units (ISUs) from Segments

**Purpose**: Abstracts thematic groups into conceptual units (ISUs) representing synchronic experiential elements within the DU.

**Input**: P2S.1 output for the current DU

**Processing**:
1. Reviews each thematic group from P2S.1
2. Defines one or more ISUs per group (conceptual abstractions of raw segments)
3. Organizes ISUs into hierarchy (level 1 for top-level, 2 for sub-units, etc.)
4. Specifies abstraction operation used (e.g., "generalization", "aggregation", "instantiation")
5. Provides intensional definition (what experiential quality/state it represents)
6. Grounds each ISU in specific segments it derives from

**Output** (`P2S_2_Output`):
```typescript
{
  transcript_id: string,
  analyzed_du_id: string,
  specific_synchronic_units_hierarchy: [
    {
      unit_name: string,              // Unique descriptive name
      level: number,                  // Hierarchy level (1=top)
      abstraction_op: string,         // Operation used (generalization, etc.)
      intensional_definition: string, // Conceptual description of ISU
      segments: SegmentedUtteranceSegment[], // Grounding segments
      constituent_lower_units: string[] // References to sub-units (if any)
    }
  ],
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P2S.3: Define Specific Synchronic Structure (SSS) within a Diachronic Unit

**Purpose**: Final step of synchronic analysis - transforms ISU hierarchy into a semantic network showing relationships between synchronic elements within the DU.

**Input**: P2S.2 output for the current DU

**Processing**:
1. Models ISUs as network - ISUs become nodes, relationships become links
2. Defines nodes:
   - `id`: Unique SSS node ID (e.g., "sss_node_VisualQualityVivid")
   - `label`: Descriptive label (typically ISU's unit_name or intensional_definition)
   - `source_isu_id`: The unit_name from P2S.2 (crucial for traceability)
3. Defines links between ISUs:
   - Hierarchical: parent-child relationships from P2S.2
   - Associative: "influences", "precedes", "co-occurs with"
   - Causal: if one ISU leads to another
4. Provides overall structure description summarizing the SSS for this DU

**Output** (`P2S_3_Output`):
```typescript
{
  transcript_id: string,
  analyzed_du_id: string,
  specific_synchronic_structure: {
    representation_type: "Semantic Network",
    description: string,      // Summary of SSS for this DU
    network_nodes: [
      {
        id: string,           // SSS node ID (e.g., "sss_node_UniqueID1")
        label: string,        // Descriptive label
        source_isu_id: string // ISU unit_name from P2S.2
      }
    ],
    network_links: [
      {
        from: string,         // Node ID
        to: string,           // Node ID
        type: string          // "hierarchical|associative|causal|etc"
      }
    ]
  },
  independent_variable_details: string,
  dependent_variable_focus: string[]
}
```

### P2S.4: Summary Table - Consolidated View

**Purpose**: Provides a unified, interactive view of all Part 2 Synchronic Analysis outputs for a transcript, enabling researchers to review and understand the complete synchronic structure across all DUs.

**Input**: All P2S.1, P2S.2, and P2S.3 outputs for the transcript

**Processing**: This is a UI-only step that:
1. Consolidates all DU analysis results into a structured table
2. Displays DU information with descriptions from P1.4
3. Shows ISU hierarchies with nested tooltips for exploration
4. Presents utterances grouped by ISU themes
5. Renders network diagrams for each DU's synchronic structure
6. Provides export capabilities for offline analysis

**Output**: Interactive table display with:
- **DU Column**: Shows DU name, description from P1.4, and segment count
- **ISU Themes Column**: Hierarchical display of ISUs with abstraction operations and definitions
- **Utterances Column**: Speaker-tagged utterances organized by ISU
- **Network Diagrams Section**: Mermaid visualizations of each DU's semantic network
- **Export Options**: HTML export with IV/DV context for documentation

**Key Features**:
- Nested tooltip navigation for exploring ISU-utterance relationships
- Refresh capabilities for Mermaid diagram rendering
- Summary statistics (total DUs, ISUs, utterances)
- Context preservation (IV, DV, filename) in exports

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
    p2s_1_output?: P2S_1_Output,
    p2s_1_error?: string,
    p2s_2_output?: P2S_2_Output,
    p2s_2_error?: string,
    p2s_3_output?: P2S_3_Output,
    p2s_3_error?: string,
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
**Cause**: State updates triggering repeated processing or missing `current_du_for_p2s_processing` update
**Solution**: 
- Ensure `current_du_for_p2s_processing` is preserved when updating state in `handleSuccessfulStep`
- Check that `indexOf(undefined)` doesn't return -1 causing loop back to du_1
- Verify proper state updates in `pipelineStore.ts`

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

## Special Processing Notes

### P2S.1 Segment Filtering
- Uses P1.4's `source_segment_ids` to filter P1.1 segments
- Only segments belonging to the current DU are analyzed
- Segments maintain their original IDs for traceability

### P2S.2 Abstraction Operations
- Common operations: generalization, aggregation, instantiation
- ISUs are conceptual abstractions, not raw data
- Each ISU must be grounded in specific segments

### P2S.3 Network Construction
- Node IDs should be unique and descriptive
- `source_isu_id` links back to P2S.2's `unit_name` field
- Link types are free-form but should be meaningful

## P2S.4 Export Features

The Summary Table includes comprehensive export capabilities:

### HTML Export
- **Filename Format**: `p2s4_summary_{base_filename}_{date}.html`
- **Content Includes**:
  - Filename, Independent Variable, and Dependent Variable(s) in header
  - Summary statistics (total DUs, ISUs, utterances)
  - Complete DU-ISU-Utterance hierarchy table
  - Network diagrams with Mermaid rendering
  - Theme-aware styling (light/dark mode support)
- **Standalone Document**: Self-contained HTML with embedded CSS and JavaScript
- **Interactive Elements**: Mermaid diagrams render on load

### Export Context Preservation
- IV/DV information extracted from P-1.1 output
- Filename used instead of technical transcript ID
- Export date included for version tracking
- All ISU hierarchies and utterance relationships preserved

## Development Notes

- P2S steps must complete for ALL DUs before moving to Part 3
- Each DU is independent - failure in one shouldn't block others
- Mermaid syntax generation happens in P2S.3 for visualization
- The semantic network in P2S.3 is crucial for Part 3's aggregation
- P2S.4 is display-only and doesn't modify any data
- Export functionality preserves full analysis context for documentation