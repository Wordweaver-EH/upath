# IRR Transcript ID Normalization Fix

## Issue
The Inter-Rater Reliability (IRR) module was failing to match transcripts across different analysis runs because transcript IDs are generated using `Date.now()` in `App.tsx:processFiles`. This creates unique IDs for each analysis session, preventing proper comparison.

## Root Cause
- Transcript IDs: `transcript_${Date.now()}_${index}`
- Different runs create different IDs for same files
- IRR uses these IDs as part of utterance keys: `transcriptId|lineNumber`
- Results in 100% disagreement as no utterances match between runs

## Solution Implemented
Created `normalizeRunBData` function that:
1. Maps Run B transcript IDs to Run A IDs based on stable filenames
2. Updates TranscriptProcessedData IDs
3. Deep clones and updates GenericAnalysisState, specifically:
   - Updates `transcript_id` in `p3_2_output.identified_gdus[].contributing_refined_du_ids[]`
   - Ensures all references use consistent IDs

## Implementation Locations
- `utils/irrReportHelper.ts`: Added `normalizeRunBData` function
- `utils/irrReportHelper.ts`: Updated `generateDisagreementReport` to use normalization
- `App.tsx`: Updated `calculateIrrResults` to use normalization

## Alternative Long-term Solution
Consider making transcript IDs stable by default:
- Use deterministic ID based on filename hash
- Or use sanitized filename as ID directly
- Would eliminate need for normalization