# µ-PATH Migration Plan: TDD and Tidy First Principles

**Navigation:** [📚 Docs Home](README.md) | [📋 Current Work](current/) | [🔧 Patterns](patterns/) | [📚 Educational](plan/)

**Last Updated:** 2025-07-12  
**Current Status:** Phase 2 - LangGraph Migration (67% Complete)

This document establishes the development methodology for the µ-PATH migration and provides the overall strategic approach.

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

## CRITICAL CONTEXT FOR PHASE 2

**Phase 2 is a MIGRATION from MVP to production-ready architecture.** The µ-PATH application has a working MVP implementation that needs to be migrated to LangGraph for:

1. **Better architecture** - Graph-based orchestration instead of imperative flow
2. **Improved error handling** - Built-in retry and recovery mechanisms  
3. **State management** - Proper checkpointing and session handling
4. **Future scalability** - Foundation for parallel execution and advanced features

When implementing Phase 2:
- Study the existing implementation to understand the logic
- Implement the same functionality with LangGraph's patterns
- Improve reliability and maintainability
- Take the opportunity to clean up technical debt from MVP
- Output formats should match what the frontend expects (but can be improved if needed)

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

## Current Migration Status

### ✅ Phase 0: Backend Security Implementation (COMPLETED)
**Goal:** Fix critical API key exposure vulnerability  
**Status:** COMPLETED 2025-07-08  
**Result:** Secure backend proxy implemented with Fastify

### ✅ Phase 1: Frontend State Refactoring (COMPLETED)
**Goal:** Extract all logic from monolithic pipelineStore into services  
**Status:** COMPLETED 2025-07-10  
**Result:** Domain-specific stores implemented using Strangler Fig pattern

### 🚧 Phase 2: LangGraph Migration (IN PROGRESS - 67% Complete)
**Goal:** Replace hardcoded pipeline with robust graph-based architecture  
**Status:** ACTIVE - Part I Complete  
**Progress:**
- ✅ **Core Infrastructure**: GraphExecutor, NodeRegistry, SessionStore implemented
- ✅ **Part I Nodes**: 8/8 implemented (P_NEG1_1 through P1_4)
- ✅ **IV/DV Context Threading**: Verified working across all nodes
- ✅ **Test Coverage**: 248 tests passing with comprehensive TDD
- ⚠️ **Critical Issues**: 4 identified requiring immediate attention
- ⏳ **Part II**: 7 remaining nodes (P2S, P3, P4S, P5, COMPLETE)

**Next Steps:**
1. Address critical production issues (memory leak, error handling, security)
2. Implement Part II nodes (synchronic and generic analysis)
3. Create API endpoints for graph execution
4. Frontend integration

### ⏳ Phase 3: Production Deployment (PENDING)
**Goal:** Deploy LangGraph system to production with full monitoring  
**Status:** PENDING Phase 2 completion  
**Prerequisites:** All critical issues resolved, verification testing complete

---

---

## Phase 2: LangGraph.js Backend Migration (DETAILED DOCS)

**Goal:** Replace the hardcoded pipeline logic in the frontend with a flexible and robust graph-based pipeline on the backend using LangGraph.js.

**📋 Current Implementation Documents:**
- **[Phase 2 Implementation Guide](current/PHASE-2-IMPLEMENTATION-GUIDE.md)** - Detailed progress and step-by-step plan
- **[Phase 2 Technical Specification](current/PHASE-2-TECHNICAL-SPEC.md)** - Comprehensive technical blueprint
- **[Production Readiness Checklist](current/PRODUCTION-READINESS.md)** - Critical issues and fixes

**📚 Background Information:**
- **[LangGraph Migration Explanation](plan/02_langgraph_migration.md)** - Why we're using LangGraph.js

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

---

**Related Documents:**
- [📚 Documentation Home](README.md) - Complete project overview and navigation
- [📋 Phase 2 Implementation Guide](current/PHASE-2-IMPLEMENTATION-GUIDE.md) - Current active development
- [🔧 Store Migration Pattern](patterns/STORE-MIGRATION-PATTERN.md) - Proven migration patterns
- [📚 Backend Architecture](plan/00_backend_architecture.md) - Why we created the backend
- [📚 State Refactoring](plan/01_state_refactoring.md) - Domain-specific stores explanation

**Next Actions:**
- Review [Production Readiness Checklist](current/PRODUCTION-READINESS.md) for critical issues
- Follow [Phase 2 Implementation Guide](current/PHASE-2-IMPLEMENTATION-GUIDE.md) for Part II development