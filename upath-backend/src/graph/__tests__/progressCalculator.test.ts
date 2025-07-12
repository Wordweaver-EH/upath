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
      // Default graph: P_NEG1_1 -> P0_1 -> P0_2 -> P0_3 -> P1_1 -> P1_2 -> P1_3 -> P1_4
      const p_neg1_1_progress = calculator.calculateProgress(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      const p0_1_progress = calculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const p0_2_progress = calculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      const p0_3_progress = calculator.calculateProgress(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      const p1_1_progress = calculator.calculateProgress(StepId.P1_1_INITIAL_SEGMENTATION);
      const p1_2_progress = calculator.calculateProgress(StepId.P1_2_DIACHRONIC_UNIT_ID);
      const p1_3_progress = calculator.calculateProgress(StepId.P1_3_REFINE_DIACHRONIC_UNITS);
      const p1_4_progress = calculator.calculateProgress(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE);
      
      expect(p_neg1_1_progress).toBe(13); // 1/8
      expect(p0_1_progress).toBe(25); // 2/8
      expect(p0_2_progress).toBe(38); // 3/8
      expect(p0_3_progress).toBe(50); // 4/8
      expect(p1_1_progress).toBe(63); // 5/8
      expect(p1_2_progress).toBe(75); // 6/8
      expect(p1_3_progress).toBe(88); // 7/8
      expect(p1_4_progress).toBe(100); // 8/8
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
      customBuilder.addEdge(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE, 'TEST_1');
      customBuilder.addEdge('TEST_1', 'TEST_2');
      
      const customGraph = customBuilder.build();
      const customCalculator = new ProgressCalculator(customGraph);
      
      // With 10 nodes total (8 default + 2 custom)
      const test1Progress = customCalculator.calculateProgress('TEST_1');
      expect(test1Progress).toBe(90); // 9/10
    });

    it('should handle branching graphs', () => {
      // Create branches: P0_1 -> P0_2 and P0_1 -> P0_3
      builder.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      const branchingGraph = builder.build();
      const branchingCalculator = new ProgressCalculator(branchingGraph);
      
      // P0_1 is second after P_NEG1_1 (with 8 nodes now)
      expect(branchingCalculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE)).toBe(25);
      
      // P0_2 and P0_3 are at same level
      const p0_2_progress = branchingCalculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      const p0_3_progress = branchingCalculator.calculateProgress(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      
      // Both should have same progress since they're at same depth
      expect(p0_2_progress).toBeGreaterThan(25);
      expect(p0_3_progress).toBeGreaterThan(25);
    });
  });

  describe('Progress by depth', () => {
    it('should calculate progress by depth when topological sort unavailable', () => {
      // Create a mock graph without topological sort
      const mockGraph = {
        nodes: new Map([
          [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, {}],
          [StepId.P0_1_TRANSCRIPTION_ADHERENCE, {}],
          [StepId.P0_2_REFINE_DATA_TYPES, {}],
          [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, {}]
        ]),
        edges: new Map([
          [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, [StepId.P0_1_TRANSCRIPTION_ADHERENCE]],
          [StepId.P0_1_TRANSCRIPTION_ADHERENCE, [StepId.P0_2_REFINE_DATA_TYPES]],
          [StepId.P0_2_REFINE_DATA_TYPES, [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]]
        ]),
        entryPoint: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
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
      expect(enrichedContext.progress).toBe(38);
      expect(enrichedContext).toHaveProperty('llmClient');
      expect(enrichedContext).toHaveProperty('logger');
      expect(enrichedContext).toHaveProperty('settings');
    });
  });

  describe('getProgressInfo method', () => {
    it('should return detailed progress information', () => {
      const info = calculator.getProgressInfo(StepId.P0_2_REFINE_DATA_TYPES);
      
      expect(info).toHaveProperty('percentage');
      expect(info).toHaveProperty('currentStepIndex');
      expect(info).toHaveProperty('totalSteps');
      
      expect(info.percentage).toBe(38);
      expect(info.currentStepIndex).toBe(2); // 0-based index
      expect(info.totalSteps).toBe(8);
    });

    it('should handle COMPLETE step in getProgressInfo', () => {
      const info = calculator.getProgressInfo(StepId.COMPLETE);
      
      expect(info.percentage).toBe(100);
      expect(info.currentStepIndex).toBe(0); // Math.max(0, -1) = 0
      expect(info.totalSteps).toBe(8);
    });

    it('should handle unknown step in getProgressInfo', () => {
      const info = calculator.getProgressInfo('UNKNOWN');
      
      expect(info.percentage).toBe(0);
      expect(info.currentStepIndex).toBe(0); // Math.max(0, -1)
      expect(info.totalSteps).toBe(8);
    });
  });

  describe('Complex graph scenarios', () => {
    it('should handle disconnected nodes', () => {
      // Create a disconnected node
      const customRegistry = new NodeRegistry();
      const customBuilder = new GraphBuilder(customRegistry);
      
      // P0_1 -> P0_2, P0_3 -> P1_1, but P1_1 is disconnected from the main flow
      customBuilder.removeEdge(StepId.P0_2_REFINE_DATA_TYPES, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      customBuilder.removeEdge(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, StepId.P1_1_INITIAL_SEGMENTATION);
      
      const disconnectedGraph = customBuilder.build();
      const disconnectedCalculator = new ProgressCalculator(disconnectedGraph);
      
      // P0_3 is disconnected from main flow (only P0_1->P0_2 connected)
      // The topological sort would be: P0_1, P0_2, P0_3, P1_1, P1_2, P1_3 (or variants)
      // Since P1_1 depends on nothing, it appears first in topological sort
      const progress = disconnectedCalculator.calculateProgress(StepId.P1_1_INITIAL_SEGMENTATION);
      expect(progress).toBe(13); // It's 1/8 of the nodes
    });

    it('should handle multiple entry points', () => {
      // This tests the fallback depth calculation
      const multiEntryGraph = {
        nodes: new Map([
          ['ENTRY_1', {}],
          ['ENTRY_2', {}],
          ['SHARED', {}],
          ['END', {}]
        ]),
        edges: new Map([
          ['ENTRY_1', ['SHARED']],
          ['ENTRY_2', ['SHARED']],
          ['SHARED', ['END']]
        ]),
        entryPoint: 'ENTRY_1',
        topologicalSort: () => ['ENTRY_1', 'ENTRY_2', 'SHARED', 'END']
      };
      
      const multiCalculator = new ProgressCalculator(multiEntryGraph as any);
      
      expect(multiCalculator.calculateProgress('ENTRY_1')).toBe(25); // 1/4
      expect(multiCalculator.calculateProgress('ENTRY_2')).toBe(50); // 2/4
      expect(multiCalculator.calculateProgress('SHARED')).toBe(75); // 3/4
      expect(multiCalculator.calculateProgress('END')).toBe(100); // 4/4
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle graph with no entry point', () => {
      const noEntryGraph = {
        nodes: new Map([['NODE', {}]]),
        edges: new Map(),
        entryPoint: null,
        topologicalSort: () => ['NODE']
      };
      
      const noEntryCalculator = new ProgressCalculator(noEntryGraph as any);
      expect(noEntryCalculator.calculateProgress('NODE')).toBe(100); // Single node = 100%
    });

    it('should handle very large graphs', () => {
      // Create a linear graph with 100 nodes
      const largeRegistry = new NodeRegistry();
      const largeBuilder = new GraphBuilder(largeRegistry);
      
      // This tests performance and accuracy with many nodes
      const nodeCount = 10; // Reduced for test speed
      for (let i = 1; i < nodeCount; i++) {
        // We'll just test the calculation logic without actual nodes
      }
      
      // Test that progress scales correctly
      const mockLargeGraph = {
        nodes: new Map(Array.from({length: 100}, (_, i) => [`NODE_${i}`, {}])),
        edges: new Map(Array.from({length: 99}, (_, i) => [`NODE_${i}`, [`NODE_${i+1}`]])),
        entryPoint: 'NODE_0',
        topologicalSort: () => Array.from({length: 100}, (_, i) => `NODE_${i}`)
      };
      
      const largeCalculator = new ProgressCalculator(mockLargeGraph as any);
      
      expect(largeCalculator.calculateProgress('NODE_0')).toBe(1); // 1/100
      expect(largeCalculator.calculateProgress('NODE_49')).toBe(50); // 50/100
      expect(largeCalculator.calculateProgress('NODE_99')).toBe(100); // 100/100
    });
  });

  describe('Caching behavior', () => {
    it('should cache topological sort for performance', () => {
      let sortCallCount = 0;
      const mockGraph = {
        nodes: graph.nodes,
        edges: graph.edges,
        entryPoint: graph.entryPoint,
        topologicalSort: () => {
          sortCallCount++;
          return graph.topologicalSort();
        }
      };
      
      const cachingCalculator = new ProgressCalculator(mockGraph as any);
      
      // Multiple calls should only trigger one sort
      cachingCalculator.calculateProgress(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      cachingCalculator.calculateProgress(StepId.P0_2_REFINE_DATA_TYPES);
      cachingCalculator.calculateProgress(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      
      expect(sortCallCount).toBe(1);
    });
  });
});