# LangGraph.js Context7 Research: Complete Implementation Guide for µ-PATH Pipeline Migration

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [LangGraph.js Core Concepts](#langgraphjs-core-concepts)
3. [StateGraph Patterns with Complex Routing](#stategraph-patterns-with-complex-routing)
4. [Loop Implementation Patterns](#loop-implementation-patterns)
5. [Annotation System for State Management](#annotation-system-for-state-management)
6. [Conditional Edges with Multiple Paths](#conditional-edges-with-multiple-paths)
7. [Checkpointing and Persistence](#checkpointing-and-persistence)
8. [Production-Ready Patterns](#production-ready-patterns)
9. [Complete µ-PATH Pipeline Implementation Plan](#complete-µ-path-pipeline-implementation-plan)
10. [Detailed Node and Edge Definitions](#detailed-node-and-edge-definitions)
11. [Implementation Code Templates](#implementation-code-templates)

## Executive Summary

This research document provides comprehensive findings from Context7 documentation on LangGraph.js patterns specifically applicable to the µ-PATH pipeline migration. The research focuses on production-ready patterns for complex multi-loop pipelines with 28 nodes, conditional routing, and state persistence.

### Key Findings:
- **StateGraph** is the primary construct for building complex workflows
- **Annotation.Root** provides type-safe state management with reducers
- **Conditional edges** support complex routing logic with multiple paths
- **MemorySaver** and production checkpointers (PostgresSaver) enable state persistence
- **Nested loops** and **parallel execution** patterns are well-supported
- **Error handling** and **retry policies** are built into the framework

## LangGraph.js Core Concepts

### StateGraph Construction

The fundamental building block is the `StateGraph` class:

```typescript
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";

// Define state annotation
const StateAnnotation = Annotation.Root({
  messages: Annotation<Message[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  currentPhase: Annotation<string>({
    reducer: (x: string, y: string) => (y ?? x),
  }),
  transcripts: Annotation<Transcript[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  })
});

// Create the graph
const graph = new StateGraph(StateAnnotation)
  .addNode("nodeA", nodeAFunction)
  .addNode("nodeB", nodeBFunction)
  .addEdge(START, "nodeA")
  .addConditionalEdges("nodeA", routingFunction)
  .addEdge("nodeB", END)
  .compile();
```

### Node Definition Pattern

Nodes are async functions that receive state and return partial state updates:

```typescript
const processNode = async (state: typeof StateAnnotation.State) => {
  console.log(`Processing with state: ${JSON.stringify(state)}`);
  // Process and return partial state update
  return {
    messages: [{ content: "Processed", role: "assistant" }],
    currentPhase: "next-phase"
  };
};
```

## StateGraph Patterns with Complex Routing

### Multi-Path Conditional Routing

From the research, here's a production pattern for complex routing:

```typescript
const routeByPhase = async (state: typeof StateAnnotation.State) => {
  const { currentPhase, transcripts } = state;
  
  // Multiple condition routing
  if (currentPhase === "initialization") {
    return transcripts.length > 1 ? "multi_transcript_path" : "single_transcript_path";
  } else if (currentPhase === "processing") {
    return state.hasError ? "error_handler" : "continue_processing";
  } else if (currentPhase === "finalization") {
    return "__end__";
  }
  
  return "default_handler";
};

// Add conditional edges with explicit path mapping
graph.addConditionalEdges("router_node", routeByPhase, {
  "multi_transcript_path": "P1_1_node",
  "single_transcript_path": "P2_1_node", 
  "continue_processing": "P3_1_node",
  "error_handler": "error_node",
  "default_handler": "default_node",
  "__end__": END
});
```

### Parallel Execution Pattern

For nodes that can execute in parallel:

```typescript
const parallelProcessing = new StateGraph(StateAnnotation)
  .addNode("coordinator", coordinatorNode)
  .addNode("processor1", processor1Node)
  .addNode("processor2", processor2Node)
  .addNode("aggregator", aggregatorNode)
  .addEdge(START, "coordinator")
  .addEdge("coordinator", "processor1")
  .addEdge("coordinator", "processor2")
  .addEdge(["processor1", "processor2"], "aggregator")
  .addEdge("aggregator", END)
  .compile();
```

## Loop Implementation Patterns

### Simple Loop with Termination Condition

```typescript
const LoopAnnotation = Annotation.Root({
  iterations: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0,
  }),
  results: Annotation<string[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  })
});

const processLoop = async (state: typeof LoopAnnotation.State) => {
  // Process and increment
  return {
    iterations: 1,
    results: [`Result ${state.iterations + 1}`]
  };
};

const shouldContinueLoop = async (state: typeof LoopAnnotation.State) => {
  if (state.iterations < 5) {
    return "process";
  }
  return "__end__";
};

const loopGraph = new StateGraph(LoopAnnotation)
  .addNode("process", processLoop)
  .addEdge(START, "process")
  .addConditionalEdges("process", shouldContinueLoop)
  .compile();
```

### Nested Loop Pattern (Critical for µ-PATH)

This pattern shows how to implement nested loops like transcript → phase → GDU:

```typescript
const NestedLoopAnnotation = Annotation.Root({
  currentTranscriptIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
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
  transcripts: Annotation<Transcript[]>(),
  phases: Annotation<Phase[]>(),
  gdus: Annotation<GDU[]>()
});

// Outer loop controller (transcript level)
const transcriptController = async (state: typeof NestedLoopAnnotation.State) => {
  const { currentTranscriptIndex, transcripts } = state;
  
  if (currentTranscriptIndex < transcripts.length) {
    return {
      currentPhaseIndex: 0,
      currentGDUIndex: 0
    };
  }
  return {};
};

// Middle loop controller (phase level)
const phaseController = async (state: typeof NestedLoopAnnotation.State) => {
  const { currentPhaseIndex, phases, currentTranscriptIndex } = state;
  
  if (currentPhaseIndex < phases.length) {
    return {
      currentGDUIndex: 0
    };
  }
  return {
    currentTranscriptIndex: currentTranscriptIndex + 1,
    currentPhaseIndex: 0
  };
};

// Inner loop processor (GDU level)
const gduProcessor = async (state: typeof NestedLoopAnnotation.State) => {
  const { currentGDUIndex, gdus, currentPhaseIndex } = state;
  
  // Process GDU
  console.log(`Processing GDU ${currentGDUIndex} in phase ${currentPhaseIndex}`);
  
  return {
    currentGDUIndex: currentGDUIndex + 1
  };
};

// Routing functions
const routeTranscript = async (state: typeof NestedLoopAnnotation.State) => {
  return state.currentTranscriptIndex < state.transcripts.length 
    ? "phase_controller" 
    : "__end__";
};

const routePhase = async (state: typeof NestedLoopAnnotation.State) => {
  return state.currentPhaseIndex < state.phases.length 
    ? "gdu_processor" 
    : "transcript_controller";
};

const routeGDU = async (state: typeof NestedLoopAnnotation.State) => {
  return state.currentGDUIndex < state.gdus.length 
    ? "gdu_processor" 
    : "phase_controller";
};

// Build the nested loop graph
const nestedLoopGraph = new StateGraph(NestedLoopAnnotation)
  .addNode("transcript_controller", transcriptController)
  .addNode("phase_controller", phaseController)
  .addNode("gdu_processor", gduProcessor)
  .addEdge(START, "transcript_controller")
  .addConditionalEdges("transcript_controller", routeTranscript)
  .addConditionalEdges("phase_controller", routePhase)
  .addConditionalEdges("gdu_processor", routeGDU)
  .compile();
```

## Annotation System for State Management

### Complex State with Multiple Reducers

```typescript
const PipelineAnnotation = Annotation.Root({
  // Simple field with default
  pipelineId: Annotation<string>({
    default: () => crypto.randomUUID(),
  }),
  
  // Array with concatenation reducer
  messages: Annotation<Message[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Object with merge reducer
  metadata: Annotation<Record<string, any>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  
  // Numeric with sum reducer
  tokenCount: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0,
  }),
  
  // Latest value reducer (overwrites)
  currentPhase: Annotation<string>({
    reducer: (x: string, y: string) => (y ?? x),
  }),
  
  // Custom reducer for complex logic
  errors: Annotation<Error[]>({
    reducer: (existing, incoming) => {
      // Custom deduplication logic
      const errorMap = new Map(existing.map(e => [e.message, e]));
      incoming.forEach(e => errorMap.set(e.message, e));
      return Array.from(errorMap.values());
    },
    default: () => [],
  })
});
```

## Conditional Edges with Multiple Paths

### Advanced Routing Patterns

```typescript
// Multi-criteria routing
const complexRouter = async (state: typeof PipelineAnnotation.State) => {
  const { currentPhase, errors, messages } = state;
  
  // Error handling takes precedence
  if (errors.length > 0) {
    if (errors.some(e => e.message.includes("critical"))) {
      return "critical_error_handler";
    }
    return "error_recovery";
  }
  
  // Phase-based routing
  switch (currentPhase) {
    case "initialization":
      return messages.length > 0 ? "process_messages" : "wait_for_input";
    
    case "processing":
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.requiresReview) {
        return "human_review";
      }
      return "continue_processing";
    
    case "finalization":
      return state.metadata.skipValidation ? "__end__" : "validation";
    
    default:
      return "unknown_phase_handler";
  }
};

// Add with explicit mapping
graph.addConditionalEdges("router", complexRouter, {
  "critical_error_handler": "critical_error_node",
  "error_recovery": "error_recovery_node",
  "process_messages": "message_processor",
  "wait_for_input": "input_waiter",
  "human_review": "review_node",
  "continue_processing": "processor",
  "validation": "validator",
  "__end__": END,
  "unknown_phase_handler": "fallback_node"
});
```

### Branching and Merging Pattern

```typescript
// Fan-out to multiple nodes, then converge
const branchingGraph = new StateGraph(StateAnnotation)
  .addNode("splitter", splitterNode)
  .addNode("branch1", branch1Node)
  .addNode("branch2", branch2Node)
  .addNode("branch3", branch3Node)
  .addNode("merger", mergerNode)
  .addEdge(START, "splitter")
  .addConditionalEdges("splitter", (state) => {
    // Return array for parallel execution
    return ["branch1", "branch2", "branch3"];
  })
  .addEdge(["branch1", "branch2", "branch3"], "merger")
  .addEdge("merger", END)
  .compile();
```

## Checkpointing and Persistence

### Development Checkpointing

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const graph = workflow.compile({ 
  checkpointer,
  interruptBefore: ["human_review_node"] // Breakpoints
});

// Invoke with thread ID for persistence
const config = { 
  configurable: { 
    thread_id: "session-123",
    checkpoint_ns: "namespace-optional"
  } 
};

await graph.invoke(initialState, config);
```

### Production Checkpointing with PostgreSQL

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const checkpointer = new PostgresSaver(pool);

// First time setup
await checkpointer.setup();

const productionGraph = workflow.compile({ 
  checkpointer,
  store: new InMemoryStore() // For cross-thread memory
});
```

### Checkpoint Recovery Pattern

```typescript
// Resume after error
try {
  await graph.invoke(input, config);
} catch (error) {
  console.error("Execution failed:", error);
  
  // Get last checkpoint
  const checkpoint = await checkpointer.get(config);
  console.log("Last successful state:", checkpoint);
  
  // Resume from checkpoint
  await graph.invoke(null, config); // null input resumes
}
```

## Production-Ready Patterns

### Error Handling and Retries

```typescript
// Node-level retry policies
const graph = new StateGraph(StateAnnotation)
  .addNode("api_caller", apiCallerNode, { 
    retryPolicy: { 
      maxAttempts: 5,
      backoffFactor: 2,
      initialInterval: 1000 
    }
  })
  .addNode("db_query", dbQueryNode, { 
    retryPolicy: { 
      retryOn: (error: any) => {
        // Custom retry logic
        return error.code === 'SQLITE_BUSY' || 
               error.code === 'ECONNREFUSED';
      },
      maxAttempts: 3
    }
  })
  .compile();
```

### Recursion Limit Management

```typescript
import { GraphRecursionError } from "@langchain/langgraph";

const MAX_ITERATIONS = 100;
const recursionLimit = 2 * MAX_ITERATIONS + 1;

try {
  await graph.invoke(input, { recursionLimit });
} catch (error) {
  if (error instanceof GraphRecursionError) {
    console.log("Maximum iterations reached");
    // Handle gracefully
  } else {
    throw error;
  }
}
```

### Streaming and Progress Updates

```typescript
// Stream updates as they happen
const stream = await graph.stream(input, {
  streamMode: "values",
  configurable: { thread_id: "123" }
});

for await (const chunk of stream) {
  console.log("Progress update:", chunk);
  // Send to frontend via WebSocket/SSE
}
```

### Task Isolation for Side Effects

```typescript
import { task } from "@langchain/langgraph";

// Wrap side effects in tasks
const saveToDatabase = task("saveToDatabase", async (data: any) => {
  await db.collection("results").insertOne(data);
  return { saved: true };
});

const sendNotification = task("sendNotification", async (message: string) => {
  await emailService.send(message);
  return { sent: true };
});

// Use in workflow
const workflow = entrypoint({
  checkpointer,
  name: "pipeline"
}, async (input) => {
  const result = await processData(input);
  await saveToDatabase(result);
  await sendNotification("Processing complete");
  return result;
});
```

## Complete µ-PATH Pipeline Implementation Plan

### Architecture Overview

The µ-PATH pipeline will be implemented as a LangGraph.js StateGraph with:
- **28 nodes** (P_NEG1_1 through P6_1)
- **3 nested loops** (transcript, phase, GDU)
- **Conditional routing** based on single/multiple transcripts
- **State persistence** using PostgresSaver for production
- **Error handling** at each processing stage

### State Definition

```typescript
interface Transcript {
  id: string;
  content: string;
  metadata: Record<string, any>;
}

interface Phase {
  id: string;
  name: string;
  prompts: string[];
}

interface GDU {
  id: string;
  content: string;
  phaseId: string;
}

interface ProcessingResult {
  nodeId: string;
  output: any;
  timestamp: Date;
  errors?: Error[];
}

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
  
  // Processing state
  currentTranscriptIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
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
  
  isMultiTranscript: Annotation<boolean>({
    reducer: (x, y) => (y ?? x),
  }),
  
  // Results accumulator
  results: Annotation<ProcessingResult[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Phase data
  phases: Annotation<Phase[]>({
    default: () => [],
  }),
  
  // GDU data
  gdus: Annotation<GDU[]>({
    reducer: (a, b) => a.concat(b),
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
  
  // Token usage tracking
  totalTokens: Annotation<number>({
    reducer: (a, b) => a + b,
    default: () => 0,
  })
});
```

### Core Router Implementation

```typescript
const mainRouter = async (state: typeof UPathAnnotation.State) => {
  const { 
    currentPhase, 
    isMultiTranscript, 
    errors,
    currentTranscriptIndex,
    transcripts 
  } = state;
  
  // Error handling takes precedence
  if (errors.length > 0) {
    const hasCriticalError = errors.some(e => 
      e.message.includes("CRITICAL") || 
      e.message.includes("FATAL")
    );
    
    if (hasCriticalError) {
      return "error_handler";
    }
    // Non-critical errors might allow continuation
  }
  
  // Initial routing based on transcript count
  if (currentPhase === "initialization") {
    return transcripts.length > 1 ? "P_NEG1_1" : "P1_1";
  }
  
  // Phase-based routing
  if (currentPhase.startsWith("P")) {
    const phaseNum = parseInt(currentPhase.substring(1).split("_")[0]);
    
    // Multi-transcript path (P_NEG1_1 through P0_4)
    if (isMultiTranscript && phaseNum <= 0) {
      return routeMultiTranscriptPhase(state);
    }
    
    // Single transcript phases (P1_1 through P6_1)
    if (phaseNum >= 1 && phaseNum <= 6) {
      return routeSingleTranscriptPhase(state);
    }
  }
  
  // Check if all transcripts processed
  if (currentTranscriptIndex >= transcripts.length) {
    return "__end__";
  }
  
  // Default to error handler for unknown states
  return "error_handler";
};

const routeMultiTranscriptPhase = (state: typeof UPathAnnotation.State) => {
  const { currentPhase } = state;
  
  const multiTranscriptFlow = {
    "P_NEG1_1": "P_NEG1_2",
    "P_NEG1_2": "P_NEG1_3", 
    "P_NEG1_3": "P_NEG1_4",
    "P_NEG1_4": "P0_1",
    "P0_1": "P0_2",
    "P0_2": "P0_3",
    "P0_3": "P0_4",
    "P0_4": "P1_1" // Transition to single transcript processing
  };
  
  return multiTranscriptFlow[currentPhase] || "error_handler";
};

const routeSingleTranscriptPhase = (state: typeof UPathAnnotation.State) => {
  const { currentPhase, currentGDUIndex, gdus } = state;
  
  // Check if still processing GDUs
  if (currentGDUIndex < gdus.length) {
    return currentPhase; // Stay in current phase
  }
  
  // Move to next phase
  const singleTranscriptFlow = {
    "P1_1": "P1_2",
    "P1_2": "P1_3",
    "P1_3": "P1_4",
    "P1_4": "P2_1",
    "P2_1": "P3_1",
    "P3_1": "P3_2",
    "P3_2": "P3_3",
    "P3_3": "P4_1",
    "P4_1": "P5_1",
    "P5_1": "P5_2",
    "P5_2": "P6_1",
    "P6_1": "transcript_complete"
  };
  
  return singleTranscriptFlow[currentPhase] || "error_handler";
};
```

## Detailed Node and Edge Definitions

### Node Implementation Templates

```typescript
// Template for processing nodes
const createProcessingNode = (nodeId: string, processFunc: Function) => {
  return async (state: typeof UPathAnnotation.State) => {
    try {
      console.log(`Executing node: ${nodeId}`);
      
      const startTime = Date.now();
      const result = await processFunc(state);
      const endTime = Date.now();
      
      return {
        results: [{
          nodeId,
          output: result,
          timestamp: new Date(),
          processingTime: endTime - startTime
        }],
        currentPhase: nodeId,
        totalTokens: result.tokenUsage || 0
      };
    } catch (error) {
      console.error(`Error in node ${nodeId}:`, error);
      
      return {
        errors: [error as Error],
        currentPhase: nodeId
      };
    }
  };
};

// Specific node implementations
const P_NEG1_1_MultiTranscriptInit = createProcessingNode(
  "P_NEG1_1",
  async (state: typeof UPathAnnotation.State) => {
    const { transcripts } = state;
    
    // Initialize multi-transcript processing
    const analysis = await llm.invoke({
      messages: [{
        role: "system",
        content: "Analyze multiple transcripts for common themes"
      }, {
        role: "user",
        content: JSON.stringify(transcripts.map(t => t.content))
      }]
    });
    
    return {
      output: analysis,
      metadata: {
        transcriptCount: transcripts.length,
        initialized: true
      }
    };
  }
);

const P1_1_SingleTranscriptInit = createProcessingNode(
  "P1_1", 
  async (state: typeof UPathAnnotation.State) => {
    const { transcripts, currentTranscriptIndex } = state;
    const currentTranscript = transcripts[currentTranscriptIndex];
    
    // Extract GDUs from transcript
    const gduExtraction = await llm.invoke({
      messages: [{
        role: "system",
        content: "Extract GDUs from transcript"
      }, {
        role: "user", 
        content: currentTranscript.content
      }]
    });
    
    return {
      output: gduExtraction,
      gdus: gduExtraction.gdus || [],
      metadata: {
        transcriptId: currentTranscript.id,
        gduCount: gduExtraction.gdus?.length || 0
      }
    };
  }
);

// GDU processor template
const createGDUProcessor = (phaseId: string) => {
  return createProcessingNode(
    phaseId,
    async (state: typeof UPathAnnotation.State) => {
      const { gdus, currentGDUIndex } = state;
      const currentGDU = gdus[currentGDUIndex];
      
      // Process individual GDU
      const result = await llm.invoke({
        messages: [{
          role: "system",
          content: `Process GDU for phase ${phaseId}`
        }, {
          role: "user",
          content: currentGDU.content
        }]
      });
      
      return {
        output: result,
        currentGDUIndex: currentGDUIndex + 1,
        metadata: {
          gduId: currentGDU.id,
          phaseId
        }
      };
    }
  );
};
```

### Edge Configuration

```typescript
const buildUPathGraph = () => {
  const graph = new StateGraph(UPathAnnotation)
    // Multi-transcript nodes
    .addNode("P_NEG1_1", P_NEG1_1_MultiTranscriptInit)
    .addNode("P_NEG1_2", createProcessingNode("P_NEG1_2", multiTranscriptPhase2))
    .addNode("P_NEG1_3", createProcessingNode("P_NEG1_3", multiTranscriptPhase3))
    .addNode("P_NEG1_4", createProcessingNode("P_NEG1_4", multiTranscriptPhase4))
    .addNode("P0_1", createProcessingNode("P0_1", multiTranscriptSummary1))
    .addNode("P0_2", createProcessingNode("P0_2", multiTranscriptSummary2))
    .addNode("P0_3", createProcessingNode("P0_3", multiTranscriptSummary3))
    .addNode("P0_4", createProcessingNode("P0_4", multiTranscriptSummary4))
    
    // Single transcript nodes with GDU processing
    .addNode("P1_1", P1_1_SingleTranscriptInit)
    .addNode("P1_2", createGDUProcessor("P1_2"))
    .addNode("P1_3", createGDUProcessor("P1_3"))
    .addNode("P1_4", createGDUProcessor("P1_4"))
    .addNode("P2_1", createProcessingNode("P2_1", phase2Processor))
    .addNode("P3_1", createGDUProcessor("P3_1"))
    .addNode("P3_2", createGDUProcessor("P3_2"))
    .addNode("P3_3", createGDUProcessor("P3_3"))
    .addNode("P4_1", createProcessingNode("P4_1", phase4Processor))
    .addNode("P5_1", createProcessingNode("P5_1", phase5Processor1))
    .addNode("P5_2", createProcessingNode("P5_2", phase5Processor2))
    .addNode("P6_1", createProcessingNode("P6_1", finalProcessor))
    
    // Control nodes
    .addNode("router", routerNode)
    .addNode("error_handler", errorHandlerNode)
    .addNode("transcript_complete", transcriptCompleteNode)
    
    // Initial edge
    .addEdge(START, "router")
    
    // Conditional routing from main router
    .addConditionalEdges("router", mainRouter, {
      "P_NEG1_1": "P_NEG1_1",
      "P1_1": "P1_1",
      "error_handler": "error_handler",
      "__end__": END
    })
    
    // Multi-transcript flow edges
    .addEdge("P_NEG1_1", "P_NEG1_2")
    .addEdge("P_NEG1_2", "P_NEG1_3")
    .addEdge("P_NEG1_3", "P_NEG1_4")
    .addEdge("P_NEG1_4", "P0_1")
    .addEdge("P0_1", "P0_2")
    .addEdge("P0_2", "P0_3")
    .addEdge("P0_3", "P0_4")
    .addEdge("P0_4", "P1_1")
    
    // Single transcript phase transitions with GDU loops
    .addConditionalEdges("P1_1", gduLoopRouter)
    .addConditionalEdges("P1_2", gduLoopRouter)
    .addConditionalEdges("P1_3", gduLoopRouter)
    .addConditionalEdges("P1_4", gduLoopRouter)
    .addEdge("P2_1", "P3_1")
    .addConditionalEdges("P3_1", gduLoopRouter)
    .addConditionalEdges("P3_2", gduLoopRouter)
    .addConditionalEdges("P3_3", gduLoopRouter)
    .addEdge("P4_1", "P5_1")
    .addEdge("P5_1", "P5_2")
    .addEdge("P5_2", "P6_1")
    .addEdge("P6_1", "transcript_complete")
    .addEdge("transcript_complete", "router")
    
    // Error recovery
    .addEdge("error_handler", "router");
    
  return graph;
};

// GDU loop router
const gduLoopRouter = async (state: typeof UPathAnnotation.State) => {
  const { currentGDUIndex, gdus, currentPhase } = state;
  
  if (currentGDUIndex < gdus.length) {
    return currentPhase; // Continue in same phase
  }
  
  // Reset GDU index and move to next phase
  return "next_phase";
};
```

## Implementation Code Templates

### Complete Pipeline Implementation

```typescript
import { 
  StateGraph, 
  Annotation, 
  START, 
  END,
  MemorySaver,
  PostgresSaver
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import pg from "pg";

// Initialize LLM
const llm = new ChatOpenAI({
  model: "gpt-4-turbo-preview",
  temperature: 0.7
});

// Production setup
const setupProduction = async () => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const checkpointer = new PostgresSaver(pool);
  await checkpointer.setup();
  
  return checkpointer;
};

// Development setup
const setupDevelopment = () => {
  return new MemorySaver();
};

// Main pipeline class
class UPathPipeline {
  private graph: any;
  private checkpointer: any;
  
  constructor(isProd: boolean = false) {
    this.setupCheckpointer(isProd);
    this.buildGraph();
  }
  
  private async setupCheckpointer(isProd: boolean) {
    this.checkpointer = isProd 
      ? await setupProduction()
      : setupDevelopment();
  }
  
  private buildGraph() {
    this.graph = buildUPathGraph().compile({
      checkpointer: this.checkpointer,
      interruptBefore: ["human_review"] // Optional breakpoints
    });
  }
  
  async process(transcripts: Transcript[], threadId?: string) {
    const config = {
      configurable: {
        thread_id: threadId || crypto.randomUUID(),
        recursionLimit: 1000 // Prevent infinite loops
      }
    };
    
    const initialState = {
      transcripts,
      isMultiTranscript: transcripts.length > 1,
      currentPhase: "initialization"
    };
    
    try {
      // Stream results
      const stream = await this.graph.stream(initialState, {
        ...config,
        streamMode: "values"
      });
      
      const results = [];
      for await (const chunk of stream) {
        console.log("Progress:", chunk.currentPhase);
        results.push(chunk);
      }
      
      return results[results.length - 1]; // Final state
      
    } catch (error) {
      if (error.name === "GraphRecursionError") {
        console.error("Max recursion reached");
        // Handle gracefully
      }
      throw error;
    }
  }
  
  async resume(threadId: string, input?: any) {
    const config = {
      configurable: { thread_id: threadId }
    };
    
    return await this.graph.invoke(input || null, config);
  }
  
  async getState(threadId: string) {
    const config = {
      configurable: { thread_id: threadId }
    };
    
    return await this.graph.getState(config);
  }
}

// Usage
const pipeline = new UPathPipeline(process.env.NODE_ENV === "production");

// Process transcripts
const results = await pipeline.process([
  { id: "1", content: "Transcript 1 content", metadata: {} },
  { id: "2", content: "Transcript 2 content", metadata: {} }
]);

// Get processing state
const state = await pipeline.getState(results.threadId);
console.log("Current state:", state);
```

### Error Recovery Implementation

```typescript
const errorHandlerNode = async (state: typeof UPathAnnotation.State) => {
  const { errors, currentPhase } = state;
  
  console.error("Handling errors:", errors);
  
  // Categorize errors
  const criticalErrors = errors.filter(e => 
    e.message.includes("CRITICAL") || 
    e.message.includes("FATAL")
  );
  
  const recoverableErrors = errors.filter(e => 
    !criticalErrors.includes(e)
  );
  
  if (criticalErrors.length > 0) {
    // Log to monitoring service
    await logToMonitoring({
      level: "critical",
      errors: criticalErrors,
      phase: currentPhase,
      state: state
    });
    
    // Mark pipeline as failed
    return {
      metadata: {
        ...state.metadata,
        failed: true,
        failureReason: criticalErrors[0].message
      },
      currentPhase: "failed"
    };
  }
  
  // Attempt recovery for non-critical errors
  if (recoverableErrors.length > 0) {
    // Clear errors and retry
    return {
      errors: [], // Clear errors
      metadata: {
        ...state.metadata,
        retryCount: (state.metadata.retryCount || 0) + 1
      }
    };
  }
  
  return state;
};
```

### Human-in-the-Loop Integration

```typescript
import { interrupt } from "@langchain/langgraph";

const humanReviewNode = async (state: typeof UPathAnnotation.State) => {
  const { results, currentPhase } = state;
  
  // Prepare review data
  const reviewData = {
    phase: currentPhase,
    results: results.slice(-5), // Last 5 results
    timestamp: new Date()
  };
  
  // Interrupt for human review
  const reviewResult = interrupt({
    data: reviewData,
    prompt: "Please review the processing results",
    options: ["approve", "reject", "modify"]
  });
  
  if (reviewResult.action === "approve") {
    return {
      metadata: {
        ...state.metadata,
        humanReviewed: true,
        reviewedAt: new Date()
      }
    };
  } else if (reviewResult.action === "reject") {
    return {
      errors: [new Error("Human review rejected")],
      currentPhase: "rejected"
    };
  } else if (reviewResult.action === "modify") {
    return {
      results: reviewResult.modifiedResults,
      metadata: {
        ...state.metadata,
        humanModified: true
      }
    };
  }
};
```

### Performance Monitoring

```typescript
const addPerformanceMonitoring = (node: Function, nodeName: string) => {
  return async (state: typeof UPathAnnotation.State) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await node(state);
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      // Track performance metrics
      const metrics = {
        nodeName,
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        timestamp: new Date()
      };
      
      // Log to monitoring service
      await logMetrics(metrics);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          performance: metrics
        }
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      await logMetrics({
        nodeName,
        duration: endTime - startTime,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  };
};
```

## Best Practices Summary

1. **State Management**
   - Use Annotation.Root with appropriate reducers
   - Keep state immutable
   - Use default values for all fields

2. **Error Handling**
   - Wrap all nodes in try-catch
   - Use retry policies for external calls
   - Implement graceful degradation

3. **Performance**
   - Set appropriate recursion limits
   - Use streaming for real-time updates
   - Monitor token usage

4. **Testing**
   - Test each node in isolation
   - Test routing logic separately
   - Use MemorySaver for test environments

5. **Production Deployment**
   - Use PostgresSaver for persistence
   - Implement monitoring and logging
   - Set up error alerting

This comprehensive guide provides all the patterns and implementations needed for the µ-PATH pipeline migration to LangGraph.js.