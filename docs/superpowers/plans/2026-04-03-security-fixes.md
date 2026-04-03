# Security & Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 confirmed security and code-quality issues identified in the Gemini code review.

**Architecture:** Targeted removals and one-line guards across 6 files — no new dependencies. Backend changes cluster in `analyze.ts` and `server.ts`; frontend changes in `vite.config.ts` and `encryptionService.ts`. Two existing tests must be updated to match new behaviour.

**Tech Stack:** TypeScript, React 19, Vite, Fastify, Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-security-fixes-design.md`

---

## File Map

| File | Change |
|------|--------|
| `vite.config.ts` | Remove `API_KEY` and `GEMINI_API_KEY` from `define` block |
| `services/encryptionService.ts` | Remove hardcoded fallback key; guard in `encryptPrompt()` |
| `upath-backend/src/routes/analyze.ts` | Remove fallback key; sanitize 500 error; add `MAX_OUTPUT_TOKENS` const |
| `upath-backend/src/server.ts` | Read CORS origins from `CORS_ORIGINS` env var |
| `services/geminiService.ts` | Add comment on token heuristic |
| `upath-backend/src/__tests__/analyze.test.ts` | Update two tests that depend on old behaviour |

---

## Task 1: Pre-condition grep + remove API key from vite bundle

**Files:** `vite.config.ts`

- [ ] **Grep for any frontend call sites that read the API key**

  Run from `C:\Users\enigm\upath`:
  ```bash
  grep -rn "process\.env\.API_KEY\|process\.env\.GEMINI_API_KEY\|[^_]API_KEY[^_]\|GEMINI_API_KEY" \
    --include="*.ts" --include="*.tsx" \
    src/ services/ App.tsx \
    | grep -v "vite.config"
  ```
  Expected: zero results. If any hits appear, remove those references before continuing.

- [ ] **Remove the two define entries**

  In `vite.config.ts`, delete lines 12-13:
  ```typescript
  // DELETE these two lines:
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  ```

  After the change `vite.config.ts` define block should be:
  ```typescript
  define: {
    'process.env.REACT_APP_P3_2_APPROACH': JSON.stringify(env.REACT_APP_P3_2_APPROACH),
    'process.env.REACT_APP_DEBUG_MODE': JSON.stringify(env.REACT_APP_DEBUG_MODE),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
  },
  ```

- [ ] **Run frontend tests to confirm no regression**

  ```bash
  cd C:\Users\enigm\upath && npm run test:run 2>&1 | tail -5
  ```
  Expected: same baseline as before (34 failed / 61 passed — pre-existing failures only).

- [ ] **Commit**

  ```bash
  git add vite.config.ts
  git commit -m "fix: remove GEMINI_API_KEY from frontend bundle define block"
  ```

---

## Task 2: Remove hardcoded fallback key from encryptionService.ts + fix geminiService.ts

**Files:** `services/encryptionService.ts`, `services/geminiService.ts`

> **Critical dependency:** `geminiService.ts:191` hardcodes `true` as the `useEncryption` argument to `createApiRequestBody`, bypassing `encryptionConfig.enabled`. After removing the fallback key, all API calls would throw when `REACT_APP_ENCRYPTION_KEY` is unset (the default). Fix both files together.

- [ ] **Fix `encryptionService.ts` line 6 — remove hardcoded fallback**

  Current line 6:
  ```typescript
  const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || "b630a313659957d2370d66f6378596b0d2478569f360af08cadf305d4f12968a";
  ```

  Replace with (no fallback):
  ```typescript
  const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY ?? '';
  ```

  At the **very top** of `encryptPrompt()`, before the `try` block, add:
  ```typescript
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.trim().length === 0) {
    throw new Error('REACT_APP_ENCRYPTION_KEY must be set when encryption is enabled');
  }
  ```

  The `encryptionConfig.key` export reads `ENCRYPTION_KEY` — it will export `''` when unset, which is fine (read-only config, not used for actual encryption).

- [ ] **Fix `geminiService.ts:191` — use the encryption flag instead of hardcoded `true`**

  `encryptionConfig` is already imported at line 3. Find line 191:
  ```typescript
  true, // Always encrypt prompts for network calls
  ```

  Replace with:
  ```typescript
  encryptionConfig.enabled, // Encrypt only when REACT_APP_USE_ENCRYPTION=true
  ```

  This ensures: encryption disabled (default) → never calls `encryptPrompt` → guard never fires → no key required.

- [ ] **Run frontend tests to confirm no regression**

  ```bash
  cd C:\Users\enigm\upath && npm run test:run 2>&1 | tail -5
  ```
  Expected: same baseline (34 failed / 61 passed).

- [ ] **Commit**

  ```bash
  git add services/encryptionService.ts services/geminiService.ts
  git commit -m "fix: remove hardcoded encryption key fallback, respect encryption flag in geminiService"
  ```

---

## Task 3: TDD (Red) — write failing backend tests

**Files:** `upath-backend/src/__tests__/analyze.test.ts`

Two tests to add. Both will fail until Tasks 4 and 5 implement the fixes.

- [ ] **Add test: encrypted request without ENCRYPTION_KEY returns 400**

  In `analyze.test.ts`, inside `describe('Analyze Endpoint - Real Production Test', ...)`, add after the existing tests:
  ```typescript
  it('should return 400 when encrypted=true but ENCRYPTION_KEY is not set', async () => {
    // Ensure ENCRYPTION_KEY is absent
    const savedKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'someIVhex:someciphertext',
        encrypted: true
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Failed to decrypt prompt');

    // Restore
    if (savedKey !== undefined) process.env.ENCRYPTION_KEY = savedKey;
  });
  ```

- [ ] **Add test: 500 response does not leak error.message**

  ```typescript
  it('should return generic error message on 500, not internal details', async () => {
    // invalid-model triggers a Gemini API error (500 path)
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'Test prompt',
        model: 'invalid-model-name'
      }
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Internal server error');
    // Must NOT leak internal details
    expect(body.error).not.toContain('API error');
    expect(body.error).not.toContain('models/');
  });
  ```

- [ ] **Run backend tests to confirm both new tests FAIL (Red)**

  ```bash
  cd C:\Users\enigm\upath\upath-backend && npm run test:run 2>&1 | tail -20
  ```
  Expected: the two new tests fail. Existing 10 tests still pass.

---

## Task 4: TDD (Red) — write failing CORS test

**Files:** `upath-backend/src/__tests__/analyze.test.ts`

- [ ] **Add a new describe block for env-configured CORS**

  Add this **after** the existing `describe` block (not inside it):
  ```typescript
  describe('CORS with CORS_ORIGINS env var', () => {
    let corsApp: FastifyInstance;

    beforeAll(async () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      process.env.CORS_ORIGINS = 'http://example.com,http://other.com';
      const { buildApp } = await import('../server');
      corsApp = await buildApp();
    });

    afterAll(async () => {
      await corsApp.close();
      delete process.env.CORS_ORIGINS;
    });

    it('should allow origin from CORS_ORIGINS env var', async () => {
      const response = await corsApp.inject({
        method: 'OPTIONS',
        url: '/api/analyze',
        headers: {
          'origin': 'http://example.com',
          'access-control-request-method': 'POST'
        }
      });
      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://example.com');
    });

    it('should reject origin not in CORS_ORIGINS env var', async () => {
      const response = await corsApp.inject({
        method: 'OPTIONS',
        url: '/api/analyze',
        headers: {
          'origin': 'http://notallowed.com',
          'access-control-request-method': 'POST'
        }
      });
      // Fastify/cors returns 204 but without access-control-allow-origin for disallowed origins
      expect(response.headers['access-control-allow-origin']).not.toBe('http://notallowed.com');
    });
  });
  ```

- [ ] **Run backend tests to confirm new CORS tests FAIL (Red)**

  ```bash
  cd C:\Users\enigm\upath\upath-backend && npm run test:run 2>&1 | tail -20
  ```
  Expected: new CORS tests fail. Original 10 pass.

---

## Task 5: Implement backend fixes in analyze.ts (Green)

**Files:** `upath-backend/src/routes/analyze.ts`

Three changes in one file.

- [ ] **Fix 3: Remove hardcoded fallback key in `decryptPrompt()`**

  Find line 22:
  ```typescript
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-please-change-in-production';
  ```

  Replace with. **Place at the very top of the `decryptPrompt()` function body, before the `try {` on line 20** — not in the route handler, and not inside the existing try block:
  ```typescript
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.trim().length === 0) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // existing `try {` block follows here unchanged
  ```

  The throw propagates out of `decryptPrompt()`, is caught by the outer catch at line ~67, which re-throws as `'Failed to decrypt prompt'`, which the route handler at line ~106 catches and returns as 400.

- [ ] **Fix 4: Sanitize 500 error message**

  Find the catch block near line 233-237:
  ```typescript
  } catch (error) {
    fastify.log.error('Gemini API call failed:', error);
    return reply.status(500).send({
      error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  ```

  Change only the `error:` line:
  ```typescript
  } catch (error) {
    fastify.log.error('Gemini API call failed:', error);
    return reply.status(500).send({
      error: 'Internal server error'
    });
  }
  ```

- [ ] **Fix 5: Add `MAX_OUTPUT_TOKENS` constant**

  Near the top of `analyze.ts`, after the `DEFAULT_MODEL` constant (line 73), add:
  ```typescript
  const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS ?? '', 10) || 65536;
  ```

  Replace both occurrences of the hardcoded value:
  - Line ~127: `maxOutputTokens: 65536,` → `maxOutputTokens: MAX_OUTPUT_TOKENS,`
  - Line ~171: `maxOutputTokens: 65536,` → `maxOutputTokens: MAX_OUTPUT_TOKENS,`

- [ ] **Run backend tests — new tests from Task 3 should now pass (Green)**

  ```bash
  cd C:\Users\enigm\upath\upath-backend && npm run test:run 2>&1 | tail -20
  ```
  Expected: the two new tests from Task 3 now pass.

---

## Task 6: Fix the existing test broken by Fix 4

**Files:** `upath-backend/src/__tests__/analyze.test.ts`

The existing test at line ~57-74 still expects `'API error'` in the response, which now returns `'Internal server error'`.

- [ ] **Update existing test at line ~73**

  Find:
  ```typescript
  expect(body.error).toContain('API error');
  ```

  Replace with:
  ```typescript
  expect(body.error).toBe('Internal server error');
  ```

  Also remove the generic `'should reject requests with invalid model'` test's description note if it references specific error content — only the assertion changes.

- [ ] **Run backend tests to confirm all pass**

  ```bash
  cd C:\Users\enigm\upath\upath-backend && npm run test:run 2>&1 | tail -10
  ```
  Expected: all tests pass (including the two new ones from Task 3).

- [ ] **Commit**

  ```bash
  git add upath-backend/src/routes/analyze.ts upath-backend/src/__tests__/analyze.test.ts
  git commit -m "fix: remove encryption key fallback, sanitize 500 errors, configurable maxOutputTokens"
  ```

---

## Task 7: Implement CORS fix in server.ts (Green)

**Files:** `upath-backend/src/server.ts`

- [ ] **Replace hardcoded CORS origins with env-driven config**

  Current `server.ts` (full file is short — replace entirely):
  ```typescript
  import Fastify from 'fastify';
  import cors from '@fastify/cors';
  import analyzeRoute from './routes/analyze';
  import modelsRoute from './routes/models';

  export async function buildApp() {
    const app = Fastify({
      logger: true
    });

    const rawCorsOrigins = process.env.CORS_ORIGINS ?? '';
    const corsOrigins = rawCorsOrigins.trim().length > 0
      ? rawCorsOrigins.split(',').map(o => o.trim()).filter(Boolean)
      : ['http://localhost:5173'];

    await app.register(cors, {
      origin: corsOrigins,
      credentials: true
    });

    await app.register(analyzeRoute, { prefix: '/api' });
    await app.register(modelsRoute, { prefix: '/api' });

    app.get('/health', async () => {
      return { status: 'ok' };
    });

    return app;
  }
  ```

- [ ] **Fix the existing CORS test that checks `localhost:3000`**

  The existing test at lines ~132-149 checks that both `localhost:5173` and `localhost:3000` are accepted. After Fix 6, `localhost:3000` is no longer in the default fallback.

  Find the test `'should accept environment-configured CORS origins'` and update it:
  ```typescript
  it('should accept the default fallback CORS origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/analyze',
      headers: {
        'origin': 'http://localhost:5173',
        'access-control-request-method': 'POST'
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
  ```

- [ ] **Run backend tests — all should pass including new CORS tests from Task 4**

  ```bash
  cd C:\Users\enigm\upath\upath-backend && npm run test:run 2>&1 | tail -10
  ```
  Expected: all tests pass (10 original + new ones).

- [ ] **Commit**

  ```bash
  git add upath-backend/src/server.ts upath-backend/src/__tests__/analyze.test.ts
  git commit -m "fix: read CORS origins from CORS_ORIGINS env var"
  ```

---

## Task 8: Document token heuristic in geminiService.ts

**Files:** `services/geminiService.ts`

- [ ] **Add comment above the return on line ~88**

  Find:
  ```typescript
  return Math.ceil(text.length / 4);
  ```

  Replace with:
  ```typescript
  // Heuristic (~4 chars/token) — accurate enough for UI display, not billing.
  return Math.ceil(text.length / 4);
  ```

- [ ] **Run frontend tests to confirm no regression**

  ```bash
  cd C:\Users\enigm\upath && npm run test:run 2>&1 | tail -5
  ```
  Expected: same baseline (34 failed / 61 passed).

- [ ] **Commit**

  ```bash
  git add services/geminiService.ts
  git commit -m "docs: document token estimation heuristic in geminiService"
  ```

---

## Task 9: Final verification

- [ ] **Run backend tests (full suite)**

  ```bash
  cd C:\Users\enigm\upath\upath-backend && npm run test:run 2>&1
  ```
  Expected: all tests pass. Zero failures.

- [ ] **Run frontend tests (full suite)**

  ```bash
  cd C:\Users\enigm\upath && npm run test:run 2>&1 | tail -10
  ```
  Expected: 34 failed / 61 passed (baseline unchanged — no new failures).

- [ ] **Verify the GEMINI_API_KEY is gone from the bundle definition**

  ```bash
  grep -n "GEMINI_API_KEY\|API_KEY" C:\Users\enigm\upath\vite.config.ts
  ```
  Expected: zero hits.

- [ ] **Verify no hardcoded fallback keys remain**

  ```bash
  grep -rn "default-key-please-change\|b630a313" \
    C:\Users\enigm\upath\services\ \
    C:\Users\enigm\upath\upath-backend\src\
  ```
  Expected: zero hits.
