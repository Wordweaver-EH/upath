# BUG-002: Critical $1 Variable References - Fix Implementation Plan

## Bug Summary
Critical runtime error caused by 13 instances of invalid `$1` variable references in `src/stores/pipelineStore.ts`. These debugging remnants cause `ReferenceError: $1 is not defined` during pipeline execution.

## Root Cause Analysis

### Issue Origin
- **Debugging Artifacts**: `$1` likely originated from text editor debugging sessions or regex operations
- **Invalid JavaScript**: `$1` is not a valid JavaScript variable identifier
- **Runtime Impact**: Causes immediate `ReferenceError` when code paths are executed

### Affected Function Calls
1. **Auto-run Control**: `uiStore.setAutorunning($1)` - expects boolean parameter
2. **Transcript Selection**: `uiStore.setActiveTranscript($1)` - expects number parameter

## Implementation Tasks

### 🔴 Critical Priority - Fix $1 References

#### Task 1: Fix setAutorunning Calls (10 instances)
**Lines affected:** 304, 337, 367, 375, 397, 577, 606, 838, 1280, 1295

**Find Pattern:**
```typescript
uiStore.setAutorunning($1)
```

**Replace With:**
```typescript
uiStore.setAutorunning(false)
```

**Rationale:** All contexts show intent to stop autorun after error or completion

#### Task 2: Fix setActiveTranscript Calls (3 instances)
**Lines affected:** 1287, 1359, 1632

**Find Pattern:** 
```typescript
uiStore.setActiveTranscript($1)
```

**Replace With:**
```typescript
uiStore.setActiveTranscript(0)  
```

**Rationale:** Default to first transcript (index 0) when selection is needed

### 🟡 Medium Priority - Verification & Testing

#### Task 3: Global Search for Remaining $1 References
- Search entire codebase for `$1` pattern
- Verify no other files contain similar debugging artifacts
- Check for `$2`, `$3` etc. patterns as well

#### Task 4: Runtime Testing
- Upload test transcripts
- Execute pipeline end-to-end  
- Monitor console for any remaining ReferenceErrors
- Verify UI state transitions work correctly

### 🟢 Low Priority - Prevention Measures

#### Task 5: Add Linting Rules
- Configure ESLint to catch undefined variable references
- Add TypeScript strict mode if not already enabled
- Consider adding pre-commit hooks

## Detailed Fix Implementation

### Step 1: Open pipelineStore.ts
```bash
# Navigate to the file
code src/stores/pipelineStore.ts
```

### Step 2: Find and Replace Operations

**Operation A: Fix setAutorunning calls**
```
Find:    uiStore\.setAutorunning\(\$1\)
Replace: uiStore.setAutorunning(false)
Options: Use regex, case sensitive
```

**Operation B: Fix setActiveTranscript calls**  
```
Find:    uiStore\.setActiveTranscript\(\$1\)
Replace: uiStore.setActiveTranscript(0)
Options: Use regex, case sensitive
```

### Step 3: Manual Verification
Review each replaced line to ensure:
- Context makes sense for the replacement value
- Function signature matches expected parameters
- No other `$1` references remain nearby

### Step 4: Test Execution
1. Start development server: `npm run dev`
2. Upload multiple transcript files
3. Execute pipeline steps
4. Check browser console for errors
5. Verify pipeline completes successfully

## Expected Code Changes

### Before (Broken):
```typescript
// Line 304 example
setTimeout(() => { 
  uiStore.setAutorunning($1) // ReferenceError!
}, 0)

// Line 1287 example  
setTimeout(() => {
  uiStore.setActiveTranscript($1) // ReferenceError!
}, 0)
```

### After (Fixed):
```typescript
// Line 304 fixed
setTimeout(() => { 
  uiStore.setAutorunning(false) // Stops autorun correctly
}, 0)

// Line 1287 fixed
setTimeout(() => {
  uiStore.setActiveTranscript(0) // Selects first transcript
}, 0)
```

## Verification Checklist

### Code Changes
- [ ] All 10 `setAutorunning($1)` instances replaced with `setAutorunning(false)`
- [ ] All 3 `setActiveTranscript($1)` instances replaced with `setActiveTranscript(0)`
- [ ] No remaining `$1` references in pipelineStore.ts
- [ ] No `$1` references found in other files

### Functional Testing  
- [ ] Transcript upload works without errors
- [ ] Pipeline execution completes successfully
- [ ] No ReferenceError messages in console
- [ ] UI state updates correctly during pipeline
- [ ] Auto-run can be started and stopped properly

### Code Quality
- [ ] TypeScript compilation passes without errors
- [ ] ESLint passes without new warnings
- [ ] Function calls match interface signatures
- [ ] No other debugging artifacts found

## Risk Assessment

**Low Risk**: This is a straightforward find-and-replace operation with clear, deterministic fixes. The replacement values are contextually appropriate and match expected function signatures.

**High Impact**: Fixing this resolves critical runtime errors that prevent core application functionality.

## Timeline
- **Immediate**: Fix all $1 references (15 minutes)
- **Short-term**: Test and verify fixes (30 minutes) 
- **Medium-term**: Add prevention measures (1 hour)