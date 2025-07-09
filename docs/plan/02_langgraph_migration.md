# Supplementary Doc: LangGraph.js Migration

This document explains the LangGraph.js migration in Phase 2.

## The Problem: A Brittle, Hardcoded Pipeline

Currently, the 9-step analysis pipeline is managed inside the massive `pipelineStore.ts` file on the frontend. The logic for calling one step after another is hardcoded. If we want to add a new step, remove a step, or change the order, we have to make complex and risky changes to this file.

This is like a factory assembly line where all the machines are welded together. If one machine breaks or you want to add a new station, you have to shut everything down and perform major surgery.

## The Solution: LangGraph.js for Orchestration

**LangGraph.js** is a library specifically designed for building robust, stateful, multi-step applications with Large Language Models (LLMs). It allows us to define our pipeline as a **graph**.

Think of it as a modern, flexible assembly line where each station is a self-contained module, and a central computer tells the parts where to go next.

### Key Concepts

-   **Nodes:** Each step in our analysis (e.g., "Variable Identification," "Data Preparation") will become a **node** in the graph. A node is just a function that performs a single, specific task.
-   **Edges:** We will define **edges** that connect these nodes, telling the system which step should run after another.
-   **State:** The graph maintains a central **state** object. As each node runs, it can read from the state and write its results back to the state. This means we don't have to pass data around manually; it's all managed by the graph.
-   **Conditional Edges:** LangGraph allows for smart routing. For example, we can define an edge that says, "*If* the user selected 'DV-only' mode, go from the start directly to the `dataPreparation` node, skipping `variableIdentification`." This makes the pipeline incredibly flexible.
-   **Streaming:** We can "stream" the state of the graph back to the frontend in real-time. This is a huge UX win, as it allows us to show the user exactly which step is currently running and display results as they become available.

### Why This is Better

1.  **Modularity:** Each step is an independent function. It's easy to test, modify, or even replace a node without affecting the rest of the pipeline.
2.  **Flexibility:** Changing the pipeline flow is as simple as redefining the edges. No more complex, hardcoded logic.
3.  **Observability:** We can easily log the state after every step, making it much easier to debug problems.
4.  **Resilience:** The graph can be designed to handle errors, retry steps, or even wait for human input (Human-in-the-Loop).
5.  **Backend Logic:** By moving this complex logic to the backend, we make the frontend simpler. The frontend's only job is to start the analysis and receive real-time updates.
