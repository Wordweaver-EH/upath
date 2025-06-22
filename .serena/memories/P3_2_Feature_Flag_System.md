# P3_2 Feature Flag System

## Current Implementation (Updated)

The application now uses a single comprehensive feature flag system for P3_2 approaches:

### Environment Variable
```
REACT_APP_P3_2_APPROACH = 'original' | 'minified' | 'minimal_context_tsv' | 'full_context_tsv' | 'zero_context_tsv'
```

### Available Approaches
1. **original**: Legacy JSON approach with full IV analysis (~15k tokens)
2. **minified**: Compressed JSON approach with IV analysis (~10k tokens)  
3. **minimal_context_tsv**: Two-phase TSV with minimal P3.1 context + IV analysis (~5k tokens)
4. **full_context_tsv**: Two-phase TSV with full P3.1 context + IV analysis (~7k tokens)
5. **zero_context_tsv**: Two-phase TSV with no P3.1 context + IV analysis (~4k tokens)

### Implementation Location
- **Feature flag constant**: `constants.tsx` - `export const P3_2_APPROACH`
- **Step configuration**: `constants.tsx` - Dynamic routing in `STEP_CONFIGS[StepId.P3_2_IDENTIFY_GDUS]`
- **Aggregation logic**: `App.tsx` - Programmatic processing for non-original approaches

### Legacy Flag Removed
- **Deprecated**: `USE_TWO_PHASE_P3_2` boolean flag completely removed
- **Migration**: All logic now uses the comprehensive `P3_2_APPROACH` system
- **Backwards compatibility**: Legacy environment variable documentation updated to point to new system

### Key Features
- All approaches now include full IV (Independent Variable) analysis
- Two-phase architecture for non-original approaches (LLM classification + programmatic aggregation)
- Validation prevents hallucinated RDU IDs
- Token efficiency while maintaining feature parity