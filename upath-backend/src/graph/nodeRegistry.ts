import { BaseNode } from './nodes/BaseNode';
import { StepId } from './types';
import {
  P0_1_TranscriptionAdherenceNode,
  P0_2_RefineDataTypesNode,
  P0_3_SelectProceduralUtterancesNode
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
    this.nodes.set(StepId.P0_1_TRANSCRIPTION_ADHERENCE, P0_1_TranscriptionAdherenceNode);
    this.nodes.set(StepId.P0_2_REFINE_DATA_TYPES, P0_2_RefineDataTypesNode);
    this.nodes.set(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, P0_3_SelectProceduralUtterancesNode);
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