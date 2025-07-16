/**
 * Pipeline Definition and Configuration
 * 
 * This file centralizes all pipeline-related configuration including:
 * - Step definitions and ordering
 * - Pipeline structure with iteration patterns
 * - Step configurations for processing
 */

import { 
  StepId,
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  P2SPhaseData,
  CurrentStepInfo,
  SavedState,
  SettingsData
} from '../../types'

/**
 * Iteration patterns for pipeline execution
 */
export type IterationType = 'per-transcript' | 'per-phase' | 'per-gdu' | 'global'

/**
 * Pipeline part definition with metadata
 */
export interface PipelinePart {
  name: string
  steps: StepId[]
  iteration: IterationType
  canPause?: boolean
  resumeStrategy?: 'from-step' | 'from-iteration-start'
  prerequisiteParts?: string[]
}

/**
 * Step configuration interface
 */
export interface StepConfig {
  id: StepId
  title: string
  part: string
  iteration?: IterationType // Override part's iteration type if needed
  isJsonOutput: boolean
  getInput: (
    currentTranscript: RawTranscript | undefined,
    allProcessedData: Map<string, TranscriptProcessedData>,
    genericState: GenericAnalysisState,
    apiKeyPresent: boolean,
    userDvFocus?: { dv_focus: string[] }
  ) => { data: any; error?: string } | { data: null; error: string }
  canSkip?: (state: { processedData: Map<string, TranscriptProcessedData>, genericState: GenericAnalysisState }) => boolean
  isComplete?: (state: { processedData: Map<string, TranscriptProcessedData>, genericState: GenericAnalysisState }) => boolean
}

/**
 * Step ordering arrays - defining the sequence of steps in each part
 */
export const STEP_ORDER_PART_NEG1 = [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]

export const STEP_ORDER_PART_0 = [
  StepId.P0_1_TRANSCRIPTION_ADHERENCE,
  StepId.P0_2_REFINE_DATA_TYPES,
  StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES
]

export const STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC = [
  StepId.P1_1_INITIAL_SEGMENTATION,
  StepId.P1_2_DIACHRONIC_UNIT_ID,
  StepId.P1_3_REFINE_DIACHRONIC_UNITS,
  StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE
]

export const STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC = [
  StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
  StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
  StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE
]

export const STEP_ORDER_PART_3_GENERIC_DIACHRONIC = [
  StepId.P3_1_ALIGN_STRUCTURES,
  StepId.P3_2_IDENTIFY_GDUS,
  StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE
]

export const STEP_ORDER_PART_4_GENERIC_SYNCHRONIC = [
  StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS
]

export const STEP_ORDER_PART_5_REFINEMENT = [
  StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
  StepId.P5_2_HOLISTIC_REFINEMENT
]

export const STEP_ORDER_PART_7_CAUSAL_MODELING = [
  StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
  StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
  StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
  StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
  StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES
]

export const STEP_ORDER_PART_6_REPORT = [StepId.P6_1_GENERATE_MARKDOWN_REPORT]

/**
 * All pipeline steps in execution order
 */
export const ALL_PIPELINE_STEP_IDS_IN_ORDER: StepId[] = [
  ...STEP_ORDER_PART_NEG1,
  ...STEP_ORDER_PART_0,
  ...STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  ...STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  ...STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  ...STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  ...STEP_ORDER_PART_5_REFINEMENT,
  ...STEP_ORDER_PART_7_CAUSAL_MODELING,
  ...STEP_ORDER_PART_6_REPORT,
  StepId.COMPLETE
]

/**
 * Declarative pipeline structure with metadata
 */
export const PIPELINE_STRUCTURE: PipelinePart[] = [
  {
    name: "Part -1: Variable Identification",
    steps: STEP_ORDER_PART_NEG1,
    iteration: 'per-transcript',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part 0: Data Preparation",
    steps: STEP_ORDER_PART_0,
    iteration: 'per-transcript',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part I: Specific Diachronic Analysis",
    steps: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
    iteration: 'per-transcript',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part II: Specific Synchronic Analysis",
    steps: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
    iteration: 'per-phase',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part III: Generic Diachronic Analysis",
    steps: STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
    iteration: 'global',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part IV: Generic Synchronic Analysis",
    steps: STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
    iteration: 'per-gdu',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part V: Refinement",
    steps: STEP_ORDER_PART_5_REFINEMENT,
    iteration: 'global',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part VII: Causal Modeling",
    steps: STEP_ORDER_PART_7_CAUSAL_MODELING,
    iteration: 'global',
    canPause: true,
    resumeStrategy: 'from-step'
  },
  {
    name: "Part VI: Report Generation",
    steps: STEP_ORDER_PART_6_REPORT,
    iteration: 'global',
    canPause: false,
    resumeStrategy: 'from-step'
  }
]

/**
 * Helper function to determine if a step is global (operates on all transcripts at once)
 */
export const isGlobalStep = (stepId: StepId): boolean => 
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC.includes(stepId) ||
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId) || 
  STEP_ORDER_PART_5_REFINEMENT.includes(stepId) ||
  STEP_ORDER_PART_7_CAUSAL_MODELING.includes(stepId) || 
  STEP_ORDER_PART_6_REPORT.includes(stepId) || 
  stepId === StepId.COMPLETE

/**
 * Map step IDs to their data key prefixes in the state
 */
export const stepIdToDataKeyPrefix: Partial<Record<StepId, keyof GenericAnalysisState | keyof TranscriptProcessedData | keyof P2SPhaseData>> = {
  [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: "p_neg1_1_output",
  [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: "p0_1_output",
  [StepId.P0_2_REFINE_DATA_TYPES]: "p0_2_output",
  [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: "p0_3_output",
  [StepId.P1_1_INITIAL_SEGMENTATION]: "p1_1_output",
  [StepId.P1_2_DIACHRONIC_UNIT_ID]: "p1_2_output",
  [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: "p1_3_output",
  [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: "p1_4_output",
  [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: "p2s_1_output",
  [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: "p2s_2_output",
  [StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE]: "p2s_3_output",
  [StepId.P3_1_ALIGN_STRUCTURES]: "p3_1_output",
  [StepId.P3_2_IDENTIFY_GDUS]: "p3_2_output",
  [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: "p3_3_output",
  [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: "p4s_1_a_outputs_by_gdu",
  [StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS]: "p4s_outputs_by_gdu",
  [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: "p5_1_output",
  [StepId.P5_2_HOLISTIC_REFINEMENT]: "p5_2_output",
  [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: "p6_1_output",
  [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: "p7_1_output",
  [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: "p7_2_output",
  [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: "p7_3_output",
  [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: "p7_3b_output",
  [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: "p7_4_output",
  [StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]: "p7_5_output"
}

/**
 * Get the pipeline part for a given step
 */
export function getPipelinePartForStep(stepId: StepId): PipelinePart | undefined {
  return PIPELINE_STRUCTURE.find(part => part.steps.includes(stepId))
}

/**
 * Get the iteration type for a given step
 */
export function getIterationTypeForStep(stepId: StepId): IterationType | undefined {
  const part = getPipelinePartForStep(stepId)
  return part?.iteration
}

/**
 * Essential steps for auto-download functionality
 */
export const ESSENTIAL_STEPS_FOR_AUTODOWNLOAD: StepId[] = [
  // Part 0
  StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
  // Part I
  StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  // Part II_S (Note: P2S_3 output is per phase, handled in App.tsx)
  StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  // Part III
  StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
  // Part IV_S (Note: P4S_1_B output is per GDU, handled in App.tsx)
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
  // Part V
  StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
  StepId.P5_2_HOLISTIC_REFINEMENT,
  // Part VII
  StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS, // Initial DAG
  StepId.P7_3B_VALIDATE_AND_CLEAN_DAG, // Cleaned DAG
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
  // Part VI
  StepId.P6_1_GENERATE_MARKDOWN_REPORT,
  StepId.COMPLETE, // Final report if auto-download enabled
]

/**
 * User-friendly display names for pipeline steps (hides confusing technical naming)
 */
export const STEP_DISPLAY_NAMES: Record<StepId, string> = {
  // Part 1: Variable Identification
  [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: "1. Variable Identification",
  
  // Part 2: Data Preparation  
  [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: "2. Transcript Preparation",
  [StepId.P0_2_REFINE_DATA_TYPES]: "3. Data Type Refinement", 
  [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: "4. Utterance Selection",
  
  // Part 3: Temporal Analysis
  [StepId.P1_1_INITIAL_SEGMENTATION]: "5. Initial Segmentation",
  [StepId.P1_2_DIACHRONIC_UNIT_ID]: "6. Temporal Unit Identification", 
  [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: "7. Temporal Unit Refinement",
  [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: "8. Temporal Structure",
  
  // Part 4: Synchronic Analysis
  [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: "9. Topic Grouping",
  [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: "10. Synchronic Units",
  [StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE]: "11. Synchronic Structure",
  
  // Part 5: Cross-Transcript Analysis  
  [StepId.P3_1_ALIGN_STRUCTURES]: "12. Structure Alignment",
  [StepId.P3_2_IDENTIFY_GDUS]: "13. Generic Unit Identification",
  [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: "14. Generic Structure",
  
  // Part 6: Generic Synchronic Analysis
  [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: "15. Node Identification", 
  [StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS]: "16. Generic Synchronic Groups",
  
  // Part 7: Refinement
  [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: "17. Comparative Analysis",
  [StepId.P5_2_HOLISTIC_REFINEMENT]: "18. Holistic Refinement",
  
  // Part 8: Causal Analysis
  [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: "19. Variable Formalization",
  [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: "20. Causal Links",
  [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: "21. DAG Assembly",
  [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: "22. DAG Validation",
  [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: "23. Path Analysis",
  [StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]: "24. Hypothesis Generation",
  
  // Part 9: Report
  [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: "25. Generate Report",
  
  // Meta states  
  [StepId.IDLE]: "Idle",
  [StepId.ALL_TRANSCRIPTS_VARIABLE_ID_DONE]: "Variable ID Complete",
  [StepId.ALL_TRANSCRIPTS_DATA_PREP_DONE]: "Data Prep Complete",
  [StepId.ALL_TRANSCRIPTS_SPECIFIC_DIACHRONIC_DONE]: "Specific Diachronic Complete",
  [StepId.ALL_TRANSCRIPTS_SPECIFIC_SYNCHRONIC_DONE]: "Specific Synchronic Complete",
  [StepId.COMPLETE]: "Complete",
  
  // Part IX: Inter-Rater Reliability
  [StepId.P9_1_SEMANTIC_GDU_MAPPING]: "26. Semantic GDU Mapping",
}

/**
 * Helper function to get user-friendly step name
 */
export function getStepDisplayName(stepId: StepId): string {
  return STEP_DISPLAY_NAMES[stepId] || stepId
}

// Note: STEP_CONFIGS will be moved here from constants.tsx in the next step