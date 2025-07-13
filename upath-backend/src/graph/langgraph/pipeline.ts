import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { UPathMVPAnnotation, UPathMVPState, PHASE_SEQUENCE, GDU_PROCESSING_PHASES } from "./annotations";
import { wrapExistingNode, wrapMultiTranscriptNode } from "./nodeWrapper";
import { nodeRegistry } from "../nodeRegistry";
import { MemorySaver } from "@langchain/langgraph";

/**
 * µ-PATH Pipeline Implementation using LangGraph
 * 
 * Based on Context7 and DeepWiki research:
 * - Uses conditional edges for loops (not explicit for loops)
 * - Implements nested loops via conditional routing
 * - Handles single vs multi-transcript paths
 * - Reuses existing node logic via wrappers
 */

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
 * Router for single vs multi-transcript processing
 * After P0_3, decide whether to process transcripts individually or together
 */
const transcriptRouter = (state: UPathMVPState): string => {
  if (state.transcripts.length === 1) {
    // Single transcript: go directly to P1_1
    return "P1_1";
  } else {
    // Multiple transcripts: need to set up transcript loop
    state.isMultiTranscript = true;
    return "transcriptLoopController";
  }
};

/**
 * Controller for transcript loop
 * Manages iteration through multiple transcripts
 */
const transcriptLoopController = async (state: UPathMVPState): Promise<Partial<UPathMVPState>> => {
  if (state.currentTranscriptIndex < state.transcripts.length) {
    // More transcripts to process
    return {
      currentPhase: "P1_1",
      currentTranscriptIndex: state.currentTranscriptIndex,
    };
  } else {
    // All transcripts processed, move to P2S
    return {
      currentPhase: "P2S_1",
      currentTranscriptIndex: 0,
    };
  }
};


/**
 * Build the main µ-PATH pipeline graph
 */
export function buildUPathPipeline() {
  const graph = new StateGraph(UPathMVPAnnotation)
    // Start node
    .addNode("start", async (state) => ({ status: "running" }))
    
    // Phase -1 and 0: Multi-transcript phases
    .addNode("P_NEG1_1", wrapMultiTranscriptNode(P_NEG1_1_VariableIdentificationNode))
    .addNode("P0_1", wrapMultiTranscriptNode(P0_1_TranscriptionAdherenceNode))
    .addNode("P0_2", wrapMultiTranscriptNode(P0_2_RefineDataTypesNode))
    .addNode("P0_3", wrapMultiTranscriptNode(P0_3_SelectProceduralUtterancesNode))
    
    // Loop controllers
    .addNode("transcriptLoopController", transcriptLoopController)
    
    // Phase 1: Diachronic Analysis (per transcript)
    .addNode("P1_1", wrapExistingNode(P1_1_InitialSegmentationNode))
    .addNode("P1_2", wrapExistingNode(P1_2_DiachronicUnitIdNode))
    .addNode("P1_3", wrapExistingNode(P1_3_RefineDiachronicUnitsNode))
    .addNode("P1_4", wrapExistingNode(P1_4_ConstructSpecificDiachronicStructureNode))
    
    // Phase 2S: Synchronic Analysis
    .addNode("P2S_1", wrapExistingNode(P2S_1_GroupUtterancesByTopicNode))
    .addNode("P2S_2", wrapExistingNode(P2S_2_IdentifySpecificSynchronicUnitsNode))
    .addNode("P2S_3", wrapExistingNode(P2S_3_DefineSpecificSynchronicStructureNode))
    
    // Phase 3: Structure Alignment
    .addNode("P3_1", wrapExistingNode(P3_1_AlignStructuresNode))
    .addNode("P3_2", wrapExistingNode(P3_2_IdentifyGDUsNode))
    .addNode("P3_3", wrapExistingNode(P3_3_DefineGenericDiachronicStructureNode))
    
    // Phase 4S: Generic Synchronic Structure (processes GDUs)
    .addNode("P4S_1_A", wrapExistingNode(P4S_1_A_IdentifyAndGroupSSSNodesNode))
    .addNode("P4S_1_B", wrapExistingNode(P4S_1_B_DefineGSSFromGroupsNode))
    
    // Phase 5: Comparative Analysis (processes GDUs)
    .addNode("P5_1", wrapExistingNode(P5_1_ComparativeAnalysisNode))
    .addNode("P5_2", wrapExistingNode(P5_2_HolisticRefinementNode))
    
    // Phase 7: Formalization
    .addNode("P7_1", wrapExistingNode(P7_1_CandidateVariableFormalizationNode))
    .addNode("P7_2", wrapExistingNode(P7_2_ProposePairwiseCausalLinksNode))
    .addNode("P7_3", wrapExistingNode(P7_3_AssembleDAGAndIdentifyPatternsNode))
    .addNode("P7_3B", wrapExistingNode(P7_3B_ValidateAndCleanDAGNode))
    .addNode("P7_4", wrapExistingNode(P7_4_AnalyzePathsAndBiasesNode))
    .addNode("P7_5", wrapExistingNode(P7_5_GenerateFormalHypothesesNode))
    
    // Phase 9: Semantic Mapping
    .addNode("P9_1", wrapExistingNode(P9_1_SemanticGduMappingNode))
    
    // Complete
    .addNode("COMPLETE", wrapExistingNode(CompleteNode))
    
    // Define edges
    .addEdge(START, "start")
    .addEdge("start", "P_NEG1_1")
    .addEdge("P_NEG1_1", "P0_1")
    .addEdge("P0_1", "P0_2")
    .addEdge("P0_2", "P0_3")
    
    // Conditional routing after P0_3
    .addConditionalEdges("P0_3", transcriptRouter, {
      "P1_1": "P1_1",
      "transcriptLoopController": "transcriptLoopController"
    })
    
    // Transcript loop edges
    .addConditionalEdges("transcriptLoopController", (state) => state.currentPhase, {
      "P1_1": "P1_1",
      "P2S_1": "P2S_1"
    })
    
    // Phase 1 edges
    .addEdge("P1_1", "P1_2")
    .addEdge("P1_2", "P1_3")
    .addEdge("P1_3", "P1_4")
    
    // After P1_4, either loop back or continue
    .addConditionalEdges("P1_4", (state) => {
      if (state.isMultiTranscript && state.currentTranscriptIndex + 1 < state.transcripts.length) {
        return "transcriptLoopController";
      }
      return "P2S_1";
    }, {
      "transcriptLoopController": "transcriptLoopController",
      "P2S_1": "P2S_1"
    })
    
    // Phase 2S edges
    .addEdge("P2S_1", "P2S_2")
    .addEdge("P2S_2", "P2S_3")
    .addEdge("P2S_3", "P3_1")
    
    // Phase 3 edges
    .addEdge("P3_1", "P3_2")
    .addEdge("P3_2", "P3_3")
    
    // After P3_3, check if we have GDUs for P4S
    .addConditionalEdges("P3_3", (state) => {
      if (state.gdus && state.gdus.length > 0) {
        return "P4S_1_A";
      }
      return "P7_1"; // Skip to P7 if no GDUs
    }, {
      "P4S_1_A": "P4S_1_A",
      "P7_1": "P7_1"
    })
    
    // Phase 4S edges (with GDU processing)
    .addEdge("P4S_1_A", "P4S_1_B")
    .addEdge("P4S_1_B", "P5_1")
    
    // Phase 5 edges
    .addEdge("P5_1", "P5_2")
    .addEdge("P5_2", "P7_1")
    
    // Phase 7 edges
    .addEdge("P7_1", "P7_2")
    .addEdge("P7_2", "P7_3")
    .addEdge("P7_3", "P7_3B")
    .addEdge("P7_3B", "P7_4")
    .addEdge("P7_4", "P7_5")
    .addEdge("P7_5", "P9_1")
    
    // Phase 9 to complete
    .addEdge("P9_1", "COMPLETE")
    .addEdge("COMPLETE", END);

  // Compile with MemorySaver for MVP
  return graph.compile({ 
    checkpointer: new MemorySaver() 
  });
}

/**
 * Create and export the compiled pipeline
 */
export const uPathPipeline = buildUPathPipeline();