import { BaseNode } from './nodes/BaseNode';
import { StepId } from './types';
import {
  P_NEG1_1_VariableIdentificationNode,
  P0_1_TranscriptionAdherenceNode,
  P0_2_RefineDataTypesNode,
  P0_3_SelectProceduralUtterancesNode,
  P1_1_InitialSegmentationNode,
  P1_2_DiachronicUnitIdNode,
  P1_3_RefineDiachronicUnitsNode,
  P1_4_ConstructSpecificDiachronicStructureNode,
  P2S_1_GroupUtterancesByTopicNode,
  P2S_2_IdentifySpecificSynchronicUnitsNode,
  P2S_3_DefineSpecificSynchronicStructureNode,
  P3_1_AlignStructuresNode,
  P3_2_IdentifyGDUsNode,
  P3_3_DefineGenericDiachronicStructureNode,
  P4S_1_A_IdentifyAndGroupSSSNodesNode,
  P4S_1_B_DefineGSSFromGroupsNode,
  P5_1_ComparativeAnalysisNode,
  P5_2_HolisticRefinementNode,
  P7_1_CandidateVariableFormalizationNode,
  P7_2_ProposePairwiseCausalLinksNode,
  P7_3_AssembleDAGAndIdentifyPatternsNode,
  P7_3B_ValidateAndCleanDAGNode,
  P7_4_AnalyzePathsAndBiasesNode,
  P7_5_GenerateFormalHypothesesNode,
  P9_1_SemanticGduMappingNode,
  CompleteNode
} from './nodes';

export type NodeConstructor = new () => BaseNode;

export class NodeRegistry {
  private static instance: NodeRegistry;
  private nodes: Map<string, NodeConstructor>;

  constructor() {
    this.nodes = new Map();
    this.registerDefaultNodes();
  }

  /**
   * Get singleton instance of NodeRegistry
   */
  static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  /**
   * Register default nodes
   */
  private registerDefaultNodes(): void {
    // Register all implemented nodes
    this.nodes.set(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, P_NEG1_1_VariableIdentificationNode);
    this.nodes.set(StepId.P0_1_TRANSCRIPTION_ADHERENCE, P0_1_TranscriptionAdherenceNode);
    this.nodes.set(StepId.P0_2_REFINE_DATA_TYPES, P0_2_RefineDataTypesNode);
    this.nodes.set(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, P0_3_SelectProceduralUtterancesNode);
    this.nodes.set(StepId.P1_1_INITIAL_SEGMENTATION, P1_1_InitialSegmentationNode);
    this.nodes.set(StepId.P1_2_DIACHRONIC_UNIT_ID, P1_2_DiachronicUnitIdNode);
    this.nodes.set(StepId.P1_3_REFINE_DIACHRONIC_UNITS, P1_3_RefineDiachronicUnitsNode);
    this.nodes.set(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE, P1_4_ConstructSpecificDiachronicStructureNode);
    this.nodes.set(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, P2S_1_GroupUtterancesByTopicNode);
    this.nodes.set(StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, P2S_2_IdentifySpecificSynchronicUnitsNode);
    this.nodes.set(StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE, P2S_3_DefineSpecificSynchronicStructureNode);
    this.nodes.set(StepId.P3_1_ALIGN_STRUCTURES, P3_1_AlignStructuresNode);
    this.nodes.set(StepId.P3_2_IDENTIFY_GDUS, P3_2_IdentifyGDUsNode);
    this.nodes.set(StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE, P3_3_DefineGenericDiachronicStructureNode);
    this.nodes.set(StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, P4S_1_A_IdentifyAndGroupSSSNodesNode);
    this.nodes.set(StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, P4S_1_B_DefineGSSFromGroupsNode);
    this.nodes.set(StepId.P5_1_IV_COMPARATIVE_ANALYSIS, P5_1_ComparativeAnalysisNode);
    this.nodes.set(StepId.P5_2_HOLISTIC_REFINEMENT, P5_2_HolisticRefinementNode);
    this.nodes.set(StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION, P7_1_CandidateVariableFormalizationNode);
    this.nodes.set(StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS, P7_2_ProposePairwiseCausalLinksNode);
    this.nodes.set(StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS, P7_3_AssembleDAGAndIdentifyPatternsNode);
    this.nodes.set(StepId.P7_3B_VALIDATE_AND_CLEAN_DAG, P7_3B_ValidateAndCleanDAGNode);
    this.nodes.set(StepId.P7_4_ANALYZE_PATHS_AND_BIASES, P7_4_AnalyzePathsAndBiasesNode);
    this.nodes.set(StepId.P7_5_GENERATE_FORMAL_HYPOTHESES, P7_5_GenerateFormalHypothesesNode);
    this.nodes.set(StepId.P9_1_SEMANTIC_GDU_MAPPING, P9_1_SemanticGduMappingNode);
    this.nodes.set(StepId.COMPLETE, CompleteNode);
  }

  /**
   * Register a new node
   */
  registerNode(nodeId: string, nodeClass: NodeConstructor, force = false): void {
    // Validate the node class extends BaseNode
    const testInstance = new nodeClass();
    if (!(testInstance instanceof BaseNode)) {
      throw new Error('Node class must extend BaseNode');
    }

    // Validate the node has an id property
    if (!testInstance.id) {
      throw new Error('Node must have an id property');
    }

    if (this.nodes.has(nodeId) && !force) {
      throw new Error(`Node ${nodeId} is already registered`);
    }

    this.nodes.set(nodeId, nodeClass);
  }

  /**
   * Get a node instance by ID
   */
  getNode(nodeId: string): BaseNode {
    const NodeClass = this.nodes.get(nodeId);
    
    if (!NodeClass) {
      throw new Error(`Node ${nodeId} not found in registry`);
    }

    return new NodeClass();
  }

  /**
   * Check if a node is registered
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * List all registered node IDs
   */
  listNodes(): string[] {
    return Array.from(this.nodes.keys());
  }
}