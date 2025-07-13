import { StateGraph, END, START } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { UPathMVPAnnotation, UPathMVPState, PHASE_SEQUENCE, GDU_PROCESSING_PHASES } from "./annotations";
import { wrapExistingNode, wrapMultiTranscriptNode } from "./nodeWrapper";

// Import all node classes
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
 * Builds the complete µ-PATH LangGraph pipeline
 */
export function buildUPathGraph() {
  const graph = new StateGraph(UPathMVPAnnotation)
    // Initialize node
    .addNode("initialize", initializeNode)
    
    // Phase -1 and 0: Variable identification and transcription processing
    .addNode("P_NEG1_1", wrapMultiTranscriptNode(P_NEG1_1_VariableIdentificationNode))
    .addNode("P0_1", wrapMultiTranscriptNode(P0_1_TranscriptionAdherenceNode))
    .addNode("P0_2", wrapMultiTranscriptNode(P0_2_RefineDataTypesNode))
    .addNode("P0_3", wrapMultiTranscriptNode(P0_3_SelectProceduralUtterancesNode))
    
    // Routing decision point
    .addNode("routingDecision", routingDecisionNode)
    
    // Phase 1: Diachronic analysis (single transcript)
    .addNode("P1_1", wrapExistingNode(P1_1_InitialSegmentationNode))
    .addNode("P1_2", wrapExistingNode(P1_2_DiachronicUnitIdNode))
    .addNode("P1_3", wrapExistingNode(P1_3_RefineDiachronicUnitsNode))
    .addNode("P1_4", wrapExistingNode(P1_4_ConstructSpecificDiachronicStructureNode))
    
    // Phase 2S: Synchronic analysis (multi transcript)
    .addNode("P2S_1", wrapExistingNode(P2S_1_GroupUtterancesByTopicNode))
    .addNode("P2S_2", wrapExistingNode(P2S_2_IdentifySpecificSynchronicUnitsNode))
    .addNode("P2S_3", wrapExistingNode(P2S_3_DefineSpecificSynchronicStructureNode))
    
    // Phase 3: Structure alignment
    .addNode("P3_1", wrapExistingNode(P3_1_AlignStructuresNode))
    .addNode("P3_2", wrapExistingNode(P3_2_IdentifyGDUsNode))
    .addNode("P3_3", wrapExistingNode(P3_3_DefineGenericDiachronicStructureNode))
    
    // Phase 4S: Generic synchronic structure
    .addNode("P4S_1_A", wrapExistingNode(P4S_1_A_IdentifyAndGroupSSSNodesNode))
    .addNode("P4S_1_B", wrapExistingNode(P4S_1_B_DefineGSSFromGroupsNode))
    
    // Phase 5: Comparative analysis
    .addNode("P5_1", wrapExistingNode(P5_1_ComparativeAnalysisNode))
    .addNode("P5_2", wrapExistingNode(P5_2_HolisticRefinementNode))
    
    // Phase 7: Formalization
    .addNode("P7_1", wrapExistingNode(P7_1_CandidateVariableFormalizationNode))
    .addNode("P7_2", wrapExistingNode(P7_2_ProposePairwiseCausalLinksNode))
    .addNode("P7_3", wrapExistingNode(P7_3_AssembleDAGAndIdentifyPatternsNode))
    .addNode("P7_3B", wrapExistingNode(P7_3B_ValidateAndCleanDAGNode))
    .addNode("P7_4", wrapExistingNode(P7_4_AnalyzePathsAndBiasesNode))
    .addNode("P7_5", wrapExistingNode(P7_5_GenerateFormalHypothesesNode))
    
    // Phase 9: Semantic mapping
    .addNode("P9_1", wrapExistingNode(P9_1_SemanticGduMappingNode))
    
    // Complete
    .addNode("COMPLETE", wrapExistingNode(CompleteNode))
    
    // Finalize node
    .addNode("finalize", finalizeNode)
    
    // Error handler
    .addNode("errorHandler", errorHandlerNode)
    
    // Add edges following the pipeline sequence
    .addEdge(START, "initialize")
    .addEdge("initialize", "P_NEG1_1")
    .addEdge("P_NEG1_1", "P0_1")
    .addEdge("P0_1", "P0_2")
    .addEdge("P0_2", "P0_3")
    .addEdge("P0_3", "routingDecision")
    
    // Conditional routing based on single vs multi transcript
    .addConditionalEdges("routingDecision", routingDecider, {
      single: "P1_1",
      multi: "P2S_1",
    })
    
    // Phase 1 sequence (single transcript path)
    .addEdge("P1_1", "P1_2")
    .addEdge("P1_2", "P1_3")
    .addEdge("P1_3", "P1_4")
    .addEdge("P1_4", "finalize") // Single transcript ends here
    
    // Phase 2S sequence (multi transcript path)
    .addEdge("P2S_1", "P2S_2")
    .addEdge("P2S_2", "P2S_3")
    .addEdge("P2S_3", "P3_1")
    
    // Phase 3 sequence
    .addEdge("P3_1", "P3_2")
    .addEdge("P3_2", "P3_3")
    .addEdge("P3_3", "P4S_1_A")
    
    // Phase 4S sequence
    .addEdge("P4S_1_A", "P4S_1_B")
    .addEdge("P4S_1_B", "P5_1")
    
    // Phase 5 sequence
    .addEdge("P5_1", "P5_2")
    .addEdge("P5_2", "P7_1")
    
    // Phase 7 sequence
    .addEdge("P7_1", "P7_2")
    .addEdge("P7_2", "P7_3")
    .addEdge("P7_3", "P7_3B")
    .addEdge("P7_3B", "P7_4")
    .addEdge("P7_4", "P7_5")
    .addEdge("P7_5", "P9_1")
    
    // Phase 9 to completion
    .addEdge("P9_1", "COMPLETE")
    .addEdge("COMPLETE", "finalize")
    
    // Final edge
    .addEdge("finalize", END)
    
    // Error handling edges
    .addConditionalEdges("errorHandler", errorRouter, {
      retry: "initialize",
      end: END,
    });

  return graph.compile({
    checkpointer: new MemorySaver(),
  });
}

// Helper nodes

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

async function errorHandlerNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  console.error("[LangGraph] Error handler invoked:", state.errors);
  return {
    status: "failed",
  };
}

function errorRouter(state: UPathMVPState): string {
  // Simple retry logic - in production, this would be more sophisticated
  if (state.errors.length < 3) {
    return "retry";
  }
  return "end";
}

/**
 * Create and return a compiled graph instance
 */
export function createUPathPipeline() {
  return buildUPathGraph();
}