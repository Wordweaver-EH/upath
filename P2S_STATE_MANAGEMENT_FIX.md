# P2S State Management Fix Summary

## Problem
During the P2S autorun loop (iterating from `du_1` to `du_11`), each time a P2S step completed for a new DU, a general-purpose block in `handleSuccessfulStep` was incorrectly processing the outputs. Instead of adding the new DU's data to the nested `p2s_outputs_by_du` map, it was overwriting a top-level property on the `TranscriptProcessedData` object, effectively clearing the map from previous iterations.

## Root Cause
The issue was in the `handleSuccessfulStep` function where the conditional logic for handling transcript-specific outputs wasn't specific enough. The general-purpose block for P0/P1 steps was inadvertently catching P2S steps during processing.

## Solution
The fix ensures that P2S step outputs are handled *exclusively* by the logic designed for them by:

1. Using an explicit `isP0orP1Step` check that includes only Part -1, 0, and 1 steps
2. Ensuring the P2S block (which checks for `currentDu`) is properly isolated
3. Adding clearer comments to indicate the isolation of different handling blocks

## Code Changes
- Added explicit check using `isP0orP1Step` variable to ensure only P0/P1 steps are handled by the first block
- Added comment to clarify that the P2S block is "correctly isolated"
- The key change prevents the state from being overwritten during P2S processing

## Result
With this fix, when P2S.4 Summary Table attempts to render, the `p2s_outputs_by_du` map will contain entries for all DUs (du_1 through du_11), not just the final one.