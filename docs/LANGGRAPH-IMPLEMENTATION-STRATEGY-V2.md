# µ-PATH Pipeline: Final Implementation Strategy (V2)

## 1. Executive Summary

This document outlines the final, consensus-driven strategy for implementing the µ-PATH pipeline using LangGraph.js. It merges the need for rapid development with the non-negotiable requirements of a production-grade system.

The architecture is founded on these core principles:
*   **Hybrid Graph with Typed Wrappers**: A main graph orchestrates modular sub-graphs, which are invoked via strongly-typed wrappers to ensure strict state contracts without excessive boilerplate.
*   **Two-Tiered Error Handling**: Combines granular, "skip-and-continue" recovery for data-specific errors with a circuit breaker pattern for systemic, transient failures.
*   **Proactive State Management**: A dedicated state pruning node actively manages memory and prevents unbounded state growth by archiving results.
*   **Security-First Design**: Security and compliance are designed into the architecture from day one with placeholder nodes and schema considerations, not bolted on later.
*   **Phased Delivery**: A realistic, two-phase timeline delivers a "Production MVP" quickly, followed by a planned "Hardening" phase to build out advanced resiliency and performance features.

## 2. State Management Design

The state will be managed in a single, comprehensive object. We will augment the `metadata` field to support security and audit requirements from the start and introduce a mechanism for referencing archived results.

```typescript
const UPathAnnotation = Annotation.Root({
  // Pipeline identification and security context
  metadata: Annotation<{
    pipelineId: string;
    correlationId: string; // For tracing requests across services
    tenantId?: string;     // For multi-tenancy
    userId?: string;       // For user-level auditing
    archivedResultCount: number;
    [key: string]: any;
  }>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({
      pipelineId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
      archivedResultCount: 0,
    }),
  }),
  
  // Input data
  transcripts: Annotation<Transcript[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Loop context with logical grouping
  loopContext: Annotation<{
    currentTranscriptIndex: number;
    currentPhaseIndex: number;
    currentGDUIndex: number;
    currentPhase: string;
    gdus: GDU[]; // GDUs for current transcript
  }>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({
      currentTranscriptIndex: 0,
      currentPhaseIndex: 0,
      currentGDUIndex: 0,
      currentPhase: "",
      gdus: [],
    }),
  }),
  
  // Results accumulator - now holds recent results or references
  results: Annotation<ProcessingResult[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Error tracking
  errors: Annotation<Error[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Failed items tracking for granular recovery
  failedItems: Annotation<{
    transcripts: string[];
    phases: string[];
    gdus: string[];
  }>({
    reducer: (a, b) => ({
      transcripts: [...a.transcripts, ...b.transcripts],
      phases: [...a.phases, ...b.phases],
      gdus: [...a.gdus, ...b.gdus],
    }),
    default: () => ({ transcripts: [], phases: [], gdus: [] }),
  }),
});

type UPathState = typeof UPathAnnotation.State;
```

## 3. Graph Architecture & Node Patterns

### 3.1 Sub-Graph Composition via Typed Wrappers

All sub-graphs will be invoked through a wrapper node. This is our compromise to enforce strict contracts while using a single state definition. The wrapper isolates the sub-graph, making it independently testable and preventing unintended state mutations.

```typescript
// 1. Define the sub-graph's explicit Input/Output contract
interface GduSubgraphInput {
  gdus: GDU[];
  currentGDUIndex: number;
  currentPhase: string;
}

interface GduSubgraphOutput {
  processedGdus: GDU[];
  nextGduIndex: number;
  results: ProcessingResult[];
  errors: Error[];
}

// 2. The sub-graph itself is compiled independently
const gduSubgraph = new StateGraph<GduSubgraphInput>(/*...*/)
  .compile<GduSubgraphInput, GduSubgraphOutput>();

// 3. The wrapper node in the main graph performs the state transformation
const gduSubgraphWrapperNode = async (state: UPathState): Promise<Partial<UPathState>> => {
  // "State Slice" - Create the input for the sub-graph
  const subgraphInput: GduSubgraphInput = {
    gdus: state.loopContext.gdus,
    currentGDUIndex: state.loopContext.currentGDUIndex,
    currentPhase: state.loopContext.currentPhase,
  };
  
  // Invoke the isolated sub-graph
  const subgraphOutput = await gduSubgraph.invoke(subgraphInput);
  
  // Map the output back to the main state
  return {
    loopContext: {
      ...state.loopContext,
      currentGDUIndex: subgraphOutput.nextGduIndex,
      gdus: subgraphOutput.processedGdus,
    },
    results: subgraphOutput.results, // Reducer will concat
    errors: subgraphOutput.errors,   // Reducer will concat
  };
};
```

### 3.2 Updated Main Graph Structure

The main graph will include new, dedicated nodes for security and state management.

```typescript
const mainGraph = new StateGraph(UPathAnnotation)
  .addNode("initialize", initializationNode)
  .addNode("piiSanitization", piiSanitizationNode) // Security placeholder
  .addNode("transcriptLoopSubgraph", transcriptLoopSubgraphWrapper) // Now a wrapper
  .addNode("pruneState", pruneStateNode) // State management node
  .addNode("errorHandler", enhancedErrorHandlerNode)
  .addNode("finalizer", finalizationNode)
  .addEdge(START, "initialize")
  .addEdge("initialize", "piiSanitization")
  .addEdge("piiSanitization", "transcriptLoopSubgraph")
  // The prune node runs after the main loop completes
  .addEdge("transcriptLoopSubgraph", "pruneState")
  .addEdge("pruneState", "finalizer")
  .addConditionalEdges("errorHandler", errorRecoveryRouter, {
    "continueTranscript": "transcriptLoopSubgraph",
    "continuePhase": "phaseLoopSubgraph", 
    "continueGDU": "gduLoopSubgraph",
    "terminate": END,
  })
  .addEdge("finalizer", END);
```

### 3.3 State Pruning Node

This node encapsulates the logic for managing state size, decoupling it from business logic nodes.

```typescript
const PRUNING_THRESHOLD = 100;
const PRUNING_RETAIN_COUNT = 20;

const pruneStateNode = async (state: UPathState): Promise<Partial<UPathState>> => {
  if (state.results.length > PRUNING_THRESHOLD) {
    const toArchive = state.results.slice(0, -PRUNING_RETAIN_COUNT);
    const remaining = state.results.slice(-PRUNING_RETAIN_COUNT);
    
    // In Phase 2, this will write to S3/DB. In Phase 1, it can just log.
    console.log(`Archiving ${toArchive.length} results...`);
    // await archiveService.store(state.metadata.pipelineId, toArchive);
    
    return {
      results: remaining,
      metadata: {
        ...state.metadata,
        archivedResultCount: state.metadata.archivedResultCount + toArchive.length,
      },
    };
  }
  return {}; // No changes needed
};
```

## 4. Error Handling & Resiliency

We will implement a two-tiered strategy for robust error handling.

*   **Tier 1: Granular Recovery**: For data-specific, recoverable errors (e.g., malformed GDU), the `enhancedErrorHandlerNode` will log the failure to `failedItems` and allow the graph to continue, as defined in the original plan.

*   **Tier 2: Systemic Failure (Circuit Breaker)**: For I/O-heavy nodes (LLMs, databases), we will use a circuit breaker to prevent hammering a failing service. A tripped breaker will throw a `GraphInterrupt`, pausing the graph for intervention.

```typescript
import { CircuitBreaker } from 'opossum'; // Example library
import { GraphInterrupt } from '@langchain/langgraph';

const createCircuitBreakerNode = (node: Function, options = {}) => {
  const breaker = new CircuitBreaker(node, {
    timeout: 30000, // 30 second timeout
    errorThresholdPercentage: 50,
    resetTimeout: 30000, // Try again after 30 seconds
    ...options
  });
  
  return async (state: UPathState, config?: any) => {
    try {
      // Circuit breaker will throw if open
      const result = await breaker.fire(state, config);
      return result;
    } catch (error) {
      if (breaker.opened) {
        // Circuit is open, interrupt the graph
        console.warn(`Circuit breaker open for node. Interrupting graph execution.`);
        throw new GraphInterrupt({
          reason: "Circuit breaker triggered",
          nodeId: node.name,
          canResume: true
        });
      }
      // Other errors bubble up normally
      throw error;
    }
  };
};

// Usage when defining the graph
// .addNode("llmApiCall", createCircuitBreakerNode(llmApiCallNode, { timeout: 60000 }))
```

### 4.1 Enhanced Error Handler Node

```typescript
const enhancedErrorHandlerNode = async (state: UPathState): Promise<Partial<UPathState>> => {
  const errors = state.errors;
  if (errors.length === 0) return {};
  
  // Classify errors
  const criticalErrors = errors.filter(e => 
    e.message.includes("CRITICAL") || 
    e.message.includes("FATAL") ||
    e.name === "GraphInterrupt"
  );
  const recoverableErrors = errors.filter(e => 
    !criticalErrors.includes(e)
  );
  
  if (criticalErrors.length > 0) {
    // Log critical errors for monitoring
    console.error("Critical errors encountered:", criticalErrors);
    return { 
      metadata: { 
        ...state.metadata, 
        terminationReason: "Critical error",
        criticalErrors: criticalErrors.map(e => ({
          message: e.message,
          stack: e.stack,
          timestamp: new Date().toISOString()
        }))
      }
    };
  }
  
  // Handle recoverable errors with granular recovery
  for (const error of recoverableErrors) {
    if (error.message.includes("GDU")) {
      // Skip failed GDU
      const failedGduId = extractGduId(error);
      return {
        failedItems: { 
          gdus: [failedGduId],
          transcripts: [],
          phases: []
        },
        loopContext: {
          ...state.loopContext,
          currentGDUIndex: state.loopContext.currentGDUIndex + 1
        },
        errors: [] // Clear handled errors
      };
    }
    // Similar logic for transcript and phase errors
  }
  
  return {};
};
```

## 5. Security & Compliance Architecture

### 5.1 PII Sanitization Node (Placeholder)

```typescript
const piiSanitizationNode = async (state: UPathState): Promise<Partial<UPathState>> => {
  // Phase 1: Pass-through with logging
  console.log(`[PII Sanitization] Processing ${state.transcripts.length} transcripts`);
  
  // Phase 2 will implement actual sanitization:
  // - Detect PII patterns (SSN, credit cards, emails, etc.)
  // - Replace with tokens or redact
  // - Store mapping for potential restoration
  
  return {
    metadata: {
      ...state.metadata,
      piiProcessed: true,
      piiProcessingTime: new Date().toISOString()
    }
  };
};
```

### 5.2 Audit Trail Integration

Every node wrapper should include audit logging:

```typescript
const withAuditLogging = (node: Function, nodeName: string) => {
  return async (state: UPathState, config?: any) => {
    const startTime = Date.now();
    const auditEntry = {
      nodeId: nodeName,
      userId: state.metadata.userId,
      tenantId: state.metadata.tenantId,
      correlationId: state.metadata.correlationId,
      timestamp: new Date().toISOString(),
      inputHash: hashState(state), // Hash for integrity
    };
    
    try {
      const result = await node(state, config);
      auditEntry.status = 'success';
      auditEntry.duration = Date.now() - startTime;
      // In Phase 2, write to audit log
      return result;
    } catch (error) {
      auditEntry.status = 'error';
      auditEntry.error = error.message;
      // In Phase 2, write to audit log
      throw error;
    }
  };
};
```

## 6. Performance Monitoring

### 6.1 Selective Performance Wrapper

Only wrap I/O-heavy nodes initially to minimize overhead:

```typescript
const IO_HEAVY_NODES = ['llmApiCall', 'databaseQuery', 'externalApiCall'];

const withPerformanceMonitoring = (node: Function, nodeName: string) => {
  // Only monitor if in production and node is I/O heavy
  if (process.env.NODE_ENV !== 'production' || !IO_HEAVY_NODES.includes(nodeName)) {
    return node;
  }
  
  return async (state: UPathState, config?: any) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await node(state, config);
      
      const metrics = {
        nodeName,
        duration: Date.now() - startTime,
        memoryDelta: process.memoryUsage().heapUsed - startMemory.heapUsed,
        timestamp: new Date().toISOString(),
        pipelineId: state.metadata.pipelineId,
        correlationId: state.metadata.correlationId
      };
      
      // In Phase 2, send to monitoring service
      // await monitoringService.send(metrics);
      
      return result;
    } catch (error) {
      // Log error metrics
      throw error;
    }
  };
};
```

## 7. Testing Strategy

### 7.1 Sub-Graph Contract Tests

Test sub-graphs in isolation using their Input/Output contracts:

```typescript
describe('GDU Processing Sub-graph', () => {
  it('should process GDUs according to contract', async () => {
    const input: GduSubgraphInput = {
      gdus: [mockGdu1, mockGdu2],
      currentGDUIndex: 0,
      currentPhase: 'P4S'
    };
    
    const output = await gduSubgraph.invoke(input);
    
    expect(output).toMatchObject<GduSubgraphOutput>({
      processedGdus: expect.any(Array),
      nextGduIndex: 2,
      results: expect.arrayContaining([
        expect.objectContaining({ gduId: mockGdu1.id }),
        expect.objectContaining({ gduId: mockGdu2.id })
      ]),
      errors: []
    });
  });
});
```

### 7.2 Circuit Breaker Tests

```typescript
describe('Circuit Breaker Behavior', () => {
  it('should interrupt graph when circuit opens', async () => {
    const failingNode = jest.fn().mockRejectedValue(new Error('Service unavailable'));
    const protectedNode = createCircuitBreakerNode(failingNode, {
      errorThresholdPercentage: 50,
      resetTimeout: 100
    });
    
    // Trigger failures to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await protectedNode(mockState);
      } catch (e) {
        // Expected failures
      }
    }
    
    // Next call should throw GraphInterrupt
    await expect(protectedNode(mockState))
      .rejects
      .toThrow(GraphInterrupt);
  });
});
```

## 8. Phased Implementation Timeline

### Phase 1: Production MVP (25 Days)

#### Days 1-4: Foundation & Contracts
- Finalize `UPathAnnotation` including security fields
- Define all sub-graph Input/Output interfaces
- Set up project structure with clear separation of concerns
- Implement checkpointer factory pattern

#### Days 5-13: Node Implementation
- Implement all 28 business logic nodes
- Implement placeholder security nodes (piiSanitization, auditLog)
- Implement state management nodes (pruneState)
- Apply appropriate wrappers (typed, audit, performance)

#### Days 14-18: Graph Assembly & Error Handling
- Assemble main graph with typed wrapper nodes
- Implement all sub-graphs with proper isolation
- Implement Tier 1 error handling (skip-and-continue)
- Implement basic Tier 2 circuit breakers

#### Days 19-22: Integration & Testing
- PostgreSQL integration with basic schema
- Write comprehensive test suite:
  - Unit tests for all nodes
  - Sub-graph contract tests
  - Integration tests for error paths
  - End-to-end tests for complete pipeline

#### Days 23-25: MVP Deployment Prep
- Performance testing and optimization
- Documentation and runbooks
- Deployment configuration
- Final review and sign-off

### Phase 2: Hardening (10-15 Days, Post-MVP)

#### State Management (Days 1-3)
- Implement S3/DB archival service
- Advanced state pruning strategies
- State recovery mechanisms

#### Resiliency (Days 4-6)
- Advanced circuit breaker configuration
- Implement retry policies with exponential backoff
- Dead letter queue for failed items

#### Security (Days 7-9)
- Implement actual PII detection and sanitization
- Complete audit logging system
- Encryption at rest for sensitive data

#### Performance (Days 10-12)
- PostgreSQL optimization (indexes, partitioning)
- Implement caching layer for LLM responses
- Parallel processing optimizations

#### Observability (Days 13-15)
- Complete monitoring integration
- Custom dashboards and alerts
- Performance profiling and optimization

## 9. Key Implementation Files

```
upath-backend/
├── src/
│   ├── graph/
│   │   ├── state/
│   │   │   ├── annotations.ts      # UPathAnnotation definition
│   │   │   └── types.ts           # State types and interfaces
│   │   ├── nodes/
│   │   │   ├── business/          # 28 business logic nodes
│   │   │   ├── security/          # PII, audit nodes
│   │   │   ├── management/        # State pruning, etc.
│   │   │   └── wrappers/          # Typed wrapper nodes
│   │   ├── subgraphs/
│   │   │   ├── transcript/        # Transcript loop subgraph
│   │   │   ├── phase/             # Phase loop subgraph
│   │   │   └── gdu/               # GDU loop subgraph
│   │   ├── utils/
│   │   │   ├── circuitBreaker.ts
│   │   │   ├── monitoring.ts
│   │   │   └── persistence.ts
│   │   └── builder.ts             # Main graph assembly
│   └── __tests__/
│       ├── unit/                  # Node-level tests
│       ├── integration/           # Sub-graph tests
│       └── e2e/                   # Full pipeline tests
```

## 10. Conclusion

This implementation strategy represents a balanced approach that:
- Delivers value quickly with a Production MVP
- Maintains high quality standards through typed contracts and comprehensive testing
- Ensures production readiness through proper error handling and state management
- Plans for security and compliance from day one
- Provides a clear path to a fully hardened system

The phased approach allows the team to ship working software while maintaining a clear vision of the complete system. By incorporating both development velocity and production robustness, we ensure the µ-PATH pipeline migration is both successful and sustainable.