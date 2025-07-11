import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0_2_RefineDataTypesNode } from '../P0_2_RefineDataTypesNode';
import { GraphState, ExecutionContext, StepId } from '../../types';
import { P0_1_Output, P0_2_Output } from '../../types/outputs';

describe('P0_2_RefineDataTypesNode', () => {
  let node: P0_2_RefineDataTypesNode;
  let mockContext: ExecutionContext;
  let testState: GraphState;

  beforeEach(() => {
    node = new P0_2_RefineDataTypesNode();
    
    mockContext = {
      llmClient: {
        generateContent: vi.fn()
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      settings: {
        model: 'gemini-1.5-pro',
        temperature: 0.2
      }
    };

    // State with P0_1 output already completed
    testState = {
      sessionId: 'test-session',
      currentStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      transcripts: [{
        id: 'transcript-1',
        filename: 'test-interview.txt',
        content: 'Interview content...'
      }],
      stepOutputs: {
        [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: {
          transcript_id: 'transcript-1',
          line_numbered_transcript: [
            '1: Interviewer: Tell me about your process.',
            '2: Participant: Well, first I gather all the materials.',
            '3: Participant: Then I organize them by type.',
            '4: Interviewer: What types are there?',
            '5: Participant: There are documents, images, and data files.'
          ],
          transcription_convention_notes: 'Clear speaker labels',
          initial_impressions_log: 'Describes categorization process'
        } as P0_1_Output
      },
      errors: {},
      metadata: {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        settings: {
          model: 'gemini-1.5-pro',
          temperature: 0.2
        }
      }
    };
  });

  describe('Basic properties', () => {
    it('should have correct step ID', () => {
      expect(node.id).toBe(StepId.P0_2_REFINE_DATA_TYPES);
    });

    it('should have appropriate retry policy', () => {
      expect(node.retryPolicy.maxAttempts).toBe(3);
      expect(node.retryPolicy.backoff).toBe('exponential');
    });
  });

  describe('Input validation', () => {
    it('should fail if P0_1 output is missing', async () => {
      testState.stepOutputs = {};
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('P0_1 output not found');
      expect(result.error?.recoverable).toBe(false);
    });

    it('should fail if line_numbered_transcript is empty', async () => {
      const p0_1_output = testState.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] as P0_1_Output;
      p0_1_output.line_numbered_transcript = [];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No transcript lines to refine');
      expect(result.error?.recoverable).toBe(false);
    });
  });

  describe('Prompt building', () => {
    it('should build correct prompt for data type refinement', () => {
      const p0_1_output = testState.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] as P0_1_Output;
      const prompt = node.buildPrompt(p0_1_output);
      
      expect(prompt).toContain('DATA TYPE REFINEMENT');
      expect(prompt).toContain('line_numbered_transcript');
      expect(prompt).toContain('information_tags');
      expect(prompt).toContain('I-tag');
      expect(prompt).toContain('L-tag');
      expect(prompt).toContain('P-tag');
    });

    it('should include all transcript lines in prompt', () => {
      const p0_1_output = testState.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] as P0_1_Output;
      const prompt = node.buildPrompt(p0_1_output);
      
      p0_1_output.line_numbered_transcript.forEach(line => {
        expect(prompt).toContain(line);
      });
    });

    it('should include instructions for JSON output', () => {
      const p0_1_output = testState.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] as P0_1_Output;
      const prompt = node.buildPrompt(p0_1_output);
      
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('refined_data_transcript');
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with correct parameters', async () => {
      const mockResponse: P0_2_Output = {
        transcript_id: 'transcript-1',
        refined_data_transcript: [
          {
            line_num: 1,
            text: 'Interviewer: Tell me about your process.',
            information_tags: ['L-tag'],
            decision_notes: 'Leading question'
          },
          {
            line_num: 2,
            text: 'Participant: Well, first I gather all the materials.',
            information_tags: ['P-tag'],
            decision_notes: 'Procedural step 1'
          },
          {
            line_num: 3,
            text: 'Participant: Then I organize them by type.',
            information_tags: ['P-tag'],
            decision_notes: 'Procedural step 2'
          },
          {
            line_num: 4,
            text: 'Interviewer: What types are there?',
            information_tags: ['L-tag'],
            decision_notes: 'Clarification question'
          },
          {
            line_num: 5,
            text: 'Participant: There are documents, images, and data files.',
            information_tags: ['I-tag'],
            decision_notes: 'Information about categories'
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);

      expect(mockContext.llmClient.generateContent).toHaveBeenCalledWith({
        contents: [{ 
          role: 'user', 
          parts: [{ text: expect.stringContaining('DATA TYPE REFINEMENT') }]
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });

      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toEqual(mockResponse);
    });

    it('should handle LLM errors gracefully', async () => {
      mockContext.llmClient.generateContent.mockRejectedValue(
        new Error('Model overloaded')
      );

      await expect(node.execute(testState, mockContext)).rejects.toThrow('Model overloaded');
    });

    it('should validate response has correct structure', async () => {
      const invalidResponse = {
        transcript_id: 'transcript-1',
        // Missing refined_data_transcript
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(invalidResponse)
        }
      });

      await expect(node.execute(testState, mockContext)).rejects.toThrow();
    });
  });

  describe('State updates', () => {
    it('should update state correctly on success', async () => {
      const mockResponse: P0_2_Output = {
        transcript_id: 'transcript-1',
        refined_data_transcript: [
          {
            line_num: 1,
            text: 'Line 1',
            information_tags: ['I-tag']
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);

      expect(result.currentStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(result.lastCompletedStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toBeDefined();
      expect(result.metadata?.lastUpdateTime).toBeDefined();
    });

    it('should preserve previous step outputs', async () => {
      const mockResponse: P0_2_Output = {
        transcript_id: 'transcript-1',
        refined_data_transcript: []
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);

      // Should still have P0_1 output
      expect(result.stepOutputs?.[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toBeDefined();
      // And new P0_2 output
      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toBeDefined();
    });
  });

  describe('Information tag validation', () => {
    it('should accept valid information tags', async () => {
      const mockResponse: P0_2_Output = {
        transcript_id: 'transcript-1',
        refined_data_transcript: [
          {
            line_num: 1,
            text: 'Text',
            information_tags: ['I-tag', 'L-tag', 'P-tag']
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);
      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toBeDefined();
    });

    it('should handle lines with no tags', async () => {
      const mockResponse: P0_2_Output = {
        transcript_id: 'transcript-1',
        refined_data_transcript: [
          {
            line_num: 1,
            text: 'Text',
            information_tags: []
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);
      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toBeDefined();
    });
  });

  describe('Integration with BaseNode', () => {
    it('should work with retry mechanism on transient errors', async () => {
      // First call fails, second succeeds
      mockContext.llmClient.generateContent
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              refined_data_transcript: []
            })
          }
        });

      const result = await node.executeWithRetry(testState, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
    });
  });
});