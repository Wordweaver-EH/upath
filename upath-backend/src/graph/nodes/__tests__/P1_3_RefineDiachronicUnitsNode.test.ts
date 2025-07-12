import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P1_3_RefineDiachronicUnitsNode } from '../P1_3_RefineDiachronicUnitsNode';
import { GraphState, StepId, ExecutionContext } from '../../types';
import { createInitialGraphState } from '../../types/state';
import { P0_1_Output, P0_3_Output, P1_1_Output, P1_2_Output, P1_3_Output, RefinedDiachronicUnit } from '../../types/outputs';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P1_3_RefineDiachronicUnitsNode', () => {
  let node: P1_3_RefineDiachronicUnitsNode;
  let mockState: GraphState;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    node = new P1_3_RefineDiachronicUnitsNode();
    
    // Create base state with required previous outputs
    mockState = createInitialGraphState('session-1', [{
      id: 'transcript-1',
      filename: 'test.txt',
      content: 'test content'
    }]);

    // Add P0_1 output (required for transcript data)
    mockState.stepOutputs[StepId.P0_1_TRANSCRIPTION_ADHERENCE] = {
      transcript_id: 'transcript-1',
      line_numbered_transcript: [
        '1: First line',
        '2: Second line',
        '3: Third line',
        '4: Fourth line',
        '5: Fifth line'
      ],
      transcription_convention_notes: 'Test notes',
      initial_impressions_log: 'Test impressions'
    } as P0_1_Output;

    // Add P0_3 output (procedural utterances)
    mockState.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] = {
      transcript_id: 'transcript-1',
      procedural_utterances: [
        {
          utterance_id: 'ut_001',
          line_number: 1,
          speaker: 'Participant',
          text: 'First line',
          information_tags: ['P-tag']
        },
        {
          utterance_id: 'ut_002',
          line_number: 2,
          speaker: 'Participant',
          text: 'Second line',
          information_tags: ['P-tag']
        },
        {
          utterance_id: 'ut_003',
          line_number: 3,
          speaker: 'Participant',
          text: 'Third line',
          information_tags: ['P-tag']
        },
        {
          utterance_id: 'ut_004',
          line_number: 4,
          speaker: 'Participant',
          text: 'Fourth line',
          information_tags: ['P-tag']
        },
        {
          utterance_id: 'ut_005',
          line_number: 5,
          speaker: 'Participant',
          text: 'Fifth line',
          information_tags: ['P-tag']
        }
      ]
    } as P0_3_Output;

    // Add P1_1 output (segments)
    mockState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] = {
      segments: [
        {
          segment_id: 'seg_001',
          start_line: 1,
          end_line: 2,
          description: 'Preparation phase',
          utterances: [
            { line_number: 1, speaker: 'Participant', text: 'First line' },
            { line_number: 2, speaker: 'Participant', text: 'Second line' }
          ]
        },
        {
          segment_id: 'seg_002',
          start_line: 3,
          end_line: 5,
          description: 'Execution phase',
          utterances: [
            { line_number: 3, speaker: 'Participant', text: 'Third line' },
            { line_number: 4, speaker: 'Participant', text: 'Fourth line' },
            { line_number: 5, speaker: 'Participant', text: 'Fifth line' }
          ]
        }
      ],
      segmentation_criteria: 'Natural activity boundaries',
      segment_count: 2
    } as P1_1_Output;

    // Add P1_2 output (diachronic units)
    mockState.stepOutputs[StepId.P1_2_DIACHRONIC_UNIT_ID] = {
      diachronic_units: [
        {
          unit_id: 'du_1',
          description: 'Initial preparation activities',
          source_segment_ids: ['seg_001']
        },
        {
          unit_id: 'du_2',
          description: 'Main execution activities',
          source_segment_ids: ['seg_002']
        }
      ],
      unit_metadata: {
        total_units: 2,
        grouping_criteria: 'Grouped by major activity phases'
      }
    } as P1_2_Output;

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
    it('should validate that P1_2 output exists', async () => {
      delete mockState.stepOutputs[StepId.P1_2_DIACHRONIC_UNIT_ID];

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('P1_2 output not found');
    });

    it('should validate that diachronic units exist', async () => {
      const p1_2Output = mockState.stepOutputs[StepId.P1_2_DIACHRONIC_UNIT_ID] as P1_2_Output;
      p1_2Output.diachronic_units = [];

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('No diachronic units to refine');
    });

    it('should validate that P1_1 output exists', async () => {
      delete mockState.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION];

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('P1_1 output not found');
    });

    it('should validate that P0_3 output exists', async () => {
      delete mockState.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES];

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('P0_3 output not found');
    });
  });

  describe('Successful execution', () => {
    it('should refine diachronic units with additional micro-gestures', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [
              {
                unit_id: 'du_1',
                original_description: 'Initial preparation activities',
                refined_description: 'Setting up workspace and gathering materials',
                micro_gestures: [],
                temporal_markers: [],
                source_segment_ids: ['seg_001'],
                temporal_phase: 'Beginning',
                confidence: 0.9
              },
              {
                unit_id: 'du_2',
                original_description: 'Main execution activities',
                refined_description: 'Actively working with materials to create final product',
                micro_gestures: [],
                temporal_markers: [],
                source_segment_ids: ['seg_002'],
                temporal_phase: 'Core Event',
                confidence: 0.85
              }
            ],
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'Fine-grained analysis of procedural micro-gestures',
              temporal_flow: 'preparation -> execution'
            }
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(mockState, mockContext);

      expect(result.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS]).toBeDefined();
      const output = result.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output;

      expect(output.refined_diachronic_units).toHaveLength(2);
      expect(output.refined_diachronic_units[0].unit_id).toBe('du_1');
      expect(output.refined_diachronic_units[0].micro_gestures).toHaveLength(0);
      expect(output.refined_diachronic_units[0].temporal_phase).toBe('Beginning');
      expect(output.refined_diachronic_units[0].confidence).toBe(0.9);
      
      expect(output.refined_diachronic_units[1].unit_id).toBe('du_2');
      expect(output.refined_diachronic_units[1].micro_gestures).toHaveLength(0);
      expect(output.refined_diachronic_units[1].temporal_phase).toBe('Core Event');
      expect(output.refined_diachronic_units[1].confidence).toBe(0.85);

      expect(output.refinement_metadata.total_micro_gestures).toBe(0);
      expect(output.refinement_metadata.temporal_flow).toBe('preparation -> execution');
    });

    it('should include transcript data in prompt', async () => {
      mockContext.llmClient.generateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [],
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'test',
              temporal_flow: 'none'
            }
          })
        }
      });

      await node.execute(mockState, mockContext);

      const call = mockContext.llmClient.generateContent.mock.calls[0][0];
      const prompt = call.contents[0].parts[0].text;

      expect(prompt).toContain('micro-phenomenological analyst');
      expect(prompt).toContain('refine the Diachronic Units');
      expect(prompt).toContain('temporal phase');
      expect(prompt).toContain('du_1');
      expect(prompt).toContain('Initial preparation activities');
    });

    it('should log successful refinement', async () => {
      mockContext.llmClient.generateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [
              {
                unit_id: 'du_1',
                original_description: 'Initial preparation activities',
                refined_description: 'Setting up workspace',
                micro_gestures: [],
                temporal_markers: ['initial'],
                source_segment_ids: ['seg_001']
              }
            ],
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'test',
              temporal_flow: 'linear'
            }
          })
        }
      });

      await node.execute(mockState, mockContext);

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'P1_3 successfully refined 1 diachronic units with 0 micro-gestures'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON response', async () => {
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON {{{{'
        }
      });

      await expect(node.execute(mockState, mockContext)).rejects.toThrow(LLMResponseError);
    });

    it('should handle missing required fields in response', async () => {
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            // Missing refined_diachronic_units
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'test'
            }
          })
        }
      });

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('Invalid response structure');
    });

    it('should handle LLM API errors', async () => {
      mockContext.llmClient.generateContent.mockRejectedValue(new Error('LLM API error'));

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('LLM API error');
    });
  });

  describe('Retry mechanism', () => {
    it('should retry on transient failures', async () => {
      // First call fails
      mockContext.llmClient.generateContent.mockRejectedValueOnce(new Error('Transient error'));
      
      // Second call succeeds
      mockContext.llmClient.generateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [
              {
                unit_id: 'du_1',
                original_description: 'Initial preparation activities',
                refined_description: 'Setting up',
                micro_gestures: [],
                temporal_markers: ['initial'],
                source_segment_ids: ['seg_001']
              }
            ],
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'test',
              temporal_flow: 'linear'
            }
          })
        }
      });

      const result = await node.execute(mockState, mockContext);

      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
      expect(result.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS]).toBeDefined();
    });

    it('should fail after max retries', async () => {
      mockContext.llmClient.generateContent.mockRejectedValue(new Error('Persistent error'));

      await expect(node.execute(mockState, mockContext)).rejects.toThrow('Persistent error');
      
      // Should try once + 3 retries = 4 times
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(4);
    });
  });

  describe('Node metadata', () => {
    it('should have correct id and name', () => {
      expect(node.id).toBe(StepId.P1_3_REFINE_DIACHRONIC_UNITS);
      expect(node.name).toBe('Refine Diachronic Units');
    });
  });

  describe('Edge cases', () => {
    it('should handle units with no micro-gestures', async () => {
      mockContext.llmClient.generateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [
              {
                unit_id: 'du_1',
                original_description: 'Initial preparation activities',
                refined_description: 'Setting up workspace',
                micro_gestures: [], // No micro-gestures
                temporal_markers: ['initial'],
                source_segment_ids: ['seg_001']
              }
            ],
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'High-level analysis only',
              temporal_flow: 'simple'
            }
          })
        }
      });

      const result = await node.execute(mockState, mockContext);
      const output = result.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output;

      expect(output.refined_diachronic_units[0].micro_gestures).toHaveLength(0);
      expect(output.refinement_metadata.total_micro_gestures).toBe(0);
    });

    it('should handle units with complex micro-gestures spanning multiple lines', async () => {
      mockContext.llmClient.generateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [
              {
                unit_id: 'du_1',
                original_description: 'Initial preparation activities',
                refined_description: 'Complex multi-step preparation',
                micro_gestures: [
                  {
                    gesture_id: 'mg_complex',
                    description: 'Continuous gesture spanning multiple utterances',
                    line_numbers: [1, 2, 3, 4, 5], // Spans all lines
                    utterance_ids: ['ut_001', 'ut_002', 'ut_003', 'ut_004', 'ut_005']
                  }
                ],
                temporal_markers: ['continuous', 'spanning'],
                source_segment_ids: ['seg_001', 'seg_002'] // Spans multiple segments
              }
            ],
            refinement_metadata: {
              total_micro_gestures: 1,
              refinement_approach: 'Holistic gesture analysis',
              temporal_flow: 'continuous'
            }
          })
        }
      });

      const result = await node.execute(mockState, mockContext);
      const output = result.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output;

      expect(output.refined_diachronic_units[0].micro_gestures[0].line_numbers).toHaveLength(5);
      expect(output.refined_diachronic_units[0].source_segment_ids).toHaveLength(2);
    });
  });
});