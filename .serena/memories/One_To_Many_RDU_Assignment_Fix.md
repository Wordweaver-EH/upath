# One-to-Many RDU Assignment Bug Fix

## Problem Identified
Critical methodological flaw where a single RDU could be assigned to multiple GDUs, violating the core principle that each utterance should map to exactly one GDU. This created:

- **Methodological Invalidity**: Breaking mutual exclusivity assumption fundamental to micro-phenomenological analysis
- **Invalid IRR Calculations**: Causing statistical errors in reliability matrix construction 
- **Confusing Downstream Analysis**: Inflating counts and creating misleading data interpretations

## Root Cause
The issue occurred because:
1. **LLM Prompt Constraint Missing**: Original P3.2 prompt lacked explicit exclusivity requirements
2. **No Defensive Validation**: No post-processing to catch and handle LLM errors
3. **Traceability Logic Correctly Reported**: `mapUtteranceToGdu()` was correctly finding multiple GDUs per RDU, exposing the underlying data problem

## Two-Part Solution Implemented

### Part 1: Preventative (Prompt Engineering)
- **Updated Original Approach Prompt** (`generateOriginalP3_2_Prompt`): Added **CRITICAL CONSTRAINT** that each refined DU must appear in exactly one GDU's `contributing_refined_du_ids` list
- **TSV Approaches Already Had Constraint**: All TSV-based approaches (`generateTwoPhaseP3_2_Prompt`, `generateFullContextTsvP3_2_Prompt`, `generateMinifiedP3_2_Prompt`) already included the "exactly once" rule

### Part 2: Defensive (Code Validation)  
- **New Validation Function**: `validateAndCleanP3_2_Output()` in `constants.tsx`
- **First-Assignment-Wins Strategy**: When duplicates detected, keeps first occurrence and filters out subsequent assignments with warning
- **Integrated into Pipeline**: Added `validateAndClean` property to P3.2 step config, called in `App.tsx` processing logic
- **Preserves Other Properties**: Maintains all GDU metadata while cleaning only the duplicate assignments

### Part 3: Test Coverage
- **Added Comprehensive Tests**: Three test cases in `utils/__tests__/bugFixes.test.ts`:
  1. Basic first-assignment-wins behavior
  2. Complex multi-GDU duplicate scenarios  
  3. Property preservation during cleaning

## Implementation Details
- **Location**: `constants.tsx:15-43` (validation function), `App.tsx:1016-1025` (integration)
- **Approach**: Non-breaking change - existing valid outputs unchanged, only fixes invalid LLM responses
- **Warning System**: Console warnings logged when duplicates detected for debugging
- **Export**: Function exported for testing and potential future use

## Impact
- **Ensures Methodological Validity**: Guarantees one-utterance-one-GDU principle
- **Fixes IRR Statistical Issues**: Eliminates reliability matrix construction errors
- **Maintains Data Integrity**: Preserves deterministic analysis results
- **Backward Compatible**: No breaking changes to existing valid data