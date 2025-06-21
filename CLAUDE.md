# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- **Development**: `npm run dev` - Starts Vite development server
- **Build**: `npm run build` - Creates production build  
- **Preview**: `npm run preview` - Preview production build

## Essential Environment Setup

This application requires a Google Gemini API key configured as `process.env.API_KEY`. The app will not function without this key being set in the environment.

**Model Configuration**: Uses `gemini-2.5-flash-preview-04-17` (defined in `constants.tsx` as `GEMINI_MODEL_TEXT`).

### Feature Flags

**P3_2 Implementation Approaches**: The application supports multiple P3_2 implementation approaches via the `REACT_APP_P3_2_APPROACH` environment variable:

- **original**: Legacy JSON approach with full IV analysis (~15k tokens)
- **minified**: Compressed JSON approach with IV analysis (~10k tokens)  
- **minimal_context_tsv**: Two-phase TSV with minimal P3.1 context + IV analysis (~5k tokens)
- **full_context_tsv**: Two-phase TSV with full P3.1 context + IV analysis (~7k tokens)
- **zero_context_tsv**: Two-phase TSV with no P3.1 context + IV analysis (~4k tokens)

Set in `.env` file: `REACT_APP_P3_2_APPROACH=full_context_tsv`

**IV Analysis Implementation**: All approaches now include Independent Variable (IV) analysis:
- LLM analyzes how IV conditions influence RDU manifestations
- TSV approaches include `iv_details` column with IV information
- Programmatic aggregation synthesizes IV variation notes from individual RDU classifications
- Enables comprehensive A/B testing with full feature parity across all approaches

**Implementation Notes**:
- All non-original approaches use two-phase architecture: LLM classification + programmatic aggregation
- Validation prevents hallucinated RDU IDs by checking against source data
- IV analysis synthesis combines observations from multiple RDUs per GDU group

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

## Claude Code Tooling Guidelines

**Use Advanced MCP Tools When Appropriate**:
- **Serena**: Use for complex codebase analysis, symbol navigation, code refactoring, and multi-file operations. Particularly valuable for understanding the pipeline architecture and component relationships.
- **Zen**: Use for deep analysis, code review, debugging complex issues, test generation, and architectural planning. Excellent for validating pipeline implementations and analyzing data flow patterns.
- **Context7**: Use for accessing up-to-date documentation and best practices for React, TypeScript, Vite, and other frameworks used in this project.

These tools provide enhanced capabilities beyond standard file operations and should be leveraged for non-trivial development tasks, especially when working with the complex pipeline architecture or debugging cross-component data flow issues.