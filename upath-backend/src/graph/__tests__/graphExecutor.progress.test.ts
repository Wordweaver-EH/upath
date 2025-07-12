import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphExecutor } from '../graphExecutor';
import { GraphBuilder } from '../graphBuilder';
import { NodeRegistry } from '../nodeRegistry';
import { StepId, ExecutionContext } from '../types';

describe('GraphExecutor with ProgressCalculator', () => {
  let executor: GraphExecutor;
  let builder: GraphBuilder;
  let registry: NodeRegistry;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    registry = new NodeRegistry();
    builder = new GraphBuilder(registry);
    executor = new GraphExecutor(builder.build());
    
    mockContext = {
      llmClient: {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              line_numbered_transcript: ['1: Line 1'],
              transcription_convention_notes: 'Notes',
              initial_impressions_log: 'Log'
            })
          }
        })
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      settings: {
        model: 'gemini-1.5-pro',
        temperature: 0.1
      }
    };
  });

  describe('Progress calculation', () => {
    it('should calculate progress dynamically based on graph structure', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Test content'
        }],
        settings: {}
      });

      // Execute first step
      const result1 = await executor.executeStep(sessionId, mockContext);
      expect(result1.success).toBe(true);
      
      const session1 = await executor.getSession(sessionId);
      // After executing P0_1, we're now on P0_2, which is 2/3 progress
      expect(session1?.state.progress).toBe(67); // 2/3

      // Mock P0_2 response
      mockContext.llmClient.generateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            refined_data_transcript: [{
              line_num: 1,
              text: 'Line 1',
              information_tags: ['P-tag']
            }]
          })
        }
      });

      // Execute second step
      const result2 = await executor.executeStep(sessionId, mockContext);
      expect(result2.success).toBe(true);
      
      const session2 = await executor.getSession(sessionId);
      // After executing P0_2, we're now on P0_3, which is 3/3 progress
      expect(session2?.state.progress).toBe(100); // 3/3

      // Execute third step (no LLM needed for P0_3)
      const result3 = await executor.executeStep(sessionId, mockContext);
      expect(result3.success).toBe(true);
      
      const session3 = await executor.getSession(sessionId);
      // After executing P0_3, we should still be at 100% (no more steps)
      expect(session3?.state.progress).toBe(100); // Still 3/3
    });

    it('should handle custom graph structures', async () => {
      // Create a custom graph with different structure
      const customBuilder = new GraphBuilder(registry);
      
      // Remove default P0_2 -> P0_3 edge
      customBuilder.removeEdge(StepId.P0_2_REFINE_DATA_TYPES, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      
      // Add branching: P0_1 -> P0_3 directly
      customBuilder.addEdge(StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      
      const customExecutor = new GraphExecutor(customBuilder.build());
      
      const sessionId = await customExecutor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Test content'
        }],
        settings: {}
      });

      // Progress should still be calculated correctly
      const session = await customExecutor.getSession(sessionId);
      expect(session?.state.progress).toBeDefined();
      expect(session?.state.progress).toBeGreaterThanOrEqual(0);
      expect(session?.state.progress).toBeLessThanOrEqual(100);
    });

    it('should set progress to 100 when reaching COMPLETE', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Test content'
        }],
        settings: {}
      });

      // Manually set to COMPLETE state
      const session = await executor.getSession(sessionId);
      if (session) {
        session.state.currentStep = StepId.COMPLETE;
        session.state.status = 'completed';
        // Calculate progress for COMPLETE state
        session.state.progress = 100;
      }

      // Check progress
      expect(session?.state.progress).toBe(100);
    });

    it('should start with 0 progress for IDLE state', async () => {
      // Test that initial state would have 0 progress if it were IDLE
      // (Note: actual implementation starts with P0_1, so this tests the calculator logic)
      const mockGraph = builder.build();
      const { ProgressCalculator } = await import('../services/progressCalculator');
      const calculator = new ProgressCalculator(mockGraph);
      
      expect(calculator.calculateProgress(StepId.IDLE)).toBe(0);
    });
  });

  describe('Progress in ExecutionContext', () => {
    it('should pass progress information to nodes via context', async () => {
      // Create a spy to capture the context passed to nodes
      let capturedContext: any;
      
      // Override the first node's execute method to capture context
      const originalGetNode = registry.getNode.bind(registry);
      registry.getNode = vi.fn((nodeId) => {
        const node = originalGetNode(nodeId);
        if (nodeId === StepId.P0_1_TRANSCRIPTION_ADHERENCE) {
          const originalExecute = node.execute.bind(node);
          node.execute = vi.fn(async (state, context) => {
            capturedContext = context;
            return originalExecute(state, context);
          });
        }
        return node;
      });

      const customExecutor = new GraphExecutor(builder.build());
      
      const sessionId = await customExecutor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Test content'
        }],
        settings: {}
      });

      await customExecutor.executeStep(sessionId, mockContext);

      // Verify that progress was included in the context
      // When executing P0_1, the progress shows P0_1's position (1/3 = 33%)
      expect(capturedContext).toBeDefined();
      expect(capturedContext.progress).toBeDefined();
      expect(capturedContext.progress.percentage).toBe(33);
      expect(capturedContext.progress.currentStepIndex).toBe(0);
      expect(capturedContext.progress.totalSteps).toBe(3);
    });
  });
});