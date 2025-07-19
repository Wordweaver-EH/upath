# Problem Statement: Implementing Part 1 Diachronic Analysis Pipeline Improvements

## Context

We have a working micro-phenomenological analysis pipeline (µ-PATH) built in React/TypeScript that processes interview transcripts through multiple analytical steps. The pipeline is already functional and includes:

- A modular step configuration system
- State management with Zustand
- Pipeline orchestration for autorun functionality
- Interactive UI with tables, tooltips, and data visualization
- Gemini API integration for LLM-based analysis

## Current State of Part 1 (Diachronic Analysis)

Part 1 currently has 4 implemented steps:
1. **P1.1**: Initial Segmentation - breaks utterances into minimal action units
2. **P1.2**: Diachronic Unit Identification - groups segments into coherent moments (DUs)
3. **P1.3**: Refine Diachronic Units - assigns temporal phases and refines units
4. **P1.4**: Construct Specific Diachronic Structure - creates final structure with visualization

However, based on expert review and our refined understanding, we need to restructure Part 1 to have 5 steps with clearer separation of concerns.

## Proposed New Structure

### Step P1.1: Initial Segmentation
- **Current**: Already implemented
- **Needed Change**: Update prompt to include concrete examples of implicit temporal markers:
  - Sequence of distinct verbs ("I noticed... I felt... I realized...")
  - Progression indicators ("The sensation grew stronger")
  - Transition markers ("My attention shifted")
  - Implied causal language ("Because of this...", "This led to...", "As a result...")

### Step P1.2: Diachronic Unit Identification (DU)
- **Current**: Already implemented
- **No changes needed**: Keep as is

### Step P1.3: Temporal Phase Assignment (NEW)
- **Current**: This functionality is currently bundled inside P1.3
- **Needed**: Create a new separate step that ONLY assigns phase types to DUs
- **Input**: P1.2 output enriched with original segment text
- **Output**: DUs with assigned phase_type (Onset, Development_n, Peak_n, etc.)

### Step P1.4: Refine Diachronic Units (RDU)
- **Current**: Currently named P1.3
- **Needed Changes**: 
  - Rename current P1.3 to P1.4
  - Update to work with phase-grouped DUs
  - Add `merge_justification` field for transparency
  - Implement the sophisticated merging logic based on phase grouping

### Step P1.5: Construct Specific Diachronic Structure (SDS)
- **Current**: Currently P1.4
- **Needed Changes**:
  - Rename to P1.5
  - Keep the programmatic table generation
  - Add validation logic to check sequence coherence

## Technical Implementation Requirements

1. **File Structure Changes**:
   - Current files in `src/config/pipeline/part1/`:
     - `initialSegmentation.ts` (P1.1)
     - `diachronicUnitId.ts` (P1.2)
     - `refineDiachronicUnits.ts` (current P1.3, becomes P1.4)
     - `constructSpecificDiachronicStructure.ts` (current P1.4, becomes P1.5)
   - Need to add:
     - `temporalPhaseAssignment.ts` (new P1.3)

2. **Type Updates**:
   - Add new types for P1.3 input/output
   - Update existing types to support the new flow
   - Ensure `merge_justification` field is added to RDU type

3. **Pipeline Configuration**:
   - Update `STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC` in constants
   - Update step configurations in the pipeline
   - Ensure proper data flow between steps

4. **UI Components**:
   - The existing table display for P1.4 (becoming P1.5) should continue to work
   - May need to update tooltip components to show merge justifications

5. **Data Flow**:
   - P1.1 → P1.2 → P1.3 → P1.4 → P1.5
   - P1.3 enriches DUs with phase types
   - P1.4 groups by phase type before refinement
   - P1.5 aggregates and validates

## Constraints

1. **Backward Compatibility**: We need to handle existing processed data gracefully
2. **Minimal UI Changes**: The user experience should remain consistent
3. **Maintain Traceability**: All source IDs and relationships must be preserved
4. **No Breaking Changes**: The rest of the pipeline (Parts 2-7) must continue to work

## Success Criteria

1. Part 1 has 5 distinct steps with clear separation of concerns
2. P1.1 prompt includes comprehensive temporal marker examples
3. P1.3 (new) performs only phase assignment
4. P1.4 implements sophisticated phase-grouped merging with justifications
5. P1.5 includes validation logic
6. All existing functionality continues to work
7. The interactive table with recursive tooltips remains functional

## Available Resources

- Full codebase in TypeScript/React
- Existing pipeline infrastructure
- Working Gemini API integration
- Comprehensive type system
- Modular configuration system

## Deliverables Needed

1. Implementation plan with specific code changes
2. Updated type definitions
3. New step configuration for P1.3
4. Modified prompts for P1.1 and P1.4
5. Validation logic for P1.5
6. Migration strategy for existing data

Please provide a detailed implementation plan that addresses all these requirements while maintaining the existing system's functionality and user experience.