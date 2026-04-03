# Response Schema Enforcement — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Approach:** A — Plain object schema in `StepConfig`

---

## Problem

The backend `/api/analyze` endpoint sets `responseMimeType: 'application/json'` when `isJsonOutput: true`, which enforces syntactically valid JSON via Gemini's constrained decoding. However, it does **not** enforce structure. Weaker models (e.g. `gemini-2.5-flash-lite`) can return valid JSON with wrong field names, missing required keys, or incorrect nesting — causing silent downstream failures in the pipeline.

Adding `responseSchema` to the Gemini request constrains decoding at the token level: the model cannot emit JSON that violates the schema, regardless of model capability.

---

## Approach

Plain object `responseSchema?: object` field added to `StepConfig`. Each step config that produces JSON output authors a schema co-located with its prompt. The schema flows through the call chain to the backend and is included in `generationConfig` alongside `responseMimeType`.

Fully backward compatible — steps without a schema behave exactly as today.

---

## Change Surface

| Layer | File | Change |
|-------|------|--------|
| Step config type | `src/config/pipeline/types.ts` | Add `responseSchema?: object` to `StepConfig` interface |
| Gemini service | `services/geminiService.ts` | Add `responseSchema?` param to `callGeminiAPI` and `performGeminiCall`; include in request body |
| Backend route | `upath-backend/src/routes/analyze.ts` | Accept `responseSchema?` in `AnalyzeRequest.Body`; add to `generationConfig` on both SDK and REST API paths |
| Pipeline store | `src/stores/pipelineStore.ts` | Extract `config.responseSchema` and pass to `callGeminiAPI` |
| Step configs (×10) | Parts -1, 0, 1, 2 | Add `responseSchema` to each `isJsonOutput: true` step |

### Steps receiving schemas

| Step ID | File |
|---------|------|
| `P_NEG1_1` | `partNeg1/variableIdentification.ts` |
| `P0_1` | `part0/transcriptionAdherence.ts` |
| `P0_2` | `part0/refineDataTypes.ts` |
| `P0_3` | `part0/selectProceduralUtterances.ts` |
| `P1_1` | `part1/P1_1_initialSegmentation.ts` |
| `P1_2` | `part1/P1_2_coarsePhaseTagging.ts` |
| `P1_3` | `part1/P1_3_intraPhaSorting.ts` |
| `P1_4` | `part1/P1_4_diachronicUnitGrouping.ts` |
| `P2S_1` | `part2/P2S_1_groupUtterancesByTopic.ts` |
| `P2S_2` | `part2/P2S_2_identifySpecificSynchronicUnits.ts` |
| `P2S_3` | `part2/P2S_3_defineSpecificSynchronicStructure.ts` |

Skipped: `P1_5` (`isJsonOutput: false`, programmatic) and `P2S_4` (`isJsonOutput: false`, UI-only).

---

## Data Flow

```
StepConfig.responseSchema (plain object, Gemini OpenAPI 3.0 subset)
  ↓ extracted in processSingleStep
callGeminiAPI(prompt, isJsonOutput, useGrounding, temp, seed, model, responseSchema?)
  ↓
performGeminiCall → POST /api/analyze { prompt, isJsonOutput, responseSchema? }
  ↓
backend: responseSchema present?
  → yes: generationConfig = { responseMimeType: 'application/json', responseSchema }
  → no:  generationConfig = { responseMimeType: 'application/json' }   ← unchanged
  ↓
Gemini constrained decoding enforces structure at token level
  ↓
Response flows back unchanged — existing JSON extraction + validateAndClean still run
```

---

## Schema Authoring

Schemas are plain objects in Gemini's OpenAPI 3.0 subset format. They capture top-level structure: correct field names, array-vs-object distinction, required top-level keys. They do not need to replicate every nested leaf.

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
  required: ["transcript_id", "diachronic_units"]
}
```

Each schema is derived from the corresponding TypeScript output type in `types.ts`.

---

## Error Handling

No new error cases. If Gemini rejects a malformed `responseSchema` (400 response), the existing error handler in `callGeminiAPI` catches it and surfaces it identically to any other API error. The self-correction retry loop is unaffected. `validateAndClean` continues to run on all JSON responses.

---

## Testing

**Backend** (`upath-backend`): one new test — POST `/api/analyze` with `responseSchema` in the body passes it through to `generationConfig`. Assert the field is present in the config sent to Gemini. Does not test Gemini's enforcement.

**Step configs**: each of the 10 updated configs gets a test asserting:
- `responseSchema` is present
- `responseSchema.type === "object"`
- `responseSchema.properties` is a non-empty object
- `responseSchema.required` is a non-empty array

**Regression**: existing 34 pre-existing frontend failures and 10 backend tests remain green — no logic changes, only additive fields.

---

## Non-Goals

- Migrating output types to Zod (Approach B) — deferred
- Adding `responseSchema` to future Parts 3–7 step configs — out of scope, handled when those steps are implemented
- Schema versioning or runtime schema validation — YAGNI
