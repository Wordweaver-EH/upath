# Debug Pipeline CLI Design

**Date:** 2026-04-03
**Scope:** `upath-backend/src/debug/run-pipeline.ts` — standalone CLI for running pipeline steps without the Chrome UI
**Goal:** Fast prompt/structure iteration on any modularised pipeline step

---

## Problem

Iterating on pipeline prompts via the Chrome UI is slow and token-wasteful: open browser, run full UI session, inspect output visually, repeat. A CLI runner eliminates that loop — run a step, see output, edit prompt, re-run in seconds.

---

## Design

### Single file

`upath-backend/src/debug/run-pipeline.ts`

All logic in one file. Prompts come from the real frontend step configs (imported via relative path). Gemini is called directly — no server process needed.

### Where it lives

```
upath-backend/
  src/debug/
    run-pipeline.ts       # the CLI
  debug-output/           # gitignored; step JSON outputs land here
  .gitignore              # add debug-output/
  package.json            # add "debug": "tsx src/debug/run-pipeline.ts"
```

### How step configs are imported

The frontend step configs (`src/config/pipeline/part*/`) export `generatePrompt` and `responseSchema`. These are pure TypeScript with no React runtime dependencies — `tsx` in Node.js handles them cleanly.

```typescript
import { P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG } from '../../src/config/pipeline/part1/P1_4_diachronicUnitGrouping';
// use: P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG.generatePrompt(input)
//      P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG.responseSchema
```

P1.3 is a special case: its main config's `generatePrompt` returns `""`. The CLI imports and uses `generatePhaseSpecificPrompt` directly, running one LLM call per coarse phase — matching `pipelineStore` behaviour.

### Supported steps (MVP)

All modularised steps:
- `p_neg1` — Part -1 (variable identification)
- `p0_1`, `p0_2`, `p0_3`, `p0_4` — Part 0 (transcript cleanup)
- `p1_1`, `p1_2`, `p1_3`, `p1_4`, `p1_5` — Part 1 diachronic
- `p2s_1`, `p2s_2`, `p2s_3`, `p2s_4` — Part 2 synchronic

P3–P7 are not yet modularised (still in `constants_backup_23b0993_full_generic.tsx`) — not supported until extracted.

### CLI interface

```bash
# Run a single step with saved input
npm run debug -- --step p1_4 --input debug-output/p1_3_output.json

# Run a range of steps, chaining outputs automatically
npm run debug -- --from p1_3 --to p1_5 --input debug-output/p1_2_output.json

# Run from raw transcript (Part 0 onwards)
npm run debug -- --from p0_1 --transcript transcripts/p1s1.txt

# Override model
npm run debug -- --step p1_4 --input debug-output/p1_3_output.json --model gemini-2.5-flash
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--step <id>` | Run a single step. Equivalent to `--from <id> --to <id>` |
| `--from <id>` | First step in chain |
| `--to <id>` | Last step in chain (inclusive). Defaults to `--from` value |
| `--input <file>` | JSON file containing the input for `--from` step |
| `--transcript <file>` | Raw transcript text file. Only valid when `--from p0_1` or `--from p_neg1` |
| `--model <id>` | Gemini model ID. Default: `gemini-3.1-flash-lite-preview` |

When running a chain (`--from`/`--to`), `--input` is only required for the first step if `debug-output/<step_id>_output.json` does not already exist. If it exists, it is used automatically. `--transcript` is only valid when `--from` is `p0_1` or `p_neg1`.

### Gemini calls

Direct `@google/generative-ai` SDK calls — same SDK already in `upath-backend`. Reads `GEMINI_API_KEY` from `upath-backend/.env` via `dotenv`. Non-thinking path only (Flash Lite doesn't use thinking config).

```typescript
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
```

### Output

Each step writes its output to `debug-output/<step_id>_output.json`. When running a chain, each step reads the previous step's output from `debug-output/` automatically — no manual chaining needed.

Human-readable summary printed to **stderr** after each step so you can read it without opening the JSON:

```
[p1_4] 9 DUs:
  du_1: Noticing the researcher's presence
  du_2: Pushing intrusive thoughts aside
  du_3: Hands beginning to move spontaneously
  ...
[p1_5] 3 phases, 2 hinge points:
  "Initial self-consciousness" → "Active avoidance" (hinge: effortful shift begins)
  "Active avoidance" → "Yielding to sensation" (hinge: hands start moving involuntarily)
```

Full JSON to `debug-output/`.

### P2S iteration (per-DU steps)

P2S steps run once per DU. When `--step p2s_1` is given, the CLI reads the DU list from the P1.5 output (loaded from `debug-output/p1_5_output.json` or `--input`) and runs one LLM call per DU, saving all DU outputs together in `debug-output/p2s_1_output.json`.

### Error handling

- Missing `GEMINI_API_KEY`: print clear error, exit 1
- Missing input file: print clear error, exit 1
- Gemini API error: print error with step name, exit 1
- Invalid `--step` / `--from` / `--to` value: list valid step IDs, exit 1

---

## What this does NOT change

- Frontend step configs — CLI is read-only consumer
- `pipelineStore.ts` — no changes
- Backend server routes — CLI bypasses the server entirely
- Tests — no new test required for a dev-only debug script

---

## Iteration workflow

```bash
# 1. One-time: run full chain to get stable P1.3 output
npm run debug -- --from p0_1 --transcript transcripts/p1s1.txt --to p1_3

# 2. Edit P1.4 prompt in src/config/pipeline/part1/P1_4_diachronicUnitGrouping.ts

# 3. Re-run just P1.4 (fast — one LLM call)
npm run debug -- --step p1_4 --input debug-output/p1_3_output.json

# 4. Compare DU count/names in stderr output vs ground truth

# 5. Repeat from step 2
```
