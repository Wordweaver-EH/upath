# µ-PATH LangGraph Pipeline - Product Requirements Document

## Overview

The µ-PATH (micro-Procedural Alignment Through Horizontalization) pipeline is a stateful workflow implemented using LangGraph.js that processes interview transcripts through systematic phenomenological analysis to generate formal causal hypotheses.

## Pipeline Architecture: Three Nested Loops

```mermaid
graph TB
    Start([Start]) --> Init[Initialize Pipeline]
    Init --> MultiDecision{Multiple<br/>Transcripts?}
    
    %% Single Transcript Path
    MultiDecision -->|Single| P_NEG1_1[P_NEG1_1: Variable ID]
    P_NEG1_1 --> P0_1[P0_1: Line Numbering]
    P0_1 --> P0_2[P0_2: Tag Content Types]
    P0_2 --> P0_3[P0_3: Select Procedural]
    P0_3 --> P1_1[P1_1: Segment Actions]
    P1_1 --> P1_2[P1_2: Group into DUs]
    P1_2 --> P1_3[P1_3: Refine DUs]
    P1_3 --> P1_4[P1_4: Define Phases]
    P1_4 --> SingleComplete[Complete Single Path]
    SingleComplete --> End([End])
    
    %% Multi Transcript Path - Outer Loop
    MultiDecision -->|Multiple| TranscriptLoop[Transcript Loop<br/>Controller]
    TranscriptLoop --> CheckTranscript{More<br/>Transcripts?}
    CheckTranscript -->|Yes| SelectTranscript[Select Current<br/>Transcript]
    CheckTranscript -->|No| Finalize[Finalize Pipeline]
    Finalize --> End
    
    %% Phase Loop - Middle Loop
    SelectTranscript --> PhaseLoop[Phase Loop<br/>Controller]
    PhaseLoop --> CheckPhase{More<br/>Phases?}
    CheckPhase -->|Yes| ProcessPhase[Process Current Phase]
    CheckPhase -->|No| TranscriptLoop
    
    %% Phase Processing
    ProcessPhase --> P2S_1[P2S_1: Group by Theme]
    P2S_1 --> P2S_2[P2S_2: Identify SSUs]
    P2S_2 --> P2S_3[P2S_3: Define SSS]
    P2S_3 --> PhaseLoop
    
    %% After Phase 3_2 - GDU Loop
    ProcessPhase -->|After P3_2| GDULoop[GDU Loop<br/>Controller]
    GDULoop --> CheckGDU{More<br/>GDUs?}
    CheckGDU -->|Yes| SelectGDU[Select Current GDU]
    CheckGDU -->|No| PhaseLoop
    
    %% GDU Processing
    SelectGDU --> P4S_1_A[P4S_1_A: Group SSS Nodes]
    P4S_1_A --> P4S_1_B[P4S_1_B: Define GSS]
    P4S_1_B --> P5_1[P5_1: Comparative Analysis]
    P5_1 --> P5_2[P5_2: Holistic Refinement]
    P5_2 --> GDULoop
    
    style TranscriptLoop fill:#f9f,stroke:#333,stroke-width:4px
    style PhaseLoop fill:#bbf,stroke:#333,stroke-width:4px
    style GDULoop fill:#bfb,stroke:#333,stroke-width:4px
```

## Data Flow Through Pipeline Nodes

### Phase -1: Variable Identification

```mermaid
graph LR
    Input[Raw Transcripts<br/>with Headers] --> P_NEG1_1[P_NEG1_1:<br/>Variable Identification]
    P_NEG1_1 --> Output[identified_iv<br/>identified_dv<br/>dv_focus_notes]
```

**P_NEG1_1 Purpose**: Extracts independent variables (IV) and dependent variables (DV) from transcript headers to set analysis focus.

### Phase 0: Data Preparation (All Transcripts)

```mermaid
graph LR
    T1[Transcript 1] --> P0_1[P0_1: Line Numbering]
    T2[Transcript 2] --> P0_1
    T3[Transcript N] --> P0_1
    P0_1 --> LN[Line-numbered<br/>transcripts]
    
    LN --> P0_2[P0_2: Tag Content]
    P0_2 --> Tagged[Tagged lines:<br/>procedural/<br/>experiential/<br/>mixed]
    
    Tagged --> P0_3[P0_3: Select<br/>Procedural]
    P0_3 --> ProcOnly[Procedural<br/>utterances only]
```

### Phase 1: Specific Diachronic Analysis (Per Transcript)

```mermaid
graph TB
    ProcUtterances[Procedural<br/>Utterances] --> P1_1[P1_1: Segment<br/>into Actions]
    P1_1 --> Segments[Action<br/>Segments]
    
    Segments --> P1_2[P1_2: Group into<br/>Diachronic Units]
    P1_2 --> DUs[Temporal<br/>Clusters]
    
    DUs --> P1_3[P1_3: Refine DUs]
    P1_3 --> RefinedDUs[Merged/Split<br/>DUs]
    
    RefinedDUs --> P1_4[P1_4: Construct<br/>Phases]
    P1_4 --> Phases[Beginning<br/>Middle<br/>End<br/>etc.]
```

### Phase 2S: Specific Synchronic Analysis (Per Phase)

```mermaid
graph LR
    Phase[Current Phase<br/>Utterances] --> P2S_1[P2S_1: Group<br/>by Theme]
    P2S_1 --> Themes[Thematic<br/>Groups]
    
    Themes --> P2S_2[P2S_2: Identify<br/>SSUs]
    P2S_2 --> SSUs[Specific<br/>Synchronic<br/>Units]
    
    SSUs --> P2S_3[P2S_3: Define<br/>SSS]
    P2S_3 --> SSS[Specific<br/>Synchronic<br/>Structure]
```

### Phase 3: Generic Diachronic Analysis

```mermaid
graph TB
    AllStructures[All Transcript<br/>Structures] --> P3_1[P3_1: Align<br/>Structures]
    P3_1 --> Aligned[Cross-transcript<br/>Alignment]
    
    Aligned --> P3_2[P3_2: Identify<br/>GDUs]
    P3_2 --> GDUs[Generic<br/>Diachronic<br/>Units]
    
    GDUs --> P3_3[P3_3: Define<br/>GDS]
    P3_3 --> GDS[Generic<br/>Diachronic<br/>Structure]
```

### Phase 4S & 5: Generic Synchronic Analysis (Per GDU)

```mermaid
graph TB
    GDU[Current GDU] --> P4S_1_A[P4S_1_A: Group<br/>SSS Nodes]
    P4S_1_A --> Groups[Common<br/>SSS Groups]
    
    Groups --> P4S_1_B[P4S_1_B: Define<br/>GSS]
    P4S_1_B --> GSS[Generic<br/>Synchronic<br/>Structure]
    
    GSS --> P5_1[P5_1: Compare<br/>IV Effects]
    P5_1 --> Comparison[IV Impact<br/>Analysis]
    
    Comparison --> P5_2[P5_2: Holistic<br/>Refinement]
    P5_2 --> Refined[Confidence<br/>Scores]
```

### Phase 7: Causal Modeling

```mermaid
graph TB
    AllData[All Pipeline<br/>Outputs] --> P7_1[P7_1: Formalize<br/>Variables]
    P7_1 --> Variables[Candidate<br/>Variables]
    
    Variables --> P7_2[P7_2: Propose<br/>Causal Links]
    P7_2 --> Links[Pairwise<br/>Relationships]
    
    Links --> P7_3[P7_3: Assemble<br/>DAG]
    P7_3 --> DAG[Directed<br/>Acyclic<br/>Graph]
    
    DAG --> P7_3B[P7_3B: Validate<br/>DAG]
    P7_3B --> CleanDAG[Cycle-free<br/>DAG]
    
    CleanDAG --> P7_4[P7_4: Analyze<br/>Paths]
    P7_4 --> Paths[Causal<br/>Paths]
    
    Paths --> P7_5[P7_5: Generate<br/>Hypotheses]
    P7_5 --> Hypotheses[Formal<br/>Hypotheses]
```

## Loop Logic Details

### 1. Transcript Loop (Outer)
- **Controller**: `transcriptLoopController`
- **Counter**: `currentTranscriptIndex`
- **Logic**: Increments index, resets phase and GDU indices
- **Termination**: When `currentTranscriptIndex >= transcripts.length`

### 2. Phase Loop (Middle)
- **Controller**: `phaseLoopController`
- **Counter**: `currentPhaseIndex`
- **Sequence**: [P2S_1, P2S_2, P2S_3, P3_1, P3_2, P3_3, gdu_loop, P7_1, ...]
- **Logic**: Processes phases identified by P1_4 for current transcript
- **Termination**: When all phases processed

### 3. GDU Loop (Inner)
- **Controller**: `gduLoopController`
- **Counter**: `currentGDUIndex`
- **Logic**: Processes each GDU identified by P3_2
- **Nodes**: P4S_1_A → P4S_1_B → P5_1 → P5_2
- **Termination**: When `currentGDUIndex >= gdus.length`

## State Management

```typescript
interface UPathMVPState {
  // Pipeline control
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  
  // Data
  transcripts: RawTranscript[];
  stepOutputs: Record<string, any>;
  gdus: GDU[];
  
  // Loop indices
  currentTranscriptIndex: number;
  currentPhaseIndex: number;
  currentGDUIndex: number;
  
  // Configuration
  settings: {
    model: string;      // Default: gemini-2.5-flash
    temperature: number;
    seed: number;
    useGrounding: boolean;
  };
  
  // Control flags
  isMultiTranscript: boolean;
  currentPhase: string;
  
  // Error tracking
  errors: ErrorInfo[];
}
```

## Key Technical Decisions

1. **Persistence**: SqliteSaver for state persistence across server restarts
2. **Streaming**: Server-Sent Events (SSE) for real-time progress updates
3. **Configuration**: Dynamic model selection from environment/request
4. **Error Handling**: GraphInterrupt for graceful failure recovery
5. **Conditional Routing**: Graph edges determine single vs multi-transcript paths

## API Endpoints

### POST /api/langgraph/stream
Starts pipeline execution with streaming updates.

**Request:**
```json
{
  "transcripts": [
    {
      "id": "t1",
      "content": "Interview transcript text...",
      "metadata": {
        "iv": "experience_level",
        "dv": "task_completion_time"
      }
    }
  ],
  "settings": {
    "model": "gemini-2.5-flash",
    "temperature": 0.7
  }
}
```

**Response:** Server-Sent Events stream with progress updates

## Implementation Status

✅ **Completed:**
- All 28 pipeline nodes implemented
- Three nested loops (transcript, phase, GDU)
- Single vs multi-transcript routing
- SqliteSaver persistence
- Dynamic configuration
- Streaming endpoint

⏳ **Pending:**
- Error handling with GraphInterrupt
- Comprehensive testing
- Frontend integration
- Performance optimization

## Performance Considerations

1. **Memory**: Large transcripts may require chunking
2. **Processing Time**: ~2-5 minutes per transcript depending on length
3. **Persistence**: SQLite database grows with checkpoint history
4. **Concurrency**: Currently single-threaded, consider worker pools

## Future Enhancements

1. **Parallel Processing**: Process independent phases concurrently
2. **Caching**: Cache intermediate results for faster re-runs
3. **Visualization**: Real-time graph visualization of pipeline state
4. **Metrics**: Detailed timing and resource usage tracking
5. **Resume Capability**: Resume failed pipelines from last checkpoint