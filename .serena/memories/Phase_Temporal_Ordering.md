# Phase Temporal Ordering System

## Purpose
Ensures correct temporal sequencing of RDUs and phases throughout the pipeline.

## Standard Phase Order Mapping
```typescript
const phaseOrder: Record<string, number> = {
    "Beginning": 0, "Start": 0, "Initial": 0,
    "Early": 1, "Early-Middle": 1,
    "Core": 2, "Core Event": 2, "Middle": 2, "Peak": 2,
    "Late": 3, "Late-Middle": 3,
    "End": 4, "Ending": 4, "Final": 4, "Conclusion": 4,
    "Reflection": 5, "Post": 5, "After": 5,
    "Transition": 6, "Between": 6,
    "Other": 99
};
```

## Usage
- Used in P5.1 for correct GDU sequence extraction
- Ensures temporal consistency across different phase naming conventions
- Fallback to value 99 for unrecognized phases

## Related Functions
- `compareRduIds()`: Handles numeric sorting of RDU IDs
- `extractNumericFromRduId()`: Extracts numeric portion from IDs like "DU_1", "RDU_10"

## Important Note
Phase names should be consistent within a dataset but the system handles variations gracefully.