import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P_NEG1_1_VariableIdentificationNode } from '../P_NEG1_1_VariableIdentificationNode';
import { GraphState, StepId, ExecutionContext } from '../../types';
import { createInitialGraphState } from '../../types/state';
import { P_NEG1_1_Output } from '../../types/outputs';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P_NEG1_1_VariableIdentificationNode', () => {
  let node: P_NEG1_1_VariableIdentificationNode;
  let mockState: GraphState;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    node = new P_NEG1_1_VariableIdentificationNode();
    
    mockState = createInitialGraphState('session-1', [{
      id: 'transcript-1',
      filename: 'test_transcript.txt',
      content: `Participant 42, Condition A (Score 8/10)
      
      Interviewer: Can you tell me about your experience?
      Participant: Well, I started by...`
    }]);

    // Set user DV focus
    mockState.userDvFocus = {
      dv_focus: ['emotional_response', 'cognitive_load']
    };

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
  });

  describe('Validation', () => {
    it('should validate required inputs', () => {
      // Missing transcript content
      mockState.transcripts[0].content = '';
      expect(() => node.validateInputs(mockState))
        .toThrow('Missing transcript content for P_NEG1_1');

      // Missing DV focus
      mockState.transcripts[0].content = 'test content';
      mockState.userDvFocus = undefined;
      expect(() => node.validateInputs(mockState))
        .toThrow('Missing user DV focus for P_NEG1_1');

      // Empty DV focus array
      mockState.userDvFocus = { dv_focus: [] };
      expect(() => node.validateInputs(mockState))
        .toThrow('Empty DV focus array for P_NEG1_1');
    });

    it('should validate with valid inputs', () => {
      expect(() => node.validateInputs(mockState)).not.toThrow();
    });
  });

  describe('Successful execution', () => {
    it('should extract IV from transcript header', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test_transcript.txt',
            independent_variable_details: 'Participant 42, Condition A (Score 8/10)',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      const result = await node.execute(mockState, mockContext);

      // Verify LLM was called with correct prompt
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([{
            role: 'user',
            parts: expect.arrayContaining([{
              text: expect.stringContaining('You are a data extraction assistant')
            }])
          }])
        })
      );

      // Verify result structure
      expect(result).toEqual({
        currentStep: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        lastCompletedStep: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        stepOutputs: {
          ...mockState.stepOutputs,
          [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: {
            transcript_id: 'test_transcript.txt',
            independent_variable_details: 'Participant 42, Condition A (Score 8/10)',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          }
        }
      });
    });

    it('should handle missing IV in header', async () => {
      // Update transcript without IV in header
      mockState.transcripts[0].content = `Interviewer: Can you tell me about your experience?
      Participant: Well, I started by...`;

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test_transcript.txt',
            independent_variable_details: 'Not explicitly stated in header.',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      const result = await node.execute(mockState, mockContext);

      const output = result.stepOutputs![StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] as P_NEG1_1_Output;
      expect(output.independent_variable_details).toBe('Not explicitly stated in header.');
    });

    it('should preserve exact DV focus from user input', async () => {
      mockState.userDvFocus = {
        dv_focus: ['attention_shifts', 'memory_recall', 'emotional_valence']
      };

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test_transcript.txt',
            independent_variable_details: 'Participant 42, Condition A (Score 8/10)',
            dependent_variable_focus: ['attention_shifts', 'memory_recall', 'emotional_valence']
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      const result = await node.execute(mockState, mockContext);

      const output = result.stepOutputs![StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] as P_NEG1_1_Output;
      expect(output.dependent_variable_focus).toEqual(['attention_shifts', 'memory_recall', 'emotional_valence']);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON response', async () => {
      const mockResponse = {
        response: {
          text: () => 'Not valid JSON'
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow(LLMResponseError);
    });

    it('should handle missing required fields in response', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test_transcript.txt',
            // Missing independent_variable_details and dependent_variable_focus
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow('Missing required field');
    });

    it('should handle LLM API errors', async () => {
      mockContext.llmClient.generateContent.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('Prompt generation', () => {
    it('should include transcript filename in prompt', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test_transcript.txt',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      await node.execute(mockState, mockContext);

      const promptCall = mockContext.llmClient.generateContent.mock.calls[0][0];
      const promptText = promptCall.contents[0].parts[0].text;
      
      expect(promptText).toContain('test_transcript.txt');
      expect(promptText).toContain('["emotional_response","cognitive_load"]');
    });

    it('should include full transcript content', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test_transcript.txt',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValue(mockResponse);

      await node.execute(mockState, mockContext);

      const promptCall = mockContext.llmClient.generateContent.mock.calls[0][0];
      const promptText = promptCall.contents[0].parts[0].text;
      
      expect(promptText).toContain('Participant 42, Condition A (Score 8/10)');
      expect(promptText).toContain('Can you tell me about your experience?');
    });
  });

  describe('Integration with BaseNode', () => {
    it('should work with retry mechanism on transient errors', async () => {
      // First attempt fails with transient error
      mockContext.llmClient.generateContent
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              transcript_id: 'test_transcript.txt',
              independent_variable_details: 'Test IV',
              dependent_variable_focus: ['emotional_response', 'cognitive_load']
            })
          }
        });

      const result = await node.executeWithRetry(mockState, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
    });
  });
});