import { StepId, GenericAnalysisState, TranscriptProcessedData, P2SPhaseData } from '../../types'
import { 
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC, 
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, 
  STEP_ORDER_PART_5_REFINEMENT, 
  STEP_ORDER_PART_7_CAUSAL_MODELING, 
  STEP_ORDER_PART_6_REPORT 
} from '../../constants'

export const isGlobalStep = (stepId: StepId) => 
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC.includes(stepId) ||
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId) || 
  STEP_ORDER_PART_5_REFINEMENT.includes(stepId) ||
  STEP_ORDER_PART_7_CAUSAL_MODELING.includes(stepId) || 
  STEP_ORDER_PART_6_REPORT.includes(stepId) || 
  stepId === StepId.COMPLETE

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
  [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: "p7_1_output",
  [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: "p7_2_output",
  [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: "p7_3_output",
  [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: "p7_3b_output",
  [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: "p7_4_output",
  [StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]: "p7_5_output",
  [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: "p6_1_output",
}