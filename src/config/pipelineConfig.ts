// ============================================================================
// PIPELINE CONFIGURATION (Extracted from constants.tsx after LangGraph Migration)
// ============================================================================
// Pipeline step definitions, display names, and ordering for frontend UI

import { StepId } from '../../types';

// ============================================================================
// STEP ORDERING (Pipeline Execution Order)
// ============================================================================

export const STEP_ORDER_PART_NEG1 = [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION];

export const STEP_ORDER_PART_0 = [
  StepId.P0_1_TRANSCRIPTION_ADHERENCE, 
  StepId.P0_2_REFINE_DATA_TYPES, 
  StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES
];

export const STEP_ORDER_PART_I = [
  StepId.P1_1_INITIAL_SEGMENTATION, 
  StepId.P1_2_DIACHRONIC_UNIT_ID, 
  StepId.P1_3_REFINE_DIACHRONIC_UNITS, 
  StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE
];

export const STEP_ORDER_PART_II = [
  StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, 
  StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, 
  StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE
];

export const STEP_ORDER_PART_III = [
  StepId.P3_1_ALIGN_STRUCTURES, 
  StepId.P3_2_IDENTIFY_GDUS, 
  StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE
];

export const STEP_ORDER_PART_IV = [
  StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, 
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS
];

export const STEP_ORDER_PART_V = [
  StepId.P5_1_IV_COMPARATIVE_ANALYSIS, 
  StepId.P5_2_HOLISTIC_REFINEMENT
];

export const STEP_ORDER_PART_VII = [
  StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION, 
  StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS, 
  StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS, 
  StepId.P7_3B_VALIDATE_AND_CLEAN_DAG, 
  StepId.P7_4_ANALYZE_PATHS_AND_BIASES, 
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES
];

export const STEP_ORDER_PART_VI = [StepId.P6_1_GENERATE_MARKDOWN_REPORT];

// Master pipeline order (all steps in execution sequence)
export const ALL_PIPELINE_STEP_IDS_IN_ORDER = [
  ...STEP_ORDER_PART_NEG1,
  ...STEP_ORDER_PART_0,
  ...STEP_ORDER_PART_I,
  ...STEP_ORDER_PART_II,
  ...STEP_ORDER_PART_III,
  ...STEP_ORDER_PART_IV,
  ...STEP_ORDER_PART_V,
  ...STEP_ORDER_PART_VII,
  ...STEP_ORDER_PART_VI,
  StepId.COMPLETE
];

// ============================================================================
// STEP DISPLAY NAMES (For UI)
// ============================================================================

export const STEP_DISPLAY_NAMES: { [key in StepId]: string } = {
  // Part -1: Variable Identification
  [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: "P-1.1: Variable Identification",

  // Part 0: Data Preparation
  [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: "P0.1: Transcription Adherence",
  [StepId.P0_2_REFINE_DATA_TYPES]: "P0.2: Refine Data Types",
  [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: "P0.3: Select Procedural Utterances",

  // Part I: Specific Diachronic Analysis
  [StepId.P1_1_INITIAL_SEGMENTATION]: "P1.1: Initial Segmentation",
  [StepId.P1_2_DIACHRONIC_UNIT_ID]: "P1.2: Diachronic Unit Identification",
  [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: "P1.3: Refine Diachronic Units",
  [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: "P1.4: Construct Specific Diachronic Structure",

  // Part II: Specific Synchronic Analysis
  [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: "P2S.1: Group Utterances by Topic",
  [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: "P2S.2: Identify Specific Synchronic Units",
  [StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE]: "P2S.3: Define Specific Synchronic Structure",

  // Part III: Generic Diachronic Analysis
  [StepId.P3_1_ALIGN_STRUCTURES]: "P3.1: Align Structures",
  [StepId.P3_2_IDENTIFY_GDUS]: "P3.2: Identify GDUs",
  [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: "P3.3: Define Generic Diachronic Structure",

  // Part IV: Generic Synchronic Analysis
  [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: "P4S.1.A: Identify and Group SSS Nodes",
  [StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS]: "P4S.1.B: Define GSS from Groups",

  // Part V: Refinement
  [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: "P5.1: IV Comparative Analysis",
  [StepId.P5_2_HOLISTIC_REFINEMENT]: "P5.2: Holistic Refinement",

  // Part VII: Causal Structure Elicitation
  [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: "P7.1: Candidate Variable Formalization",
  [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: "P7.2: Propose Pairwise Causal Links",
  [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: "P7.3: Assemble DAG and Identify Patterns",
  [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: "P7.3B: Validate and Clean DAG",
  [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: "P7.4: Analyze Paths and Biases",
  [StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]: "P7.5: Generate Formal Hypotheses",

  // Part VI: Report Generation
  [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: "P6.1: Generate Markdown Report",

  // Part IX: Inter-Rater Reliability Analysis
  [StepId.P9_1_SEMANTIC_GDU_MAPPING]: "P9.1: Semantic GDU Mapping",

  // Meta States
  [StepId.IDLE]: "Idle",
  [StepId.ALL_TRANSCRIPTS_VARIABLE_ID_DONE]: "All Transcripts: Variable Identification Complete",
  [StepId.ALL_TRANSCRIPTS_DATA_PREP_DONE]: "All Transcripts: Data Preparation Complete",
  [StepId.ALL_TRANSCRIPTS_SPECIFIC_DIACHRONIC_DONE]: "All Transcripts: Specific Diachronic Analysis Complete",
  [StepId.ALL_TRANSCRIPTS_SPECIFIC_SYNCHRONIC_DONE]: "All Transcripts: Specific Synchronic Analysis Complete",
  [StepId.ALL_GENERIC_DIACHRONIC_DONE]: "Generic Diachronic Analysis Complete",
  [StepId.ALL_GENERIC_SYNCHRONIC_DONE]: "Generic Synchronic Analysis Complete",
  [StepId.ALL_REFINEMENT_DONE]: "Refinement Complete",
  [StepId.ALL_CAUSAL_MODELING_DONE]: "Causal Modeling Complete",
  [StepId.COMPLETE]: "Analysis Complete"
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the display name for a step
 */
export function getStepDisplayName(stepId: StepId): string {
  return STEP_DISPLAY_NAMES[stepId] || stepId;
}

// ============================================================================
// AUTODOWNLOAD CONFIGURATION
// ============================================================================

// Steps that should trigger automatic download when completed
export const ESSENTIAL_STEPS_FOR_AUTODOWNLOAD = [
  StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
  StepId.P5_2_HOLISTIC_REFINEMENT,
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
  StepId.P6_1_GENERATE_MARKDOWN_REPORT,
  StepId.COMPLETE
];