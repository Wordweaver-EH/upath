# responseSchema Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread `responseSchema?: object` from each `StepConfig` through the full call chain to Gemini's `generationConfig`, enforcing output structure at the token level for all 10 JSON-producing pipeline steps.

**Architecture:** Add an optional `responseSchema` field to `StepConfig`; pass it as the 8th parameter through `callGeminiAPI` → `performGeminiCall` → `createApiRequestBody` → POST body → backend route → both Gemini call paths (SDK and REST/thinking). Author schemas co-located with each step config. Fully backward-compatible — steps without schemas behave exactly as today.

**Tech Stack:** TypeScript, Fastify, Vitest, `@google/generative-ai` SDK, Gemini OpenAPI 3.0 schema subset

**Spec:** `docs/superpowers/specs/2026-04-03-response-schema-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/config/pipeline/types.ts` | Modify | Make `generatePrompt` optional; add `responseSchema?: object` |
| `services/encryptionService.ts` | Modify | Add `responseSchema?: object` to `createApiRequestBody` options type |
| `services/geminiService.ts` | Modify | Add 8th param to both functions; pass through call chain |
| `src/stores/pipelineStore.ts` | Modify | Extract `config.responseSchema` and pass as 8th arg |
| `upath-backend/src/routes/analyze.ts` | Modify | Accept `responseSchema` in body; apply to both generationConfig paths |
| `upath-backend/src/__tests__/analyze.test.ts` | Modify | Add SDK-path responseSchema passthrough test |
| `src/config/pipeline/__tests__/step-config-schemas.test.ts` | Create | Tests asserting responseSchema presence on all 10 configs |
| `src/config/pipeline/partNeg1/variableIdentification.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part0/transcriptionAdherence.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part0/refineDataTypes.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part0/selectProceduralUtterances.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part1/P1_1_initialSegmentation.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part1/P1_2_coarsePhaseTagging.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part2/P2S_1_groupUtterancesByTopic.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part2/P2S_2_identifySpecificSynchronicUnits.ts` | Modify | Add responseSchema |
| `src/config/pipeline/part2/P2S_3_defineSpecificSynchronicStructure.ts` | Modify | Add responseSchema |

---

## Task 1: Foundation types — `StepConfig` update

**Files:**
- Modify: `src/config/pipeline/types.ts`

> **CRITICAL:** Both changes (making `generatePrompt` optional AND adding `responseSchema`) MUST land in a single commit. `P1_5` already omits `generatePrompt` and will not compile until it is made optional.

- [ ] **Step 1.1: Read the current file**

  Read `src/config/pipeline/types.ts` to confirm current content (lines 1–13).

- [ ] **Step 1.2: Apply the change**

  Replace `generatePrompt: (input: any) => string;` with `generatePrompt?: (input: any) => string;` and add `responseSchema?: object;` on the next line:

  ```typescript
  export interface StepConfig {
    id: StepId;
    title: string;
    part: string;
    isJsonOutput: boolean;
    getInput: (...args: any[]) => { data: any; error?: string } | { data: null; error: string };
    generatePrompt?: (input: any) => string;
    responseSchema?: object;
    validateAndClean?: (output: any, ...args: any[]) => any;
  }
  ```

- [ ] **Step 1.3: Verify TypeScript compiles**

  Run: `cd C:/Users/enigm/upath && npx tsc --noEmit 2>&1 | head -20`

  Expected: zero errors (or same pre-existing errors as before, none related to `StepConfig`).

- [ ] **Step 1.4: Commit**

  ```bash
  git add src/config/pipeline/types.ts
  git commit -m "feat: make generatePrompt optional and add responseSchema to StepConfig"
  ```

---

## Task 2: Encryption service type annotation

**Files:**
- Modify: `services/encryptionService.ts:72–82`

> The `...options` spread on line 90 already serialises all options into the request body. Only a type annotation change is needed — no body change.

- [ ] **Step 2.1: Read the current options type** (lines 72–82 of `services/encryptionService.ts`)

- [ ] **Step 2.2: Add `responseSchema?: object` to the options type**

  Replace the `options` parameter type block (lines 75–81):

  ```typescript
  options: {
    model?: string;
    isJsonOutput?: boolean;
    useGrounding?: boolean;
    temperature?: number;
    seed?: number;
    responseSchema?: object;
  } = {}
  ```

- [ ] **Step 2.3: Verify TypeScript compiles**

  Run: `cd C:/Users/enigm/upath && npx tsc --noEmit 2>&1 | head -20`

  Expected: zero new errors.

- [ ] **Step 2.4: Commit**

  ```bash
  git add services/encryptionService.ts
  git commit -m "feat: add responseSchema to createApiRequestBody options type"
  ```

---

## Task 3: Gemini service — thread `responseSchema` through the call chain

**Files:**
- Modify: `services/geminiService.ts`

> Three sub-changes: (a) add 8th param to `performGeminiCall` and pass it to `createApiRequestBody`; (b) add 8th param to `callGeminiAPI` and update the initial call at line 246 with an explicit `undefined` as 7th arg; (c) add a comment to the retry call at line 302.

- [ ] **Step 3.1: Read the relevant sections**

  Read lines 162–310 of `services/geminiService.ts` — this covers the full `performGeminiCall` signature, the `createApiRequestBody` call, the `callGeminiAPI` signature, the initial call at ~246, and the retry call at ~302.

- [ ] **Step 3.2: Update `performGeminiCall` signature (line 169)**

  Add `responseSchema?: object` as the 8th parameter after `originalPromptForFixer?`:

  ```typescript
  async function performGeminiCall(
      prompt: string,
      isJsonOutput: boolean,
      useGrounding: boolean,
      temperature: number,
      seed?: number,
      model: string = GEMINI_MODEL_TEXT,
      originalPromptForFixer?: string,
      responseSchema?: object
  )
  ```

- [ ] **Step 3.3: Pass `responseSchema` to `createApiRequestBody` options (lines 191–197)**

  Add `responseSchema` to the options object in the `createApiRequestBody` call:

  ```typescript
  body: JSON.stringify(createApiRequestBody(
      effectivePrompt,
      true,
      {
          model,
          isJsonOutput,
          useGrounding,
          temperature,
          seed,
          responseSchema
      }
  )),
  ```

- [ ] **Step 3.4: Update `callGeminiAPI` signature (lines 228–235)**

  Add `responseSchema?: object` as the 8th parameter after `attempt`:

  ```typescript
  export async function callGeminiAPI(
    prompt: string,
    isJsonOutput: boolean,
    useGrounding: boolean = false,
    temperature: number = 0.0,
    seed?: number,
    model: string = GEMINI_MODEL_TEXT,
    attempt: number = 1,
    responseSchema?: object
  )
  ```

- [ ] **Step 3.5: Update the initial `performGeminiCall` call at line 246**

  > CRITICAL: The current call passes 6 positional args. `responseSchema` is the 8th param. Without an explicit `undefined` for position 7 (`originalPromptForFixer`), `responseSchema` would land in the wrong slot and silently corrupt fixer-prompt token counting.

  Replace:
  ```typescript
  const initialCallResult = await performGeminiCall(prompt, isJsonOutput, useGrounding, temperature, seed, model);
  ```
  With:
  ```typescript
  const initialCallResult = await performGeminiCall(prompt, isJsonOutput, useGrounding, temperature, seed, model, undefined, responseSchema);
  ```

- [ ] **Step 3.6: Add comment to the retry call at line 302**

  The retry call at line 302 already passes 7 args (with `fixerPrompt` as position 7). No positional change needed. Add a trailing comment:

  ```typescript
  const retryResult = await performGeminiCall(fixerPrompt, true, false, 0.0, seed, model, fixerPrompt); // responseSchema intentionally omitted — fixer prompt is a reformatting call, not a fresh generation
  ```

- [ ] **Step 3.7: Verify TypeScript compiles**

  Run: `cd C:/Users/enigm/upath && npx tsc --noEmit 2>&1 | head -20`

  Expected: zero new errors.

- [ ] **Step 3.8: Commit**

  ```bash
  git add services/geminiService.ts
  git commit -m "feat: add responseSchema param to callGeminiAPI and performGeminiCall"
  ```

---

## Task 4: Pipeline store — extract and pass `responseSchema`

**Files:**
- Modify: `src/stores/pipelineStore.ts:770–779`

- [ ] **Step 4.1: Read lines 763–785 of `src/stores/pipelineStore.ts`**

  Confirm the generic `callGeminiAPI` call and surrounding context.

- [ ] **Step 4.2: Extract `responseSchema` and pass as 8th argument**

  Immediately before the `const effectiveSeed` line, add the extraction. Then add `responseSchema` as the 8th arg to `callGeminiAPI`:

  ```typescript
  const effectiveSeed = overrideSeed !== undefined ? overrideSeed : seed
  const responseSchema = config.responseSchema
  const apiResult = await callGeminiAPI(
    promptForHistory,
    config.isJsonOutput,
    false, // useGrounding
    temperature,
    effectiveSeed,
    model || GEMINI_MODEL_TEXT,
    1, // attempt
    responseSchema
  )
  ```

- [ ] **Step 4.3: Verify TypeScript compiles**

  Run: `cd C:/Users/enigm/upath && npx tsc --noEmit 2>&1 | head -20`

  Expected: zero new errors.

- [ ] **Step 4.4: Commit**

  ```bash
  git add src/stores/pipelineStore.ts
  git commit -m "feat: extract and pass config.responseSchema to callGeminiAPI"
  ```

---

## Task 5: Backend test — write failing test (RED)

**Files:**
- Modify: `upath-backend/src/__tests__/analyze.test.ts`

> This test must use `gemini-1.5-flash` (NOT the default `gemini-2.5-flash`) because `gemini-2.5-flash` is in `THINKING_MODELS` and takes the REST `fetch` path, bypassing the SDK. The SDK path is what we're testing here.

- [ ] **Step 5.1: Read `upath-backend/src/__tests__/analyze.test.ts` lines 1–5**

  Note the current imports: `{ describe, it, expect, beforeAll, afterAll }` from vitest.

- [ ] **Step 5.2: Add `vi` to the vitest import and add `GoogleGenerativeAI` import**

  Update line 1 from:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  ```
  To:
  ```typescript
  import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
  import { GoogleGenerativeAI } from '@google/generative-ai';
  ```

- [ ] **Step 5.3: Add the new test to the end of the describe block (before the closing `}`)**

  ```typescript
  it('should pass responseSchema to generationConfig on SDK path', async () => {
    // Use gemini-1.5-flash — NOT in THINKING_MODELS, so it takes the SDK path
    // (gemini-2.5-flash would use the REST fetch path and bypass the SDK entirely)
    const mockGenerateContent = vi.fn().mockResolvedValue({
      response: { text: () => '{"result": "ok"}' }
    });
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel')
      .mockReturnValue({ generateContent: mockGenerateContent } as any);

    const testSchema = {
      type: 'object',
      properties: { result: { type: 'string' } },
      required: ['result']
    };

    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'test prompt',
        model: 'gemini-1.5-flash',
        isJsonOutput: true,
        responseSchema: testSchema
      }
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [requestConfig] = mockGenerateContent.mock.calls[0];
    expect(requestConfig.generationConfig.responseSchema).toEqual(testSchema);

    spy.mockRestore();
  });
  ```

- [ ] **Step 5.4: Run the test to confirm RED**

  Run: `cd C:/Users/enigm/upath/upath-backend && npm run test:run -- --reporter=verbose 2>&1 | tail -30`

  Expected: The new test FAILS with something like `expected undefined to equal {...}` (because `responseSchema` isn't accepted by the route yet).

- [ ] **Step 5.5: Commit the failing test**

  ```bash
  git add upath-backend/src/__tests__/analyze.test.ts
  git commit -m "test: add failing test for responseSchema passthrough to generationConfig (SDK path)"
  ```

---

## Task 6: Backend route — implement `responseSchema` support

**Files:**
- Modify: `upath-backend/src/routes/analyze.ts`

- [ ] **Step 6.1: Read `upath-backend/src/routes/analyze.ts` lines 1–20 and 90–135 and 160–180**

  Confirm current `AnalyzeRequest.Body`, destructuring on line 94, SDK generationConfig (lines 124–132), and thinking-model generationConfig (lines 163–176).

- [ ] **Step 6.2: Add `responseSchema` to `AnalyzeRequest.Body` (lines 5–15)**

  ```typescript
  interface AnalyzeRequest {
    Body: {
      prompt: string;
      encrypted?: boolean;
      model?: string;
      temperature?: number;
      isJsonOutput?: boolean;
      seed?: number;
      useGrounding?: boolean;
      responseSchema?: object;
    };
  }
  ```

- [ ] **Step 6.3: Add `responseSchema` to the destructuring at line 94**

  ```typescript
  const { prompt, encrypted = false, model = DEFAULT_MODEL, isJsonOutput = false, temperature = 0.0, seed, useGrounding = false, responseSchema } = request.body;
  ```

- [ ] **Step 6.4: Apply `responseSchema` to the SDK-path `generationConfig` (after line 132)**

  After the existing `if (isJsonOutput)` block, add:

  ```typescript
  if (isJsonOutput) {
    generationConfig.responseMimeType = 'application/json';
  }
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }
  ```

- [ ] **Step 6.5: Apply `responseSchema` to the thinking-model REST-path `generationConfig` (lines 165–175)**

  Add `...(responseSchema && { responseSchema })` to the inline `generationConfig` object. The thinking-path block becomes:

  ```typescript
  const thinkingRequest: any = {
    contents: [{ parts: [{ text: actualPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 65536,
      ...(seed !== undefined && { seed }),
      ...(isJsonOutput && { responseMimeType: 'application/json' }),
      ...(responseSchema && { responseSchema }),
      thinkingConfig: {
        thinkingBudget: -1,
        includeThoughts: true
      }
    }
  };
  ```

- [ ] **Step 6.6: Run the backend tests to confirm GREEN**

  Run: `cd C:/Users/enigm/upath/upath-backend && npm run test:run -- --reporter=verbose 2>&1 | tail -30`

  Expected: **11 tests pass, 0 fail.** The new test now passes; all 10 existing tests remain green.

- [ ] **Step 6.7: Commit**

  ```bash
  git add upath-backend/src/routes/analyze.ts
  git commit -m "feat: accept and apply responseSchema in both SDK and REST generationConfig paths"
  ```

---

## Task 7: Step config schema tests — write failing tests (RED)

**Files:**
- Create: `src/config/pipeline/__tests__/step-config-schemas.test.ts`

- [ ] **Step 7.1: Create the test file**

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG } from '../partNeg1/variableIdentification';
  import { P0_1_TRANSCRIPTION_ADHERENCE_CONFIG } from '../part0/transcriptionAdherence';
  import { P0_2_REFINE_DATA_TYPES_CONFIG } from '../part0/refineDataTypes';
  import { P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG } from '../part0/selectProceduralUtterances';
  import { P1_1_INITIAL_SEGMENTATION_CONFIG } from '../part1/P1_1_initialSegmentation';
  import { P1_2_COARSE_PHASE_TAGGING_CONFIG } from '../part1/P1_2_coarsePhaseTagging';
  import { P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG } from '../part1/P1_4_diachronicUnitGrouping';
  import { P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG } from '../part2/P2S_1_groupUtterancesByTopic';
  import { P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG } from '../part2/P2S_2_identifySpecificSynchronicUnits';
  import { P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG } from '../part2/P2S_3_defineSpecificSynchronicStructure';

  const configs = [
    { id: 'P_NEG1_1', config: P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG },
    { id: 'P0_1', config: P0_1_TRANSCRIPTION_ADHERENCE_CONFIG },
    { id: 'P0_2', config: P0_2_REFINE_DATA_TYPES_CONFIG },
    { id: 'P0_3', config: P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG },
    { id: 'P1_1', config: P1_1_INITIAL_SEGMENTATION_CONFIG },
    { id: 'P1_2', config: P1_2_COARSE_PHASE_TAGGING_CONFIG },
    { id: 'P1_4', config: P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG },
    { id: 'P2S_1', config: P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG },
    { id: 'P2S_2', config: P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG },
    { id: 'P2S_3', config: P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG },
  ];

  describe('Step config responseSchema', () => {
    it.each(configs)('$id has a valid responseSchema', ({ id, config }) => {
      const schema = (config as any).responseSchema;
      expect(schema, `${id}: responseSchema must be defined`).toBeDefined();
      expect(schema.type, `${id}: responseSchema.type must be "object"`).toBe('object');
      expect(schema.properties, `${id}: responseSchema.properties must be a non-empty object`).toBeDefined();
      expect(Object.keys(schema.properties).length, `${id}: responseSchema.properties must have at least one key`).toBeGreaterThan(0);
      expect(schema.required, `${id}: responseSchema.required must be a non-empty array`).toBeDefined();
      expect(Array.isArray(schema.required), `${id}: responseSchema.required must be an array`).toBe(true);
      expect(schema.required.length, `${id}: responseSchema.required must have at least one entry`).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 7.2: Run the tests to confirm RED**

  Run: `cd C:/Users/enigm/upath && npm run test:run -- src/config/pipeline/__tests__/step-config-schemas.test.ts --reporter=verbose 2>&1`

  Expected: **10 tests fail** with `responseSchema must be defined`.

- [ ] **Step 7.3: Commit the failing tests**

  ```bash
  git add src/config/pipeline/__tests__/step-config-schemas.test.ts
  git commit -m "test: add failing responseSchema presence tests for all 10 JSON step configs"
  ```

---

## Task 8: Add `responseSchema` to all 10 step configs (GREEN)

> All schemas use only Gemini's OpenAPI 3.0 subset: `type`, `properties`, `items`, `required`, `enum`, `description`. No `$ref`, `oneOf`, `anyOf`, `allOf`, `not`. For nullable optional fields use `type: "string"` (Gemini handles null gracefully).
>
> `required` policy: include fields read by downstream steps without a null-check.

### 8a — `P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG`

**File:** `src/config/pipeline/partNeg1/variableIdentification.ts`

- [ ] **Step 8a.1: Add `responseSchema` before the closing `}`**

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8b — `P0_1_TRANSCRIPTION_ADHERENCE_CONFIG`

**File:** `src/config/pipeline/part0/transcriptionAdherence.ts`

- [ ] **Step 8b.1: Add `responseSchema`**

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      line_numbered_transcript: { type: "array", items: { type: "string" } },
      transcription_convention_notes: { type: "string" },
      initial_impressions_log: { type: "string" }
    },
    required: ["transcript_id", "line_numbered_transcript", "transcription_convention_notes", "initial_impressions_log"]
  },
  ```

---

### 8c — `P0_2_REFINE_DATA_TYPES_CONFIG`

**File:** `src/config/pipeline/part0/refineDataTypes.ts`

> `line_num` is typed as `number` in `RefinedLine`. `speaker` and `decision_notes` are optional — omit from items' `required`.

- [ ] **Step 8c.1: Add `responseSchema`**

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      refined_data_transcript: {
        type: "array",
        items: {
          type: "object",
          properties: {
            line_num: { type: "integer" },
            speaker: { type: "string" },
            text: { type: "string" },
            information_tags: { type: "array", items: { type: "string" } },
            decision_notes: { type: "string" }
          },
          required: ["line_num", "text", "information_tags"]
        }
      }
    },
    required: ["transcript_id", "refined_data_transcript"]
  },
  ```

---

### 8d — `P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG`

**File:** `src/config/pipeline/part0/selectProceduralUtterances.ts`

> `speaker` is optional on `SelectedUtterance` — omit from items' `required`.

- [ ] **Step 8d.1: Add `responseSchema`**

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      selected_procedural_utterances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_line_num: { type: "string" },
            speaker: { type: "string" },
            utterance_text: { type: "string" },
            selection_justification: { type: "string" },
            included: { type: "boolean" }
          },
          required: ["original_line_num", "utterance_text", "selection_justification", "included"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "selected_procedural_utterances", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8e — `P1_1_INITIAL_SEGMENTATION_CONFIG`

**File:** `src/config/pipeline/part1/P1_1_initialSegmentation.ts`

> `temporal_cues` is optional on `SegmentedUtteranceSegment`.

- [ ] **Step 8e.1: Add `responseSchema`**

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      segmented_utterances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_utterance: {
              type: "object",
              properties: {
                original_line_num: { type: "string" },
                utterance_text: { type: "string" },
                selection_justification: { type: "string" }
              },
              required: ["original_line_num", "utterance_text"]
            },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" },
                  temporal_cues: { type: "array", items: { type: "string" } }
                },
                required: ["segment_id", "segment_text"]
              }
            }
          },
          required: ["original_utterance", "segments"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "segmented_utterances", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8f — `P1_2_COARSE_PHASE_TAGGING_CONFIG`

**File:** `src/config/pipeline/part1/P1_2_coarsePhaseTagging.ts`

> `coarse_phase` is read without null-check by P1_3 — include in segment items' `required`.

- [ ] **Step 8f.1: Add `responseSchema`**

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      phase_tagged_utterances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original_utterance: {
              type: "object",
              properties: {
                original_line_num: { type: "string" },
                utterance_text: { type: "string" }
              },
              required: ["original_line_num", "utterance_text"]
            },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" },
                  temporal_cues: { type: "array", items: { type: "string" } },
                  coarse_phase: {
                    type: "string",
                    enum: ["Initial State", "Core Experience", "Final Action", "Post-Hoc Reflection"]
                  }
                },
                required: ["segment_id", "segment_text", "coarse_phase"]
              }
            }
          },
          required: ["original_utterance", "segments"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "phase_tagged_utterances", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8g — `P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG`

**File:** `src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts`

- [ ] **Step 8g.1: Add `responseSchema`** (this is the reference example from the spec)

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
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
    required: ["transcript_id", "diachronic_units", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8h — `P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG`

**File:** `src/config/pipeline/part2/P2S_1_groupUtterancesByTopic.ts`

- [ ] **Step 8h.1: Add `responseSchema`** (insert before the `saveToTranscript` property)

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      analyzed_du_id: { type: "string" },
      synchronic_thematic_groups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_label: { type: "string" },
            justification: { type: "string" },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" },
                  temporal_cues: { type: "array", items: { type: "string" } }
                },
                required: ["segment_id", "segment_text"]
              }
            }
          },
          required: ["group_label", "justification", "segments"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "analyzed_du_id", "synchronic_thematic_groups", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8i — `P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG`

**File:** `src/config/pipeline/part2/P2S_2_identifySpecificSynchronicUnits.ts`

> `unit_name` is used as `source_isu_id` by P2S_3 — must be in items' `required`.

- [ ] **Step 8i.1: Add `responseSchema`** (insert before the `saveToTranscript` property)

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      analyzed_du_id: { type: "string" },
      specific_synchronic_units_hierarchy: {
        type: "array",
        items: {
          type: "object",
          properties: {
            unit_name: { type: "string" },
            level: { type: "integer" },
            abstraction_op: { type: "string" },
            intensional_definition: { type: "string" },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" }
                },
                required: ["segment_id", "segment_text"]
              }
            },
            constituent_lower_units: { type: "array", items: { type: "string" } }
          },
          required: ["unit_name", "level", "abstraction_op", "intensional_definition"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "analyzed_du_id", "specific_synchronic_units_hierarchy", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

### 8j — `P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG`

**File:** `src/config/pipeline/part2/P2S_3_defineSpecificSynchronicStructure.ts`

- [ ] **Step 8j.1: Add `responseSchema`** (insert before the `saveToTranscript` property)

  ```typescript
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      analyzed_du_id: { type: "string" },
      specific_synchronic_structure: {
        type: "object",
        properties: {
          representation_type: { type: "string" },
          description: { type: "string" },
          network_nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                source_isu_id: { type: "string" }
              },
              required: ["id", "label", "source_isu_id"]
            }
          },
          network_links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                type: { type: "string" }
              },
              required: ["from", "to", "type"]
            }
          }
        },
        required: ["representation_type", "description", "network_nodes", "network_links"]
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "analyzed_du_id", "specific_synchronic_structure", "independent_variable_details", "dependent_variable_focus"]
  },
  ```

---

## Task 9: Verify and commit step config schemas

- [ ] **Step 9.1: Run the step config schema tests to confirm GREEN**

  Run: `cd C:/Users/enigm/upath && npm run test:run -- src/config/pipeline/__tests__/step-config-schemas.test.ts --reporter=verbose 2>&1`

  Expected: **10 tests pass, 0 fail.**

- [ ] **Step 9.2: Run the full frontend test suite**

  Run: `cd C:/Users/enigm/upath && npm run test:run 2>&1 | tail -20`

  Expected: 34 pre-existing failures remain (localForage/jsdom mock issue — see CLAUDE.md). No new failures. Total passing count increases by 10.

- [ ] **Step 9.3: Run the backend tests one final time**

  Run: `cd C:/Users/enigm/upath/upath-backend && npm run test:run 2>&1 | tail -10`

  Expected: **11 tests pass, 0 fail.**

- [ ] **Step 9.4: Commit all 10 step config changes**

  ```bash
  git add \
    src/config/pipeline/partNeg1/variableIdentification.ts \
    src/config/pipeline/part0/transcriptionAdherence.ts \
    src/config/pipeline/part0/refineDataTypes.ts \
    src/config/pipeline/part0/selectProceduralUtterances.ts \
    src/config/pipeline/part1/P1_1_initialSegmentation.ts \
    src/config/pipeline/part1/P1_2_coarsePhaseTagging.ts \
    src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts \
    src/config/pipeline/part2/P2S_1_groupUtterancesByTopic.ts \
    src/config/pipeline/part2/P2S_2_identifySpecificSynchronicUnits.ts \
    src/config/pipeline/part2/P2S_3_defineSpecificSynchronicStructure.ts
  git commit -m "feat: add Gemini responseSchema to all 10 JSON-producing step configs"
  ```

---

## Summary of commits

| # | Message | Files |
|---|---------|-------|
| 1 | `feat: make generatePrompt optional and add responseSchema to StepConfig` | `types.ts` |
| 2 | `feat: add responseSchema to createApiRequestBody options type` | `encryptionService.ts` |
| 3 | `feat: add responseSchema param to callGeminiAPI and performGeminiCall` | `geminiService.ts` |
| 4 | `feat: extract and pass config.responseSchema to callGeminiAPI` | `pipelineStore.ts` |
| 5 | `test: add failing test for responseSchema passthrough to generationConfig (SDK path)` | `analyze.test.ts` |
| 6 | `feat: accept and apply responseSchema in both SDK and REST generationConfig paths` | `analyze.ts` |
| 7 | `test: add failing responseSchema presence tests for all 10 JSON step configs` | `step-config-schemas.test.ts` |
| 8 | `feat: add Gemini responseSchema to all 10 JSON-producing step configs` | 10 step config files |

---

## Key invariants to verify throughout

- The P1_3 special-handling branch at line ~678 of `pipelineStore.ts` passes `callGeminiAPI` with 7 args — the new optional 8th defaults to `undefined`. **No change to P1_3 code.**
- The retry `performGeminiCall` call at line ~302 of `geminiService.ts` still passes 7 args — the 8th defaults to `undefined`. **`responseSchema` is intentionally absent from the retry.**
- `P2S_4` is not in the test list and receives no `responseSchema`. It has no `generatePrompt` and makes no LLM call. **No change to P2S_4.**
- `P1_5` has `isJsonOutput: false` and no `generatePrompt`. **No change to P1_5; it will benefit from `generatePrompt` being optional.**
