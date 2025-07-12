import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0_3_SelectProceduralUtterancesNode } from '../P0_3_SelectProceduralUtterancesNode';
import { GraphState, ExecutionContext, StepId } from '../../types';
import { P0_2_Output, P0_3_Output } from '../../types/outputs';

describe('P0_3_SelectProceduralUtterancesNode', () => {
  let node: P0_3_SelectProceduralUtterancesNode;
  let mockContext: ExecutionContext;
  let testState: GraphState;

  beforeEach(() => {
    node = new P0_3_SelectProceduralUtterancesNode();
    
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

    // State with P0_2 output already completed
    testState = {
      sessionId: 'test-session',
      currentStep: StepId.P0_2_REFINE_DATA_TYPES,
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
            '5: Participant: There are documents, images, and data files.',
            '6: Participant: After sorting, I scan each document.',
            '7: Interviewer: How long does that take?',
            '8: Participant: Usually about 30 minutes per batch.'
          ],
          transcription_convention_notes: 'Clear speaker labels',
          initial_impressions_log: 'Describes categorization and scanning process'
        },
        [StepId.P0_2_REFINE_DATA_TYPES]: {
          transcript_id: 'transcript-1',
          refined_data_transcript: [
            {
              line_num: 1,
              text: 'Interviewer: Tell me about your process.',
              information_tags: ['procedural_information'],
              decision_notes: 'Interviewer question - part of interview process'
            },
            {
              line_num: 2,
              text: 'Participant: Well, first I gather all the materials.',
              information_tags: ['experiential_content'],
              decision_notes: 'Describes first step of their experience'
            },
            {
              line_num: 3,
              text: 'Participant: Then I organize them by type.',
              information_tags: ['experiential_content'],
              decision_notes: 'Describes second step of their experience'
            },
            {
              line_num: 4,
              text: 'Interviewer: What types are there?',
              information_tags: ['procedural_information'],
              decision_notes: 'Interviewer clarification question'
            },
            {
              line_num: 5,
              text: 'Participant: There are documents, images, and data files.',
              information_tags: ['experiential_content'],
              decision_notes: 'Details about the experience'
            },
            {
              line_num: 6,
              text: 'Participant: After sorting, I scan each document.',
              information_tags: ['experiential_content'],
              decision_notes: 'Describes third step of their experience'
            },
            {
              line_num: 7,
              text: 'Interviewer: How long does that take?',
              information_tags: ['procedural_information'],
              decision_notes: 'Interviewer time inquiry'
            },
            {
              line_num: 8,
              text: 'Participant: Usually about 30 minutes per batch.',
              information_tags: ['experiential_content'],
              decision_notes: 'Time details of the experience'
            }
          ]
        } as P0_2_Output
      },
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
      expect(node.id).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });

    it('should have appropriate retry policy', () => {
      expect(node.retryPolicy.maxAttempts).toBe(3);
      expect(node.retryPolicy.backoff).toBe('exponential');
    });
  });

  describe('Input validation', () => {
    it('should fail if P0_2 output is missing', async () => {
      delete testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('P0_2 output not found');
      expect(result.error?.recoverable).toBe(false);
    });

    it('should fail if refined_data_transcript is missing', async () => {
      // Add P_NEG1_1 output so we can test the refined_data_transcript validation
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      p0_2_output.refined_data_transcript = undefined as any;
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No refined transcript');
      expect(result.error?.recoverable).toBe(false);
    });

    it('should fail if refined_data_transcript is empty', async () => {
      // Add P_NEG1_1 output so we can test the refined_data_transcript validation
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      p0_2_output.refined_data_transcript = [];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No refined transcript');
      expect(result.error?.recoverable).toBe(false);
    });
  });

  describe('LLM-based selection', () => {
    it('should require P_NEG1_1 output for IV/DV context', async () => {
      // Remove P_NEG1_1 output
      delete testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('P_NEG1_1 output not found');
    });

    it('should build prompt with experiential content focus', () => {
      // Add P_NEG1_1 output to state
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Interview about document processing',
        dependent_variable_focus: ['efficiency', 'organization']
      };
      
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      const p_neg1_1_output = testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION];
      const prompt = node.buildPrompt(p0_2_output, p_neg1_1_output);
      
      expect(prompt).toContain('micro-phenomenological analyst');
      expect(prompt).toContain('diachronic (temporal) structure');
      expect(prompt).toContain('experiential_content');
      expect(prompt).toContain('independent_variable_details');
      expect(prompt).toContain('dependent_variable_focus');
    });

    it('should call LLM with proper semantic analysis prompt', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Interview about document processing',
        dependent_variable_focus: ['efficiency', 'organization']
      };
      
      // Mock LLM response
      const mockResponse = {
        transcript_id: 'transcript-1',
        selected_procedural_utterances: [
          {
            original_line_num: '2',
            utterance_text: 'Participant: Well, first I gather all the materials.',
            selection_justification: 'Describes first action in the experience sequence'
          },
          {
            original_line_num: '3',
            utterance_text: 'Participant: Then I organize them by type.',
            selection_justification: 'Describes second sequential action'
          },
          {
            original_line_num: '6',
            utterance_text: 'Participant: After sorting, I scan each document.',
            selection_justification: 'Describes third procedural step with temporal marker "After"'
          }
        ],
        discarded_info_summary: 'Interviewer questions and static descriptions were excluded',
        independent_variable_details: 'Interview about document processing',
        dependent_variable_focus: ['efficiency', 'organization']
      };
      
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });
      
      const result = await node.execute(testState, mockContext);
      
      expect(mockContext.llmClient.generateContent).toHaveBeenCalled();
      expect(result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toEqual(mockResponse);
    });
  });

  describe('Output generation', () => {
    it('should generate correct output structure', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Interview about document processing',
        dependent_variable_focus: ['efficiency', 'organization']
      };
      
      // Mock LLM response
      const mockResponse = {
        transcript_id: 'transcript-1',
        selected_procedural_utterances: [
          {
            original_line_num: '2',
            utterance_text: 'Participant: Well, first I gather all the materials.',
            selection_justification: 'First step in process'
          },
          {
            original_line_num: '3',
            utterance_text: 'Participant: Then I organize them by type.',
            selection_justification: 'Second step'
          },
          {
            original_line_num: '6',
            utterance_text: 'Participant: After sorting, I scan each document.',
            selection_justification: 'Third step'
          }
        ],
        discarded_info_summary: 'Excluded interviewer questions and static descriptions',
        independent_variable_details: 'Interview about document processing',
        dependent_variable_focus: ['efficiency', 'organization']
      };
      
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });
      
      const result = await node.execute(testState, mockContext);
      
      expect(result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toBeDefined();
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      expect(output.transcript_id).toBe('transcript-1');
      expect(output.selected_procedural_utterances).toHaveLength(3);
      expect(output.discarded_info_summary).toBeDefined();
      expect(output.independent_variable_details).toBe('Interview about document processing');
      expect(output.dependent_variable_focus).toEqual(['efficiency', 'organization']);
    });

    it('should preserve utterance details with justifications', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      const mockResponse = {
        transcript_id: 'transcript-1',
        selected_procedural_utterances: [
          {
            original_line_num: '2',
            utterance_text: 'Participant: Well, first I gather all the materials.',
            selection_justification: 'Describes first action in experiential sequence'
          }
        ],
        discarded_info_summary: 'Excluded non-procedural content',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });
      
      const result = await node.execute(testState, mockContext);
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      const firstUtterance = output.selected_procedural_utterances[0];
      expect(firstUtterance.original_line_num).toBe('2');
      expect(firstUtterance.utterance_text).toBe('Participant: Well, first I gather all the materials.');
      expect(firstUtterance.selection_justification).toBe('Describes first action in experiential sequence');
    });

    it('should handle case with no procedural utterances', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      const mockResponse = {
        transcript_id: 'transcript-1',
        selected_procedural_utterances: [],
        discarded_info_summary: 'No procedural content found - all utterances were static descriptions or interview process',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse)
        }
      });
      
      const result = await node.execute(testState, mockContext);
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      expect(output.selected_procedural_utterances).toHaveLength(0);
      expect(output.discarded_info_summary).toContain('No procedural content found');
    });
  });

  describe('State updates', () => {
    it('should update state correctly on success', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      // Mock LLM response
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            selected_procedural_utterances: [],
            discarded_info_summary: 'Test',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['test']
          })
        }
      });
      
      // Add progress to context
      const contextWithProgress = {
        ...mockContext,
        progress: {
          percentage: 75,
          currentStepIndex: 2,
          totalSteps: 4
        }
      };
      
      const result = await node.execute(testState, contextWithProgress);
      
      expect(result.currentStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(result.lastCompletedStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(result.metadata?.lastUpdateTime).toBeDefined();
      expect(result.progress).toBe(75);
    });

    it('should preserve previous step outputs', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      // Mock LLM response
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            selected_procedural_utterances: [],
            discarded_info_summary: 'Test',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['test']
          })
        }
      });
      
      const result = await node.execute(testState, mockContext);
      
      // Should still have P_NEG1_1, P0_1 and P0_2 outputs
      expect(result.stepOutputs?.[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]).toBeDefined();
      expect(result.stepOutputs?.[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toBeDefined();
      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toBeDefined();
      // And new P0_3 output
      expect(result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toBeDefined();
    });
  });

  describe('Error recovery', () => {
    it('should mark input validation errors as non-recoverable', async () => {
      delete testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.error?.recoverable).toBe(false);
    });

    it('should handle LLM errors with retry', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      // First call fails, second succeeds
      mockContext.llmClient.generateContent
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              selected_procedural_utterances: [],
              discarded_info_summary: 'Test',
              independent_variable_details: 'Test IV',
              dependent_variable_focus: ['test']
            })
          }
        });
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed LLM response', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      // Mock invalid JSON response
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON {broken'
        }
      });
      
      await expect(node.execute(testState, mockContext)).rejects.toThrow('Failed to parse LLM JSON response');
    });

    it('should handle missing required fields in LLM response', async () => {
      // Add P_NEG1_1 output
      testState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
        transcript_id: 'transcript-1',
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test']
      };
      
      // Mock response missing required fields
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1'
            // Missing selected_procedural_utterances
          })
        }
      });
      
      await expect(node.execute(testState, mockContext)).rejects.toThrow();
    });
  });
});