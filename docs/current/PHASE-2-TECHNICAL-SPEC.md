# Phase 2 LangGraph Migration Technical Specification

**Navigation:** [📚 Docs Home](../README.md) | [📋 Implementation Guide](PHASE-2-IMPLEMENTATION-GUIDE.md) | [🚨 Production Issues](PRODUCTION-READINESS.md) | [📋 Migration Plan](../MIGRATION-PLAN.md)

## Executive Summary

Phase 2 migrates the MVP pipeline implementation to LangGraph, transforming it from an imperative orchestration system to a robust graph-based architecture. This is an architectural improvement that maintains the core functionality while adding production-ready features.

### Implementation Status (2025-07-12)
- **Part I Nodes**: ✅ COMPLETE (8/8 nodes implemented with full test coverage)
- **IV/DV Context Threading**: ✅ VERIFIED working correctly across all nodes
- **Core Infrastructure**: ✅ COMPLETE (GraphExecutor, NodeRegistry, SessionStore)
- **Critical Issues**: ⚠️ 4 identified requiring immediate attention before production
- **Test Coverage**: ✅ 248 tests passing (comprehensive TDD implementation)

### Migration Context
- **Current State**: Working MVP with 30+ pipeline steps implemented in frontend
- **Target State**: Same functionality reimplemented with LangGraph for better reliability
- **Approach**: Study existing implementation, recreate in LangGraph with improvements

### Key Objectives
- Replace imperative orchestration with declarative graph-based flow
- Implement proper state checkpointing and recovery
- Add comprehensive error handling and retry mechanisms
- Enable future parallel execution capabilities
- Maintain compatibility with frontend data structures (with room for improvements)
- Clean up technical debt from rapid MVP development

## System Architecture

### Current Architecture
```
Frontend (React + Zustand) → PipelineOrchestrator → Services → Gemini API
                          ↓
                    Store Transactions
```

### Target Architecture with LangGraph
```
Frontend (React + Zustand) → LangGraph Agent → Graph Nodes → Gemini API
                          ↓                  ↓
                    Store Adapter      State Checkpoints
```

### Integration Points

1. **Frontend Integration**
   - Maintain existing Zustand store interfaces
   - Create StoreAdapter to bridge LangGraph state with Zustand
   - Preserve existing UI callbacks and progress tracking

2. **Backend Integration**
   - LangGraph server runs as separate process (port 3002)
   - REST API endpoints for graph execution
   - WebSocket support for real-time updates

## Node Specifications

### P0_1_TRANSCRIPTION_ADHERENCE

**Purpose**: Validate transcript format and adherence to guidelines

**Node Configuration**:
```typescript
interface P0_1_Node extends BaseNode {
  name: "p0_1_transcription_adherence";
  
  inputs: {
    rawTranscripts: TranscriptData[];
    validationRules: ValidationRules;
  };
  
  outputs: {
    validatedTranscripts: ValidatedTranscript[];
    adherenceReport: AdherenceReport;
    errors: ValidationError[];
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.1;
    maxTokens: 4096;
  };
}
```

**Implementation**:
```typescript
const p0_1_node = new Node({
  name: "p0_1_transcription_adherence",
  
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    const { rawTranscripts } = state;
    
    // Prepare prompt
    const prompt = buildTranscriptionAdherencePrompt(rawTranscripts);
    
    // Call LLM
    const response = await callLLM(prompt, this.llmConfig);
    
    // Parse and validate response
    const result = parseTranscriptionAdherenceResponse(response);
    
    return {
      p0_1_output: result,
      lastCompletedStep: "P0_1_TRANSCRIPTION_ADHERENCE",
      errors: result.errors
    };
  },
  
  retryPolicy: {
    maxAttempts: 3,
    backoff: "exponential"
  }
});
```

### P0_2_ILP_DETECTION

**Purpose**: Detect and classify utterance types (ILP - Information, Leading, Procedural)

**Node Configuration**:
```typescript
interface P0_2_Node extends BaseNode {
  name: "p0_2_ilp_detection";
  
  inputs: {
    validatedTranscripts: ValidatedTranscript[];
    classificationRules: ILPRules;
  };
  
  outputs: {
    classifiedUtterances: ClassifiedUtterance[];
    ilpStatistics: ILPStats;
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.2;
    maxTokens: 8192;
  };
}
```

### P0_3_SELECT_PROCEDURAL_UTTERANCES

**Purpose**: Filter and select only procedural utterances for further processing

**Node Configuration**:
```typescript
interface P0_3_Node extends BaseNode {
  name: "p0_3_select_procedural";
  
  inputs: {
    classifiedUtterances: ClassifiedUtterance[];
    selectionCriteria: SelectionCriteria;
  };
  
  outputs: {
    proceduralUtterances: ProceduralUtterance[];
    selectionMetadata: SelectionMetadata;
  };
  
  // No LLM call - pure filtering logic
  llmConfig: null;
}
```

### P1_1_INITIAL_SEGMENTATION

**Purpose**: Segment transcript into initial activity boundaries

**Node Configuration**:
```typescript
interface P1_1_Node extends BaseNode {
  name: "p1_1_initial_segmentation";
  
  inputs: {
    proceduralUtterances: ProceduralUtterance[];
    segmentationRules: SegmentationRules;
  };
  
  outputs: {
    segments: TranscriptSegment[];
    segmentationReport: SegmentationReport;
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.3;
    maxTokens: 8192;
  };
}
```

### P1_2_DIACHRONIC_UNIT_ID

**Purpose**: Identify diachronic units within segments

**Node Configuration**:
```typescript
interface P1_2_Node extends BaseNode {
  name: "p1_2_diachronic_unit_id";
  
  inputs: {
    segments: TranscriptSegment[];
    unitIdentificationRules: DiachronicRules;
  };
  
  outputs: {
    diachronicUnits: DiachronicUnit[];
    unitMetadata: UnitMetadata;
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.3;
    maxTokens: 16384;
  };
}
```

### P1_3_REFINE_DIACHRONIC_UNITS

**Purpose**: Refine and validate diachronic unit boundaries

**Node Configuration**:
```typescript
interface P1_3_Node extends BaseNode {
  name: "p1_3_refine_diachronic";
  
  inputs: {
    diachronicUnits: DiachronicUnit[];
    refinementCriteria: RefinementRules;
  };
  
  outputs: {
    refinedUnits: RefinedDiachronicUnit[];
    refinementReport: RefinementReport;
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.2;
    maxTokens: 16384;
  };
}
```

### P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE

**Purpose**: Build complete diachronic structure from refined units

**Node Configuration**:
```typescript
interface P1_4_Node extends BaseNode {
  name: "p1_4_construct_diachronic";
  
  inputs: {
    refinedUnits: RefinedDiachronicUnit[];
    structureRules: DiachronicStructureRules;
  };
  
  outputs: {
    diachronicStructure: DiachronicStructure;
    structureVisualization: MermaidDiagram;
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.1;
    maxTokens: 16384;
  };
}
```

### P2S_1_GROUP_UTTERANCES_BY_TOPIC

**Purpose**: Group utterances by topical similarity

**Node Configuration**:
```typescript
interface P2S_1_Node extends BaseNode {
  name: "p2s_1_group_by_topic";
  
  inputs: {
    proceduralUtterances: ProceduralUtterance[];
    topicModelingRules: TopicRules;
  };
  
  outputs: {
    topicGroups: TopicGroup[];
    topicDistribution: TopicStats;
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.4;
    maxTokens: 16384;
  };
}
```

### P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS

**Purpose**: Identify synchronic units within topic groups

**Node Configuration**:
```typescript
interface P2S_2_Node extends BaseNode {
  name: "p2s_2_identify_synchronic";
  
  inputs: {
    topicGroups: TopicGroup[];
    synchronicRules: SynchronicIdentificationRules;
  };
  
  outputs: {
    synchronicUnits: SynchronicUnit[];
    unitRelationships: UnitRelationship[];
  };
  
  llmConfig: {
    model: "gemini-1.5-pro";
    temperature: 0.3;
    maxTokens: 16384;
  };
}
```

## State Schema

### Core Graph State
```typescript
interface GraphState {
  // Input data
  rawTranscripts: TranscriptData[];
  settings: PipelineSettings;
  
  // Step outputs
  p0_1_output?: P0_1_Output;
  p0_2_output?: P0_2_Output;
  p0_3_output?: P0_3_Output;
  p1_1_output?: P1_1_Output;
  p1_2_output?: P1_2_Output;
  p1_3_output?: P1_3_Output;
  p1_4_output?: P1_4_Output;
  p2s_1_output?: P2S_1_Output;
  p2s_2_output?: P2S_2_Output;
  
  // Execution metadata
  currentStep: StepId;
  lastCompletedStep?: StepId;
  errors: ExecutionError[];
  startTime: number;
  endTime?: number;
  
  // Checkpointing
  checkpointId: string;
  parentCheckpointId?: string;
}
```

### Step Output Types
```typescript
interface P0_1_Output {
  validatedTranscripts: ValidatedTranscript[];
  adherenceReport: {
    overallScore: number;
    issues: AdherenceIssue[];
    suggestions: string[];
  };
  errors: ValidationError[];
}

interface P0_2_Output {
  classifiedUtterances: Array<{
    id: string;
    text: string;
    speaker: string;
    type: "information" | "leading" | "procedural";
    confidence: number;
  }>;
  statistics: {
    totalUtterances: number;
    informationCount: number;
    leadingCount: number;
    proceduralCount: number;
  };
}

// Additional output interfaces for each step...
```

## Edge Configuration

### Graph Definition
```typescript
const pipelineGraph = new StateGraph({
  channels: graphStateSchema,
})
  // Add nodes
  .addNode("p0_1_transcription_adherence", p0_1_node)
  .addNode("p0_2_ilp_detection", p0_2_node)
  .addNode("p0_3_select_procedural", p0_3_node)
  .addNode("p1_1_initial_segmentation", p1_1_node)
  .addNode("p1_2_diachronic_unit_id", p1_2_node)
  .addNode("p1_3_refine_diachronic", p1_3_node)
  .addNode("p1_4_construct_diachronic", p1_4_node)
  .addNode("p2s_1_group_by_topic", p2s_1_node)
  .addNode("p2s_2_identify_synchronic", p2s_2_node)
  
  // Define edges
  .addEdge(START, "p0_1_transcription_adherence")
  .addEdge("p0_1_transcription_adherence", "p0_2_ilp_detection")
  .addEdge("p0_2_ilp_detection", "p0_3_select_procedural")
  
  // Conditional routing after P0_3
  .addConditionalEdges(
    "p0_3_select_procedural",
    (state) => {
      const hasProceduralUtterances = state.p0_3_output?.proceduralUtterances.length > 0;
      return hasProceduralUtterances ? "continue" : "end";
    },
    {
      continue: "p1_1_initial_segmentation",
      end: END
    }
  )
  
  // Phase 1 edges
  .addEdge("p1_1_initial_segmentation", "p1_2_diachronic_unit_id")
  .addEdge("p1_2_diachronic_unit_id", "p1_3_refine_diachronic")
  .addEdge("p1_3_refine_diachronic", "p1_4_construct_diachronic")
  
  // Parallel execution for Phase 2
  .addEdge("p0_3_select_procedural", "p2s_1_group_by_topic")
  .addEdge("p2s_1_group_by_topic", "p2s_2_identify_synchronic")
  
  // Compile
  .compile({
    checkpointer: new MemorySaver(),
  });
```

### Conditional Routing Rules

1. **Early Termination**: If no procedural utterances found in P0_3
2. **Error Handling**: Route to error recovery node on failures
3. **Parallel Execution**: P1 and P2S branches can execute in parallel
4. **Checkpoint Recovery**: Resume from last successful checkpoint

## Error Handling Strategy

### Node-Level Error Handling
```typescript
class BaseNode {
  async executeWithRetry(state: GraphState): Promise<Partial<GraphState>> {
    const { maxAttempts = 3, backoff = "exponential" } = this.retryPolicy;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.execute(state);
      } catch (error) {
        if (attempt === maxAttempts) {
          return this.handleFinalError(error, state);
        }
        
        await this.waitForRetry(attempt, backoff);
      }
    }
  }
  
  handleFinalError(error: Error, state: GraphState): Partial<GraphState> {
    return {
      errors: [...state.errors, {
        step: this.name,
        message: error.message,
        timestamp: Date.now(),
        recoverable: this.isRecoverable(error)
      }],
      currentStep: this.name,
      status: "error"
    };
  }
}
```

### Graph-Level Error Recovery
```typescript
const errorRecoveryNode = new Node({
  name: "error_recovery",
  
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    const lastError = state.errors[state.errors.length - 1];
    
    if (lastError.recoverable) {
      // Attempt recovery strategies
      const recoveryStrategy = selectRecoveryStrategy(lastError);
      return await recoveryStrategy.execute(state);
    }
    
    // Non-recoverable error - save state and notify
    await saveErrorState(state);
    await notifyError(lastError);
    
    return {
      status: "failed",
      endTime: Date.now()
    };
  }
});
```

### Resilience Patterns

1. **Checkpointing**: Save state after each successful node
2. **Retry with Backoff**: Exponential backoff for transient failures
3. **Circuit Breaker**: Prevent cascading failures
4. **Graceful Degradation**: Continue with partial results where possible
5. **Error Aggregation**: Collect all errors for comprehensive reporting

## API Specifications

### REST Endpoints

#### Start Pipeline Execution
```typescript
POST /api/pipeline/execute
Content-Type: application/json

Request:
{
  "transcripts": TranscriptData[],
  "settings": {
    "model": "gemini-1.5-pro",
    "temperature": 0.3,
    "autoRun": boolean,
    "startFrom": StepId?
  },
  "checkpointId": string? // Resume from checkpoint
}

Response:
{
  "executionId": string,
  "status": "started" | "resumed",
  "checkpointId": string,
  "websocketUrl": string
}
```

#### Get Execution Status
```typescript
GET /api/pipeline/status/:executionId

Response:
{
  "executionId": string,
  "status": "running" | "completed" | "failed" | "paused",
  "currentStep": StepId,
  "completedSteps": StepId[],
  "progress": number, // 0-100
  "errors": ExecutionError[],
  "checkpointId": string
}
```

#### Pause/Resume Execution
```typescript
POST /api/pipeline/:executionId/pause
POST /api/pipeline/:executionId/resume

Response:
{
  "executionId": string,
  "status": "paused" | "resumed",
  "checkpointId": string
}
```

#### Get Step Results
```typescript
GET /api/pipeline/:executionId/results/:stepId

Response:
{
  "executionId": string,
  "stepId": StepId,
  "output": StepOutput,
  "metadata": {
    "startTime": number,
    "endTime": number,
    "tokenUsage": TokenUsage,
    "llmCalls": number
  }
}
```

### WebSocket Events

```typescript
// Connection
ws://localhost:3002/pipeline/:executionId

// Events from server
interface PipelineEvent {
  type: "step_started" | "step_completed" | "step_failed" | 
        "execution_completed" | "execution_failed" | "progress_update";
  executionId: string;
  timestamp: number;
  data: EventData;
}

// Step started
{
  type: "step_started",
  data: {
    stepId: StepId,
    stepName: string,
    estimatedDuration: number
  }
}

// Progress update
{
  type: "progress_update",
  data: {
    stepId: StepId,
    progress: number, // 0-100
    message: string
  }
}
```

### Store Adapter API

```typescript
class LangGraphStoreAdapter {
  constructor(
    private langGraphClient: LangGraphClient,
    private zustandStores: StoreRegistry
  ) {}
  
  // Sync LangGraph state to Zustand
  async syncToZustand(executionId: string): Promise<void> {
    const state = await this.langGraphClient.getState(executionId);
    
    // Update pipeline store
    this.zustandStores.pipeline.setState({
      currentStep: state.currentStep,
      isProcessing: state.status === "running",
      outputData: this.mapOutputData(state)
    });
    
    // Update analysis results
    if (state.p0_1_output) {
      this.zustandStores.analysisResult.setP0_1_Output(state.p0_1_output);
    }
    // ... sync other outputs
  }
  
  // Subscribe to real-time updates
  subscribeToUpdates(executionId: string): () => void {
    const ws = this.langGraphClient.connectWebSocket(executionId);
    
    ws.on("message", (event: PipelineEvent) => {
      this.handleRealtimeUpdate(event);
    });
    
    return () => ws.close();
  }
}
```

## Testing Strategy

### Unit Testing

#### Node Testing
```typescript
describe("P0_1_TranscriptionAdherence Node", () => {
  let node: P0_1_Node;
  let mockLLM: MockLLMClient;
  
  beforeEach(() => {
    mockLLM = createMockLLMClient();
    node = new P0_1_Node({ llmClient: mockLLM });
  });
  
  it("should validate transcripts successfully", async () => {
    const state = createTestState({
      rawTranscripts: [createValidTranscript()]
    });
    
    mockLLM.mockResponse(createValidationResponse());
    
    const result = await node.execute(state);
    
    expect(result.p0_1_output).toBeDefined();
    expect(result.p0_1_output.validatedTranscripts).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
  
  it("should handle validation errors", async () => {
    const state = createTestState({
      rawTranscripts: [createInvalidTranscript()]
    });
    
    mockLLM.mockResponse(createErrorResponse());
    
    const result = await node.execute(state);
    
    expect(result.p0_1_output.errors).toHaveLength(1);
    expect(result.p0_1_output.errors[0].type).toBe("format_error");
  });
  
  it("should retry on transient failures", async () => {
    mockLLM
      .mockError(new Error("Network error"))
      .mockError(new Error("Network error"))
      .mockResponse(createValidationResponse());
    
    const result = await node.executeWithRetry(state);
    
    expect(mockLLM.callCount).toBe(3);
    expect(result.p0_1_output).toBeDefined();
  });
});
```

### Integration Testing

#### Graph Execution Testing
```typescript
describe("Pipeline Graph Integration", () => {
  let graph: CompiledStateGraph;
  let mockLLM: MockLLMClient;
  
  beforeEach(() => {
    mockLLM = createMockLLMClient();
    graph = createTestGraph({ llmClient: mockLLM });
  });
  
  it("should execute full pipeline successfully", async () => {
    const input = {
      rawTranscripts: [createTestTranscript()],
      settings: createDefaultSettings()
    };
    
    // Mock all LLM responses
    mockLLMResponses(mockLLM, "full_success");
    
    const result = await graph.invoke(input);
    
    expect(result.lastCompletedStep).toBe("P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS");
    expect(result.errors).toHaveLength(0);
    
    // Verify all outputs present
    expect(result.p0_1_output).toBeDefined();
    expect(result.p0_2_output).toBeDefined();
    // ... verify all outputs
  });
  
  it("should handle early termination", async () => {
    const input = {
      rawTranscripts: [createNonProceduralTranscript()],
      settings: createDefaultSettings()
    };
    
    mockLLMResponses(mockLLM, "no_procedural");
    
    const result = await graph.invoke(input);
    
    expect(result.lastCompletedStep).toBe("P0_3_SELECT_PROCEDURAL_UTTERANCES");
    expect(result.p0_3_output.proceduralUtterances).toHaveLength(0);
    expect(result.p1_1_output).toBeUndefined();
  });
});
```

### End-to-End Testing

#### API Testing
```typescript
describe("Pipeline API E2E", () => {
  let app: FastifyInstance;
  let wsClient: WebSocketClient;
  
  beforeAll(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0 });
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it("should execute pipeline via API", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/pipeline/execute",
      payload: {
        transcripts: [createTestTranscript()],
        settings: { autoRun: true }
      }
    });
    
    expect(response.statusCode).toBe(200);
    const { executionId, websocketUrl } = JSON.parse(response.payload);
    
    // Connect websocket
    wsClient = new WebSocketClient(websocketUrl);
    await wsClient.connect();
    
    // Collect events
    const events = [];
    wsClient.on("message", (event) => events.push(event));
    
    // Wait for completion
    await waitForEvent(wsClient, "execution_completed", 60000);
    
    // Verify events received
    expect(events).toContainEqual(
      expect.objectContaining({ type: "step_started", data: { stepId: "P0_1_TRANSCRIPTION_ADHERENCE" } })
    );
  });
});
```

### Performance Testing

```typescript
describe("Pipeline Performance", () => {
  it("should handle concurrent executions", async () => {
    const executions = await Promise.all(
      Array(10).fill(null).map(() => 
        graph.invoke(createTestInput())
      )
    );
    
    expect(executions).toHaveLength(10);
    executions.forEach(result => {
      expect(result.errors).toHaveLength(0);
    });
  });
  
  it("should maintain reasonable memory usage", async () => {
    const memBefore = process.memoryUsage().heapUsed;
    
    await graph.invoke(createLargeTestInput());
    
    global.gc(); // Force garbage collection
    const memAfter = process.memoryUsage().heapUsed;
    
    const memIncrease = memAfter - memBefore;
    expect(memIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
  });
});
```

### Testing Best Practices

1. **Mock LLM Calls**: Never call real LLM in tests
2. **Test State Transitions**: Verify state changes at each step
3. **Error Scenarios**: Test all error paths
4. **Checkpoint Recovery**: Test resume from various checkpoints
5. **Concurrent Execution**: Ensure thread safety
6. **Performance Benchmarks**: Monitor execution time and memory
7. **Integration Points**: Test store adapter thoroughly

## Migration Plan

### Phase 1: Backend Setup (Week 1)
1. Set up LangGraph server infrastructure
2. Implement base node classes and utilities
3. Create graph state schema
4. Set up checkpointing system

### Phase 2: Node Implementation (Week 2-3)
1. Implement P0_1 through P0_3 nodes
2. Implement P1_1 through P1_4 nodes
3. Implement P2S_1 and P2S_2 nodes
4. Unit test each node thoroughly

### Phase 3: Graph Assembly (Week 4)
1. Define graph edges and routing
2. Implement error recovery nodes
3. Test graph execution paths
4. Performance optimization

### Phase 4: API Development (Week 5)
1. Create REST endpoints
2. Implement WebSocket server
3. Build store adapter
4. API documentation

### Phase 5: Frontend Integration (Week 6)
1. Update service layer to use new API
2. Maintain backward compatibility
3. Implement real-time updates
4. Update UI for new features

### Phase 6: Testing & Deployment (Week 7-8)
1. Comprehensive integration testing
2. Load testing
3. Migration scripts for existing data
4. Staged rollout plan

## Appendix: Code Examples

### Complete Node Implementation Example
```typescript
import { Node, NodeConfig } from "@langchain/langgraph";
import { GraphState } from "./types";
import { buildPrompt, parseResponse } from "./utils";

export class P0_1_TranscriptionAdherenceNode extends Node<GraphState> {
  constructor(config: NodeConfig) {
    super({
      ...config,
      name: "p0_1_transcription_adherence",
    });
  }
  
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    try {
      // Log start
      this.logger.info(`Starting ${this.name}`, {
        transcriptCount: state.rawTranscripts.length
      });
      
      // Build prompt
      const prompt = buildPrompt("P0_1_ADHERENCE_TEMPLATE", {
        transcripts: state.rawTranscripts,
        validationRules: state.settings.validationRules
      });
      
      // Call LLM
      const response = await this.llm.invoke(prompt, {
        temperature: 0.1,
        maxTokens: 4096,
      });
      
      // Parse response
      const output = parseResponse(response, "P0_1_OUTPUT_SCHEMA");
      
      // Update state
      return {
        p0_1_output: output,
        lastCompletedStep: this.name,
        progress: this.calculateProgress(state),
      };
      
    } catch (error) {
      this.logger.error(`Error in ${this.name}`, error);
      throw new NodeExecutionError(this.name, error);
    }
  }
  
  private calculateProgress(state: GraphState): number {
    const totalSteps = 9; // Total nodes in Phase 2
    const completedSteps = Object.keys(state)
      .filter(key => key.endsWith("_output"))
      .length;
    return (completedSteps / totalSteps) * 100;
  }
}
```

### Store Adapter Implementation
```typescript
import { EventEmitter } from "events";
import { StoreApi } from "zustand";

export class LangGraphStoreAdapter extends EventEmitter {
  private subscriptions: Map<string, () => void> = new Map();
  
  constructor(
    private client: LangGraphClient,
    private stores: {
      pipeline: StoreApi<PipelineStore>;
      analysisResult: StoreApi<AnalysisResultStore>;
      transcript: StoreApi<TranscriptStore>;
    }
  ) {
    super();
  }
  
  async startExecution(
    transcripts: TranscriptData[],
    settings: PipelineSettings
  ): Promise<string> {
    // Create execution
    const { executionId } = await this.client.execute({
      transcripts,
      settings
    });
    
    // Subscribe to updates
    this.subscribeToExecution(executionId);
    
    // Update store
    this.stores.pipeline.setState({
      isProcessing: true,
      currentStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      executionId
    });
    
    return executionId;
  }
  
  private subscribeToExecution(executionId: string): void {
    const ws = this.client.connectWebSocket(executionId);
    
    ws.on("message", (event: PipelineEvent) => {
      this.handleEvent(event);
    });
    
    ws.on("error", (error) => {
      this.emit("error", error);
    });
    
    ws.on("close", () => {
      this.subscriptions.delete(executionId);
    });
    
    this.subscriptions.set(executionId, () => ws.close());
  }
  
  private handleEvent(event: PipelineEvent): void {
    switch (event.type) {
      case "step_completed":
        this.handleStepCompleted(event.data);
        break;
      case "progress_update":
        this.handleProgressUpdate(event.data);
        break;
      case "execution_completed":
        this.handleExecutionCompleted(event.data);
        break;
      // ... other event handlers
    }
  }
  
  private handleStepCompleted(data: StepCompletedData): void {
    const { stepId, output } = data;
    
    // Update pipeline store
    this.stores.pipeline.setState({
      currentStep: this.getNextStep(stepId),
      lastCompletedStep: stepId,
    });
    
    // Update analysis result store
    const setterMethod = `set${stepId}Output`;
    if (this.stores.analysisResult[setterMethod]) {
      this.stores.analysisResult[setterMethod](output);
    }
    
    this.emit("stepCompleted", { stepId, output });
  }
}
```

## Production Readiness Assessment

### Current Implementation Status

**Architecture Grade: A-**
- Clean graph-based architecture implemented
- Proper separation of concerns achieved
- Event-driven progress tracking working
- Comprehensive session management with Redis

**Code Quality Grade: B+**
- Strong TDD implementation with 248 passing tests
- Consistent node implementation patterns
- Proper TypeScript usage with minor improvements needed
- Good error handling foundation (needs enhancement)

### Critical Issues Requiring Resolution

**Before Production Deployment:**

1. **P1_4 Error Handling Bug** (CRITICAL)
   - Incorrect LLMResponseError constructor usage
   - Could cause cryptic error messages and improper retry behavior
   - File: `P1_4_ConstructSpecificDiachronicStructureNode.ts:51`

2. **Session Memory Leak** (CRITICAL)
   - Redis sessions have no TTL causing unlimited memory growth
   - Production system will exhaust memory over time
   - Fix: Add 24-hour TTL to Redis operations

3. **Security Gap: Prompt Injection** (HIGH)
   - User inputs go directly into prompts without sanitization
   - Could allow prompt injection attacks
   - Fix: Implement input sanitization for all user-controlled content

4. **Progress Calculation Bug** (MEDIUM)
   - Progress reaches 100% before COMPLETE step executes
   - UX issue causing completion status confusion
   - Fix: Adjust calculation to account for COMPLETE step

### Implementation Recommendations

**Immediate (Week 1):**
- Fix all critical issues #1-3
- Add comprehensive error types (ValidationError, SessionError, ExecutionError)
- Implement session TTL and cleanup

**Short-term (Week 2-3):**
- Add input sanitization across all nodes
- Implement progress calculation fix
- Add memory usage monitoring
- Create session archival strategy

**Medium-term (Month 2):**
- Add rate limiting mechanisms
- Implement comprehensive audit logging
- Create performance monitoring dashboard
- Add automated error recovery strategies

### Verification Requirements

Before production:
- [ ] 24+ hour memory leak testing
- [ ] Security testing with malicious inputs
- [ ] Load testing with concurrent sessions
- [ ] Error recovery testing
- [ ] Progress calculation verification across all node types

This technical specification provides a comprehensive blueprint for migrating the upath pipeline to LangGraph, ensuring maintainability, scalability, and improved error handling while preserving the existing frontend functionality.

---

**Related Documents:**
- [📚 Documentation Home](../README.md) - Complete project overview and navigation
- [📋 Phase 2 Implementation Guide](PHASE-2-IMPLEMENTATION-GUIDE.md) - Step-by-step implementation progress
- [🚨 Production Readiness Checklist](PRODUCTION-READINESS.md) - Critical issues and verification requirements
- [📋 Migration Plan](../MIGRATION-PLAN.md) - Overall strategy and TDD principles
- [🔧 Store Migration Pattern](../patterns/STORE-MIGRATION-PATTERN.md) - Proven migration patterns
- [📚 LangGraph Migration Explanation](../plan/02_langgraph_migration.md) - Conceptual background

**Implementation Resources:**
- [🔧 Transaction Pattern](../patterns/TRANSACTION-PATTERN.md) - Cross-store coordination patterns
- [📚 Backend Architecture](../plan/00_backend_architecture.md) - Backend design principles