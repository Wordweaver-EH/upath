# Edge Cases for Invalidation Cascade Testing

## Critical Edge Cases Identified

### 1. **Execution Method Consistency** ✅ FIXED
- **Issue Found**: Autorun worked, manual "Run Step" and HIL didn't
- **Root Cause**: Different code paths - only autorun called invalidation logic
- **Fix Applied**: Moved invalidation from `toggleAutorun()` to `processSingleStep()`
- **Test**: All three methods (autorun, manual, HIL) now produce identical invalidation

### 2. **Per-Transcript Step Types**
- **Parts -1, 0**: Variable ID, Data Prep steps → should cascade to all global steps
- **Part I**: Specific Diachronic (P1.1-P1.4) → should cascade to Parts III+
- **Part II**: Specific Synchronic (P2S.1-P2S.3) → should cascade to Parts III+
- **Special Case**: P1.4 has additional cascading effects to Part II processing

### 3. **Phase-Level Invalidation (Part II)**
- Part II processes multiple phases per transcript
- **Critical**: Re-running P2S.2 for any phase should invalidate ALL global steps
- **Isolation**: Phase changes should not affect other transcripts

### 4. **Multi-Transcript Isolation**
- **Expected**: Correcting Transcript A only affects Transcript A + global steps
- **Verify**: Transcript B's per-transcript data (Parts -1,0,I,II) remain valid
- **Global Impact**: All transcripts share global analysis (Parts III+)

### 5. **Pipeline Position Dependencies**
- **Early Steps**: P_NEG1.1, P0.1 should cascade to ALL downstream steps
- **Mid Steps**: P1.2, P1.3 should cascade to Parts II+ and III+
- **Late Per-Transcript**: P2S.3 should still cascade to global steps
- **Global Steps**: Should only affect downstream global steps (preserve existing logic)

### 6. **Special Step Cascading Effects**
- **P1.4**: Clears Part II phase processing + global downstream
- **P3.3**: Affects all Part IV, V, VII processing states
- **P4S Steps**: Complex GDU-based processing with interdependencies

### 7. **State Completion Scenarios**
- **Complete State**: Re-running any step from fully green pipeline
- **Partial Completion**: Mid-pipeline invalidation and continuation
- **Mixed States**: Some transcripts complete, others partial

### 8. **Data Edge Cases**
- **No Transcripts**: Should handle gracefully without errors
- **Missing Phases**: Part II with no available phases
- **Incomplete Dependencies**: Steps run without proper prerequisites

### 9. **Human-in-the-Loop (HIL) Integration** ✅ CONFIRMED WORKING
- **HIL Method**: Uses `processSingleStep()` → gets invalidation automatically
- **Guidance Flow**: User corrections + invalidation cascade + step re-execution
- **Expected**: HIL corrections properly invalidate downstream global steps

### 10. **Cross-Scope Boundary Conditions**
- **Last Per-Transcript → First Global**: P2S.3 → P3.1 transition
- **Global-Only Changes**: P5.1 changes shouldn't over-invalidate per-transcript
- **Complete → Per-Transcript**: Re-running early steps from complete state

## Testing Strategy

### Primary Test Flow
1. Load complete state (everything green)
2. Navigate to per-transcript step for specific transcript
3. Execute step via different methods:
   - Manual "Run Step" button
   - HIL "Provide Guidance & Re-run"
   - Autorun functionality
4. Verify consistent invalidation patterns

### Expected Results
- ✅ All global steps (P3.1+) show as invalidated
- ✅ Active transcript's downstream per-transcript steps invalidated
- ✅ Other transcripts' per-transcript steps remain valid
- ✅ Identical behavior across all execution methods

### Critical Success Metrics
- **Data Consistency**: No stale global analysis results
- **Execution Parity**: Manual, HIL, and autorun behave identically
- **Transcript Isolation**: Changes to one transcript don't affect others' per-transcript data
- **Cascade Completeness**: All dependent downstream steps properly invalidated

## Implementation Notes

The fix addresses the core architectural flaw where different execution paths had inconsistent invalidation behavior. Moving invalidation logic to `processSingleStep()` ensures all step execution methods use unified invalidation logic, eliminating the "Catastrophic Invalidation Cascade Failure."