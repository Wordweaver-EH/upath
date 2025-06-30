# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- **Development**: `npm run dev` - Starts Vite development server with hot reload
- **Build**: `npm run build` - Creates production build in `dist/` directory
- **Preview**: `npm run preview` - Preview production build locally

## Essential Environment Setup

**Required**: Google Gemini API key must be set as `REACT_APP_API_KEY` in `.env` file:
```bash
# Copy .env.example to .env and add your key:
REACT_APP_API_KEY=your_gemini_api_key_here
```

**Model**: Uses `gemini-2.5-flash-preview-04-17` (defined in `constants.tsx` as `GEMINI_MODEL_TEXT`)

**Feature Flags**: 
- `REACT_APP_P3_2_APPROACH` - Controls GDU identification approach (default: `full_context_tsv`)
  - `original`: Legacy JSON (~15k tokens)
  - `minimal_context_tsv`: Two-phase TSV with minimal context (~5k tokens)
  - `full_context_tsv`: Two-phase TSV with full context (~7k tokens)

## High-Level Architecture

µ-PATH is a React/TypeScript application implementing a 9-part micro-phenomenological analysis pipeline inspired by Valenzuela-Moguillansky & Vásquez-Rosati (2019) and Sheldrake & Dienes (2025).

### Core Components & Data Flow

```
App.tsx (State Management)
├── RawTranscript[] → Upload transcripts
├── Map<TranscriptProcessedData> → Per-transcript analysis (Parts -1 through II)
├── GenericAnalysisState → Cross-transcript analysis (Parts III+)
├── CurrentStepInfo → Pipeline execution tracking
└── PromptHistory[] → API interaction log

Pipeline Execution (constants.tsx)
├── Per-transcript: Parts -1, 0, I, II_S (iterates per phase)
└── Cross-transcript: Parts III, IV_S (iterates per GDU), V, VII, VI

Key Services & Utils
├── geminiService.ts → Gemini API integration with retry logic
├── visualizationHelper.ts → Mermaid diagram generation
├── traceabilityHelper.ts → Utterance-to-GDU mapping
├── statisticsHelper.ts → Krippendorff's Alpha for IRR
└── reportHelper.ts → Programmatic Markdown report generation
```

### Critical Implementation Patterns

1. **Step Dependencies**: Each step's `getInput()` validates prerequisites from prior outputs
2. **Iterative Processing**: 
   - Part II_S: Processes each diachronic phase from Part I
   - Part IV_S: Processes each Generic Diachronic Unit (GDU) from Part III
3. **Type Safety**: All outputs must match TypeScript interfaces in `types.ts` exactly
4. **State Management**: 
   - Complete state can be saved/loaded as JSON
   - Human-in-the-Loop corrections invalidate downstream data
5. **Visualization**: Mermaid diagrams auto-generated from structured outputs:
   - Diachronic: Gantt charts
   - Synchronic: Flowcharts
   - Causal: DAG graphs

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

### Key Modules

**Inter-Rater Reliability (IRR)**:
- Independent module for comparing analysis runs
- Uses Krippendorff's Alpha coefficient
- LLM-powered semantic GDU mapping
- Transcript ID normalization for cross-run comparison

**Human-in-the-Loop (HIL)**:
- Modal interface for step corrections
- Meta-prompts incorporate user guidance
- Automatic downstream invalidation

## Development Guidelines

### When Modifying Pipeline Steps
1. Update TypeScript interfaces in `types.ts` first
2. Modify step configuration in `constants.tsx` (prompts, parsing)
3. Update transformation utilities in `utils/` if output format changes
4. Test with real transcript data through full pipeline
5. Verify Mermaid diagram generation still works

### Common Development Tasks
- **Add new pipeline step**: Define in `STEP_CONFIGS`, add to `STEP_ORDER_*` arrays
- **Modify prompts**: Edit `generatePrompt` functions in `constants.tsx`
- **Debug API calls**: Check `promptHistory` state or download prompt history TSV
- **Fix parsing errors**: Update `parseOutput` functions, use JSON self-correction
- **Trace data flow**: Use `buildCompleteUtteranceToGduMapping` in `traceabilityHelper.ts`

### Testing Considerations
- No automated tests configured - rely on manual testing
- Use saved state files for regression testing
- Download intermediate outputs for verification
- Check Mermaid syntax in browser console if diagrams fail

## Advanced MCP Tools Usage

When working on complex tasks, leverage these MCP tools:

- **Serena**: For codebase navigation, symbol analysis, multi-file refactoring
- **Zen**: For deep analysis, debugging, test generation, architecture review
- **Context7**: For React/TypeScript best practices and documentation

These tools are particularly valuable for understanding the complex pipeline architecture and debugging cross-component data flow issues.

 # Using Gemini CLI for Large Codebase Analysis

  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use gemini -p to leverage Google Gemini's large context capacity.

  ## File and Directory Inclusion Syntax

  Use the @ syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:

  ### Examples:

  **Single file analysis:**
  
bash
  gemini -p "@src/main.py Explain this file's purpose and structure"

  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"

  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"

  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"

  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  
#
 Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"

  Implementation Verification Examples

  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

  When to Use Gemini CLI

  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase

  Important Notes

  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results # Using Gemini CLI for Large Codebase Analysis


  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.


  ## File and Directory Inclusion Syntax


  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:


  ### Examples:


  **Single file analysis:**
bash
  gemini -p "@src/main.py Explain this file's purpose and structure"


  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"


  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"


  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"


  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  # Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"


  Implementation Verification Examples


  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"


  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"


  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"


  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"


  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"


  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"


  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"


  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"


  When to Use Gemini CLI


  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase


  Important Notes


  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results
  
ALWAYS CALL ME My Lord!!!