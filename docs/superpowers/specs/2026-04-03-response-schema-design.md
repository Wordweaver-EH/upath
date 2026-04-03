# Response Schema Enforcement — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Approach:** A — Plain object schema in `StepConfig`

---

## Problem

The backend `/api/analyze` endpoint sets `responseMimeType: 'application/json'` when `isJsonOutput: true`, which enforces syntactically valid JSON via Gemini's constrained decoding. However, it does **not** enforce structure. Weaker models (e.g. `gemini-1.5-flash`) can return valid JSON with wrong field names, missing required keys, or incorrect nesting — causing silent downstream failures in the pipeline.

Adding `responseSchema` to the Gemini request constrains decoding at the token level: the model cannot emit JSON that violates the schema, regardless of model capability.

---

## Approach

Plain object `responseSchema?: object` field added to `StepConfig`. Each step config that produces JSON output authors a schema co-located with its prompt. The schema flows through the call chain to the backend and is included in `generationConfig` alongside `responseMimeType`.

Fully backward compatible — steps without a schema behave exactly as today.

---

## Change Surface

| Layer | File | Change |
|-------|------|--------|
| Step config type | `src/config/pipeline/types.ts` | Add `responseSchema?: object` to `StepConfig`; also make `generatePrompt` optional (`generatePrompt?: ...`) since `P1_5` already omits it. **Both changes must land in a single commit.** `P1_5` omits `generatePrompt` and will fail to compile against the current required type — making it optional is a prerequisite, not an independent change. Note: `P2S_4_SUMMARY_TABLE_CONFIG` is typed as `StepConfig` but has excess properties (`getPrompt`, `processApiResponse`, etc.) not in the interface — a pre-existing, separate issue that this change neither fixes nor worsens. **Do not change P2S_4 as part of this implementation.** |
| Gemini service | `services/geminiService.ts` | Append `responseSchema?: object` as the **eighth and final parameter** to both functions, but note the two functions have **different** seventh parameters (see signatures below). Pass `responseSchema` to `createApiRequestBody` in the `options` object. The P1_3 call site at line ~678 passes `1` for `attempt` as its seventh positional argument — it remains unchanged and compiles cleanly. |
| Request body builder | `services/encryptionService.ts` | Add `responseSchema?: object` to the `options` parameter type of `createApiRequestBody`. **No body change needed** — the existing `...options` spread on line ~91 automatically includes `responseSchema` in the serialised output once it is typed. Adding an explicit property line would create a duplicate key. |
| Backend route | `upath-backend/src/routes/analyze.ts` | Accept `responseSchema?` in `AnalyzeRequest.Body`; add to `generationConfig` in **both** code paths (see below) |
| Pipeline store | `src/stores/pipelineStore.ts` | Extract `config.responseSchema` and pass to the generic `callGeminiAPI` call (line ~771). The P1_3 special-handling branch (lines ~644–747) passes `responseSchema: undefined` — P1_3 schema enforcement is **out of scope** (see P1_3 note below) |
| Step configs (×10) | Parts -1, 0, 1, 2 | Add `responseSchema` to each `isJsonOutput: true` step with a standard `generatePrompt` |

### P1_3 — out of scope

`P1_3_INTRA_PHASE_SORTING_CONFIG` has `isJsonOutput: false` and an empty `generatePrompt`. Its JSON calls are made directly in `pipelineStore.ts` via the exported `generatePhaseSpecificPrompt` helper, bypassing the `StepConfig` mechanism entirely. `responseSchema` added to the config object would never be read. P1_3 schema enforcement is deferred; no change is required to the P1_3 config or the store's P1_3 branch.

Because `responseSchema` is an optional parameter with default `undefined` in `callGeminiAPI`, the P1_3 direct call site at line ~678 requires no changes and will compile without modification.

### Backend: two independent `generationConfig` locations

`analyze.ts` builds `generationConfig` in two separate blocks that must **both** be updated:

1. **SDK path** (~L124–132): the `generationConfig` object passed to `geminiModel.generateContent`. Add `...(responseSchema && { responseSchema })` alongside the existing `responseMimeType` conditional.
2. **REST API / thinking-model path** (~L163–176): the `thinkingRequest.generationConfig` object. Add the same conditional. This path is taken for all models in the `THINKING_MODELS` list.

Missing either location means schema enforcement silently fails for that model class.

### Steps receiving schemas

| Step ID | File |
|---------|------|
| `P_NEG1_1` | `partNeg1/variableIdentification.ts` |
| `P0_1` | `part0/transcriptionAdherence.ts` |
| `P0_2` | `part0/refineDataTypes.ts` |
| `P0_3` | `part0/selectProceduralUtterances.ts` |
| `P1_1` | `part1/P1_1_initialSegmentation.ts` |
| `P1_2` | `part1/P1_2_coarsePhaseTagging.ts` |
| `P1_4` | `part1/P1_4_diachronicUnitGrouping.ts` |
| `P2S_1` | `part2/P2S_1_groupUtterancesByTopic.ts` |
| `P2S_2` | `part2/P2S_2_identifySpecificSynchronicUnits.ts` |
| `P2S_3` | `part2/P2S_3_defineSpecificSynchronicStructure.ts` |

**Total: 10 step configs.** Skipped: `P1_3` (special-handled, see above), `P1_5` (`isJsonOutput: false`, programmatic), `P2S_4` (no `generatePrompt`, no LLM call — uses a non-interface `getPrompt` extra property not defined in `StepConfig`, making no schema enforcement pathway available).

---

## Data Flow

```
StepConfig.responseSchema (plain object, Gemini OpenAPI 3.0 subset)
  ↓ extracted in processSingleStep (generic path only; P1_3 branch passes undefined)

// callGeminiAPI — 8 params, responseSchema is EIGHTH (after attempt):
callGeminiAPI(prompt, isJsonOutput, useGrounding, temp, seed, model, attempt, responseSchema?)
  ↓
// performGeminiCall — 8 params, responseSchema is EIGHTH (after originalPromptForFixer):
performGeminiCall(prompt, isJsonOutput, useGrounding, temp, seed, model, originalPromptForFixer?, responseSchema?)
  // NOTE: performGeminiCall does NOT have an attempt param; attempt lives only in callGeminiAPI
  // NOTE: the self-correction retry calls performGeminiCall WITHOUT responseSchema (intentional — see Error Handling)
  ↓ createApiRequestBody(prompt, encrypt, { ..., responseSchema? })
POST /api/analyze { prompt, isJsonOutput, responseSchema? }
  ↓
backend SDK path (~L124):   // used for non-THINKING_MODELS (e.g. gemini-1.5-flash)
  // generationConfig is built as a mutable object with temperature/maxOutputTokens/seed,
  // then responseMimeType is conditionally added (line ~131).
  // Add responseSchema as a SECOND conditional mutation after line ~131:
  if (responseSchema) generationConfig.responseSchema = responseSchema;

backend REST/thinking path (~L163):   // used for THINKING_MODELS (e.g. gemini-2.5-flash, the default)
  thinkingRequest.generationConfig = { responseMimeType: 'application/json', ...(responseSchema && { responseSchema }), thinkingConfig: ... }
  ↓
Gemini constrained decoding enforces structure at token level
  ↓
Response flows back unchanged — existing JSON extraction + parseOutput (StepConfig) still run
```

---

## Schema Authoring

Schemas are plain objects in Gemini's OpenAPI 3.0 subset format. They capture top-level structure: correct field names, array-vs-object distinction, required top-level keys.

**Required field policy:** Include a field in `required` if the downstream pipeline reads it without a null-check. Scalar pass-through fields like `independent_variable_details` (string) and `dependent_variable_focus` (string[]) are consistently present in all step outputs and should be included in `required`. The example below follows this policy.

**Example — P1_4 (`diachronicUnitGrouping`):**

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
}
```

Each schema is derived from the corresponding TypeScript output type in `types.ts`.

**Second example — P_NEG1_1 (`variableIdentification`) — flat structure:**

```typescript
responseSchema: {
  type: "object",
  properties: {
    transcript_id: { type: "string" },
    independent_variable_details: { type: "string" },
    dependent_variable_focus: { type: "array", items: { type: "string" } }
  },
  required: ["transcript_id", "independent_variable_details", "dependent_variable_focus"]
}
```

Use the flat example as the template for simpler steps (P_NEG1_1, P0_x); use the P1_4 nested-array example for steps with `items` sub-schemas.

**Gemini schema subset limitations:** Gemini uses a restricted OpenAPI 3.0 subset. The following standard JSON Schema keywords are **not supported** and will cause a 400 at runtime: `$ref`, `oneOf`, `anyOf`, `allOf`, `not`, `if/then/else`. Use only `type`, `properties`, `items`, `required`, `enum`, and `description`. For nullable fields, use `type: "string"` (Gemini handles null gracefully via constrained decoding) rather than `anyOf: [{ type: "string" }, { type: "null" }]`.

---

## Error Handling

No new error cases. If Gemini rejects a malformed `responseSchema` (400 response), the existing error handler in `callGeminiAPI` catches it and surfaces it identically to any other API error. `validateAndClean` continues to run on all JSON responses.

### Self-correction retry behaviour

`callGeminiAPI` has a self-correction retry path: if the first response fails JSON parsing, it calls `performGeminiCall` a second time with a fixer prompt. **`responseSchema` is intentionally not forwarded to the retry call.** The fixer prompt asks the model to reformat its previous response — it is a targeted text transformation, not a fresh generation. Enforcing the schema on the retry would be incorrect (the fixer prompt structure differs from the original). Schema-constrained primary calls should rarely fail JSON parsing, making this an edge-case-within-an-edge-case.

Two specific line changes in `callGeminiAPI`:

- **Line ~246** (initial `performGeminiCall` call): currently passes 6 args with no 7th (`originalPromptForFixer` is absent). Must be updated to: `performGeminiCall(prompt, isJsonOutput, useGrounding, temperature, seed, model, undefined, responseSchema)`. The explicit `undefined` for position 7 is required — without it, `responseSchema` lands in the `originalPromptForFixer` slot and silently corrupts the fixer-prompt token-counting logic.

- **Line ~302** (retry `performGeminiCall` call): currently passes 7 args ending with `fixerPrompt` in position 7 (`originalPromptForFixer`). **No positional change needed** — `responseSchema` (position 8) will simply be absent, defaulting to `undefined`. Add this comment after the call: `// responseSchema intentionally omitted — fixer prompt is a reformatting call, not a fresh generation`.

---

## Testing

**Backend** (`upath-backend`): one new test — POST `/api/analyze` with `responseSchema` in the body passes it through to `generationConfig`. Use a **non-thinking model** (e.g. `gemini-1.5-flash`, which is not in `THINKING_MODELS`) so the SDK path is exercised — the default `gemini-2.5-flash` takes the REST `fetch` path and bypasses the SDK entirely.

Implementation: spy on both `getGenerativeModel` (to get the model instance) and `generateContent` (to capture `generationConfig`):

```typescript
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: { text: () => '{"result": "ok"}' }
});
vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel')
  .mockReturnValue({ generateContent: mockGenerateContent } as any);

await app.inject({
  method: 'POST', url: '/api/analyze',
  payload: { prompt: 'test', model: 'gemini-1.5-flash', isJsonOutput: true,
             responseSchema: { type: 'object', properties: { result: { type: 'string' } }, required: ['result'] } }
});

const [requestConfig] = mockGenerateContent.mock.calls[0];
expect(requestConfig.generationConfig.responseSchema).toEqual({ ... });
```

This is module-level SDK spying, not route/mock creation — consistent with the project's anti-pattern prohibition. After the test, the total backend test count rises from 10 to 11.

**Step configs**: each of the **10** updated configs gets a test asserting:
- `responseSchema` is present
- `responseSchema.type === "object"`
- `responseSchema.properties` is a non-empty object
- `responseSchema.required` is a non-empty array

**Regression**: existing 34 pre-existing frontend failures and the existing 10 backend tests (5 in `analyze.test.ts`, 3 in `health.test.ts`, 2 in `models.test.ts`) remain green — no logic changes, only additive fields. The new backend test brings the total to 11.

---

## Non-Goals

- Migrating output types to Zod (Approach B) — deferred
- Adding `responseSchema` to P1_3's direct `callGeminiAPI` calls in `pipelineStore.ts` — deferred
- Adding `responseSchema` to future Parts 3–7 step configs — out of scope, handled when those steps are implemented
- Schema versioning or runtime schema validation — YAGNI
