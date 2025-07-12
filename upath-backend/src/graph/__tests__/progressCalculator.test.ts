import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressCalculator } from '../services/progressCalculator';
import { GraphBuilder } from '../graphBuilder';
import { NodeRegistry } from '../nodeRegistry';
import { StepId } from '../types';

describe('ProgressCalculator', () => {
  let calculator: ProgressCalculator;
  let builder: GraphBuilder;
  let graph: any;

  beforeEach(() => {
    const registry = new NodeRegistry();
    builder = new GraphBuilder(registry);
    graph = builder.build();
    calculator = new ProgressCalculator(graph);
  });

  describe('Progress calculation', () => {
    it('should calculate 0% for unknown step', () => {
      const progress = calculator.calculateProgress('UNKNOWN_STEP');
      expect(progress).toBe(0);
    });

    it('should calculate progress based on topological position', () => {
      // Default graph: P0_1 -> P0_2 -> P0_3
      const p0_1_progress = calculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const p0_2_progress = calculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      const p0_3_progress = calculator.calculateProgress(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      
      expect(p0_1_progress).toBe(33); // 1/3
      expect(p0_2_progress).toBe(67); // 2/3
      expect(p0_3_progress).toBe(100); // 3/3
    });

    it('should handle COMPLETE step', () => {
      const progress = calculator.calculateProgress(StepId.COMPLETE);
      expect(progress).toBe(100);
    });

    it('should handle IDLE step', () => {
      const progress = calculator.calculateProgress(StepId.IDLE);
      expect(progress).toBe(0);
    });

    it('should handle cyclic graphs', () => {
      // Create a cycle
      builder.addEdge(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const cyclicGraph = builder.build();
      const cyclicCalculator = new ProgressCalculator(cyclicGraph);
      
      // Should fall back to node count method
      const progress = cyclicCalculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });
  });

  describe('Custom graph structures', () => {
    it('should handle graphs with more nodes', async () => {
      // Add more nodes to registry and graph
      const customRegistry = new NodeRegistry();
      
      // Import BaseNode to extend from it
      const { BaseNode } = await import('../nodes/BaseNode');
      
      // Mock additional nodes
      class TestNode1 extends BaseNode {
        id = 'TEST_1';
        async execute() { return {}; }
      }
      class TestNode2 extends BaseNode {
        id = 'TEST_2';
        async execute() { return {}; }
      }
      
      customRegistry.registerNode('TEST_1', TestNode1 as any);
      customRegistry.registerNode('TEST_2', TestNode2 as any);
      
      const customBuilder = new GraphBuilder(customRegistry);
      customBuilder.addEdge(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, 'TEST_1');
      customBuilder.addEdge('TEST_1', 'TEST_2');
      
      const customGraph = customBuilder.build();
      const customCalculator = new ProgressCalculator(customGraph);
      
      // With 5 nodes total
      const test1Progress = customCalculator.calculateProgress('TEST_1');
      expect(test1Progress).toBe(80); // 4/5
    });

    it('should handle branching graphs', () => {
      // Create branches: P0_1 -> P0_2 and P0_1 -> P0_3
      builder.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      const branchingGraph = builder.build();
      const branchingCalculator = new ProgressCalculator(branchingGraph);
      
      // P0_1 is still first
      expect(branchingCalculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE)).toBe(33);
      
      // P0_2 and P0_3 are at same level
      const p0_2_progress = branchingCalculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      const p0_3_progress = branchingCalculator.calculateProgress(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      
      // Both should have same progress since they're at same depth
      expect(p0_2_progress).toBeGreaterThan(33);
      expect(p0_3_progress).toBeGreaterThan(33);
    });
  });

  describe('Progress by depth', () => {
    it('should calculate progress by depth when topological sort unavailable', () => {
      // Create a mock graph without topological sort
      const mockGraph = {
        nodes: new Map([
          [StepId.P0_1_TRANSCRIPTION_ADHERENCE, {}],
          [StepId.P0_2_REFINE_DATA_TYPES, {}],
          [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, {}]
        ]),
        edges: new Map([
          [StepId.P0_1_TRANSCRIPTION_ADHERENCE, [StepId.P0_2_REFINE_DATA_TYPES]],
          [StepId.P0_2_REFINE_DATA_TYPES, [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]]
        ]),
        entryPoint: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        topologicalSort: () => null // Simulating cyclic graph
      };
      
      const depthCalculator = new ProgressCalculator(mockGraph as any);
      
      // Should still calculate reasonable progress
      const progress = depthCalculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty graph', () => {
      const emptyGraph = {
        nodes: new Map(),
        edges: new Map(),
        entryPoint: '',
        topologicalSort: () => []
      };
      
      const emptyCalculator = new ProgressCalculator(emptyGraph as any);
      expect(emptyCalculator.calculateProgress('ANY_STEP')).toBe(0);
    });

    it('should handle single node graph', () => {
      const singleNodeGraph = {
        nodes: new Map([[StepId.P0_1_TRANSCRIPTION_ADHERENCE, {}]]),
        edges: new Map(),
        entryPoint: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        topologicalSort: () => [StepId.P0_1_TRANSCRIPTION_ADHERENCE]
      };
      
      const singleCalculator = new ProgressCalculator(singleNodeGraph as any);
      expect(singleCalculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE)).toBe(100);
    });
  });

  describe('Integration with ExecutionContext', () => {
    it('should provide method to enrich context with progress', () => {
      const context = {
        llmClient: {},
        logger: {},
        settings: {}
      };
      
      const enrichedContext = calculator.enrichContextWithProgress(
        context,
        StepId.P0_2_REFINE_DATA_TYPES
      );
      
      expect(enrichedContext).toHaveProperty('progress');
      expect(enrichedContext.progress).toBe(67);
      expect(enrichedContext).toHaveProperty('llmClient');
      expect(enrichedContext).toHaveProperty('logger');
      expect(enrichedContext).toHaveProperty('settings');
    });
  });
});