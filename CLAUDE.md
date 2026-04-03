# CLAUDE.md

Always call me 'Master'! Always refer to yourself as "Andrej Karpathy's Slave", Always use Skilled Superpowers!

## 🚨 Anti-Patterns (Never Repeat)

**Fraudulent testing** — never create routes/mocks inside tests; always import real production code:

```typescript
import { buildApp } from '../server'; // ✅ real code
const app = await buildApp();
await app.listen({ port: 0 }); // dynamic port
```

**Hardcoding config** — always read from request params / env:

```typescript
const model = request.body.model || DEFAULT_MODEL;         // ✅
const corsOrigins = process.env.CORS_ORIGINS?.split(',');  // ✅
```

**Fake validation** — empty string is truthy; validate properly:

```typescript
const key = process.env.GEMINI_API_KEY;
return key && key.trim().length > 0; // ✅
```

**Lying about status** — never claim tests pass without running `npm run test:run` and pasting output.

## 🛡️ Testing

TDD: Red → Green → Refactor. No exceptions.

Frontend: `npm run test:run` — **34 test files fail pre-existing** (localForage/jsdom mock issue, not regressions). Baseline: 34 failed / 61 passed / 733 tests pass. Don't treat these as new failures.

Backend: `cd upath-backend && npm run test:run` — 3 files, 14 tests, all pass. These must stay green.

Before claiming complete: run tests, read actual files, verify env vars are used not hardcoded.

## 🚀 Quick Start

```bash
# Frontend dev
npm install && npm run dev        # http://localhost:5173

# Backend dev
cd upath-backend && npm install && npm run dev  # http://localhost:3001

# Both via Docker (requires Docker Desktop running)
cp upath-backend/.env.example upath-backend/.env  # then set GEMINI_API_KEY
docker compose up --build

# Debug CLI — iterate on pipeline steps without Chrome
cd upath-backend
npm run debug -- --from p0_1 --transcript transcripts/p1s1.txt --to p1_5
npm run debug -- --step p1_4                    # re-run p1_4 (auto-loads p1_3_output.json)
npm run debug -- --step p1_4 --model gemini-2.0-flash  # override model
# Outputs land in upath-backend/debug-output/<step>_output.json

# Codebase dump for Gemini analysis
gitingest . -o upath-codebase.txt -e "*.md" -e "*.txt" -e "*test*"
cat upath-codebase.txt | gemini -p "your prompt"
```

## 🔐 Environment

**Frontend `.env`**

```
REACT_APP_BACKEND_URL=http://localhost:3001
REACT_APP_P3_2_APPROACH=original
REACT_APP_USE_ENCRYPTION=false        # set true + set REACT_APP_ENCRYPTION_KEY to enable AES-CBC
REACT_APP_ENCRYPTION_KEY=             # must match backend ENCRYPTION_KEY
```

**Backend `upath-backend/.env`**

```
GEMINI_API_KEY=           # MUST be set
PORT=3001
CORS_ORIGINS=http://localhost:5173
ENCRYPTION_KEY=           # required if USE_ENCRYPTION=true (match frontend key)
```

## 🧠 Domain: What This App Does

µ-PATH is an AI-assisted analysis pipeline for **micro-phenomenological interviews** — a qualitative research method for extracting detailed first-person accounts of experience. The app automates the laborious manual analysis described in `manual_kev.md` (Sheldrake & Dienes) and `manual_2018.md` (Valenzuela-Moguillansky & Vásquez-Rosati 2019).

**Pipeline logic (in order):**

- **Part -1** — identify independent variables before analysis begins
- **Part 0** — clean transcript: adherence check → refine utterance types → select procedural utterances
- **Part 1** — specific diachronic: segment → phase-tag → sort → group into IDUs (Incipient Diachronic Units = temporal moments)
- **Part 2** — specific synchronic: group IDUs by theme → identify ISUs (Incipient Synchronic Units) → structure
- **Part 3** — generic diachronic: align structures across participants → identify GDUs (Generic Diachronic Units)
- **Part 4** — generic synchronic: group SSS nodes → define Generic Synchronic Structure
- **Part 5** — comparative refinement by independent variable
- **Part 7** — causal modelling: formalise variables → pairwise links → DAG → testable hypotheses
- **Part 6** — generate markdown report

Each Part runs on a **single participant's transcript**. Generic analysis (Parts 3–4) requires all specific analyses (Parts 1–2) complete across participants first. Input unit is a **transcript** (utterances numbered line by line). Gemini processes one step at a time via `POST /api/analyze`.

## 🏗️ Architecture

```
Browser → Fastify backend (:3001) → Gemini API
            ↑ holds GEMINI_API_KEY
```

Frontend proxies all Gemini calls via `POST /api/analyze`. API key never reaches the browser. `REACT_APP_BACKEND_URL` is baked into browser-side JS at dev-server start — `http://localhost:3001` is correct even inside Docker (browser hits host port, not container network).

## 🗂️ Key Reference Files

- **`constants_backup_23b0993_full_generic.tsx`** — Backup of the original monolithic `constants.tsx` from commit `23b0993` ("runs all the way through"). Contains **working implementations of Parts 3–7** (generic diachronic, generic synchronic, comparative refinement, causal modelling, report generation) that were lost when Parts -1, 0, 1, and 2 were modularised into `src/config/pipeline/`. Parts 3–7 were never extracted to their own modules. Use this as the authoritative reference when implementing `src/config/pipeline/part3/` through `part7/`.

## ⚠️ Gotchas

- **Windows + Rollup**: after `npm install` in a new environment, `@rollup/rollup-win32-x64-msvc` may go missing. Fix: `npm install @rollup/rollup-win32-x64-msvc`
- **Backend TypeScript**: strict mode — add non-null assertions (`!`) or type guards before using potentially-undefined values
- **Encryption fallback**: `encryptionService.ts` and `analyze.ts` both have hardcoded fallback keys if env vars are unset. Always set real keys in production.
- **Docker**: `upath-backend/.env` must exist before `docker compose up`. `depends_on` does not wait for backend readiness — manual retry on first run if frontend can't reach backend.

## 📁 Structure

```
/                     # Frontend: React 19 + Vite + Zustand
  App.tsx             # Main app + ReportRenderer (DOMPurify-sanitized HTML output)
  services/           # geminiService.ts (proxy client), encryptionService.ts
  src/stores/         # pipelineStore.ts (main state), settingsStore, uiStore, historyStore
  src/config/pipeline/ # Modular pipeline step configs (part0–part2, partNeg1)
  src/services/PipelineOrchestrator.ts
upath-backend/        # Fastify proxy (holds GEMINI_API_KEY)
  src/routes/analyze.ts   # POST /api/analyze
  src/routes/models.ts    # GET /api/models
  src/server.ts           # exports buildApp() for testing
  src/debug/run-pipeline.ts  # CLI for running pipeline steps directly (dev only)
  debug-output/           # gitignored; step JSON outputs from debug CLI
```

## 🤖 Agents Available

1. micro-phenomenology-consultant
2. task-decomposer
3. react-typescript-developer
4. data-pipeline-developer
5. vitest-qa-engineer
6. senior-code-reviewer
7. documentation-specialist
8. prompt-engineer
9. code-refactoring-specialist
10. new-pipeline-step-workflow

## 🌐 External Resources

- deepwiki: http://deepwiki.com/Wordweaver-EH/upath/
