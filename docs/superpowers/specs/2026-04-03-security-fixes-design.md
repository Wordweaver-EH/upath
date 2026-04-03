# Security & Quality Fixes — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Source:** Gemini code review + manual verification

---

## Breaking Change Warning

**Fixes 2 and 3 convert silent fallback behaviour into hard failures.** Before deploying, confirm `ENCRYPTION_KEY` is set in all environments where `USE_ENCRYPTION=true` (check Vercel dashboard → Environment Variables, or grep `.env` files). Environments with encryption disabled are unaffected.

---

## Fixes

### 1. Remove API key from frontend bundle (`vite.config.ts:12-13`)

**Pre-condition:** Grep frontend source for all of: `process.env.API_KEY`, `process.env.GEMINI_API_KEY`, bare `API_KEY`, and bare `GEMINI_API_KEY`. Confirm zero call sites before removing the define entries.

**Fix:** Remove `'process.env.API_KEY'` and `'process.env.GEMINI_API_KEY'` from the `define` block. Keep `REACT_APP_P3_2_APPROACH`, `REACT_APP_DEBUG_MODE`, and `VITE_APP_VERSION`.

**Files:** `vite.config.ts`

---

### 2. Hard-fail on missing frontend encryption key (`encryptionService.ts:6`)

**Context:** `ENCRYPTION_KEY` is a module-level constant (`process.env.REACT_APP_ENCRYPTION_KEY || "hardcoded..."`). In Vite, `REACT_APP_*` vars are not auto-exposed — this value requires explicit injection via the `define` block or a `VITE_` prefix. The current code effectively always uses the hardcoded fallback unless `REACT_APP_ENCRYPTION_KEY` is already injected. The fix removes the fallback and surfaces misconfiguration loudly.

**Contract:** `encryptPrompt()` is called only when `REACT_APP_USE_ENCRYPTION === 'true'`. When encryption is disabled, `encryptPrompt` is never called. No change to call sites.

**Fix:** Move the key read inside `encryptPrompt()` to avoid module-level `"undefined"` string pitfalls:
```typescript
export function encryptPrompt(text: string): string {
  const key = process.env.REACT_APP_ENCRYPTION_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error('REACT_APP_ENCRYPTION_KEY must be set when encryption is enabled');
  }
  // use `key` (not module-level ENCRYPTION_KEY) for the rest of the function
  ...
}
```
Remove the module-level `ENCRYPTION_KEY` constant entirely.

**Test coverage gap (acknowledged):** The throw path has no automated test coverage because `REACT_APP_USE_ENCRYPTION` is not `true` in test environments. This is an accepted gap — the guard protects production misconfiguration, not test-time logic.

**Files:** `services/encryptionService.ts`

---

### 3. Hard-fail on missing backend encryption key (`analyze.ts:22`)

**Placement:** Fail at **call time inside `decryptPrompt()`**, not at startup. Rationale: `ENCRYPTION_KEY` is only required for encrypted requests; servers where encryption is disabled never call `decryptPrompt`.

**Error propagation (verified):** `decryptPrompt()` has an outer try/catch (line 67) that catches all throws and re-throws `'Failed to decrypt prompt'`. The route handler (line 106-108) catches this and returns **400** — not 500. The missing-key case therefore returns 400, which is correct (client sent an encrypted request to a server not configured to handle it).

**Fix:** Remove `|| 'default-key-please-change-in-production'`. At the very top of `decryptPrompt()`, before the try/catch:
```typescript
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.trim().length === 0) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}
```

**Files:** `upath-backend/src/routes/analyze.ts`

---

### 4. Sanitize error messages sent to client (`analyze.ts:233-237`)

**Scope:** Only the **500 catch block** (line 233, Gemini API failure). The **400 path** (`'Failed to decrypt prompt'`, line 107) is already a sanitized message — leave it unchanged.

`fastify.log.error('Gemini API call failed:', error)` at line 234 already captures full details for operators — no log change needed.

**Fix:** In the 500 `reply.status(500).send(...)` call, replace:
```typescript
error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`
```
with:
```typescript
error: 'Internal server error'
```

**Files:** `upath-backend/src/routes/analyze.ts`

---

### 5. Make `maxOutputTokens` configurable (`analyze.ts:127, 171`)

**Parsing:** `parseInt(value, 10) || 65536`. This correctly handles: missing → 65536, empty → 65536, NaN → 65536, `0` → 65536. **Known accepted gap:** negative values (e.g. `-1`) pass through to Gemini, which returns its own error. No range validation added — out of scope.

**Fix:** One constant at top of `analyze.ts`:
```typescript
const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS ?? '', 10) || 65536;
```
Replace both hardcoded `65536` occurrences with `MAX_OUTPUT_TOKENS`.

**Files:** `upath-backend/src/routes/analyze.ts`

---

### 6. Read CORS origins from env var (`server.ts:13`)

**Behaviour:** Both unset (`undefined`) and explicitly empty (`""`) are treated identically via `rawCorsOrigins.trim().length > 0`. This is intentional — no attempt to distinguish `undefined` from `""`.

**Fix:**
```typescript
const rawCorsOrigins = process.env.CORS_ORIGINS ?? '';
const corsOrigins = rawCorsOrigins.trim().length > 0
  ? rawCorsOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173'];
```
Pass `corsOrigins` to `origin:` in `app.register(cors, ...)`.

**Files:** `upath-backend/src/server.ts`

---

### 7. Document token estimation heuristic (`geminiService.ts:88`)

**Fix:** Add comment, no logic change:
```typescript
// Heuristic (~4 chars/token) — accurate enough for UI display, not billing.
return Math.ceil(text.length / 4);
```

**Files:** `services/geminiService.ts`

---

## Testing

- Backend: `cd upath-backend && npm run test:run` — 3 files, 10 tests must stay green.
- Frontend: `npm run test:run` — baseline 34 failed / 61 passed must not regress.
- Fix 3: all tests use `encrypted: false` (default) → `decryptPrompt` never called → unaffected.
- Fix 6: tests don't set `CORS_ORIGINS` → fallback `['http://localhost:5173']` used → unaffected.
- Fix 2: throw path has no test coverage (acknowledged gap — encryption disabled in test env).
- Fix 1: run grep pre-condition before editing; if call sites found, remove them first.

## Out of Scope

- Store decomposition (`pipelineStore.ts` 2528 lines)
- `any` type cleanup in stores and routes
- `_storeRefs` circular dependency pattern
