# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- **Development**: `npm run dev` - Starts Vite development server with hot reload
- **Build**: `npm run build` - Creates production build in `dist/` directory
- **Preview**: `npm run preview` - Preview production build locally
- **Test**: `npm run test` - Run tests with Vitest
- **Test UI**: `npm run test:ui` - Run tests with Vitest UI interface
- **Test Once**: `npm run test:run` - Run tests once and exit

## Essential Environment Setup

**Required**: Google Gemini API key must be set as `REACT_APP_API_KEY` in `.env` file:
```bash
# Copy .env.example to .env and add your key:
REACT_APP_API_KEY=your_gemini_api_key_here
```

**Model**: Uses `gemini-2.5-flash-preview-04-17` (defined in `constants.tsx` as `GEMINI_MODEL_TEXT`)

**Feature Flags**: 
- `REACT_APP_P3_2_APPROACH` - Controls GDU identification approach (default: `original`)
  - `original`: Legacy JSON (~15k tokens)
  - `minimal_context_tsv`: Two-phase TSV with minimal context (~5k tokens)
  - `full_context_tsv`: Two-phase TSV with full context (~7k tokens)

## High-Level Architecture

µ-PATH is a React/TypeScript application implementing a 9-part micro-phenomenological analysis pipeline inspired by Valenzuela-Moguillansky & Vásquez-Rosati (2019) and Sheldrake & Dienes (2025).

### State Management Architecture (Zustand)

The application uses **Zustand** with **4 specialized stores** to avoid circular dependencies:

```typescript
// Store hierarchy and responsibilities
src/stores/
├── pipelineStore.ts    # Core pipeline data, transcript processing, step execution
├── uiStore.ts          # UI state, themes, modals, current step tracking
├── settingsStore.ts    # Configuration (API keys, model parameters)
└── irrStore.ts         # Inter-rater reliability analysis workflows
```

**Key Patterns**:
- **Dependency injection** pattern prevents circular dependencies between stores
- **Selective subscriptions** with fine-grained state selectors for performance
- **Immutable updates** using Immer for complex nested state
- **Automatic downstream invalidation** when earlier steps are corrected

### Pipeline Processing Architecture

**Sequential Processing**: 9-part pipeline with two distinct processing modes:

1. **Per-transcript analysis** (Parts -1, 0, I, II_S): Iterates through each transcript
2. **Cross-transcript analysis** (Parts III, IV_S, V, VII, VI): Processes aggregated data

**Iterative Sub-processing**:
- **Part II_S**: Processes each diachronic phase from Part I
- **Part IV_S**: Processes each Generic Diachronic Unit (GDU) from Part III

### Core Components & Data Flow

```
App.tsx (Main orchestrator)
├── State Management
│   ├── RawTranscript[] → Upload transcripts
│   ├── Map<TranscriptProcessedData> → Per-transcript analysis (Parts -1 through II)
│   ├── GenericAnalysisState → Cross-transcript analysis (Parts III+)
│   ├── CurrentStepInfo → Pipeline execution tracking
│   └── PromptHistory[] → API interaction log
├── Pipeline Execution (constants.tsx)
│   ├── Per-transcript: Parts -1, 0, I, II_S (iterates per phase)
│   └── Cross-transcript: Parts III, IV_S (iterates per GDU), V, VII, VI
└── Key Services & Utils
    ├── services/geminiService.ts → Gemini API integration with retry logic
    ├── src/utils/visualizationHelper.ts → Mermaid diagram generation
    ├── src/utils/traceabilityHelper.ts → Utterance-to-GDU mapping
    ├── src/utils/statisticsHelper.ts → Krippendorff's Alpha for IRR
    └── src/utils/reportHelper.ts → Programmatic Markdown report generation
```

### Critical Implementation Patterns

1. **Step Dependencies**: Each step's `getInput()` validates prerequisites from prior outputs
2. **Type Safety**: All outputs must match TypeScript interfaces in `types.ts` exactly
3. **Human-in-the-Loop (HIL)**: 
   - Modal interface for step corrections
   - Meta-prompts incorporate user guidance
   - Automatic downstream invalidation
4. **Visualization Integration**: 
   - Mermaid.js diagrams auto-generated from structured outputs
   - Theme-aware rendering with automatic diagram re-rendering

### Pipeline Parts Summary

1. **Part -1**: Variable Identification (IV/DV extraction)
2. **Part 0**: Data Preparation (utterance selection)
3. **Part I**: Specific Diachronic Analysis (temporal structure)
4. **Part II_S**: Specific Synchronic Analysis (per phase)
5. **Part III**: Generic Diachronic (cross-transcript patterns)
6. **Part IV_S**: Generic Synchronic (per GDU)
7. **Part V**: Refinement (IV analysis & holistic review)
8. **Part VII**: Causal Modeling (DAG construction)
9. **Part VI**: Report Generation (programmatic Markdown)

### Inter-Rater Reliability (IRR) Module

**Independent module** for comparing analysis runs:
- Uses Krippendorff's Alpha coefficient for reliability assessment
- LLM-powered semantic GDU mapping for different GDU sets
- Transcript ID normalization for cross-run comparison
- Comprehensive disagreement analysis with export options

## Development Guidelines

### When Modifying Pipeline Steps
1. Update TypeScript interfaces in `types.ts` first
2. Modify step configuration in `constants.tsx` (prompts, parsing)
3. Update transformation utilities in `src/utils/` if output format changes
4. Test with real transcript data through full pipeline
5. Verify Mermaid diagram generation still works

### Key File Locations
- **Step configurations**: `constants.tsx` (prompts, parsing, validation)
- **Type definitions**: `types.ts` (all pipeline output interfaces)
- **State management**: `src/stores/` (Zustand stores)
- **Utilities**: `src/utils/` (helper functions, calculations)
- **UI components**: `components/` (React components)

### Testing Strategy
- **Vitest** with jsdom environment for React testing
- **Manual testing** with real transcript data (no automated e2e tests)
- **State persistence** for regression testing (save/load JSON states)
- **Download intermediate outputs** for verification

### Common Development Tasks
- **Add new pipeline step**: Define in `STEP_CONFIGS`, add to `STEP_ORDER_*` arrays
- **Modify prompts**: Edit `generatePrompt` functions in `constants.tsx`
- **Debug API calls**: Check `promptHistory` state or download prompt history TSV
- **Fix parsing errors**: Update `parseOutput` functions, use JSON self-correction
- **Trace data flow**: Use `buildCompleteUtteranceToGduMapping` in `traceabilityHelper.ts`

## Advanced Features

### Mermaid.js Integration
- **Diachronic structures**: Gantt charts for temporal analysis
- **Synchronic structures**: Flowcharts for structural analysis
- **Causal models**: Directed graphs for DAG visualization
- **Theme synchronization**: Diagrams automatically update with light/dark mode

### Human-in-the-Loop System
- **Natural language corrections**: Users provide guidance to improve AI outputs
- **Meta-prompt generation**: Incorporates user feedback into subsequent API calls
- **Downstream invalidation**: Automatically resets dependent data when corrections are made

### State Management Features
- **Complete state persistence**: Save/load entire application state as JSON
- **Version compatibility**: State files include version information
- **Selective autodownload**: Automatically download essential analysis outputs
- **Token usage tracking**: Monitor API usage and performance metrics