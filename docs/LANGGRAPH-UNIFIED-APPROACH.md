# Unified LangGraph.js Strategy for the µ-PATH Pipeline

## 1. Executive Summary

This document presents a unified strategy for implementing the µ-PATH pipeline in LangGraph.js, synthesizing the development-focused, modular approach from `LANGGRAPH-DEEPWIKI-RESEARCH.md` with the production-focused, monolithic patterns from `LANGGRAPH-CONTEXT7-RESEARCH.md`.

The proposed architecture balances maintainability and production readiness. It adopts a **hybrid graph architecture** where modular, reusable **sub-graphs** manage discrete loops (e.g., GDU processing), which are orchestrated by a main graph. This approach provides the testability and isolation of the modular design while maintaining the clear, end-to-end control flow of the production design.

This strategy is built on five core principles:
1.  **Hybrid Architecture:** Modular sub-graphs for loops, orchestrated by a main graph.
2.  **Robust State Management:** A single, comprehensive state object with explicit reducers.
3.  **Layered Error Handling:** A multi-layered approach combining node-level retries, dedicated error-handling nodes, and graceful failure.
4.  **Holistic Quality Strategy:** A commitment to both comprehensive automated testing and integrated performance monitoring.
5.  **Environment-Aware Configuration:** A clean separation between development/testing and production environments.

## 2. Core Principles and Resolutions

This section resolves the key disagreements between the two research documents.

| Disagreement | DEEPWIKI (Dev-Focused) | CONTEXT7 (Prod-Focused) | Unified Resolution |
| :--- | :--- | :--- | :--- |
| **Architecture** | Modular sub-graphs for loops. | Monolithic graph with complex routers. | **Hybrid Model:** Use sub-graphs for isolated, repeatable logic (loops). The main graph orchestrates these sub-graphs, simplifying its routing logic to transitions between major phases and sub-graphs. |
| **State Management** | Simple annotations, `Map` for results. | Reducer-heavy `Annotation.Root`. | **Reducer-Heavy:** Adopt the explicit `Annotation.Root` from `CONTEXT7` for type safety and predictable state updates. Avoid `Map` objects in the state in favor of JSON-serializable structures. |
| **Error Handling** | `try/catch` in nodes, `state.errors` array. | Dedicated `error_handler` nodes and `retryPolicy`. | **Layered Approach:** 1) Use `retryPolicy` for transient errors (APIs). 2) Use `try/catch` in nodes to populate `state.errors`. 3) Use conditional edges to route to a central `error_handler` node if `state.errors` is not empty. |
| **Approach** | Development-first, iterative. | Production-first, resilient. | **Develop for Production:** Build with the modularity and testability of the dev-first approach, but incorporate production patterns (monitoring, persistence) from day one. |
| **Quality** | Emphasis on testing. | Emphasis on monitoring. | **Holistic Quality:** Mandate both. A comprehensive testing suite (`DEEPWIKI`) is required before deployment. In-built monitoring (`CONTEXT7`) is required for operational visibility. |

## 3. Unified Architecture Design

The µ-PATH pipeline will be implemented as a main graph that invokes specialized sub-graphs for its complex, nested loops.

### 3.1. High-Level Structure

The main graph is responsible for high-level orchestration:
1.  **`initialization_node`**: Sets up the initial state, determines single vs. multi-transcript path.
2.  **`transcript_router`**: Routes to the appropriate processing path.
3.  **`multi_transcript_subgraph`**: A node that invokes a self-contained graph for processing multiple transcripts (Phases NEG1 to 0).
4.  **`single_transcript_loop_subgraph`**: A node that invokes a sub-graph to manage the main loop over each transcript. This sub-graph will contain the nested GDU loop logic.
5.  **`error_handler_node`**: A centralized node for processing terminal and recoverable errors.
6.  **`finalization_node`**: Aggregates final results before ending.

This structure provides clear separation of concerns. The main graph manages the "what," while the sub-graphs manage the "how."

```typescript
// Main graph assembly
const mainGraph = new StateGraph(UPathAnnotation)
  .addNode("initialize", initializationNode)
  .addNode("multi_transcript_processor", multiTranscriptSubGraph) // Invokes a sub-graph
  .addNode("single_transcript_processor", singleTranscriptLoopSubGraph) // Invokes a sub-graph
  .addNode("error_handler", errorHandlerNode)
  .addNode("finalizer", finalizationNode)
  .addEdge(START, "initialize")
  .addConditionalEdges("initialize", transcriptRouter, {
    "multi_transcript_path": "multi_transcript_processor",
    "single_transcript_path": "single_transcript_processor",
  })
  .addEdge("multi_transcript_processor", "single_transcript_processor") // Chaining after completion
  .addEdge("single_transcript_processor", "finalizer")
  .addEdge("finalizer", END)
  .addEdge("error_handler", END); // Or route back for recovery
```

### 3.2. Sub-Graph Design (Example: GDU Loop)

Sub-graphs are standard `StateGraph` instances compiled and invoked as a single node within the parent. They encapsulate looping logic, making the main graph cleaner and the loop itself independently testable.

The GDU-processing phases (e.g., P1, P3) can be implemented as a generic sub-graph that is called repeatedly.

```typescript
// GDU processing sub-graph definition
const gduLoopSubGraph = new StateGraph(UPathAnnotation)
  .addNode("gdu_processor", gduProcessorNode) // Processes one GDU
  .addNode("increment_gdu_index", incrementGduIndexNode)
  .addEdge(START, "gdu_processor")
  .addConditionalEdges("gdu_processor", (state) => {
    // Condition to check if more GDUs exist in the current phase
    return state.currentGDUIndex < state.gdus.length ? "increment_gdu_index" : END;
  })
  .addEdge("increment_gdu_index", "gdu_processor") // Loop back
  .compile();

// This compiled sub-graph can be invoked from a node in the main graph
const P1_Phase_Node = async (state: UPathState) => {
  // Logic to prepare for Phase 1...
  const phase1Result = await gduLoopSubGraph.invoke(state);
  return { ... }; // Return updated state
};
```

## 4. State Management Strategy

We will use a single, comprehensive state object defined with `Annotation.Root`, as proposed in `CONTEXT7`. This provides type safety, clear default values, and predictable update logic via reducers. This is non-negotiable for production stability.

```typescript
const UPathAnnotation = Annotation.Root({
  // Pipeline identification
  pipelineId: Annotation<string>({
    default: () => crypto.randomUUID(),
  }),
  
  // Input data
  transcripts: Annotation<Transcript[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Processing state & Loop counters
  currentTranscriptIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x), // Always take the new value
    default: () => 0,
  }),
  currentPhaseIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
    default: () => 0,
  }),
  currentGDUIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
    default: () => 0,
  }),
  
  // Current processing context
  currentPhase: Annotation<string>({
    reducer: (x, y) => (y ?? x),
  }),
  
  // Results accumulator
  results: Annotation<ProcessingResult[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // GDU data for the current transcript
  gdus: Annotation<GDU[]>({
    reducer: (a, b) => (b ?? a), // Overwrite GDUs for each new transcript
    default: () => [],
  }),
  
  // Error tracking
  errors: Annotation<Error[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Metadata
  metadata: Annotation<Record<string, any>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
});

type UPathState = typeof UPathAnnotation.State;
```

## 5. Error Handling and Resilience Strategy

We will implement a three-layer resilience strategy.

1.  **Node-Level Retries:** For nodes making external network calls (e.g., to an LLM), use LangGraph's built-in `retryPolicy`. This handles transient network failures gracefully without complicating the graph logic.
    ```typescript
    .addNode("api_caller", apiCallerNode, { 
      retryPolicy: { 
        maxAttempts: 5,
        backoffFactor: 2,
        initialInterval: 1000 
      }
    })
    ```

2.  **In-Node `try/catch`:** All node functions must wrap their core logic in a `try/catch` block. On failure, they should not throw but instead return an `errors` array in their partial state update.
    ```typescript
    const processDataNode = async (state: UPathState): Promise<Partial<UPathState>> => {
      try {
        const result = await doRiskyOperation(state);
        return { results: [result] };
      } catch (error) {
        console.error(`Error in processDataNode:`, error);
        return { errors: [error as Error] };
      }
    };
    ```

3.  **Centralized Error Routing:** After each significant step (especially after a sub-graph invocation), a conditional edge will check `state.errors.length`. If it's greater than zero, it will route to the `error_handler_node`.
    ```typescript
    // In main graph definition
    .addConditionalEdges("some_processing_node", (state) => {
        return state.errors.length > 0 ? "error_handler" : "next_step";
    })
    ```
    The `error_handler_node` itself will contain the logic from `CONTEXT7` to inspect errors, log to a monitoring service, and decide whether to terminate the graph or attempt a recovery.

## 6. Testing and Monitoring Strategy

Quality is a function of both pre-deployment testing and post-deployment monitoring.

### 6.1. Testing (from `DEEPWIKI`)

A multi-layered testing approach is mandatory.
-   **Unit Tests:** Each node function and router function will be tested in isolation. External dependencies (LLMs, databases) will be mocked. This ensures the core logic of each unit is correct.
-   **Sub-Graph Integration Tests:** Each sub-graph will be tested as a complete, independent workflow. This validates looping and conditional logic within the sub-graph.
-   **End-to-End Tests:** The main graph will be tested with a small number of representative inputs to ensure the orchestration of sub-graphs and high-level routing is correct.
-   **Environment:** All tests will run using `MemorySaver` for speed and isolation.

### 6.2. Monitoring (from `CONTEXT7`)

Production code must be instrumented for observability.
-   **Performance Wrapper:** All primary graph nodes should be wrapped in a higher-order function to standardize the collection of performance metrics (duration, memory usage).
    ```typescript
    const addPerformanceMonitoring = (node: Function, nodeName: string) => {
      return async (state: typeof UPathAnnotation.State) => {
        const startTime = Date.now();
        // ...
        try {
          const result = await node(state);
          // ... log success metrics
          return result;
        } catch (error) {
          // ... log error metrics
          throw error;
        }
      };
    };
    ```
-   **Centralized Logging:** The `error_handler_node` is the designated point for logging critical, context-rich errors to an external monitoring service (e.g., DataDog, Sentry).
-   **Streaming:** Use `.stream()` for invocations where real-time progress updates are required, allowing front-end or operational dashboards to monitor progress.

## 7. Implementation Plan

1.  **Setup & State (Day 1-2):**
    *   Define the final `UPathAnnotation` state object.
    *   Set up the project structure with distinct directories for `nodes`, `sub-graphs`, and `tests`.
    *   Implement the environment-aware checkpointer factory (`MemorySaver` for dev/test, `PostgresSaver` for prod).

2.  **Node & Wrapper Implementation (Day 3-5):**
    *   Implement the `addPerformanceMonitoring` wrapper.
    *   Implement all 28 core node functions as standalone, testable units, wrapping each in the monitoring function and including `try/catch` blocks.
    *   Write unit tests for each node function.

3.  **Sub-Graph Assembly (Day 6-10):**
    *   Identify the looping patterns (transcript, phase, GDU) and create generic, reusable sub-graphs for them.
    *   Write integration tests for each sub-graph to validate its internal logic.

4.  **Main Graph Orchestration (Day 11-13):**
    *   Assemble the main graph, using nodes that invoke the compiled sub-graphs.
    *   Implement the top-level routers and the `error_handler_node`.
    *   Write end-to-end tests for the main graph, covering both single and multi-transcript paths.

5.  **Integration & Refinement (Day 14-15):**
    *   Integrate with the production `PostgresSaver`.
    *   Perform final performance testing and refinement.
    *   Prepare for deployment.

This unified plan provides a clear, actionable path forward that leverages the strengths of both prior research documents, resulting in a µ-PATH pipeline that is robust, scalable, maintainable, and observable.