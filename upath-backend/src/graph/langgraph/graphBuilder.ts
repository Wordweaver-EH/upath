import { StateGraph, END, START } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { UPathMVPAnnotation, UPathMVPState, PHASE_SEQUENCE, GDU_PROCESSING_PHASES } from "./annotations";
import { wrapExistingNode, wrapMultiTranscriptNode } from "./nodeWrapper";

// Import all node classes (same as before)
import { P_NEG1_1_VariableIdentificationNode } from "../nodes/P_NEG1_1_VariableIdentificationNode";
import { P0_1_TranscriptionAdherenceNode } from "../nodes/P0_1_TranscriptionAdherenceNode";
import { P0_2_RefineDataTypesNode } from "../nodes/P0_2_RefineDataTypesNode";
import { P0_3_SelectProceduralUtterancesNode } from "../nodes/P0_3_SelectProceduralUtterancesNode";
import { P1_1_InitialSegmentationNode } from "../nodes/P1_1_InitialSegmentationNode";
import { P1_2_DiachronicUnitIdNode } from "../nodes/P1_2_DiachronicUnitIdNode";
import { P1_3_RefineDiachronicUnitsNode } from "../nodes/P1_3_RefineDiachronicUnitsNode";
import { P1_4_ConstructSpecificDiachronicStructureNode } from "../nodes/P1_4_ConstructSpecificDiachronicStructureNode";
import { P2S_1_GroupUtterancesByTopicNode } from "../nodes/P2S_1_GroupUtterancesByTopicNode";
import { P2S_2_IdentifySpecificSynchronicUnitsNode } from "../nodes/P2S_2_IdentifySpecificSynchronicUnitsNode";
import { P2S_3_DefineSpecificSynchronicStructureNode } from "../nodes/P2S_3_DefineSpecificSynchronicStructureNode";
import { P3_1_AlignStructuresNode } from "../nodes/P3_1_AlignStructuresNode";
import { P3_2_IdentifyGDUsNode } from "../nodes/P3_2_IdentifyGDUsNode";
import { P3_3_DefineGenericDiachronicStructureNode } from "../nodes/P3_3_DefineGenericDiachronicStructureNode";
import { P4S_1_A_IdentifyAndGroupSSSNodesNode } from "../nodes/P4S_1_A_IdentifyAndGroupSSSNodesNode";
import { P4S_1_B_DefineGSSFromGroupsNode } from "../nodes/P4S_1_B_DefineGSSFromGroupsNode";
import { P5_1_ComparativeAnalysisNode } from "../nodes/P5_1_ComparativeAnalysisNode";
import { P5_2_HolisticRefinementNode } from "../nodes/P5_2_HolisticRefinementNode";
import { P7_1_CandidateVariableFormalizationNode } from "../nodes/P7_1_CandidateVariableFormalizationNode";
import { P7_2_ProposePairwiseCausalLinksNode } from "../nodes/P7_2_ProposePairwiseCausalLinksNode";
import { P7_3_AssembleDAGAndIdentifyPatternsNode } from "../nodes/P7_3_AssembleDAGAndIdentifyPatternsNode";
import { P7_3B_ValidateAndCleanDAGNode } from "../nodes/P7_3B_ValidateAndCleanDAGNode";
import { P7_4_AnalyzePathsAndBiasesNode } from "../nodes/P7_4_AnalyzePathsAndBiasesNode";
import { P7_5_GenerateFormalHypothesesNode } from "../nodes/P7_5_GenerateFormalHypothesesNode";
import { P9_1_SemanticGduMappingNode } from "../nodes/P9_1_SemanticGduMappingNode";
import { CompleteNode } from "../nodes/CompleteNode";

/**
 * µ-PATH LangGraph pipeline with proper loop logic
 */
export function buildUPathGraph() {
  const graph = new StateGraph(UPathMVPAnnotation)
    // Initialize
    .addNode("initialize", initializeNode)
    
    // Phase -1 and 0 (process all transcripts together)
    .addNode("P_NEG1_1", wrapMultiTranscriptNode(P_NEG1_1_VariableIdentificationNode))
    .addNode("P0_1", wrapMultiTranscriptNode(P0_1_TranscriptionAdherenceNode))
    .addNode("P0_2", wrapMultiTranscriptNode(P0_2_RefineDataTypesNode))
    .addNode("P0_3", wrapMultiTranscriptNode(P0_3_SelectProceduralUtterancesNode))
    
    // Routing decision
    .addNode("routingDecision", routingDecisionNode)
    
    // SINGLE TRANSCRIPT PATH
    .addNode("P1_1", wrapExistingNode(P1_1_InitialSegmentationNode))
    .addNode("P1_2", wrapExistingNode(P1_2_DiachronicUnitIdNode))
    .addNode("P1_3", wrapExistingNode(P1_3_RefineDiachronicUnitsNode))
    .addNode("P1_4", wrapExistingNode(P1_4_ConstructSpecificDiachronicStructureNode))
    
    // MULTI TRANSCRIPT PATH WITH LOOPS
    
    // Transcript loop controller
    .addNode("transcriptLoopController", transcriptLoopControllerNode)
    .addNode("selectCurrentTranscript", selectCurrentTranscriptNode)
    
    // Phase loop controller
    .addNode("phaseLoopController", phaseLoopControllerNode)
    
    // Phase nodes (wrapped to process current transcript)
    .addNode("P2S_1", wrapExistingNode(P2S_1_GroupUtterancesByTopicNode))
    .addNode("P2S_2", wrapExistingNode(P2S_2_IdentifySpecificSynchronicUnitsNode))
    .addNode("P2S_3", wrapExistingNode(P2S_3_DefineSpecificSynchronicStructureNode))
    .addNode("P3_1", wrapExistingNode(P3_1_AlignStructuresNode))
    .addNode("P3_2", wrapExistingNode(P3_2_IdentifyGDUsNode))
    .addNode("P3_3", wrapExistingNode(P3_3_DefineGenericDiachronicStructureNode))
    
    // GDU loop controller (for P4S and P5)
    .addNode("gduLoopController", gduLoopControllerNode)
    .addNode("selectCurrentGDU", selectCurrentGDUNode)
    
    .addNode("P4S_1_A", wrapExistingNode(P4S_1_A_IdentifyAndGroupSSSNodesNode))
    .addNode("P4S_1_B", wrapExistingNode(P4S_1_B_DefineGSSFromGroupsNode))
    .addNode("P5_1", wrapExistingNode(P5_1_ComparativeAnalysisNode))
    .addNode("P5_2", wrapExistingNode(P5_2_HolisticRefinementNode))
    
    // Post-GDU processing
    .addNode("P7_1", wrapExistingNode(P7_1_CandidateVariableFormalizationNode))
    .addNode("P7_2", wrapExistingNode(P7_2_ProposePairwiseCausalLinksNode))
    .addNode("P7_3", wrapExistingNode(P7_3_AssembleDAGAndIdentifyPatternsNode))
    .addNode("P7_3B", wrapExistingNode(P7_3B_ValidateAndCleanDAGNode))
    .addNode("P7_4", wrapExistingNode(P7_4_AnalyzePathsAndBiasesNode))
    .addNode("P7_5", wrapExistingNode(P7_5_GenerateFormalHypothesesNode))
    .addNode("P9_1", wrapExistingNode(P9_1_SemanticGduMappingNode))
    .addNode("COMPLETE", wrapExistingNode(CompleteNode))
    
    // Finalize
    .addNode("finalize", finalizeNode)
    
    // EDGES - Start
    .addEdge(START, "initialize")
    .addEdge("initialize", "P_NEG1_1")
    .addEdge("P_NEG1_1", "P0_1")
    .addEdge("P0_1", "P0_2")
    .addEdge("P0_2", "P0_3")
    .addEdge("P0_3", "routingDecision")
    
    // Routing
    .addConditionalEdges("routingDecision", routingDecider, {
      single: "P1_1",
      multi: "transcriptLoopController",
    })
    
    // Single transcript path
    .addEdge("P1_1", "P1_2")
    .addEdge("P1_2", "P1_3")
    .addEdge("P1_3", "P1_4")
    .addEdge("P1_4", "finalize")
    
    // Multi transcript path - Transcript loop
    .addConditionalEdges("transcriptLoopController", transcriptLoopDecider, {
      continue: "selectCurrentTranscript",
      done: "finalize",
    })
    .addEdge("selectCurrentTranscript", "phaseLoopController")
    
    // Phase loop
    .addConditionalEdges("phaseLoopController", phaseLoopDecider, {
      P2S_1: "P2S_1",
      P2S_2: "P2S_2", 
      P2S_3: "P2S_3",
      P3_1: "P3_1",
      P3_2: "P3_2",
      P3_3: "P3_3",
      gdu_loop: "gduLoopController",
      P7_1: "P7_1",
      done: "transcriptLoopController",
    })
    
    // Phase edges
    .addEdge("P2S_1", "phaseLoopController")
    .addEdge("P2S_2", "phaseLoopController")
    .addEdge("P2S_3", "phaseLoopController")
    .addEdge("P3_1", "phaseLoopController")
    .addEdge("P3_2", "phaseLoopController")
    .addEdge("P3_3", "phaseLoopController")
    
    // GDU loop
    .addConditionalEdges("gduLoopController", gduLoopDecider, {
      continue: "selectCurrentGDU",
      done: "phaseLoopController",
    })
    .addEdge("selectCurrentGDU", "P4S_1_A")
    .addEdge("P4S_1_A", "P4S_1_B")
    .addEdge("P4S_1_B", "P5_1")
    .addEdge("P5_1", "P5_2")
    .addEdge("P5_2", "gduLoopController")
    
    // Post-GDU processing
    .addEdge("P7_1", "P7_2")
    .addEdge("P7_2", "P7_3")
    .addEdge("P7_3", "P7_3B")
    .addEdge("P7_3B", "P7_4")
    .addEdge("P7_4", "P7_5")
    .addEdge("P7_5", "P9_1")
    .addEdge("P9_1", "COMPLETE")
    .addEdge("COMPLETE", "phaseLoopController")
    
    // Final
    .addEdge("finalize", END);

  return graph.compile({
    checkpointer: new SqliteSaver({
      connectionString: process.env.LANGGRAPH_DB_PATH || "./langgraph-demo.db"
    }),
  });
}

// Loop controller nodes

async function transcriptLoopControllerNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  // Always increment the index - let the decider handle bounds checking
  return {
    currentTranscriptIndex: state.currentTranscriptIndex + 1,
    currentPhaseIndex: 0, // Reset phase for new transcript
    currentGDUIndex: 0,   // Reset GDU index
  };
}

function transcriptLoopDecider(state: UPathMVPState): string {
  return state.currentTranscriptIndex < state.transcripts.length ? "continue" : "done";
}

async function selectCurrentTranscriptNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  // This would update the state to process only the current transcript
  console.log(`[LangGraph] Processing transcript ${state.currentTranscriptIndex + 1}/${state.transcripts.length}`);
  return {};
}

async function phaseLoopControllerNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  // Use a filtered phase sequence for multi-transcript path
  const multiTranscriptPhases = PHASE_SEQUENCE.filter(phase => 
    !["P_NEG1_1", "P0_1", "P0_2", "P0_3", "P1_1", "P1_2", "P1_3", "P1_4"].includes(phase)
  );
  
  // Insert gdu_loop at the right position (after P3_3)
  const p3_3Index = multiTranscriptPhases.indexOf("P3_3");
  const phaseSequence = [
    ...multiTranscriptPhases.slice(0, p3_3Index + 1),
    "gdu_loop",
    ...multiTranscriptPhases.slice(p3_3Index + 1)
  ];
  
  if (state.currentPhaseIndex < phaseSequence.length) {
    return {
      currentPhase: phaseSequence[state.currentPhaseIndex],
      currentPhaseIndex: state.currentPhaseIndex + 1,
    };
  }
  
  return {}; // Done with phases for this transcript
}

function phaseLoopDecider(state: UPathMVPState): string {
  // Build the same phase sequence as the controller
  const multiTranscriptPhases = PHASE_SEQUENCE.filter(phase => 
    !["P_NEG1_1", "P0_1", "P0_2", "P0_3", "P1_1", "P1_2", "P1_3", "P1_4"].includes(phase)
  );
  
  const p3_3Index = multiTranscriptPhases.indexOf("P3_3");
  const phaseSequence = [
    ...multiTranscriptPhases.slice(0, p3_3Index + 1),
    "gdu_loop",
    ...multiTranscriptPhases.slice(p3_3Index + 1)
  ];
  
  if (state.currentPhaseIndex >= phaseSequence.length) {
    return "done";
  }
  
  const currentPhase = phaseSequence[state.currentPhaseIndex];
  
  // Special handling for GDU phases
  if (currentPhase === "gdu_loop" && state.gdus && state.gdus.length > 0) {
    return "gdu_loop";
  } else if (currentPhase === "gdu_loop" && (!state.gdus || state.gdus.length === 0)) {
    // Skip GDU loop if no GDUs
    return "P7_1";
  }
  
  return currentPhase;
}

async function gduLoopControllerNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  const hasMoreGDUs = state.currentGDUIndex < state.gdus.length - 1;
  
  if (hasMoreGDUs) {
    return {
      currentGDUIndex: state.currentGDUIndex + 1,
    };
  }
  
  return {
    currentGDUIndex: 0, // Reset for next transcript
  };
}

function gduLoopDecider(state: UPathMVPState): string {
  return state.currentGDUIndex < state.gdus.length ? "continue" : "done";
}

async function selectCurrentGDUNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log(`[LangGraph] Processing GDU ${state.currentGDUIndex + 1}/${state.gdus.length}`);
  return {};
}

// Helper nodes (same as before)
async function initializeNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log("[LangGraph] Initializing pipeline");
  return {
    status: "running",
    progress: 0,
    currentPhaseIndex: 0,
    currentTranscriptIndex: 0,
    currentGDUIndex: 0,
  };
}

async function routingDecisionNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  const isMulti = state.transcripts.length > 1;
  console.log(`[LangGraph] Routing decision: ${isMulti ? 'multi' : 'single'} transcript path`);
  return {
    isMultiTranscript: isMulti,
  };
}

function routingDecider(state: UPathMVPState): string {
  return state.isMultiTranscript ? "multi" : "single";
}

async function finalizeNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.log("[LangGraph] Pipeline completed successfully");
  return {
    status: "completed",
    progress: 100,
  };
}

/**
 * Create pipeline with loops
 */
export function createUPathPipeline() {
  return buildUPathGraph();
}