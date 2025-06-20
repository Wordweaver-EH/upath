# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- **Development**: `npm run dev` - Starts Vite development server
- **Build**: `npm run build` - Creates production build  
- **Preview**: `npm run preview` - Preview production build

## Essential Environment Setup

This application requires a Google Gemini API key configured as `process.env.API_KEY`. The app will not function without this key being set in the environment.

**Model Configuration**: Uses `gemini-2.5-flash-preview-04-17` (defined in `constants.tsx` as `GEMINI_MODEL_TEXT`).

## Core Architecture

µ-PATH is a React-based web application for automated micro-phenomenological interview analysis. The architecture centers around:

### State Management Pattern
- **Global State**: Managed in `App.tsx` with multiple state objects:
  - `rawTranscripts`: Array of uploaded interview transcripts
  - `processedDataMap`: Map tracking per-transcript analysis results  
  - `genericAnalysisState`: Cross-transcript analysis results
  - `currentStepInfo`: Current pipeline execution status
  - `promptHistory`: All API interactions for debugging/export

### Pipeline Architecture
- **Sequential Processing**: Analysis follows a strict 9-part pipeline defined in `constants.tsx`
- **Per-transcript vs Generic Steps**: Parts -1 through II process individual transcripts; Parts III+ work across all transcripts
- **Step Configuration**: Each step has input validation, prompt generation, and output parsing logic in `STEP_CONFIGS`

### Key Data Flow
1. **Upload** → `RawTranscript[]` 
2. **Per-transcript Analysis** → `TranscriptProcessedData` (Parts -1, 0, I, II)
3. **Generic Analysis** → `GenericAnalysisState` (Parts III, IV, V, VII, VI)
4. **Visualization** → Mermaid diagrams generated from structured outputs
5. **Export** → Multiple formats (JSON, TSV, Markdown, HTML)

### Component Organization
- `App.tsx`: Main application logic and state management
- `components/`: UI components (controls, visualizations, status displays)
- `services/geminiService.ts`: Google Gemini API integration
- `utils/`: Data transformation utilities (TSV export, HTML generation, Mermaid conversions)
- `constants.tsx`: Pipeline configuration and prompts
- `types.ts`: Comprehensive TypeScript interfaces for all data structures

### Critical Patterns
- **State Persistence**: Complete application state can be saved/loaded as JSON
- **Human-in-the-Loop**: Users can provide guidance to re-run steps with corrections
- **Iterative Processing**: Parts II and IV iterate over phases/GDUs respectively
- **Error Handling**: Each step tracks success/error states separately
- **Mermaid Integration**: Structured data automatically generates interactive diagrams

### Data Structure Hierarchy
```
RawTranscript
├── TranscriptProcessedData (per-transcript results)
│   ├── Parts -1,0,I outputs
│   └── Part II: P2SPhaseData (per-phase results)
└── GenericAnalysisState (cross-transcript results)
    ├── Parts III,V,VII,VI outputs  
    └── Part IV: outputs per-GDU
```

## Pipeline Implementation Notes

The analysis pipeline follows a strict 9-part sequence detailed in `pipeline.md`:
- **Parts -1 to II**: Per-transcript analysis (Variable ID → Data Prep → Specific Diachronic → Specific Synchronic)  
- **Parts III+**: Cross-transcript analysis (Generic Diachronic → Generic Synchronic → Refinement → Causal Modeling → Report)

**Critical Implementation Details**:
- **Step Dependencies**: Each step's `getInput()` function validates prerequisites and constructs input from prior outputs
- **Iterative Steps**: Parts II and IV process multiple phases/GDUs respectively using `current_phase_for_p2s_processing` and `current_gdu_for_p4s_processing` tracking
- **Output Validation**: All outputs must match TypeScript interfaces in `types.ts` exactly - the system includes JSON parsing self-correction
- **Mermaid Generation**: Structured outputs automatically generate diagrams via `utils/visualizationHelper.ts`

When modifying analysis steps, ensure outputs match the expected TypeScript interfaces in `types.ts` and update corresponding transformation utilities in `utils/`.