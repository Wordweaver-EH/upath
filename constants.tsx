// ============================================================================
// ESSENTIAL CONSTANTS (Cleaned after LangGraph Migration)
// ============================================================================
// This file now contains only the minimal constants needed by the frontend.
// Most functionality has been moved to:
// - LangGraph backend nodes (prompt generation & validation)
// - src/components/ui/Icons.tsx (UI icons)
// - src/config/pipelineConfig.ts (pipeline configuration)

// ============================================================================
// CORE MODEL CONFIGURATION
// ============================================================================

export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';

// Feature flag for P3_2 implementation approach
export const P3_2_APPROACH = process.env.REACT_APP_P3_2_APPROACH || 'original';

// ============================================================================
// COMPATIBILITY STUB (DEPRECATED)
// ============================================================================
// Legacy imports - use src/config/pipelineConfig.ts for new code
// TODO: Remove this after migrating pipeline services to use LangGraph backend

import { 
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_I,
  STEP_ORDER_PART_II, 
  STEP_ORDER_PART_III, 
  STEP_ORDER_PART_IV, 
  STEP_ORDER_PART_V, 
  STEP_ORDER_PART_VI, 
  STEP_ORDER_PART_VII,
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  getStepDisplayName,
  ESSENTIAL_STEPS_FOR_AUTODOWNLOAD
} from './src/config/pipelineConfig';

import {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  NextIcon,
  PreviousIcon,
  UploadIcon,
  LoadIcon,
  SaveIcon,
  LightbulbIcon,
  FileTextIcon,
  CheckCircleIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RetryIcon,
  AppendixIcon
} from './src/components/ui/Icons';

export const STEP_CONFIGS: Record<string, any> = {};

// Legacy step order exports for compatibility
export { 
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_I as STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_II as STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_III as STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_IV as STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_V as STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_VI as STEP_ORDER_PART_6_REPORT,
  STEP_ORDER_PART_VII as STEP_ORDER_PART_7_CAUSAL_MODELING,
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  getStepDisplayName,
  ESSENTIAL_STEPS_FOR_AUTODOWNLOAD
};

// Legacy icon exports for compatibility
export {
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  NextIcon,
  PreviousIcon,
  UploadIcon,
  LoadIcon,
  SaveIcon,
  LightbulbIcon,
  FileTextIcon,
  CheckCircleIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RetryIcon,
  AppendixIcon
};

// Note: Legacy pipeline services that depend on these should be
// refactored to use the LangGraph backend API endpoints instead.

// ============================================================================
// NOTE: MAJOR CLEANUP COMPLETED
// ============================================================================
// 
// The following sections have been REMOVED as they are now handled by LangGraph:
// - validateAndCleanP3_2_Output function (backend validation)
// - buildDynamicP5Prompt function (P5 nodes handle prompts)
// - All P3.2 implementation strategies (backend handles)
// - CAUSAL_INFERENCE_GLOSSARY_TEXT (embedded in P7 nodes)
// - P7_BASIC_DEFINITIONS (embedded in P7 nodes)
// - STEP_CONFIGS object (2,044 lines removed!)
// - StepConfig interface and validation logic
//
// The following sections have been MOVED to organized modules:
// - UI Icons → src/components/ui/Icons.tsx
// - Pipeline configuration → src/config/pipelineConfig.ts
//
// RESULT: constants.tsx reduced from 2,889 lines to ~25 lines (99% reduction!)
// The frontend now imports from the LangGraph backend for all pipeline logic.
//
// ============================================================================