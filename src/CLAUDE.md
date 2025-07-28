# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Frontend Architecture Overview

The µ-PATH frontend is a React/TypeScript application for micro-phenomenological analysis of interview transcripts.

### Technology Stack:
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand with Immer
- **UI Components**: Custom components + AG Grid
- **Styling**: Tailwind CSS
- **Testing**: Vitest
- **API Integration**: Gemini via backend proxy

### Application Structure:

```
src/
├── components/     # React components (tables, editors, UI)
├── config/         # Pipeline configuration and step definitions
├── services/       # Business logic and orchestration
├── stores/         # Zustand state management
├── utils/          # Helper functions and utilities
├── hooks/          # Custom React hooks
├── styles/         # CSS and theming
└── types/          # TypeScript type definitions
```

### Core Concepts:

1. **Pipeline Architecture**: The app implements a multi-step analysis pipeline:
   - Pre-processing (Part -1): Variable identification
   - Data Preparation (Part 0): Transcript refinement
   - Diachronic Analysis (Part 1): Temporal structure (P1.1-P1.5)
   - Synchronic Analysis (Part 2): Thematic structure (P2S.1-P2S.4)

2. **State Management**: Zustand stores manage:
   - Pipeline execution state and outputs
   - UI state (views, modals, preferences)
   - Settings (API keys, models)
   - History and session data

3. **Component Hierarchy**:
   - App.tsx → PipelineStepGrid → Individual step components
   - Each step has its own specialized table/editor component
   - Shared UI components in components/ui/

4. **Data Flow**:
   - User uploads transcript → Pipeline processes steps → Results displayed
   - Each step validates inputs from previous steps
   - Outputs are stored in pipeline store
   - Results can be exported as encrypted files

### Key Features:
- Multi-transcript support with batch processing
- Drag-and-drop file uploads
- Real-time pipeline execution with progress tracking
- Session persistence and recovery
- Encrypted data export/import
- Comprehensive reporting and visualization

### Security Considerations:
- API keys stored in backend only
- All Gemini API calls proxied through backend
- Sensitive data can be encrypted for export
- No direct browser access to LLM APIs

### Performance Optimizations:
- AG Grid virtualization for large datasets
- Memoized components and selectors
- Lazy loading of pipeline steps
- Debounced state updates

### Development Guidelines:
1. Always use TypeScript - no `any` types
2. Follow existing component patterns
3. Use Zustand stores for global state
4. Test all new features with Vitest
5. Maintain dark/light theme support
6. Keep components focused and modular
