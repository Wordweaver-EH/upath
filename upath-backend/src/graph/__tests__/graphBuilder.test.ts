import { describe, it, expect, beforeEach } from 'vitest';
import { GraphBuilder } from '../graphBuilder';
import { StepId } from '../types';
import { NodeRegistry } from '../nodeRegistry';

describe('GraphBuilder', () => {
  let builder: GraphBuilder;
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
    builder = new GraphBuilder(registry);
  });

  describe('Graph construction', () => {
    it('should create a graph with correct structure', () => {
      const graph = builder.build();
      
      expect(graph).toBeDefined();
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
      expect(graph.entryPoint).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    });

    it('should include all registered nodes', () => {
      const graph = builder.build();
      const nodeIds = Array.from(graph.nodes.keys());
      
      expect(nodeIds).toContain(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(nodeIds).toContain(StepId.P0_2_REFINE_DATA_TYPES);
      expect(nodeIds).toContain(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });

    it('should create edges in correct sequence', () => {
      const graph = builder.build();
      
      // Check P0_1 -> P0_2 edge
      const p0_1_edges = graph.edges.get(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(p0_1_edges).toBeDefined();
      expect(p0_1_edges).toContain(StepId.P0_2_REFINE_DATA_TYPES);
      
      // Check P0_2 -> P0_3 edge
      const p0_2_edges = graph.edges.get(StepId.P0_2_REFINE_DATA_TYPES);
      expect(p0_2_edges).toBeDefined();
      expect(p0_2_edges).toContain(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });
  });

  describe('Custom graph building', () => {
    it('should allow setting custom entry point', () => {
      builder.setEntryPoint(StepId.P0_2_REFINE_DATA_TYPES);
      const graph = builder.build();
      
      expect(graph.entryPoint).toBe(StepId.P0_2_REFINE_DATA_TYPES);
    });

    it('should allow adding custom edges', () => {
      builder.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      const graph = builder.build();
      
      const p0_1_edges = graph.edges.get(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(p0_1_edges).toContain(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });

    it('should allow removing edges', () => {
      builder.removeEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_2_REFINE_DATA_TYPES);
      const graph = builder.build();
      
      const p0_1_edges = graph.edges.get(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(p0_1_edges).toBeDefined();
      expect(p0_1_edges).not.toContain(StepId.P0_2_REFINE_DATA_TYPES);
    });
  });

  describe('Graph validation', () => {
    it('should validate that entry point exists', () => {
      builder.setEntryPoint('UNKNOWN_NODE' as StepId);
      
      expect(() => builder.build()).toThrow('Entry point UNKNOWN_NODE not found in graph');
    });

    it('should validate that all edge targets exist', () => {
      builder.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, 'UNKNOWN_NODE' as StepId);
      
      expect(() => builder.build()).toThrow('Target node UNKNOWN_NODE not found');
    });

    it('should detect cycles in graph', () => {
      // Create a cycle: P0_1 -> P0_2 -> P0_3 -> P0_1
      builder.addEdge(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      
      const graph = builder.build();
      expect(graph.hasCycles).toBe(true);
    });

    it('should not report cycles for valid DAG', () => {
      const graph = builder.build();
      expect(graph.hasCycles).toBe(false);
    });
  });

  describe('Graph traversal helpers', () => {
    it('should provide topological sort for acyclic graph', () => {
      const graph = builder.build();
      const sorted = graph.topologicalSort();
      
      expect(sorted).toBeDefined();
      expect(sorted).toHaveLength(3);
      
      // P0_1 should come before P0_2
      const p0_1_index = sorted.indexOf(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const p0_2_index = sorted.indexOf(StepId.P0_2_REFINE_DATA_TYPES);
      expect(p0_1_index).toBeLessThan(p0_2_index);
      
      // P0_2 should come before P0_3
      const p0_3_index = sorted.indexOf(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(p0_2_index).toBeLessThan(p0_3_index);
    });

    it('should return null for topological sort on cyclic graph', () => {
      builder.addEdge(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES, StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      const graph = builder.build();
      
      expect(graph.topologicalSort()).toBeNull();
    });

    it('should find all paths from entry to a target node', () => {
      const graph = builder.build();
      const paths = graph.findPaths(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE, 
        StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES
      );
      
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual([
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES,
        StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES
      ]);
    });

    it('should find multiple paths when they exist', () => {
      // Add alternate path: P0_1 -> P0_3
      builder.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      const graph = builder.build();
      
      const paths = graph.findPaths(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES
      );
      
      expect(paths).toHaveLength(2);
      // One direct path and one through P0_2
    });
  });

  describe('Conditional edges', () => {
    it('should support conditional edges with predicates', () => {
      const condition = (state: any) => state.skipP0_2 === true;
      
      builder.addConditionalEdge(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
        condition
      );
      
      const graph = builder.build();
      const conditionalEdges = graph.conditionalEdges.get(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      
      expect(conditionalEdges).toBeDefined();
      expect(conditionalEdges).toHaveLength(1);
      expect(conditionalEdges![0].target).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(conditionalEdges![0].condition).toBe(condition);
    });
  });

  describe('Graph metadata', () => {
    it('should include metadata about the graph', () => {
      const graph = builder.build();
      
      expect(graph.metadata).toBeDefined();
      expect(graph.metadata.nodeCount).toBe(3);
      expect(graph.metadata.edgeCount).toBeGreaterThan(0);
      expect(graph.metadata.createdAt).toBeDefined();
    });
  });
});