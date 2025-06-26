# Inter-Rater Reliability (IRR) Module

## Overview
The IRR module enables comparison of two independent µ-PATH analysis runs to measure reliability of GDU assignments using Krippendorff's Alpha coefficient.

## Key Components

### Statistical Foundation
- **Location**: `utils/statisticsHelper.ts`
- **Algorithm**: Krippendorff's Alpha for nominal data
- **Features**: Handles missing data, validates reliability matrices, provides qualitative interpretations

### Data Traceability  
- **Location**: `utils/traceabilityHelper.ts`
- **Function**: Maps utterances through pipeline (P0.3 → P1.1 → P1.2 → P1.3 → P3.2)
- **Key**: `mapUtteranceToGdu()` with deterministic GDU ordering (sorted)

### UI Components
- **IRRModal**: Main workflow interface (`components/IRRModal.tsx`)
- **GduMappingModal**: Human-in-the-loop GDU mapping validation (`components/GduMappingModal.tsx`)
- **Button**: "Compare Runs (IRR)" in ControlsPanel

### Report Generation
- **Location**: `utils/irrReportHelper.ts`
- **Outputs**: CSV and Markdown disagreement reports
- **Content**: Detailed analysis of where raters disagreed

## Architecture Notes
- Operates as self-contained module, not part of main pipeline
- Uses direct LLM service calls for semantic mapping (not formal pipeline step)
- Consolidated state pattern in `irrWorkflowState`
- No interference with sequential analysis workflow

## Workflow
1. Load two completed analysis JSON files
2. Check if GDU sets are identical
3. If different: LLM proposes semantic mappings → user validation
4. Calculate Krippendorff's Alpha
5. Display results with interpretation
6. Optional: Generate disagreement reports

## Testing
- 18 unit tests in `utils/__tests__/statisticsHelper.test.ts`
- Bug fix verification tests in `utils/__tests__/bugFixes.test.ts`
- All tests passing with proper edge case coverage