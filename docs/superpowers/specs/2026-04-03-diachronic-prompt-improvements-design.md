# Diachronic Pipeline Prompt Improvements

**Date:** 2026-04-03
**Scope:** P1.3, P1.4, P1.5 — diachronic analysis path only
**Approach:** Prompt fixes (P1.3, P1.4) + structural conversion (P1.5)
**Model target:** Gemini 3 Flash Lite (weakest model first)

## Problem Statement

Comparing the pipeline's output against human ground-truth analyses (p1s1, p2s1, p3s1, p5s1), three systematic gaps emerge in the diachronic path:

1. **Under-segmentation (P1.4):** The pipeline produces fewer DUs than the human analyst. The human creates a new IDU whenever the *experiential mode* changes; the pipeline merges segments that are thematically related but experientially distinct.

2. **Temporal misordering (P1.3):** The pipeline doesn't sufficiently distinguish between the order segments were mentioned in the interview and the order events occurred in the experience. Segments get placed by interview position rather than experience chronology.

3. **No hinge points (P1.5):** The current P1.5 is a programmatic step that splits DUs into mechanical thirds (Initial/Development/Concluding). The human analyst identifies concrete, causal hinge points between every pair of adjacent IDUs and names phases based on content.

## Design

### Change 1: P1.3 — Temporal Ordering Prompt

**File:** `src/config/pipeline/part1/P1_3_intraPhaSorting.ts`
**What changes:** The `generatePhaseSpecificPrompt` function's prompt text.

**Current instruction (problematic):**
> "re-order these segments into their correct chronological sequence"

**New instruction adds:**
- Explicit statement that interview order ≠ experience order — participants jump around, elaborate, and circle back
- Guidance to reconstruct experience order using: causal relationships, temporal language, logical prerequisites
- No transcript-specific examples

**What stays the same:** Per-phase iteration structure, output schema (`sorted_segments` with `chronological_index`), all TypeScript types.

### Change 2: P1.4 — DU Granularity Prompt

**File:** `src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts`
**What changes:** The `generatePrompt` function's prompt text.

**Current instruction (problematic):**
> "Group consecutive segments that describe the same continuous moment, action, or thought process"

This favours lumping over splitting. The model merges segments that are thematically related but represent different experiential states.

**New instruction:**
- Reframe around *experiential mode changes* — a new DU is needed when the participant's way of engaging with the experience shifts, even if the topic hasn't changed
- Enumerate shift types (generalised from all four ground-truth analyses):
  - Agency shifts: doing/effortful → receiving/passive (or vice versa)
  - A new sensory or perceptual quality emerging
  - Spontaneous/involuntary events occurring
  - Mid-experience reflective or evaluative moments
- State a "prefer splitting" bias without prescribing a target DU count
- Instruct DU descriptions to be concise and descriptive of the experiential state (not theoretical labels)

**What stays the same:** Input/output schema, `unit_id` format, `source_segment_ids` structure, all TypeScript types.

### Change 3: P1.5 — Convert to LLM Step

**File:** `src/config/pipeline/part1/P1_5_constructSpecificDiachronicStructure.ts`
**Also:** `types.ts` (add `HingePoint` interface)

**Current state:** Programmatic step (`isJsonOutput: false`, no `generatePrompt`). Splits DUs into mechanical thirds.

**New state:** LLM step (`isJsonOutput: true`, `generatePrompt` restored).

**Prompt instructs the LLM to:**
- Group DUs into phases with content-derived names (not "Beginning/Middle/End")
- Identify a hinge point between each pair of adjacent phases: what shifted and what precipitated it
- Produce a narrative summary of the experience's temporal arc

**Type changes:**
- Add `HingePoint` interface to `types.ts`:
  ```typescript
  interface HingePoint {
    from_phase: string;
    to_phase: string;
    transition_description: string;
    trigger?: string;
    source_du_ids?: string[];
  }
  ```
- Add optional `hinge_points` field to `SpecificDiachronicStructureType`

**`getInput` changes:** Returns raw P1.4 data instead of calling `programmaticallyConstructSds()`.

**Schema:** Added `responseSchema` with phases, hinge_points, diachronic_units (pass-through).

**What stays the same:** The `P1_5_Output` interface shape. Downstream consumers reading `p1_5_output.specific_diachronic_structure.phases` are unaffected. `hinge_points` is optional so existing saved sessions won't break.

## What This Does NOT Change

- P1.1 (segmentation) and P1.2 (phase tagging) prompts — no issues identified there
- P2S.1 and P2S.2 (synchronic analysis) — deferred; expected to improve passively from better DU boundaries
- Output schemas and TypeScript types (except adding `HingePoint`)
- Pipeline orchestration logic in `pipelineStore.ts` (P1.5 will be detected as a normal LLM step because `generatePrompt` exists)
- No target DU counts or transcript-specific examples in any prompt

## Risks

- **Flash Lite may struggle with P1.5 schema complexity:** The hinge points + phases + DU pass-through is a moderately complex JSON output. Mitigation: `responseSchema` constrains the output shape.
- **Over-splitting:** The "prefer splitting" bias might cause the model to create too many tiny DUs. Mitigation: the prompt frames it as experiential mode changes, not arbitrary breaks.
- **P1.5 LLM call adds latency/cost:** One extra Gemini call per transcript. Acceptable given the quality improvement.

## Validation

After implementation, re-run p1s1.txt through the pipeline with Flash Lite and compare against the xlsx ground truth. Key metrics:
- DU count closer to 9 (was 6)
- Temporal ordering of DUs matches human's sequence
- Hinge points present and semantically meaningful
- Phase names content-derived, not generic

Then spot-check with a second transcript (e.g., p2s1 or p3s1) to confirm generalisation.
