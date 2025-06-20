# Pipeline Architecture & Implementation Notes

## Core Pipeline Structure

### 9-Part Sequential Analysis
The application follows a strict pipeline detailed in `pipeline.md`:

1. **Part -1**: Variable Identification (per transcript)
2. **Part 0**: Data Preparation (per transcript)  
3. **Part I**: Specific Diachronic Analysis (per transcript)
4. **Part II_S**: Specific Synchronic Analysis (per transcript, per phase)
5. **Part III**: Generic Diachronic Analysis (cross-transcript)
6. **Part IV_S**: Generic Synchronic Analysis (per GDU)
7. **Part V**: Refinement (global)
8. **Part VII**: Causal Structure Elicitation (global)
9. **Part VI**: Report Generation (global)

### Implementation Patterns

#### Step Configuration System
- **constants.tsx**: Contains `STEP_CONFIGS` mapping each step ID to configuration
- **Step Dependencies**: Each step's `getInput()` validates prerequisites
- **Output Validation**: All outputs must match TypeScript interfaces exactly
- **JSON Self-Correction**: System includes parsing error recovery

#### Iterative Processing
- **Part II (P2S)**: Iterates over diachronic phases from Part I
- **Part IV (P4S)**: Iterates over Generic Diachronic Units (GDUs) from Part III
- **State Tracking**: Uses `current_phase_for_p2s_processing` and `current_gdu_for_p4s_processing`

#### State Management Architecture
```typescript
// Key state objects in App.tsx
rawTranscripts: RawTranscript[]                    // Input data
processedDataMap: Map<string, TranscriptProcessedData>  // Per-transcript results
genericAnalysisState: GenericAnalysisState         // Cross-transcript results
currentStepInfo: CurrentStepInfo                   // Pipeline execution status
promptHistory: PromptHistoryEntry[]                // API interaction log
```

## Critical Implementation Details

### Mermaid Diagram Generation
- **Transform Functions**: `utils/visualizationHelper.ts` converts structured data to Mermaid syntax
- **Automatic Generation**: Diagrams generated from pipeline outputs (P1.4, P2S.3, P3.3, P4S.1, P7.3)
- **Integration**: Diagrams embedded in UI and final reports

### Human-in-the-Loop (HIL) System
- **Modal Interface**: `components/HilModal.tsx` for user guidance input
- **Meta-prompts**: User guidance incorporated into re-run prompts
- **Downstream Invalidation**: Correcting a step resets dependent downstream data

### API Integration
- **Gemini Service**: `services/geminiService.ts` handles all AI interactions
- **Model Specification**: Uses `gemini-2.5-flash-preview-04-17` exclusively
- **Error Handling**: Comprehensive retry logic and JSON parsing self-correction

## Development Considerations

### When Modifying Pipeline Steps
1. **Update TypeScript interfaces** in `types.ts` first
2. **Modify step configuration** in `constants.tsx`
3. **Update transformation utilities** in `utils/` if needed
4. **Test with real data** through the full pipeline
5. **Verify Mermaid generation** still works

### State Consistency
- All pipeline data flows through strictly typed interfaces
- State updates must maintain referential integrity
- Save/load functionality preserves complete application state