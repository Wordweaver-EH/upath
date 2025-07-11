import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '../nodeRegistry';
import { BaseNode } from '../nodes/BaseNode';
import { StepId, GraphState, ExecutionContext } from '../types';
import { 
  P0_1_TranscriptionAdherenceNode,
  P0_2_RefineDataTypesNode,
  P0_3_SelectProceduralUtterancesNode 
} from '../nodes';

describe('NodeRegistry', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  describe('Default registration', () => {
    it('should have all implemented nodes registered by default', () => {
      expect(registry.hasNode(StepId.P0_1_TRANSCRIPTION_ADHERENCE)).toBe(true);
      expect(registry.hasNode(StepId.P0_2_REFINE_DATA_TYPES)).toBe(true);
      expect(registry.hasNode(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES)).toBe(true);
    });

    it('should return correct node types', () => {
      const p0_1 = registry.getNode(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const p0_2 = registry.getNode(StepId.P0_2_REFINE_DATA_TYPES);
      const p0_3 = registry.getNode(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);

      expect(p0_1).toBeInstanceOf(P0_1_TranscriptionAdherenceNode);
      expect(p0_2).toBeInstanceOf(P0_2_RefineDataTypesNode);
      expect(p0_3).toBeInstanceOf(P0_3_SelectProceduralUtterancesNode);
    });
  });

  describe('Custom node registration', () => {
    class TestNode extends BaseNode {
      id = 'TEST_NODE';
      
      async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
        return { currentStep: this.id };
      }
    }

    it('should allow registering custom nodes', () => {
      registry.registerNode('TEST_NODE', TestNode);
      
      expect(registry.hasNode('TEST_NODE')).toBe(true);
      const node = registry.getNode('TEST_NODE');
      expect(node).toBeInstanceOf(TestNode);
      expect(node.id).toBe('TEST_NODE');
    });

    it('should throw error when registering duplicate node', () => {
      registry.registerNode('TEST_NODE', TestNode);
      
      expect(() => {
        registry.registerNode('TEST_NODE', TestNode);
      }).toThrow('Node TEST_NODE is already registered');
    });

    it('should allow overriding existing node with force flag', () => {
      registry.registerNode('TEST_NODE', TestNode);
      
      class AnotherTestNode extends BaseNode {
        id = 'TEST_NODE';
        
        async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
          return { currentStep: 'another' };
        }
      }
      
      registry.registerNode('TEST_NODE', AnotherTestNode, true);
      
      const node = registry.getNode('TEST_NODE');
      expect(node).toBeInstanceOf(AnotherTestNode);
    });
  });

  describe('Node retrieval', () => {
    it('should throw error for unknown node', () => {
      expect(() => {
        registry.getNode('UNKNOWN_NODE');
      }).toThrow('Node UNKNOWN_NODE not found in registry');
    });

    it('should return false for hasNode on unknown node', () => {
      expect(registry.hasNode('UNKNOWN_NODE')).toBe(false);
    });

    it('should create new instance each time getNode is called', () => {
      const node1 = registry.getNode(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const node2 = registry.getNode(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      
      expect(node1).not.toBe(node2);
      expect(node1).toBeInstanceOf(P0_1_TranscriptionAdherenceNode);
      expect(node2).toBeInstanceOf(P0_1_TranscriptionAdherenceNode);
    });
  });

  describe('Registry listing', () => {
    it('should list all registered nodes', () => {
      const nodes = registry.listNodes();
      
      expect(nodes).toContain(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(nodes).toContain(StepId.P0_2_REFINE_DATA_TYPES);
      expect(nodes).toContain(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(nodes.length).toBeGreaterThanOrEqual(3);
    });

    it('should include custom registered nodes in listing', () => {
      class TestNode extends BaseNode {
        id = 'TEST_NODE';
        async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
          return {};
        }
      }
      
      registry.registerNode('TEST_NODE', TestNode);
      const nodes = registry.listNodes();
      
      expect(nodes).toContain('TEST_NODE');
    });
  });

  describe('Node validation', () => {
    it('should validate that registered class extends BaseNode', () => {
      class NotANode {
        id = 'BAD_NODE';
      }
      
      expect(() => {
        // @ts-expect-error - Testing invalid registration
        registry.registerNode('BAD_NODE', NotANode);
      }).toThrow('Node class must extend BaseNode');
    });

    it('should validate node has required properties after instantiation', () => {
      class InvalidNode extends BaseNode {
        // @ts-expect-error - Missing id property for testing
        async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
          return {};
        }
      }
      
      expect(() => {
        registry.registerNode('INVALID_NODE', InvalidNode);
        registry.getNode('INVALID_NODE');
      }).toThrow();
    });
  });

  describe('Singleton pattern', () => {
    it('should provide a default singleton instance', () => {
      const instance1 = NodeRegistry.getInstance();
      const instance2 = NodeRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should have all nodes in singleton instance', () => {
      const instance = NodeRegistry.getInstance();
      
      expect(instance.hasNode(StepId.P0_1_TRANSCRIPTION_ADHERENCE)).toBe(true);
      expect(instance.hasNode(StepId.P0_2_REFINE_DATA_TYPES)).toBe(true);
      expect(instance.hasNode(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES)).toBe(true);
    });
  });
});