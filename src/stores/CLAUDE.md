# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Store Architecture Overview

This directory contains Zustand stores that manage the application's global state. The stores follow a dependency injection pattern to avoid circular imports.

### Store Files:
- **pipelineStore.ts**: Core state management for the multi-step analysis pipeline. This is the most complex store, handling:
  - Pipeline execution flow
  - Step outputs and state transitions
  - File uploads and data persistence
  - Encryption/decryption of analysis data
  - Integration with Gemini API for analysis steps

- **uiStore.ts**: UI-specific state including:
  - Active views and layout
  - Modal states
  - File drop handling
  - UI preferences and interaction states

- **settingsStore.ts**: Application settings including:
  - API keys (stored securely)
  - Model selection preferences
  - Processing options
  - User preferences

- **historyStore.ts**: Manages analysis history and session data

- **irrStore.ts**: Specialized store for IRR (Inter-Rater Reliability) analysis features

### Key Design Decisions:
1. **Dependency Injection**: Stores are initialized through `index.ts` to manage inter-store dependencies properly. The UI store receives callbacks from the pipeline store.

2. **Immer Integration**: All stores use Immer for immutable state updates. MapSet support is enabled for complex data structures.

3. **Type Safety**: Each store exports strongly-typed hooks and selectors. Never use `any` types.

4. **Persistence**: Some stores persist data to localStorage or handle encrypted file exports.

### Common Patterns:
- Use selectors (e.g., `selectCurrentStepDisplay`) for computed values
- Actions should be pure and handle errors gracefully
- Complex operations should be broken into smaller, testable functions
- Always validate input data before state updates

### Known Complexities:
- Pipeline store has intricate step dependencies - changes to one step may cascade
- File encryption/decryption must maintain backward compatibility
- UI store file drop callback injection prevents circular dependencies
