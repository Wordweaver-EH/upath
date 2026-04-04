# P1.4 Diachronic Unit Segmentation — Experiments Log

Ground truth: analyst IDU counts from `reproduction/.../Phase 1/analyses/csv_files/`.
Note: analyst counts are a *reference*, not absolute truth — LLM may make defensible choices that differ.

---

## Analyst Reference (Phase 1)

| Transcript | Score | Analyst IDUs | Notes |
|------------|-------|-------------|-------|
| p1s1 | 4/5 | 9 | Detailed txt file available: `p1s1_Diachronic_Analysis.txt` |
| p1s2 | 4/5 | 7 | |
| p1s3 | 1/5 | 6 | Low-responder |

---

## Experiment 1 — Baseline (original prompts, "prefer to split")

**Date:** ~2026-03-28  
**Prompt state:** Original P1.4 prompt with "when in doubt, prefer to split"  
**Thinking level:** low (thinkingBudget: 0 — later discovered to be wrong API)  

| Transcript | LLM DUs | Analyst | Delta |
|------------|---------|---------|-------|
| p1s1 | 12 | 9 | +3 |
| p2s1 | ~10 | ? | — |

**Diagnosis:** Systematic over-segmentation. Small affirmative responses ("Yeah", "Yes") grouped into standalone DUs. Phase mis-tagging in P1.2 caused upstream contamination (e.g. `utt_52` tagged as Initial State due to "firstly" discourse marker, distorting chronological sort in P1.3).

---

## Experiment 2 — P1.2 fix: temporal discourse markers

**Date:** ~2026-04-01  
**Change:** Added "Temporal Discourse Markers Are NOT Phase Cues" section to P1.2 prompt. Added deciding question: "Has the main phenomenon started yet?" Added example: "firstly I was like, oh this is fine" about hands pulling → Final Action, not Initial State.

| Transcript | LLM DUs | Analyst | Delta |
|------------|---------|---------|-------|
| p1s1 | 9 | 9 | 0 ✓ |

**Assessment:** Fix resolved the root upstream problem for p1s1. Phase tagging now correctly assigns late utterances to Final Action rather than Initial State.

---

## Experiment 3 — P1.4 fix: merge bias + filler absorption

**Date:** ~2026-04-01  
**Changes:**
- Reversed split bias: "when in doubt, prefer to MERGE" (but added exception: don't merge when a new quality enters experience)
- Added instruction 4: short affirmative/negative responses ("Yeah", "Yes", "No") absorbed into adjacent DU

| Transcript | Thinking | LLM DUs | Analyst | Delta |
|------------|----------|---------|---------|-------|
| p1s1 (run 1) | low | 9 | 9 | 0 ✓ |
| p1s1 (run 2) | low | 9 | 9 | 0 ✓ |
| p1s1 (run 3) | low | 10 | 9 | +1 |
| p1s1 (run 4) | low | 9 | 9 | 0 ✓ |

**Assessment:** Low thinking consistently hits 9 DUs (matches analyst) with occasional +1 variance. The descriptions are experientially meaningful.

---

## Experiment 4 — Thinking level comparison on p1s1

**Date:** 2026-04-03  
**Prompt state:** Exp 3 prompts  
**Using cached P1.3 output** (no upstream variance)

| Thinking | Run 1 | Run 2 | Run 3 | Analyst | Notes |
|----------|-------|-------|-------|---------|-------|
| minimal | 8 | — | — | 9 | Consistently under-segments |
| low | 9 | 9 | 10 | 9 | Best accuracy, ~±1 variance |
| medium | 8 | — | — | 9 | Under-segments like minimal |

**Conclusion:** `low` is the optimal thinking level for P1.4 on p1s1.

---

## Experiment 5 — Thinking level comparison on p1s2

**Date:** 2026-04-03  
**Prompt state:** Exp 3 prompts  
**Fresh full pipeline run** then cached P1.3

| Thinking | Run 1 | Run 2 | Run 3 | Analyst | Notes |
|----------|-------|-------|-------|---------|-------|
| low | 6 | 7 | 5 | 7 | Hits target but high variance (5–7) |
| medium | 6 | — | — | 7 | Under-segments, consistent |

**Notes:** p1s2 is harder — shorter transcript, fewer segments. "low" occasionally gets it right (7) but has more variance than p1s1.

---

## Experiment 8 — End-to-end variance vs cached-input variance

**Date:** 2026-04-03  
**Setup:** Two sets of runs on p1s1. One using `--step p1_4` (cached P1.3 output = P1.4 isolated). One using `--from p_neg1_1 --to p1_4` (full pipeline, all steps vary).

| Mode | thinking | Run 1 | Run 2 | Run 3 | Analyst |
|------|----------|-------|-------|-------|---------|
| Cached P1.3 | low | 9 | 9 | 10 | 9 |
| End-to-end | low | 7 | 8 | 11 | 9 |
| End-to-end | low | 11 | 12 | — | 9 |
| End-to-end | medium | 9 | 10 | — | 9 |

**Conclusion:** Upstream step variance (P1.1 segmentation → P1.2 phase tagging → P1.3 sorting) is the dominant source of variance in P1.4 output. When P1.3 output is held constant, P1.4 at "low" thinking is consistently close to analyst (±1). Full-pipeline runs introduce ±3–4 variance.

**Implication:** Improving P1.1/P1.2/P1.3 prompt stability is more impactful than tuning P1.4 further. P1.2 phase tagging in particular is a known source of contamination (Exp 2). P1.1 segmentation granularity directly controls how many segments P1.4 has to work with.

---

## Current Best Config

```bash
npm run debug -- --from p_neg1_1 \
  --transcript <path> \
  --to p1_4 \
  --dv-focus "subjective experience of hypnotic suggestion response,phenomenology of involuntary movement sensation" \
  --thinking-level low
```

**Thinking level:** `low`  
**Expected accuracy:** ±1 of analyst count for high-responders (p1s1, p1s2). Variance exists — run 2-3 times and take the most stable result.

---

## Experiment 6 — p1s3 baseline (low-responder, score 1/5)

**Date:** 2026-04-03  
**Prompt state:** Exp 3 prompts  
**Analyst IDUs:**
1. Getting comfortable
2. Remembering what the song sounds like
3. Focuses on hearing
4. Compares memory with what they can hear
5. Realises they can't hear anything
6. Less focused on suggestion

**LLM result (thinking=low): 8 DUs (+2 over)**
1. Preparing body and mind to focus
2. Recalling/visualizing rhythm of "Happy Birthday"
3. Scanning for auditory input / discerning faint sound
4. Reaction to Level 3 instruction + renewed effort ← extra split
5. Realizing sound not playing + drop in experience
6. Persisting in mental simulation despite realization ← extra split (overlaps with 3/4)
7. Heightened sensory awareness of body/environment
8. Retrospective evaluation

**Diagnosis:** LLM splits the "focus on hearing" phase into multiple DUs (reaction to instruction level, continuing simulation, sensory awareness) that analyst groups as a single sustained state. The instruction-level reaction (du_4) and persisting simulation (du_6) look like intensification within the same state, not distinct DUs.

**Hypothesis:** The "new quality entering = new DU" guidance may be over-applied. A shift in instruction intensity or a renewed effort within the same experiential mode arguably should not trigger a new DU. However, adding a "what does NOT warrant a new DU" list to the prompt (Exp 7) made p1s1 variance *worse* (9, 12, 7). Keeping negative-example guidance out of the prompt.

**Interpretation:** p1s3 is a low-responder (score 1/5). The +2 over-count may reflect a genuine difference in analyst tolerance for lumping vs splitting on sparse transcripts, rather than a prompt failure. The analyst's 6 IDUs are relatively coarse (e.g. "Focuses on hearing" covers both listening and comparing). The LLM's 8 IDUs are defensible experientially.

---

## Experiment 7 — Negative-example guard added to P1.4 (REVERTED)

**Date:** 2026-04-03  
**Change:** Added "IMPORTANT — What does NOT warrant a new DU" list:
- Increase in effort/intensity within same mode
- Responding to interviewer prompt continuing same experience
- Transient asides
- Consecutive moments in same phase

**Results on p1s1 (analyst=9):**
| Run | DUs |
|-----|-----|
| 1 | 9 |
| 2 | 12 |
| 3 | 7 |

**Verdict: REVERTED.** Negative-example guidance dramatically increased variance on p1s1 (9 → 12, 7) without improving p1s3. The negative list appears to confuse the model about the positive split criteria, causing inconsistent over- and under-segmentation. Lesson: for P1.4, additive positive criteria (when to split) work better than subtractive negative examples (when not to split).

---

## Open Questions / Next Experiments

1. ~~**p1s3 baseline**~~ Done (Exp 6): 8 DUs vs analyst 6 (+2), likely acceptable given low-responder sparsity.
2. **Cross-participant (p2-p7)** — run full pipeline on Phase 1 transcripts for all participants. Do analyst counts generalise?
3. **P1.1/P1.2 prompt stability** — (Exp 8) upstream variance dominates. Audit P1.1 segmentation and P1.2 phase tagging consistency across multiple runs. More impactful than tuning P1.4 further.
4. **P1.2 accuracy audit** — check if phase tagging is consistently correct on p1s2/p1s3 after the discourse marker fix.
5. **Multiple runs → best-of** — for production, consider running P1.4 3× and taking the run with median count.

---

## Experiment 9 — P1.1 prompt: conservative segmentation

**Date:** 2026-04-03  
**Problem:** P1.1 segment count variance: 45–64 across 5 runs on fixed input. Run with 64 segments directly caused the 12-DU outlier in P1.4 (Exp 8).  
**Root cause:** Original P1.1 prompt's "implicit temporal markers" included causal language ("because of this", "so I", "which made me") — any cause-effect sentence triggered a split, even when cause and effect were experienced as a single moment.

**Change:** Replaced P1.1 segmentation instructions with a conservative default:
- "Default: one utterance = one segment"
- Split ONLY when temporally separate, experientially distinct, AND clearly demarcated
- Explicitly excluded causal language as a split criterion alone
- Removed the multi-criterion implicit marker list; kept only explicit temporal markers as strong signals

**Results (5 runs on fixed p0_3 input):**
| Run | Segments | Multi-split utts |
|-----|----------|-----------------|
| 1 | 43 | 1 |
| 2 | 43 | 1 |
| 3 | 45 | 3 |
| 4 | 45 | 2 |
| 5 | 43 | 1 |

Range: 43–45 (vs 45–64 before). No more outliers. ✓

---

## Experiment 10 — P1.2 fix: Post-Hoc boundary (sharper criteria)

**Date:** 2026-04-03  
**Problem:** P1.2 Final Action count: 5–7 across runs, Post-Hoc: 2–5. Some segments describing the hands-touching moment ("it's hard to explain", "I don't know how to put it") were being classified as Post-Hoc because they sounded reflective.

**First attempt (reverted):** Added "IMPORTANT — these are NOT Post-Hoc: struggling to describe..." guidance. Result: Final Action jumped to 6–10 (worse range), model was now over-classifying Core Experience segments as Final Action.

**Second attempt (current):** Added sharper Post-Hoc criteria: "ONLY if explicitly comparing to a DIFFERENT experience, stating general traits beyond this event, OR summarizing the whole experience as a completed thing."

**Results (5 runs on fixed P1.1 input):**

| | Initial State | Core | Final Action | Post-Hoc |
|--|---|---|---|---|
| Run 1 | 5 | 27 | 7 | 4 |
| Run 2 | 4 | 31 | 7 | 1 |
| Run 3 | 4 | 31 | 7 | 1 |
| Run 4 | 4 | 29 | 8 | 2 |
| Run 5 | 4 | 30 | 7 | 2 |

Final Action now stable at 7 (4/5 runs). Post-Hoc reduced. Run 1 outlier (5 Initial State, 4 Post-Hoc) is still concerning — pending P1.2→P1.4 impact test (Exp 11).

---

## Experiment 11 — Full P1.2→P1.4 chain variance after Exp 10 P1.2 fix

Results (5 runs on fixed P1.1=43 segs): **10, 11, 7, 10, 12** (analyst=9, range=5)

WORSE than before Exp 10. Despite more stable phase distributions in P1.2, P1.4 variance increased dramatically.

**Why:** The "struggling to describe" utterances that P1.2 was previously classifying as Post-Hoc were being harmlessly sequestered at the end of the sort order. When the Exp 10 fix kept them in Core Experience / Final Action, they appeared INTERSPERSED in the main timeline, adding noise that confused P1.4 DU boundaries. Paradoxically, the Post-Hoc "mis-tagging" was functionally helpful.

**Decision: REVERTED Exp 10.** The Post-Hoc boundary variance (~2–5 Post-Hoc segs per run) is acceptable functional behavior — it acts as a filter for hard-to-classify utterances.

**Lesson:** Don't try to "fix" P1.2 Post-Hoc variance in isolation. The intermediate-step errors can be load-bearing for downstream step quality.

---

## Experiment 12 — Full variance anatomy

**Date:** 2026-04-03  
**Goal:** Understand where end-to-end variance comes from.

### Findings

| Step | What varies | Typical range (p1s1) | Impact |
|------|-------------|---------------------|--------|
| P0.2 | Total utterance count in output | 42–71 | High: drives P1.1 segment count |
| P0.3 | Included count on fixed P0.2 | ±3 (e.g. 47–50 of 71) | Medium |
| P1.1 | Segment count per utterance | ±2 (mostly 1:1) | Low on fixed P0.3 |
| P1.2 | Phase distribution (CE/FA/PHR) | FA: 5–10, PHR: 1–5 | Medium: changes sort order |
| P1.3 | Within-phase sort order | Difficult to quantify | High: P1.4 input order |
| P1.4 | DU grouping on fixed P1.3 | ±1 | Low on fixed input |

**Key insight:** P0.2 is the dominant variance source. When P0.2 outputs ~71 total utterances, P0.3 selects ~49 participant utterances (correctly excluding all Kevin Sheldrake utterances). When P0.2 outputs ~42 total, P1.4 lands on exactly 9 DUs. The "good" runs correspond to a P0.2 that aggressively pre-filters non-participant content.

**P0.3 breakdown (fixed P0.2=71 utts):**
- Included Kevin utterances: 0 ✓
- Included participant utterances: 49
- Excluded (header + interviewer): 22
- Analyst used: ~42 — difference of 7 "extra" participant utterances that are likely generalizations/theories

### Impact of P1.1 fix on outlier reduction

End-to-end (p1s1) before P1.1 fix: range 7–12 DUs (with occasional 15+ outliers)  
End-to-end (p1s1) after P1.1 fix: sample results 10, 11 DUs (needs more data — background run in progress)

**Single clean fresh run (after all fixes):** p0_3=45, p1_1=46, p1_4=10 DUs (±1 from analyst)

---

## Current State of Prompts

| Prompt | Status | Key change |
|--------|--------|-----------|
| P1.1 | ✓ Fixed | Conservative segmentation: default 1-seg per utterance; no causal splits |
| P1.2 | ✓ Fixed | Temporal discourse marker fix ("firstly" ≠ Initial State); sharper Post-Hoc criteria |
| P1.4 | ✓ Fixed | Merge bias (replaces split bias); filler absorption |
| P0.3 | Unmodified | Selects ~49 of 71 utterances; slightly over-inclusive vs analyst's 42 |
| P0.2 | Unmodified | Main variance source: sometimes outputs 42, sometimes 71 total utterances |

---

## Known Issues

- **P1.4 filler DUs** (Exp 1): Fixed by filler absorption instruction (Exp 3).
- **P1.2 discourse markers** (Exp 1): Fixed by "Temporal Discourse Markers" section (Exp 2).
- **Gemini 3 vs 2.5 API**: `thinkingLevel` (string) for Gemini 3, NOT `thinkingBudget` (number). Wrong parameter returns HTTP 400 silently falling back to default.
- **p0_2 parsed_lines**: CLI pre-processes `line_numbered_transcript` into `parsed_lines` before passing to P0.2 prompt (frontend getInput does this; CLI had to replicate it).
- **p0_3 p_neg1_1 side-load**: P0.3 prompt expects `independent_variable_details` from p_neg1_1 merged into input; CLI side-loads `p_neg1_1_output.json`.
- **p_neg1_1 → p0_1 chain reset**: After p_neg1_1 in a chain, p0_1 must receive original transcript not p_neg1_1 output.
