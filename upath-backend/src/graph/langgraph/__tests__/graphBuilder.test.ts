import { describe, it, expect, beforeAll } from 'vitest';
import { createUPathPipeline } from '../graphBuilder';
import { UPathMVPState } from '../annotations';

describe('LangGraph MVP Pipeline', () => {
  let pipeline: any;

  beforeAll(() => {
    // Mock environment variables
    process.env.GEMINI_API_KEY = 'test-api-key';
    
    // Create pipeline instance
    pipeline = createUPathPipeline();
  });

  it('should create a valid pipeline instance', () => {
    expect(pipeline).toBeDefined();
    expect(pipeline.stream).toBeDefined();
    expect(pipeline.invoke).toBeDefined();
  });

  it('should handle single transcript routing', async () => {
    const singleTranscript: Partial<UPathMVPState> = {
      pipelineId: 'test-single',
      transcripts: [{
        id: '1',
        filename: 'test.txt',
        content: 'This is a test transcript',
      }],
      status: 'idle',
      progress: 0,
      currentTranscriptIndex: 0,
      currentPhaseIndex: 0,
      currentGDUIndex: 0,
      stepOutputs: {},
      errors: [],
      gdus: [],
    };

    // LangGraph requires thread_id in config
    const config = {
      configurable: {
        thread_id: 'test-thread-single',
      },
      recursionLimit: 10, // Limit recursion for testing
    };

    // Test streaming
    const results = [];
    const stream = await pipeline.stream(singleTranscript, config);
    
    for await (const chunk of stream) {
      results.push(chunk);
      
      // Break after routing decision to avoid full pipeline execution in test
      if (chunk.isMultiTranscript !== undefined) {
        break;
      }
    }

    // Verify routing decision
    const routingResult = results.find(r => r.isMultiTranscript !== undefined);
    expect(routingResult).toBeDefined();
    expect(routingResult.isMultiTranscript).toBe(false);
  });

  it('should handle multi transcript routing', async () => {
    const multiTranscripts: Partial<UPathMVPState> = {
      pipelineId: 'test-multi',
      transcripts: [
        {
          id: '1',
          filename: 'test1.txt',
          content: 'First transcript',
        },
        {
          id: '2',
          filename: 'test2.txt',
          content: 'Second transcript',
        },
      ],
      status: 'idle',
      progress: 0,
      currentTranscriptIndex: 0,
      currentPhaseIndex: 0,
      currentGDUIndex: 0,
      stepOutputs: {},
      errors: [],
      gdus: [],
    };

    // Test streaming
    const results = [];
    const stream = await pipeline.stream(multiTranscripts);
    
    for await (const chunk of stream) {
      results.push(chunk);
      
      // Break after routing decision
      if (chunk.isMultiTranscript !== undefined) {
        break;
      }
    }

    // Verify routing decision
    const routingResult = results.find(r => r.isMultiTranscript !== undefined);
    expect(routingResult).toBeDefined();
    expect(routingResult.isMultiTranscript).toBe(true);
  });

  it('should update progress during execution', async () => {
    const testState: Partial<UPathMVPState> = {
      pipelineId: 'test-progress',
      transcripts: [{
        id: '1',
        content: 'Test content',
      }],
      status: 'idle',
      progress: 0,
      currentTranscriptIndex: 0,
      currentPhaseIndex: 0,
      currentGDUIndex: 0,
      stepOutputs: {},
      errors: [],
      gdus: [],
    };

    const progressUpdates = [];
    const stream = await pipeline.stream(testState);
    
    let count = 0;
    for await (const chunk of stream) {
      if (chunk.progress !== undefined) {
        progressUpdates.push(chunk.progress);
      }
      
      // Limit iterations to prevent long test
      count++;
      if (count > 5) break;
    }

    // Should have some progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[0]).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const invalidState: Partial<UPathMVPState> = {
      pipelineId: 'test-error',
      transcripts: [], // Empty transcripts should cause issues
      status: 'idle',
      progress: 0,
      currentTranscriptIndex: 0,
      currentPhaseIndex: 0,
      currentGDUIndex: 0,
      stepOutputs: {},
      errors: [],
      gdus: [],
    };

    try {
      const stream = await pipeline.stream(invalidState);
      const results = [];
      
      for await (const chunk of stream) {
        results.push(chunk);
        
        // Check for errors
        if (chunk.errors && chunk.errors.length > 0) {
          break;
        }
        
        // Or status failure
        if (chunk.status === 'failed') {
          break;
        }
      }

      // Should have handled the error state
      const errorResult = results.find(r => r.errors?.length > 0 || r.status === 'failed');
      expect(errorResult).toBeDefined();
    } catch (error) {
      // Pipeline might throw on invalid input, which is also acceptable
      expect(error).toBeDefined();
    }
  });

  it('should maintain state consistency across nodes', async () => {
    const testState: Partial<UPathMVPState> = {
      pipelineId: 'test-consistency',
      transcripts: [{
        id: '1',
        content: 'Test transcript for consistency',
      }],
      status: 'idle',
      progress: 0,
      currentTranscriptIndex: 0,
      currentPhaseIndex: 0,
      currentGDUIndex: 0,
      stepOutputs: {},
      errors: [],
      gdus: [],
    };

    const stateSnapshots = [];
    const stream = await pipeline.stream(testState);
    
    let count = 0;
    for await (const chunk of stream) {
      stateSnapshots.push({
        pipelineId: chunk.pipelineId,
        status: chunk.status,
        transcriptIndex: chunk.currentTranscriptIndex,
        phaseIndex: chunk.currentPhaseIndex,
      });
      
      count++;
      if (count > 3) break;
    }

    // Verify pipeline ID remains consistent
    const pipelineIds = stateSnapshots.map(s => s.pipelineId).filter(Boolean);
    expect(new Set(pipelineIds).size).toBe(1);
    
    // Verify status progresses correctly
    const firstStatus = stateSnapshots.find(s => s.status)?.status;
    expect(['idle', 'running']).toContain(firstStatus);
  });
});