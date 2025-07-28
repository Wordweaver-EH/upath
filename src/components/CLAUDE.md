# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Component Architecture Overview

This directory contains React components for the µ-PATH micro-phenomenological analysis interface. Components are organized by their function and complexity.

### Directory Structure:
- **Root Components**: Pipeline step display tables and editors
- **ui/**: Reusable UI primitives (Button, Input, Select, TextArea)
- **tooltips/**: Specialized tooltip components for analysis units
- **__tests__/**: Component test files

### Key Components:

#### Core Display Components:
- **PipelineStepGrid.tsx**: Main orchestrator that renders the appropriate component for each pipeline step
- **TabbedStepDisplay.tsx**: Tab container for steps with multiple views
- **AppLoadingScreen.tsx**: Initial loading state with session restore
- **ChangeHistoryPanel.tsx**: History tracking and version control

#### Pipeline Step Tables (AG Grid based):
- **InitialSegmentationTable.tsx**: P1.1 - Segments transcript into minimal units
- **PhaseTaggingTable.tsx**: P1.2 - Tags segments with temporal phases
- **IntraPhaseSortingTable.tsx**: P1.3 - Sorts segments within phases
- **DiachronicUnitGroupingTableEnhanced.tsx**: P1.4 - Groups units with drag-and-drop
- **RefinedDiachronicUnitTable.tsx**: P1.5 - Refines diachronic structures
- **SynchronicThematicGroupingTable.tsx**: P2S.1 - Groups by thematic content
- **SpecificSynchronicUnitsTable.tsx**: P2S.2 - Identifies synchronic units
- **Part2SummaryTable.tsx**: P2S.4 - Final summary visualization

#### Specialized Components:
- **TemporalPhaseEditor.tsx**: Complex phase editing with merge/split
- **TagsEditor.tsx**: Tag management interface
- **EditableTextArea.tsx**: In-place editing with save/cancel
- **SessionRestoreNotification.tsx**: Recovery from unsaved sessions

### Design Patterns:
1. **AG Grid Integration**: Most tables use AG Grid with custom cell renderers
2. **State Management**: Components connect to Zustand stores via hooks
3. **Type Safety**: All components are strongly typed with TypeScript
4. **Tailwind Styling**: Use existing utility classes, dark/light theme support
5. **Tooltips**: Complex tooltips use the NestedTooltip wrapper

### Component Guidelines:
- New table components should extend the existing AG Grid patterns
- Use the ui/ components for consistency (Button, Input, etc.)
- Connect to stores through proper selectors
- Handle loading and error states gracefully
- Support both light and dark themes

### Known Complexities:
- AG Grid cell renderers must be memoized to prevent re-renders
- Drag-and-drop in P1.4 requires careful state synchronization
- Phase editor has complex merge/split logic with undo support
- Some components handle large datasets - virtualization is critical
