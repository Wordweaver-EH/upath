# Guiding Principles: TDD and Tidy First

This document establishes the development methodology for the µ-PATH migration. It must be followed precisely.

---

## ROLE AND EXPERTISE

You are a senior software engineer who follows Kent Beck's Test-Driven Development (TDD) and Tidy First principles. Your purpose is to guide development following these methodologies precisely.

## CORE DEVELOPMENT PRINCIPLES

- Always follow the TDD cycle: Red → Green → Refactor
- Write the simplest failing test first
- Implement the minimum code needed to make tests pass
- Refactor only after tests are passing
- Follow Beck's "Tidy First" approach by separating structural changes from behavioral changes
- Maintain high code quality throughout development

## TDD METHODOLOGY GUIDANCE

- Start by writing a failing test that defines a small increment of functionality
- Use meaningful test names that describe behavior (e.g., "shouldSumTwoPositiveNumbers")
- Make test failures clear and informative
- Write just enough code to make the test pass - no more
- Once tests pass, consider if refactoring is needed
- Repeat the cycle for new functionality

## TIDY FIRST APPROACH

- Separate all changes into two distinct types:
1. STRUCTURAL CHANGES: Rearranging code without changing behavior (renaming, extracting methods, moving code)
2. BEHAVIORAL CHANGES: Adding or modifying actual functionality
- Never mix structural and behavioral changes in the same commit
- Always make structural changes first when both are needed
- Validate structural changes do not alter behavior by running tests before and after

## COMMIT DISCIPLINE

- Only commit when:
1. ALL tests are passing
2. ALL compiler/linter warnings have been resolved
3. The change represents a single logical unit of work
4. Commit messages clearly state whether the commit contains structural or behavioral changes
- Use small, frequent commits rather than large, infrequent ones

## CODE QUALITY STANDARDS

- Eliminate duplication ruthlessly
- Express intent clearly through naming and structure
- Make dependencies explicit
- Keep methods small and focused on a single responsibility
- Minimize state and side effects
- Use the simplest solution that could possibly work

## REFACTORING GUIDELINES

- Refactor only when tests are passing (in the "Green" phase)
- Use established refactoring patterns with their proper names
- Make one refactoring change at a time
- Run tests after each refactoring step
- Prioritize refactorings that remove duplication or improve clarity

## EXAMPLE WORKFLOW

When approaching a new feature:
1. Write a simple failing test for a small part of the feature
2. Implement the bare minimum to make it pass
3. Run tests to confirm they pass (Green)
4. Make any necessary structural changes (Tidy First), running tests after each change
5. Commit structural changes separately
6. Add another test for the next small increment of functionality
7. Repeat until the feature is complete, committing behavioral changes separately from structural ones

Follow this process precisely, always prioritizing clean, well-tested code over quick implementation.

Always write one test at a time, make it run, then improve structure. Always run all the tests (except long-running tests) each time.

---
---

# µ-PATH Migration Plan (Junior Developer Edition)

## Introduction

This plan will guide you through upgrading the µ-PATH application from a simple prototype to a robust, secure, and scalable full-stack application. We will do this in phases, making sure the application works at every step.

Each phase has a clear goal and a set of tasks. For the more complex parts, there are links to supplementary documents that explain the concepts in more detail.

---

## Phase 0: Foundation & Security (Critical Priority)

**Goal:** Fix the biggest security problem in the app: the exposed API key. We will create a simple backend server to act as a secure proxy between our frontend and the Gemini API.

**For more details on why we're doing this, see:** [Supplementary Doc: Backend Architecture](./plan/00_backend_architecture.md)

### Tasks

1.  **Create the Backend Project Structure:**
    *   In your terminal, at the root of the `upath` project, create a new directory for our backend code: `mkdir upath-backend`

2.  **Initialize the Node.js Project:**
    *   Navigate into the new directory: `cd upath-backend`
    *   Create a `package.json` file: `npm init -y`

3.  **Install Backend Dependencies:**
    *   Run this command to install the web server (`fastify`), security middleware (`@fastify/cors`), and environment variable loader (`dotenv`):
        ```bash
        npm install fastify @fastify/cors dotenv
        ```

4.  **Install Development Dependencies:**
    *   Run this command to install tools that help us with TypeScript and running the server during development:
        ```bash
        npm install -D typescript @types/node tsx nodemon
        ```

5.  **Install AI-Related Dependencies:**
    *   These will be used by the backend to talk to the Gemini API and to build our pipeline in Phase 2.
        ```bash
        npm install @google/generative-ai @langchain/core langgraph
        ```

6.  **Create the Backend Source Files:**
    *   Inside `upath-backend`, create the `src` directory and the subdirectories and files as shown in the original plan. For now, you can leave the files empty. We will add content in the next steps.

7.  **Implement the Secure API Proxy:**
    *   Copy the code from the original plan into `upath-backend/src/routes/analyze.ts` and `upath-backend/src/index.ts`. This code sets up the Fastify server and the `/api/analyze` route that will securely call the Gemini API.

8.  **Update the Frontend Service:**
    *   In the **frontend** code, modify `services/geminiService.ts`. Remove the direct `GoogleGenAI` calls. Instead, make it `fetch` from our new backend endpoint (`http://localhost:3001/api/analyze`). The original plan has the code for this.

9.  **Test the Changes:**
    *   Start the backend server: `cd upath-backend && npm run dev` (you will need to add this script to your `package.json`).
    *   Start the frontend dev server.
    *   Verify that the application still works. The frontend should now be talking to your local backend, not directly to Google.

---

## Phase 1: Frontend State Refactoring

**Goal:** Clean up the frontend's state management. We will break down the single, massive `pipelineStore` into smaller, more manageable stores.

**For more details on why we're doing this, see:** [Supplementary Doc: Frontend State Refactoring](./plan/01_state_refactoring.md)

### Current Status: IN PROGRESS (Started 2025-07-09)

**Completed:**
- ✅ TranscriptStore and AnalysisResultStore extracted and functional
- ✅ Service functions extracted from processSingleStep (reduced from 500+ to ~241 lines)
- ✅ 2/8 consumers migrated (useAutorunManager.ts, SessionRestoreNotification.tsx)
- ✅ Autosave integration tests fixed for multi-store architecture
- ✅ Store composition layer with coordinateRehydration implemented

**Active Sub-Plan: Strangler Fig Migration Completion**

### Phase 1 Sub-Plan: COMPLETED (2025-07-10)
**Goal:** Extract stores and services from monolithic pipelineStore

**Completed Phases:**
- ✅ Phase 1: TranscriptStore and AnalysisResultStore extraction
- ✅ Phase 2: PromptHistoryStore extraction 
- ✅ Phase 3: Service extraction (13 services created)
- ✅ Phase 4: PipelineOrchestrationStore and integration
- ✅ Test fixes after manual cleanup (423/435 passing)

**Services Created:**
- StepParameterValidationService
- StepContextPreparationService
- StepInputPreparationService
- StepExecutionService
- PromptHistoryService
- StepErrorHandlingService
- StepSuccessHandlingService
- PipelineOrchestrator
- PipelineInvalidationService
- PipelineNavigationService
- PipelineStateService
- FileManagementService
- ExportService

### Phase 5: Complete Strangler Fig Pattern (IN PROGRESS - Started 2025-07-10)
**Goal:** Extract all remaining logic from pipelineStore into services

**5.1 Extract Navigation and State Management Services (2 days)**
- [ ] Create enhanced PipelineNavigationService (extract getNextStepDetails, processNextStep)
- [ ] Create enhanced StateInvalidationService (extract invalidateStateFromStep, getInvalidatedStates)
- [ ] Create PipelineStateManagementService (loadState, getSaveState, resetPipeline)
- [ ] Create PipelineUIService (UI-specific methods)

**5.2 Consolidate File Operations (1 day)**
- [ ] Extend FileManagementService with remaining file operations
- [ ] Extend ExportService with remaining export operations

**5.3 Create Master PipelineService (2 days)**
- [ ] Create PipelineService composing all services
- [ ] Refactor pipelineStore to pure state container (< 200 lines)

**5.4 Integration and Migration (2 days)**
- [ ] Update all components to use PipelineService
- [ ] Fix remaining tests
- [ ] Performance verification
- [ ] Documentation updates

### Success Criteria:
1. pipelineStore.ts reduced to < 200 lines (only essential orchestration)
2. All 8 consumers using new architecture
3. No duplicate implementations
4. All tests passing
5. Performance equal or better than before
6. Clear separation of concerns

### Risk Mitigation:
- Each phase maintains working application
- Comprehensive testing at each step
- Gradual migration with rollback points
- Preserve all existing functionality

### Estimated Timeline: 10-12 days from start

---

---

## Phase 2: LangGraph.js Backend Migration

**Goal:** Replace the hardcoded pipeline logic in the frontend with a flexible and robust graph-based pipeline on the backend using LangGraph.js.

**For more details on why we're doing this, see:** [Supplementary Doc: LangGraph.js Migration](./plan/02_langgraph_migration.md)

### Tasks

1.  **Define Graph Nodes:**
    *   In the backend, create a `src/services/graph/nodes.ts` file. Each function in this file will represent one step (a "node") of our analysis pipeline.

2.  **Define the Graph:**
    *   In `src/services/graph/index.ts`, use LangGraph's `StateGraph` to define the pipeline. Add the nodes you created and define the edges that connect them.

3.  **Create a New Streaming API Endpoint:**
    *   In the backend, add a new route, `/api/analyze/graph`. This route will invoke the LangGraph and stream its state updates back to the frontend.

4.  **Integrate with the Frontend:**
    *   Create a new hook in the frontend, `useGraphAnalysis.ts`. This hook will call the new `/api/analyze/graph` endpoint and process the streamed updates, feeding them into the `useGraphStateStore`.

---

## Phase 3: UI/UX Enhancements

**Goal:** Improve the user interface by replacing static visualizations with dynamic ones and rendering outputs in a more structured way.

### Tasks

1.  **Install React Flow:**
    *   `npm install reactflow`

2.  **Create the PipelineFlow Component:**
    *   Create a new component, `components/visualizations/PipelineFlow.tsx`.
    *   Use the `reactflow` library to render the pipeline graph. The nodes in the flow should get their status (e.g., `running`, `completed`, `error`) from the `useGraphStateStore`.

3.  **Create the AnalysisTable Component:**
    *   Create a new component, `components/outputs/AnalysisTable.tsx`.
    *   This component will be a reusable table for displaying structured analysis data, making the output easier to read than a simple text dump.