# Supplementary Doc: Frontend State Refactoring

This document explains the state management changes in Phase 1 of the migration.

## What is "State"?

In a React application, "state" is all the data that can change over time and that the UI needs to display. This includes:

-   The transcripts the user has uploaded.
-   The results from each step of the analysis.
-   Whether a loading spinner should be visible.
-   Which theme (light or dark) is active.

## The Problem: A Single, Giant Store

Currently, our application uses a tool called **Zustand** to manage all of its state. That's good, but it puts *all* of the application's data into a single, massive file called `pipelineStore.ts`.

This is like keeping all your clothes—shirts, pants, socks, jackets—in one giant, disorganized drawer. It works when you only have a few items, but as your wardrobe grows, it becomes impossible to find anything.

This monolithic approach has several problems:

-   **Hard to Understand:** A single file with thousands of lines of code is overwhelming.
-   **Easy to Break:** Making a change to one part of the state can accidentally break a completely unrelated part of the application.
-   **Poor Performance:** Components might re-render unnecessarily because they are subscribed to the entire giant store, even if they only care about one small piece of data that didn't change.

## The Solution: Domain-Specific Stores

We are going to refactor this single store into multiple, smaller, focused stores. Each store will be responsible for one specific "domain" or area of the application.

Think of this as organizing your clothes into separate, labeled drawers: one for shirts, one for socks, etc. It's much easier to find what you need and to add new clothes without messing up the other drawers.

Our new stores will be:

-   `transcriptStore.ts`: Manages only the raw transcript data.
-   `graphStateStore.ts`: Tracks the real-time status of the analysis pipeline (which node is running, etc.). This will be very important for Phase 2.
-   `analysisResultStore.ts`: Stores the processed data and final reports from the analysis.
-   `uiStore.ts`: Handles UI-related state like loading indicators, modals, and themes.

### How This Helps

-   **Clarity:** Each file has a clear, single purpose.
-   **Safety:** Changes are isolated. Modifying the `uiStore` is unlikely to break the `transcriptStore`.
-   **Performance:** Components can subscribe to just the data they need, preventing unnecessary re-renders.
-   **Scalability:** It's much easier to add new features when the state is organized this way.
