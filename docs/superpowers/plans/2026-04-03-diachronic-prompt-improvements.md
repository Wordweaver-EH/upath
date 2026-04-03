# Diachronic Prompt Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve diachronic analysis quality (P1.3, P1.4, P1.5) to match human analyst ground truth, targeting Gemini 3 Flash Lite.

**Architecture:** Three changes on the diachronic path — two prompt-only edits (P1.3 temporal ordering, P1.4 DU granularity) and one structural conversion (P1.5 from programmatic thirds-split to LLM step with hinge points). No pipeline orchestrator changes needed.

**Tech Stack:** TypeScript, Gemini API via Fastify backend, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-04-03-diachronic-prompt-improvements-design.md`

---

### Task 1: Add HingePoint type to types.ts

**Files:**
- Modify: `types.ts:147-153` (SpecificDiachronicStructureType)

This task adds the type infrastructure needed by Task 4 (P1.5 conversion). Done first so later tasks can import it.

- [ ] **Step 1: Add HingePoint interface and update SpecificDiachronicStructureType**

In `types.ts`, find this block (around line 147):

```typescript
export interface SpecificDiachronicStructureType {
    summary: string;
    phases: SpecificDiachronicPhase[];
    validation_errors?: string[];
    visualization_hint?: string;
    iv_preliminary_observation?: string;
}
```

Replace with:

```typescript
export interface HingePoint {
    from_phase: string;
    to_phase: string;
    transition_description: string;
    trigger?: string;
    source_du_ids?: string[];
}
export interface SpecificDiachronicStructureType {
    summary: string;
    phases: SpecificDiachronicPhase[];
    hinge_points?: HingePoint[];
    validation_errors?: string[];
    visualization_hint?: string;
    iv_preliminary_observation?: string;
}
```

`hinge_points` is optional so existing saved sessions and downstream consumers (`DiachronicStructureComparison.tsx`, `phaseTracingHelper.ts`) are unaffected.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "hinge\|P1_5"`
Expected: No new errors related to HingePoint or P1_5.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add HingePoint type to SpecificDiachronicStructureType"
```

---

### Task 2: Improve P1.3 temporal ordering prompt

**Files:**
- Modify: `src/config/pipeline/part1/P1_3_intraPhaSorting.ts:5-31` (generatePhaseSpecificPrompt)

- [ ] **Step 1: Update the prompt text in generatePhaseSpecificPrompt**

In `src/config/pipeline/part1/P1_3_intraPhaSorting.ts`, find the `generatePhaseSpecificPrompt` function. Replace the entire return string (lines 6-31) with:

```typescript
  return `You are a micro-phenomenological data analyst. You will be given a list of interview segments that all belong to the ${phaseName} phase. Your task is to re-order these segments into the chronological order of the ORIGINAL EXPERIENCE.

IMPORTANT — Interview Order vs Experience Order:
Participants do not recount events in the order they happened. They jump around, elaborate, and circle back. A segment mentioned early in the interview may describe something that happened late in the experience, and vice versa. Your job is to reconstruct the order in which things actually happened during the experience, using these cues:
- Causal relationships: causes precede effects
- Temporal language: "at first", "then", "after that", "eventually"
- Logical prerequisites: noticing something must precede reflecting on it; an action must precede awareness of its result

Input:
A list of segmented utterances belonging to the ${phaseName} phase.
Phase segments: ${JSON.stringify(segments, null, 2)}

Instructions:
1. For each segment, determine WHEN in the experience it actually occurred, ignoring its position in the interview transcript.
2. Assign a \`chronological_index\` based on experience order. The sequence starts from 1 for this specific list.
3. Simultaneous events should share the same index.
4. Provide a \`placement_justification\` citing the causal, temporal, or logical evidence for this position.

Output:
A JSON object containing a single, re-ordered list of the provided segments with added chronological_index and placement_justification fields:
{
  "sorted_segments": [
    {
      "segment_id": "utt_5_1_seg_0",
      "segment_text": "...",
      "temporal_cues": ["..."],
      "coarse_phase": "${phaseName}",
      "chronological_index": 1,
      "placement_justification": "This segment describes the initial moment..."
    }
  ]
}`;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "P1_3_intraPhaSorting"`
Expected: Only the pre-existing unused-import warnings (P1_3_Output, input), no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/pipeline/part1/P1_3_intraPhaSorting.ts
git commit -m "feat(P1.3): distinguish experience order from interview order in prompt"
```

---

### Task 3: Improve P1.4 DU granularity prompt

**Files:**
- Modify: `src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts:36-69` (generatePrompt)

- [ ] **Step 1: Update the prompt text in generatePrompt**

In `src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts`, replace the entire template literal in `generatePrompt` (lines 36-69) with:

```typescript
  generatePrompt: (input: P1_3_Output) => `You are a micro-phenomenological analyst performing diachronic unit grouping. You will be given a chronologically ordered list of segments from an interview. Your task is to group consecutive segments into Diachronic Units (DUs).

A DU represents a single coherent experiential state — one 'beat' in the participant's stream of experience. Segments are in chronological order of the original experience (not interview order).

IMPORTANT — When to create a new DU:
Create a new DU whenever the participant's WAY OF ENGAGING with the experience shifts, even if the topic has not changed. Types of shifts that require a new DU:
- Agency shift: the participant moves from actively doing something to passively receiving (or vice versa)
- A new sensory or perceptual quality emerges
- Something spontaneous or involuntary occurs
- The participant pauses to reflect or evaluate mid-experience

When in doubt about whether two segments belong in the same DU, prefer to split them into separate DUs.

Input:
The fully sorted list of all segments from step P1.3 for transcript ID ${input.transcript_id}.
Sorted segments: ${JSON.stringify(input.sorted_segments, null, 2)}

Instructions:
1. Read the segments in the order provided. They have already been sorted by experience chronology.
2. For each segment, ask: does this describe the same experiential state as the previous segment, or has the participant's mode of engagement shifted?
3. Create a new DU whenever a shift occurs.
4. No DU should contain segments from only the interviewer.
5. Provide a concise \`description\` for each DU that captures what the participant is experiencing in that moment. Avoid abstract theoretical labels.
6. Each DU should have a unique \`unit_id\` (e.g., "du_1", "du_2", etc.).
7. List the \`source_segment_ids\` that constitute each DU.

Output:
A JSON object containing a list of Diachronic Units:
{
  "transcript_id": "${input.transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial awareness and orientation to the experience",
      "source_segment_ids": ["utt_5_1_seg_0", "utt_6_1_seg_0"]
    },
    {
      "unit_id": "du_2",
      "description": "Actively trying to push distracting thoughts aside",
      "source_segment_ids": ["utt_6_1_seg_1", "utt_8_1_seg_0"]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}`
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "P1_4_diachronicUnitGrouping"`
Expected: Only the pre-existing unused-import warning (P1_4_Output), no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts
git commit -m "feat(P1.4): reframe DU grouping around experiential mode changes"
```

---

### Task 4: Convert P1.5 from programmatic step to LLM step

**Files:**
- Modify: `src/config/pipeline/part1/P1_5_constructSpecificDiachronicStructure.ts` (full rewrite)

This is the largest task. The entire file is replaced — the `programmaticallyConstructSds` function is removed and replaced with a `generatePrompt` and `responseSchema`.

- [ ] **Step 1: Rewrite P1_5_constructSpecificDiachronicStructure.ts**

Replace the entire contents of `src/config/pipeline/part1/P1_5_constructSpecificDiachronicStructure.ts` with:

```typescript
import { StepId, P1_4_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  title: "P1.5: Construct Specific Diachronic Structure (SDS)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.5." };

    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_4_data = transcriptData?.p1_4_output;

    if (!p1_4_data) return { data: null, error: `Missing P1.4 output for transcript ${currentTranscript.id}` };

    return { data: p1_4_data };
  },
  generatePrompt: (input: P1_4_Output) => `You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) for this transcript by grouping Diachronic Units into meaningful phases and identifying hinge points between phases.

Input:
Diachronic Units from P1.4 for transcript ID ${input.transcript_id}:
${JSON.stringify(input.diachronic_units, null, 2)}
Independent Variable: ${input.independent_variable_details}
Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:

1. GROUP DUs INTO PHASES:
   Read all DUs in order. Identify natural phase boundaries where the overall character of the experience changes. Phase names must be descriptive and grounded in the content (e.g., "Feeling hands pulling together", "Questioning whether the behaviour is voluntary"), not generic labels like "Beginning" or "Middle". A phase may contain one or several DUs. Every DU must belong to exactly one phase.

2. IDENTIFY HINGE POINTS:
   For each boundary between adjacent phases, identify the hinge point — the experiential shift that marks the transition. Describe what changes and, if apparent from the data, what precipitates the change.

3. SUMMARY:
   Provide an overall summary of the experience's temporal arc.

4. IV OBSERVATION:
   If any connection between the independent variable and the diachronic structure seems apparent, note it briefly. Otherwise state "No immediate IV connection apparent."

5. PASS THROUGH DUs:
   Copy the diachronic_units array from the input into the output unchanged.

Output:
A JSON object:
{
  "transcript_id": "${input.transcript_id}",
  "specific_diachronic_structure": {
    "summary": "Overall narrative arc of the experience",
    "phases": [
      {
        "phase_name": "Descriptive phase name",
        "description": "What the participant experiences during this phase",
        "units_involved": ["du_1", "du_2"]
      }
    ],
    "hinge_points": [
      {
        "from_phase": "Phase A name",
        "to_phase": "Phase B name",
        "transition_description": "What shifts experientially",
        "trigger": "What precipitates the shift"
      }
    ],
    "visualization_hint": "e.g., Linear progression",
    "iv_preliminary_observation": "Brief note or N/A"
  },
  "diachronic_units": ${JSON.stringify(input.diachronic_units)},
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      specific_diachronic_structure: {
        type: "object",
        properties: {
          summary: { type: "string" },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                phase_name: { type: "string" },
                description: { type: "string" },
                units_involved: { type: "array", items: { type: "string" } }
              },
              required: ["phase_name", "description", "units_involved"]
            }
          },
          hinge_points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from_phase: { type: "string" },
                to_phase: { type: "string" },
                transition_description: { type: "string" },
                trigger: { type: "string" }
              },
              required: ["from_phase", "to_phase", "transition_description"]
            }
          },
          visualization_hint: { type: "string" },
          iv_preliminary_observation: { type: "string" }
        },
        required: ["summary", "phases", "hinge_points"]
      },
      diachronic_units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unit_id: { type: "string" },
            description: { type: "string" },
            source_segment_ids: { type: "array", items: { type: "string" } }
          },
          required: ["unit_id", "description", "source_segment_ids"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "specific_diachronic_structure", "diachronic_units", "independent_variable_details", "dependent_variable_focus"]
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "P1_5"`
Expected: No errors in P1_5_constructSpecificDiachronicStructure.ts. Pre-existing unused-import warnings elsewhere are fine.

- [ ] **Step 3: Verify orchestrator will route P1.5 to LLM path**

Confirm: `pipelineStore.ts:633` checks `const isProgrammaticStep = !config.generatePrompt;`. Since the new P1.5 config has `generatePrompt`, it will be `false`, and execution flows to the normal LLM call at line 762. No orchestrator changes needed.

- [ ] **Step 4: Commit**

```bash
git add src/config/pipeline/part1/P1_5_constructSpecificDiachronicStructure.ts
git commit -m "feat(P1.5): convert from programmatic thirds-split to LLM step with hinge points"
```

---

### Task 5: Run backend tests to verify no regressions

**Files:** None modified — verification only.

- [ ] **Step 1: Run backend tests**

Run: `cd upath-backend && npm run test:run`
Expected: 3 files, 14 tests, all pass.

- [ ] **Step 2: Run frontend tests**

Run: `npm run test:run 2>&1 | tail -5`
Expected: Baseline unchanged — 34 failed (pre-existing localForage issue), 61 passed.

---

### Task 6: Commit all changes together

If Tasks 1-4 were committed individually, this task is already done. Otherwise:

- [ ] **Step 1: Stage and commit all changes**

```bash
git add types.ts src/config/pipeline/part1/P1_3_intraPhaSorting.ts src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts src/config/pipeline/part1/P1_5_constructSpecificDiachronicStructure.ts
git commit -m "feat: improve diachronic analysis prompts (P1.3, P1.4, P1.5)

P1.3: Distinguish experience order from interview order
P1.4: Reframe DU grouping around experiential mode changes
P1.5: Convert from programmatic thirds-split to LLM step with hinge points"
```
