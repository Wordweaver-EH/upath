import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P1_2_DiachronicUnitIdNode } from '../P1_2_DiachronicUnitIdNode';
import { GraphState, ExecutionContext, StepId } from '../../types';
import { createInitialGraphState } from '../../types/state';
import { P1_1_Output } from '../../types/outputs';

describe('P1_2_DiachronicUnitIdNode', () => {
  let node: P1_2_DiachronicUnitIdNode;
  let mockContext: ExecutionContext;
  let baseState: GraphState;

  beforeEach(() => {
    node = new P1_2_DiachronicUnitIdNode();
    
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

    // Create base state with P1_1 output
    baseState = createInitialGraphState('test-session', [], {});
    baseState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] = {
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
          original_utterance: 'I choose the blank template',
          segments: [
            {
              segment_id: 'seg_20_1',
              text: 'I choose the blank template',
              temporal_marker: null,
              action_type: 'physical_action'
            }
          ]
        },
        {
          original_line_num: '25',
          original_utterance: 'Finally, I save the document and close the application',
          segments: [
            {
              segment_id: 'seg_25_1',
              text: 'Finally, I save the document',
              temporal_marker: 'Finally',
              action_type: 'physical_action'
            },
            {
              segment_id: 'seg_25_2',
              text: 'and close the application',
              temporal_marker: 'and',
              action_type: 'physical_action'
            }
          ]
        }
      ],
      total_segments: 6,
      segmentation_summary: 'Fine-grained segmentation based on temporal markers and action sequences'
    } as P1_1_Output;
  });

  describe('Validation', () => {
    it('should have correct id', () => {
      expect(node.id).toBe(StepId.P1_2_DIACHRONIC_UNIT_ID);
    });

    it('should throw error if P1_1 output is missing', async () => {
      delete baseState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION];

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('P1_1 output not found');
    });

    it('should throw error if segmented utterances are empty', async () => {
      (baseState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output)
        .segmented_utterances = [];

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('No segmented utterances to process');
    });
  });

  describe('Successful Execution', () => {
    it('should group segments into diachronic units correctly', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [
              {
                unit_id: 'du_1',
                description: 'Initial setup and document creation phase',
                source_segment_ids: ['seg_5_1', 'seg_5_2']
              },
              {
                unit_id: 'du_2',
                description: 'Template selection phase',
                source_segment_ids: ['seg_15_1', 'seg_20_1']
              },
              {
                unit_id: 'du_3',
                description: 'Completion and closure phase',
                source_segment_ids: ['seg_25_1', 'seg_25_2']
              }
            ],
            unit_metadata: {
              total_units: 3,
              grouping_criteria: 'Grouped by major activity phases: setup/creation and completion/closure'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);

      expect(result.stepOutputs).toBeDefined();
      expect(result.stepOutputs![StepId.P1_2_DIACHRONIC_UNIT_ID]).toBeDefined();
      
      const output = result.stepOutputs![StepId.P1_2_DIACHRONIC_UNIT_ID];
      expect(output.diachronic_units).toHaveLength(3);
      expect(output.unit_metadata.total_units).toBe(3);
      
      // Verify first unit
      expect(output.diachronic_units[0].unit_id).toBe('du_1');
      expect(output.diachronic_units[0].source_segment_ids).toEqual(['seg_5_1', 'seg_5_2']);
      
      // Verify second unit
      expect(output.diachronic_units[1].unit_id).toBe('du_2');
      expect(output.diachronic_units[1].source_segment_ids).toEqual(['seg_15_1', 'seg_20_1']);
      
      // Verify third unit
      expect(output.diachronic_units[2].unit_id).toBe('du_3');
      expect(output.diachronic_units[2].source_segment_ids).toEqual(['seg_25_1', 'seg_25_2']);
      
      // Verify LLM was called with correct parameters
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledWith({
        contents: [{
          role: 'user',
          parts: [{ text: expect.stringContaining('DIACHRONIC UNIT IDENTIFICATION') }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      });
    });

    it('should handle single segment to single unit mapping', async () => {
      // Update state to have only one segment
      (baseState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output).segmented_utterances = [
        {
          original_line_num: '5',
          original_utterance: 'I complete the workflow',
          segments: [
            {
              segment_id: 'seg_5_1',
              text: 'I complete the workflow',
              temporal_marker: null,
              action_type: 'physical_action'
            }
          ]
        }
      ];

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [
              {
                unit_id: 'du_1',
                description: 'Complete document workflow as single unit',
                source_segment_ids: ['seg_5_1']
              }
            ],
            unit_metadata: {
              total_units: 1,
              grouping_criteria: 'Single segment forms one coherent diachronic unit'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);
      const output = result.stepOutputs![StepId.P1_2_DIACHRONIC_UNIT_ID];
      
      expect(output.diachronic_units).toHaveLength(1);
      expect(output.unit_metadata.total_units).toBe(1);
    });

    it('should handle complex grouping of many segments', async () => {
      // Add more segments for complex grouping
      const segmented_utterances = [];
      for (let i = 1; i <= 3; i++) {
        segmented_utterances.push({
          original_line_num: `${i * 5}`,
          original_utterance: `Activity ${i} with multiple steps`,
          segments: [
            {
              segment_id: `seg_${i * 5}_1`,
              text: `First part of activity ${i}`,
              temporal_marker: 'First',
              action_type: 'physical_action'
            },
            {
              segment_id: `seg_${i * 5}_2`,
              text: `Second part of activity ${i}`,
              temporal_marker: 'then',
              action_type: 'physical_action'
            }
          ]
        });
      }
      (baseState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output).segmented_utterances = segmented_utterances;

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [
              {
                unit_id: 'du_1',
                description: 'Activity 1 complete phase',
                source_segment_ids: ['seg_5_1', 'seg_5_2']
              },
              {
                unit_id: 'du_2',
                description: 'Activity 2 complete phase',
                source_segment_ids: ['seg_10_1', 'seg_10_2']
              },
              {
                unit_id: 'du_3',
                description: 'Activity 3 complete phase',
                source_segment_ids: ['seg_15_1', 'seg_15_2']
              }
            ],
            unit_metadata: {
              total_units: 3,
              grouping_criteria: 'Temporal phases identified: exploration, main activity, wrap-up'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);
      const output = result.stepOutputs![StepId.P1_2_DIACHRONIC_UNIT_ID];
      
      expect(output.diachronic_units).toHaveLength(3);
      expect(output.diachronic_units[1].source_segment_ids).toHaveLength(2);
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

    it('should handle missing diachronic_units in response', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            unit_metadata: {
              total_units: 0,
              grouping_criteria: 'Some criteria'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('Invalid response: missing diachronic_units');
    });

    it('should handle empty diachronic_units array', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [],
            unit_metadata: {
              total_units: 0,
              grouping_criteria: 'No units identified'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('No diachronic units identified');
    });

    it('should be marked as recoverable for LLM errors', () => {
      const error = new Error('LLM service temporarily unavailable');
      expect(node.isRecoverable(error)).toBe(true);
    });

    it('should not be recoverable for validation errors', () => {
      const error = new Error('No segmented utterances to process');
      expect(node.isRecoverable(error)).toBe(false);
    });
  });

  describe('Prompt Building', () => {
    it('should build proper prompt with segments', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [{
              unit_id: 'du_1',
              description: 'Test unit',
              source_segment_ids: ['seg_5_1']
            }],
            unit_metadata: {
              total_units: 1,
              grouping_criteria: 'Test'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await node.execute(baseState, mockContext);

      const callArgs = mockContext.llmClient.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents[0].parts[0].text;

      // Verify prompt contains key elements
      expect(prompt).toContain('DIACHRONIC UNIT IDENTIFICATION');
      expect(prompt).toContain('diachronic units');
      expect(prompt).toContain('temporal units');
      expect(prompt).toContain('seg_5_1');
      expect(prompt).toContain('seg_5_2');
      expect(prompt).toContain('seg_15_1');
      expect(prompt).toContain('JSON');
    });

    it('should include segment descriptions in prompt', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [{
              unit_id: 'du_1',
              description: 'Test unit',
              source_segment_ids: ['seg_5_1']
            }],
            unit_metadata: {
              total_units: 1,
              grouping_criteria: 'Test'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await node.execute(baseState, mockContext);

      const callArgs = mockContext.llmClient.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents[0].parts[0].text;

      // Verify segment descriptions are included
      expect(prompt).toContain('First, I open the application');
      expect(prompt).toContain('and then I click on the new document button');
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
            diachronic_units: [{
              unit_id: 'du_1',
              description: 'Test unit',
              source_segment_ids: ['seg_5_1']
            }],
            unit_metadata: {
              total_units: 1,
              grouping_criteria: 'Test'
            }
          })
        }
      };
      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      // Execute with retry should succeed
      const result = await node.executeWithRetry(baseState, mockContext);
      
      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should update currentStep and lastCompletedStep', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            diachronic_units: [{
              unit_id: 'du_1',
              description: 'Test unit',
              source_segment_ids: ['seg_5_1']
            }],
            unit_metadata: {
              total_units: 1,
              grouping_criteria: 'Test'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);

      expect(result.currentStep).toBe(StepId.P1_2_DIACHRONIC_UNIT_ID);
      expect(result.lastCompletedStep).toBe(StepId.P1_2_DIACHRONIC_UNIT_ID);
    });
  });
});