# Pipeline Architecture Overview

## Current Pipeline Structure
The upath system implements a multi-phase pipeline for processing transcripts:

### Phase 0: Data Preparation
- P0_1_TRANSCRIPTION_ADHERENCE
- P0_2_REFINE_DATA_TYPES (ILP Detection)
- P0_3_SELECT_PROCEDURAL_UTTERANCES

### Phase 1: Specific Diachronic Analysis
- P1_1_INITIAL_SEGMENTATION
- P1_2_DIACHRONIC_UNIT_ID
- P1_3_REFINE_DIACHRONIC_UNITS
- P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE

### Phase 2: Specific Synchronic Analysis
- P2S_1_GROUP_UTTERANCES_BY_TOPIC
- P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS
- P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE

## Key Services
- PipelineOrchestrator: Main orchestration logic
- StepExecutionService: Individual step execution
- StoreTransactionService: State management with transactions
- PipelineStateManagementService: UI and state coordination
- GeminiService: API integration for LLM calls

## State Management
- Uses Zustand stores with persistence
- Transaction-based updates for consistency
- Service-based architecture with dependency injection