import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P1_1_InitialSegmentationNode } from '../P1_1_InitialSegmentationNode';
import { GraphState, ExecutionContext, StepId } from '../../types';
import { createInitialGraphState } from '../../types/state';
import { P0_3_Output } from '../../types/outputs';

describe('P1_1_InitialSegmentationNode', () => {
  let node: P1_1_InitialSegmentationNode;
  let mockContext: ExecutionContext;
  let baseState: GraphState;

  beforeEach(() => {
    node = new P1_1_InitialSegmentationNode();
    
    mockContext = {
      sessionId: 'test-session',
      llmClient: {
        generateContent: vi.fn()
      },
      settings: {
        temperature: 0.3,
        modelName: 'gemini-1.5-pro'
      },
      retryCount: 0,
      maxRetries: 3,
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      }
    };

    // Create base state with P0_3 output
    baseState = createInitialGraphState('test-session', [], {});
    baseState.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] = {
      transcript_id: 'test-transcript',
      selected_procedural_utterances: [
        {
          original_line_num: '5',
          utterance_text: 'First, I open the application and then I click on the new document button',
          selection_justification: 'Contains sequential actions'
        },
        {
          original_line_num: '15',
          utterance_text: 'Now I need to select a template',
          selection_justification: 'Single action'
        },
        {
          original_line_num: '20',
          utterance_text: 'I choose the blank template and wait for it to load',
          selection_justification: 'Contains two actions'
        },
        {
          original_line_num: '25',
          utterance_text: 'Finally, I save the document',
          selection_justification: 'Final action'
        }
      ],
      discarded_info_summary: 'Removed interviewer questions',
      independent_variable_details: 'Document creation process',
      dependent_variable_focus: ['efficiency', 'user experience']
    } as P0_3_Output;
  });

  describe('Validation', () => {
    it('should have correct id', () => {
      expect(node.id).toBe(StepId.P1_1_INITIAL_SEGMENTATION);
    });

    it('should throw error if P0_3 output is missing', async () => {
      delete baseState.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES];

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('P0_3 output not found');
    });

    it('should throw error if procedural utterances are empty', async () => {
      (baseState.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output)
        .selected_procedural_utterances = [];

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('No procedural utterances to segment');
    });
  });

  describe('Successful Execution', () => {
    it('should segment procedural utterances correctly', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            segmented_utterances: [
              {
                original_line_num: '5',
                original_utterance: 'First, I open the application and then I click on the new document button',
                segments: [
                  {
                    segment_id: 'seg_5_1',
                    text: 'First, I open the application',
                    temporal_marker: 'First',
                    action_type: 'physical_action'
                  },
                  {
                    segment_id: 'seg_5_2',
                    text: 'and then I click on the new document button',
                    temporal_marker: 'then',
                    action_type: 'physical_action'
                  }
                ]
              },
              {
                original_line_num: '15',
                original_utterance: 'Now I need to select a template',
                segments: [
                  {
                    segment_id: 'seg_15_1',
                    text: 'Now I need to select a template',
                    temporal_marker: 'Now',
                    action_type: 'mental_process'
                  }
                ]
              },
              {
                original_line_num: '20',
                original_utterance: 'I choose the blank template and wait for it to load',
                segments: [
                  {
                    segment_id: 'seg_20_1',
                    text: 'I choose the blank template',
                    temporal_marker: null,
                    action_type: 'physical_action'
                  },
                  {
                    segment_id: 'seg_20_2',
                    text: 'and wait for it to load',
                    temporal_marker: 'and',
                    action_type: 'perception'
                  }
                ]
              },
              {
                original_line_num: '25',
                original_utterance: 'Finally, I save the document',
                segments: [
                  {
                    segment_id: 'seg_25_1',
                    text: 'Finally, I save the document',
                    temporal_marker: 'Finally',
                    action_type: 'physical_action'
                  }
                ]
              }
            ],
            total_segments: 6,
            segmentation_summary: 'Fine-grained segmentation based on temporal markers and action sequences'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);

      expect(result.stepOutputs).toBeDefined();
      expect(result.stepOutputs![StepId.P1_1_INITIAL_SEGMENTATION]).toBeDefined();
      
      const output = result.stepOutputs![StepId.P1_1_INITIAL_SEGMENTATION];
      expect(output.segmented_utterances).toHaveLength(4);
      expect(output.total_segments).toBe(6);
      expect(output.segmentation_summary).toContain('Fine-grained segmentation');
      
      // Verify first utterance was split into 2 segments
      expect(output.segmented_utterances[0].segments).toHaveLength(2);
      expect(output.segmented_utterances[0].segments[0].temporal_marker).toBe('First');
      expect(output.segmented_utterances[0].segments[1].temporal_marker).toBe('then');
      
      // Verify LLM was called with correct parameters
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledWith({
        contents: [{
          role: 'user',
          parts: [{ text: expect.stringContaining('micro-phenomenological analyst') }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      });
    });

    it('should handle utterances without temporal markers', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            segmented_utterances: [
              {
                original_line_num: '15',
                original_utterance: 'I select a template',
                segments: [
                  {
                    segment_id: 'seg_15_1',
                    text: 'I select a template',
                    temporal_marker: null,
                    action_type: 'physical_action'
                  }
                ]
              }
            ],
            total_segments: 1,
            segmentation_summary: 'Single action without temporal markers'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);
      const output = result.stepOutputs![StepId.P1_1_INITIAL_SEGMENTATION];
      
      expect(output.segmented_utterances).toHaveLength(1);
      expect(output.total_segments).toBe(1);
      expect(output.segmented_utterances[0].segments[0].temporal_marker).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON response'
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('Failed to parse LLM JSON response');
    });

    it('should handle missing segments in response', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            total_segments: 0,
            segmentation_summary: 'Some summary'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('Invalid response: missing segmented_utterances');
    });

    it('should be marked as recoverable for LLM errors', () => {
      const error = new Error('LLM service temporarily unavailable');
      expect(node.isRecoverable(error)).toBe(true);
    });

    it('should not be recoverable for validation errors', () => {
      const error = new Error('No procedural utterances to segment');
      expect(node.isRecoverable(error)).toBe(false);
    });
  });

  describe('Prompt Building', () => {
    it('should build proper prompt with utterances', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            segmented_utterances: [{
              original_line_num: '5',
              original_utterance: 'Test utterance',
              segments: [{
                segment_id: 'seg_5_1',
                text: 'Test utterance',
                temporal_marker: null,
                action_type: 'action'
              }]
            }],
            total_segments: 1,
            segmentation_summary: 'Test'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await node.execute(baseState, mockContext);

      const callArgs = mockContext.llmClient.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents[0].parts[0].text;

      // Verify prompt contains key elements
      expect(prompt).toContain('micro-phenomenological analyst');
      expect(prompt).toContain('fine-grained temporal segmentation');
      expect(prompt).toContain('minimal action units');
      expect(prompt).toContain('temporal markers');
      
      // Verify it includes the actual utterances
      expect(prompt).toContain('First, I open the application and then I click on the new document button');
      expect(prompt).toContain('Finally, I save the document');
    });
  });

  describe('Integration with BaseNode', () => {
    it('should support retry mechanism', async () => {
      const error = new Error('Temporary LLM failure');
      
      // First call fails
      mockContext.llmClient.generateContent.mockRejectedValueOnce(error);
      
      // Second call succeeds
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            segmented_utterances: [{
              original_line_num: '5',
              original_utterance: 'Test utterance',
              segments: [{
                segment_id: 'seg_5_1',
                text: 'Test utterance',
                temporal_marker: null,
                action_type: 'action'
              }]
            }],
            total_segments: 1,
            segmentation_summary: 'Test'
          })
        }
      };
      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      // Execute with retry should succeed
      const result = await node.executeWithRetry(baseState, mockContext);
      
      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
    });
  });
});