# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Utilities Architecture Overview

This directory contains utility functions and helpers that support various features across the application.

### Utility Modules by Category:

#### Data Export/Import:
- **csvExport.ts**: Exports analysis data to CSV format
- **tsvHelper.ts**: Handles TSV parsing and export for transcript data
- **htmlHelper.ts**: Generates HTML reports with full analysis results
- **p2s4HtmlExport.ts**: Specialized HTML export for P2S.4 summary tables

#### Data Transformation:
- **p2s4DataTransformer.ts**: Transforms pipeline data for P2S.4 visualization
- **migration.ts**: Handles data migration between app versions
- **stepIdToDataKeyPrefix.ts**: Maps step IDs to storage keys

#### Analysis Helpers:
- **statisticsHelper.ts**: Calculates statistics for analysis results
- **traceabilityHelper.ts**: Tracks data lineage through pipeline steps
- **phaseTracingHelper.ts**: Traces phase assignments across units
- **visualizationHelper.ts**: Prepares data for visualization components

#### Reporting:
- **reportHelper.ts**: Generates comprehensive analysis reports
- **irrReportHelper.ts**: Specialized reporting for Inter-Rater Reliability

#### Storage & Persistence:
- **storage.ts**: LocalStorage wrapper with versioning and migration
- **timeHelper.ts**: Time formatting utilities

### Design Patterns:
1. **Pure Functions**: Most utilities are stateless, pure functions
2. **Type Safety**: All functions use TypeScript for input/output typing
3. **Error Handling**: Functions validate inputs and handle edge cases
4. **Modularity**: Each file focuses on a specific domain or feature
5. **Testability**: Complex utilities have corresponding test files

### Key Features:
- CSV/TSV export maintains data integrity and proper escaping
- HTML exports include styling and are self-contained
- Traceability helpers maintain audit trails for compliance
- Storage utilities handle versioning and backward compatibility
- Statistics calculations follow established research methods

### Testing:
Many utilities have comprehensive test suites:
- htmlHelper.test.ts
- reportHelper.test.ts  
- tsvHelper.test.ts
- visualizationHelper.test.ts
- rduSorting.test.ts
- singleIvCondition.test.ts

### Known Complexities:
- HTML generation must handle complex nested structures
- TSV parsing must handle edge cases (quotes, newlines)
- Migration logic must maintain backward compatibility
- Traceability must track all data transformations
- Storage versioning requires careful schema management
