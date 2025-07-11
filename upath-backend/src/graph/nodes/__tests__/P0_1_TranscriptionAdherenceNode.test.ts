import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0_1_TranscriptionAdherenceNode } from '../P0_1_TranscriptionAdherenceNode';
import { GraphState, ExecutionContext, StepId } from '../../types';

describe('P0_1_TranscriptionAdherenceNode', () => {
  let node: P0_1_TranscriptionAdherenceNode;
  let mockContext: ExecutionContext;
  let testState: GraphState;

  beforeEach(() => {
    node = new P0_1_TranscriptionAdherenceNode();
    
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
        temperature: 0.1
      }
    };

    testState = {
      sessionId: 'test-session',
      currentStep: StepId.IDLE,
      transcripts: [{
        id: 'transcript-1',
        filename: 'test-interview.txt',
        content: `Interviewer: Can you tell me about your experience with the new software?
Participant: Well, I started using it last month...
Interviewer: And how has it been?
Participant: It's been quite helpful, actually. First, I open the application...`
      }],
      stepOutputs: {},
      errors: {},
      metadata: {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        settings: {
          model: 'gemini-1.5-pro',
          temperature: 0.1
        }
      }
    };
  });

  describe('Basic properties', () => {
    it('should have correct step ID', () => {
      expect(node.id).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    });

    it('should have appropriate retry policy', () => {
      expect(node.retryPolicy.maxAttempts).toBe(3);
      expect(node.retryPolicy.backoff).toBe('exponential');
    });
  });

  describe('Input validation', () => {
    it('should fail if no transcripts are provided', async () => {
      testState.transcripts = [];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No transcripts provided');
      expect(result.error?.recoverable).toBe(false);
    });

    it('should fail if transcript has no content', async () => {
      testState.transcripts = [{
        id: 'empty',
        filename: 'empty.txt',
        content: ''
      }];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Empty transcript');
      expect(result.error?.recoverable).toBe(false);
    });
  });

  describe('Prompt building', () => {
    it('should build correct prompt for transcription adherence', () => {
      const prompt = node.buildPrompt(testState.transcripts[0]);
      
      expect(prompt).toContain('TRANSCRIPTION ADHERENCE CHECK');
      expect(prompt).toContain(testState.transcripts[0].content);
      expect(prompt).toContain('line_numbered_transcript');
      expect(prompt).toContain('transcription_convention_notes');
      expect(prompt).toContain('initial_impressions_log');
    });

    it('should include specific instructions for formatting', () => {
      const prompt = node.buildPrompt(testState.transcripts[0]);
      
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('line numbers');
      expect(prompt).toContain('speaker labels');
    });
  });

  describe('LLM interaction', () => {
    it('should call LLM with correct parameters', async () => {
      const mockResponse = {
        transcript_id: 'transcript-1',
        line_numbered_transcript: [
          '1: Interviewer: Can you tell me about your experience with the new software?',
          '2: Participant: Well, I started using it last month...',
          '3: Interviewer: And how has it been?',
          '4: Participant: It\'s been quite helpful, actually. First, I open the application...'
        ],
        transcription_convention_notes: 'Clear speaker labels, proper punctuation',
        initial_impressions_log: 'Participant describes procedural steps for using software'
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
          parts: [{ text: expect.stringContaining('TRANSCRIPTION ADHERENCE CHECK') }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      expect(result.stepOutputs?.[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toEqual(mockResponse);
    });

    it('should handle LLM errors gracefully', async () => {
      mockContext.llmClient.generateContent.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(node.execute(testState, mockContext)).rejects.toThrow('API rate limit exceeded');
    });

    it('should parse JSON response correctly', async () => {
      const mockResponse = {
        transcript_id: 'transcript-1',
        line_numbered_transcript: ['1: Line one', '2: Line two'],
        transcription_convention_notes: 'Notes',
        initial_impressions_log: 'Impressions'
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);

      expect(result.stepOutputs?.[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toEqual(mockResponse);
      expect(result.currentStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(result.lastCompletedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    });

    it('should handle malformed JSON response', async () => {
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => 'Not valid JSON'
        }
      });

      await expect(node.execute(testState, mockContext)).rejects.toThrow();
    });
  });

  describe('State updates', () => {
    it('should update state correctly on success', async () => {
      const mockResponse = {
        transcript_id: 'transcript-1',
        line_numbered_transcript: ['1: Line'],
        transcription_convention_notes: 'Notes',
        initial_impressions_log: 'Log'
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);

      expect(result.currentStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(result.lastCompletedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(result.stepOutputs?.[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toBeDefined();
      expect(result.metadata?.lastUpdateTime).toBeDefined();
    });

    it('should calculate progress correctly', async () => {
      const mockResponse = {
        transcript_id: 'transcript-1',
        line_numbered_transcript: ['1: Line'],
        transcription_convention_notes: 'Notes',
        initial_impressions_log: 'Log'
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });

      const result = await node.execute(testState, mockContext);

      expect(result.progress).toBeDefined();
      expect(result.progress).toBeGreaterThan(0);
      expect(result.progress).toBeLessThan(100); // Not complete yet
    });
  });

  describe('Integration with BaseNode', () => {
    it('should work with retry mechanism', async () => {
      // First two calls fail, third succeeds
      mockContext.llmClient.generateContent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              line_numbered_transcript: ['1: Success'],
              transcription_convention_notes: 'Notes',
              initial_impressions_log: 'Log'
            })
          }
        });

      const result = await node.executeWithRetry(testState, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(3);
    });
  });
});