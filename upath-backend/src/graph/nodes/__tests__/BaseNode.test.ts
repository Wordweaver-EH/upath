import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseNode } from '../BaseNode';
import { GraphState, ExecutionContext, NodeExecutionResult, StepId } from '../../types';
import { NodeExecutionError } from '../../types/errors';

// Test implementation of BaseNode
class TestNode extends BaseNode {
  id = StepId.P0_1_TRANSCRIPTION_ADHERENCE;
  
  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Simple test implementation
    return {
      currentStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: { test: 'output' }
      }
    };
  }
}

// Test node that always fails
class FailingNode extends BaseNode {
  id = StepId.P0_2_REFINE_DATA_TYPES;
  failCount = 0;
  
  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    this.failCount++;
    throw new Error('Test error');
  }
}

// Test node that fails then succeeds
class RetryableNode extends BaseNode {
  id = StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES;
  attemptCount = 0;
  
  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    this.attemptCount++;
    if (this.attemptCount < 3) {
      throw new Error('Transient error');
    }
    return {
      currentStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: { attemptCount: this.attemptCount }
      }
    };
  }
}

describe('BaseNode', () => {
  let mockContext: ExecutionContext;
  let testState: GraphState;

  beforeEach(() => {
    mockContext = {
      llmClient: {},
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      settings: {
        model: 'gemini-1.5-pro',
        temperature: 0.3
      }
    };

    testState = {
      sessionId: 'test-session',
      currentStep: StepId.IDLE,
      transcripts: [],
      stepOutputs: {},
      errors: {},
      metadata: {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        settings: {}
      }
    };
  });

  describe('Basic functionality', () => {
    it('should have required properties', () => {
      const node = new TestNode();
      
      expect(node.id).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(node.retryPolicy).toBeDefined();
      expect(node.retryPolicy.maxAttempts).toBe(3);
      expect(node.retryPolicy.backoff).toBe('exponential');
    });

    it('should validate input state before execution', async () => {
      const node = new TestNode();
      
      // Test with invalid state (missing transcripts)
      const invalidState = { ...testState, transcripts: undefined as any };
      
      const result = await node.executeWithRetry(invalidState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid state');
    });

    it('should execute successfully with valid state', async () => {
      const node = new TestNode();
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.state).toBeDefined();
      expect(result.state?.currentStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(result.state?.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toEqual({ test: 'output' });
    });
  });

  describe('Retry logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      const node = new FailingNode();
      node.retryPolicy = { maxAttempts: 3, backoff: 'exponential' };
      
      const startTime = Date.now();
      const result = await node.executeWithRetry(testState, mockContext);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(node.failCount).toBe(3); // Should have attempted 3 times
      expect(duration).toBeGreaterThan(300); // Should have delays: 100ms + 200ms = 300ms minimum
      expect(mockContext.logger.error).toHaveBeenCalledTimes(3);
    });

    it('should succeed after retries', async () => {
      const node = new RetryableNode();
      node.retryPolicy = { maxAttempts: 3, backoff: 'exponential' };
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(true);
      expect(node.attemptCount).toBe(3);
      expect(result.state?.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toEqual({ attemptCount: 3 });
    });

    it('should respect maxAttempts setting', async () => {
      const node = new FailingNode();
      node.retryPolicy = { maxAttempts: 1, backoff: 'exponential' };
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(node.failCount).toBe(1); // Should only attempt once
    });

    it('should support linear backoff', async () => {
      const node = new FailingNode();
      node.retryPolicy = { maxAttempts: 3, backoff: 'linear' };
      
      const startTime = Date.now();
      const result = await node.executeWithRetry(testState, mockContext);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(duration).toBeGreaterThan(200); // Should have delays: 100ms + 100ms = 200ms minimum
    });
  });

  describe('Error handling', () => {
    it('should wrap errors in NodeExecutionError', async () => {
      const node = new FailingNode();
      node.retryPolicy = { maxAttempts: 1, backoff: 'exponential' };
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.stepId).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(result.error?.message).toContain('Test error');
      expect(result.error?.recoverable).toBe(true);
    });

    it('should mark certain errors as non-recoverable', async () => {
      class NonRecoverableNode extends BaseNode {
        id = 'test-node' as any;
        
        async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
          const error = new Error('Validation failed: Invalid input format');
          throw error;
        }
      }
      
      const node = new NonRecoverableNode();
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.recoverable).toBe(false);
    });
  });

  describe('Logging', () => {
    it('should log execution start and completion', async () => {
      const node = new TestNode();
      
      await node.executeWithRetry(testState, mockContext);
      
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Executing node'),
        expect.objectContaining({ nodeId: StepId.P0_1_TRANSCRIPTION_ADHERENCE })
      );
      
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Node execution completed'),
        expect.objectContaining({ 
          nodeId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          duration: expect.any(Number)
        })
      );
    });

    it('should log retry attempts', async () => {
      const node = new RetryableNode();
      
      await node.executeWithRetry(testState, mockContext);
      
      // Should log each retry attempt
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrying node'),
        expect.objectContaining({ 
          nodeId: StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
          attempt: 2
        })
      );
    });
  });

});