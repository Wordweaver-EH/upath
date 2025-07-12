# UPath LangGraph Implementation

This directory contains the LangGraph-based implementation of the UPath pipeline system, migrating from the frontend service-based architecture to a backend graph-based approach.

## Architecture Overview

The implementation follows a node-based graph architecture where each pipeline step is represented as a node that processes state and produces outputs.

### Core Components

- **GraphExecutor**: Orchestrates the execution of the graph, managing sessions and event streaming
- **GraphBuilder**: Constructs the DAG (Directed Acyclic Graph) with nodes and conditional edges
- **BaseNode**: Abstract base class providing retry logic, error handling, and common patterns
- **SessionStore**: Interface for persisting session state (InMemory and Redis implementations)
- **ProgressCalculator**: Service for calculating pipeline progress based on graph topology

## Node Implementation Status

### ✅ Completed Nodes (4/14)

#### P0_1_TranscriptionAdherenceNode
- **Purpose**: Validates that the transcript adheres to expected format and quality standards
- **Input**: Raw transcript data
- **Output**: Validation results with adherence scores and identified issues
- **Key Features**:
  - LLM-based transcript analysis
  - Structured JSON output validation
  - Error classification for retry logic

#### P0_2_RefineDataTypesNode
- **Purpose**: Refines and normalizes data types across the transcript
- **Input**: P0_1 validation output
- **Output**: Refined transcript with standardized data types
- **Key Features**:
  - Data type inference and conversion
  - Handles malformed JSON responses gracefully
  - Custom error handling for parsing failures

#### P0_3_SelectProceduralUtterancesNode
- **Purpose**: Identifies and extracts procedural utterances from the transcript
- **Input**: Refined transcript data
- **Output**: Array of procedural utterances with metadata
- **Key Features**:
  - Filters non-procedural content
  - Preserves speaker information and line numbers
  - Validates utterance structure

#### P1_1_InitialSegmentationNode
- **Purpose**: Segments procedural utterances into coherent activity groups
- **Input**: Selected procedural utterances from P0_3
- **Output**: Segmented utterances with boundary metadata
- **Key Features**:
  - Natural boundary identification using temporal cues
  - Groups related actions into segments
  - Provides segment descriptions and criteria
  - Example-based prompting for consistency

### ⏳ Pending Nodes (10/14)

- P1_4_TOPIC_ASSIGNMENT
- P2S_* nodes (4 synchronic analysis nodes)
- P3_* nodes (2 grounding nodes)
- P4S_* generic synchronic nodes
- P4_1_*, P4_2_*, P4_3_* report generation nodes
- COMPLETE node

## Input/Output Examples

### P1_1_InitialSegmentationNode

**Input Structure** (from P0_3):
```json
{
  "procedural_utterances": [
    {
      "line_number": 5,
      "speaker": "Participant",
      "text": "First, I open the application"
    },
    {
      "line_number": 10,
      "speaker": "Participant",
      "text": "Then I click on the new document button"
    }
  ]
}
```

**Output Structure**:
```json
{
  "segments": [
    {
      "segment_id": "segment_1",
      "start_line": 5,
      "end_line": 15,
      "description": "Application initialization and document creation",
      "utterances": [
        {
          "line_number": 5,
          "speaker": "Participant",
          "text": "First, I open the application"
        },
        {
          "line_number": 10,
          "speaker": "Participant",
          "text": "Then I click on the new document button"
        }
      ]
    }
  ],
  "segmentation_criteria": "Segments identified based on major activity transitions and temporal markers (first, then)",
  "segment_count": 1
}
```

## Integration with Graph Pipeline

Each node integrates seamlessly with the graph execution flow:

1. **State Management**: Nodes receive GraphState and return partial updates
2. **Error Handling**: Recoverable vs non-recoverable error classification
3. **Progress Tracking**: Automatic progress calculation based on graph position
4. **Session Persistence**: State saved after each successful node execution
5. **Event Streaming**: Real-time updates emitted during execution

## Testing Approach

All nodes follow strict TDD (Test-Driven Development):

1. **Unit Tests**: Each node has comprehensive unit tests covering:
   - Happy path execution
   - Error scenarios
   - Input validation
   - Output structure validation
   - Retry logic

2. **Integration Tests**: Graph-level tests covering:
   - Node sequencing
   - State propagation
   - Session management
   - Progress calculation

## Special Considerations

### P1_1 Specific Notes

- **Temporal Cue Recognition**: The node specifically looks for words like "first", "then", "next", "finally" to identify segment boundaries
- **Segment Coherence**: Each segment represents a complete sub-goal or activity
- **Error Recovery**: JSON parsing failures are caught and wrapped in LLMResponseError for proper retry handling
- **Validation**: Ensures P0_3 output exists and contains procedural utterances before processing

### Common Patterns

1. **Input Validation**: All nodes validate prerequisites before execution
2. **Prompt Engineering**: Structured prompts with clear guidelines and examples
3. **JSON Response Handling**: Robust parsing with specific error types
4. **State Updates**: Consistent pattern for updating GraphState fields

## Future Enhancements

1. **Streaming Support**: Real-time progress updates during long-running nodes
2. **Parallel Execution**: Support for parallel node execution where dependencies allow
3. **Dynamic Prompts**: Template-based prompts with configurable parameters
4. **Caching**: Result caching for expensive LLM operations

## Development Guidelines

When implementing new nodes:

1. Extend `BaseNode` class
2. Implement `execute()` method with proper state updates
3. Override `validateInputOrThrow()` for specific validation
4. Override `isRecoverable()` for custom retry logic
5. Write comprehensive tests before implementation (TDD)
6. Document input/output structures clearly
7. Handle all error cases explicitly

## Session Storage

The system supports multiple session storage backends:

- **InMemorySessionStore**: For development and testing
- **RedisSessionStore**: For production with persistence
- **Custom Implementations**: Extend ISessionStore interface

See `SESSION_STORAGE_README.md` for detailed storage documentation.