import { Annotation } from "@langchain/langgraph";

/**
 * MVP State Annotation for µ-PATH Pipeline
 * 
 * This minimal state structure supports:
 * - Multiple transcript processing
 * - Phase iteration through the pipeline
 * - GDU processing within phases
 * - Error tracking
 * - Progress monitoring
 */
export const UPathMVPAnnotation = Annotation.Root({
  // Pipeline metadata
  pipelineId: Annotation<string>({
    default: () => crypto.randomUUID(),
  }),
  
  // Input transcripts
  transcripts: Annotation<any[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Loop control indices
  currentTranscriptIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
    default: () => 0,
  }),
  
  currentPhaseIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
    default: () => 0,
  }),
  
  currentGDUIndex: Annotation<number>({
    reducer: (x, y) => (y ?? x),
    default: () => 0,
  }),
  
  // Current phase being processed
  currentPhase: Annotation<string>({
    reducer: (x, y) => (y ?? x),
    default: () => "",
  }),
  
  // GDUs for current transcript (populated by P3_2)
  gdus: Annotation<any[]>({
    reducer: (a, b) => (b ?? a), // Replace on new transcript
    default: () => [],
  }),
  
  // Accumulated step outputs
  stepOutputs: Annotation<Record<string, any>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  
  // Error tracking
  errors: Annotation<any[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  
  // Progress tracking
  progress: Annotation<number>({
    reducer: (x, y) => (y ?? x),
    default: () => 0,
  }),
  
  // Current status
  status: Annotation<"idle" | "running" | "completed" | "failed">({
    reducer: (x, y) => (y ?? x),
    default: () => "idle",
  }),
  
  // Single vs Multi transcript path flag
  isMultiTranscript: Annotation<boolean>({
    reducer: (x, y) => (y ?? x),
    default: () => false,
  }),
});

export type UPathMVPState = typeof UPathMVPAnnotation.State;

// Phase sequence definition
export const PHASE_SEQUENCE = [
  "P_NEG1_1",
  "P0_1", "P0_2", "P0_3",
  "P1_1", "P1_2", "P1_3", "P1_4",
  "P2S_1", "P2S_2", "P2S_3",
  "P3_1", "P3_2", "P3_3",
  "P4S_1_A", "P4S_1_B",
  "P5_1", "P5_2",
  "P7_1", "P7_2", "P7_3", "P7_3B", "P7_4", "P7_5",
  "P9_1",
  "COMPLETE"
];

// Phases that process GDUs
export const GDU_PROCESSING_PHASES = ["P4S_1_A", "P4S_1_B", "P5_1", "P5_2"];