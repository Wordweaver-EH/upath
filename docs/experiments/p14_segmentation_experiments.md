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
3. **P1.4 prompt: variance reduction** — can the "low" thinking variance on p1s1 (9, 9, 10, 9, 12, 7 with prompt v2) be tightened? Negative examples ("what NOT to split") make things worse. Try increasing thinkingLevel to "medium" if a future model version is more calibrated.
4. **P1.2 accuracy audit** — check if phase tagging is consistently correct on p1s2/p1s3 after the discourse marker fix.
5. **Multiple runs → best-of** — for production, consider running P1.4 3× and taking the run with median count.

---

## Known Issues

- **P1.4 filler DUs** (Exp 1): Fixed by filler absorption instruction (Exp 3).
- **P1.2 discourse markers** (Exp 1): Fixed by "Temporal Discourse Markers" section (Exp 2).
- **Gemini 3 vs 2.5 API**: `thinkingLevel` (string) for Gemini 3, NOT `thinkingBudget` (number). Wrong parameter returns HTTP 400 silently falling back to default.
- **p0_2 parsed_lines**: CLI pre-processes `line_numbered_transcript` into `parsed_lines` before passing to P0.2 prompt (frontend getInput does this; CLI had to replicate it).
- **p0_3 p_neg1_1 side-load**: P0.3 prompt expects `independent_variable_details` from p_neg1_1 merged into input; CLI side-loads `p_neg1_1_output.json`.
- **p_neg1_1 → p0_1 chain reset**: After p_neg1_1 in a chain, p0_1 must receive original transcript not p_neg1_1 output.
