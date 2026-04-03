# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Configuration Architecture Overview

This directory contains the pipeline configuration system that drives the µ-PATH analysis workflow.

### Directory Structure:
- **pipelineDefinition.ts**: Central pipeline orchestration and step ordering
- **pipeline/**: Individual step configurations organized by analysis phase
  - **partNeg1/**: Pre-processing (variable identification)
  - **part0/**: Data preparation (transcript refinement, utterance selection)
  - **part1/**: Diachronic analysis (P1.1-P1.5)
  - **part2/**: Synchronic analysis (P2S.1-P2S.4)
  - **types.ts**: Shared types for pipeline configuration

### Pipeline Architecture:

#### Step Configuration Pattern:
Each step module exports a configuration object with:
```typescript
{
  id: StepId,
  getInput: (state) => InputData | { error: string },
  generatePrompt: (input, settings) => PromptConfig,
  component?: React.Component // Optional UI component
}
```

#### Execution Flow:
1. **Pre-processing** (partNeg1): Variable identification from transcripts
2. **Data Preparation** (part0): Clean and structure raw transcript data
3. **Diachronic Analysis** (part1): Temporal structure analysis
   - P1.1: Initial segmentation into minimal units
   - P1.2: Coarse phase tagging
   - P1.3: Intra-phase sorting
   - P1.4: Diachronic unit grouping
   - P1.5: Construct specific diachronic structure
4. **Synchronic Analysis** (part2): Thematic structure analysis
   - P2S.1: Group utterances by topic
   - P2S.2: Identify specific synchronic units
   - P2S.3: Define synchronic structure
   - P2S.4: Generate summary table

### Key Design Principles:
1. **Modular Steps**: Each step is self-contained with clear input/output contracts
2. **Error Handling**: Steps validate prerequisites via `getInput` function
3. **Prompt Engineering**: Each step generates structured prompts for LLM processing
4. **Type Safety**: All configurations use TypeScript for compile-time validation
5. **Iteration Support**: Steps can iterate per-transcript, per-DU, or globally

### Pipeline Execution:
- Steps are executed sequentially with dependency validation
- Failed steps block downstream processing
- State is preserved between steps in the pipeline store
- Supports pause/resume with checkpoint restoration

### Known Complexities:
- Step dependencies must be explicitly managed
- Prompt generation requires careful schema definition
- Some steps have multiple iteration patterns (per-transcript vs per-DU)
- Error recovery requires understanding the full pipeline state

## Critical Methodological References (2025-07-28)

The pipeline configuration in this directory implements micro-phenomenological analysis based on two key manuals:

1. **`manual_kev.md`** - Sheldrake & Dienes simplified approach for hypothesis generation
2. **`manual_2018.md`** - Valenzuela-Moguillansky & Vásquez-Rosati rigorous analysis procedure

### Key Implementation Principles

- **Diachronic before Synchronic**: Always identify temporal moments (IDUs) before themes within moments (ISUs)
- **Preserve Utterance Numbers**: Critical for traceability back to original transcripts
- **Non-Leading Prompts**: Never presuppose content exists (e.g., "identify IF there are patterns" not "identify the patterns")
- **Recursive Refinement**: Each pipeline step may require revisiting previous steps based on discoveries

### Pipeline Stage Mapping

- **Part 1 (P1.x)**: Segmentation and initial diachronic grouping
- **Part 2 (P2.x)**: Synchronic analysis within diachronic units
- **Part 3 (P3.x)**: Structure building and abstraction
- **Part 4 (P4.x)**: Cross-participant generic analysis

When modifying pipeline steps, always consult the `micro-phenomenology-consultant` agent for methodological validation.
