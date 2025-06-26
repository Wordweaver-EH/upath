# P2S Infinite Loop Fix

## Bug Description
The application was getting stuck in an infinite loop at Part II (P2S) completion due to a React stale closure issue.

## Root Cause
In `getNextStepDetails` function, when P2S.3 completed, it checked `current_phase_for_p2s_processing` which was stale due to React's asynchronous state updates. This caused it to incorrectly loop back to P2S.1 instead of progressing.

## Fix Applied
Changed the condition in App.tsx (lines 416-426) from:
```typescript
if (currentTData.current_phase_for_p2s_processing) return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], ... };
```

To:
```typescript
if (!currentTData.isFullyProcessedSpecificSynchronic) {
    return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], ... };
} else {
    // Move to next transcript or Part 3
}
```

## Why This Works
- `isFullyProcessedSpecificSynchronic` is a more stable flag
- The inverted logic handles stale state gracefully
- If the flag is stale false, it loops once more harmlessly
- When state updates, the flag becomes true and progression continues

## Testing
Verified the fix handles:
- Multi-phase transcripts (phases loop correctly)
- Final transcript completion (moves to Part III)
- Transcripts with no phases (P2S is skipped)