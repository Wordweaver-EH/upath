import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P3_2_IdentifyGDUsNode } from '../P3_2_IdentifyGDUsNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P3_2_IdentifyGDUsNode', () => {
  let node: P3_2_IdentifyGDUsNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P3_2_IdentifyGDUsNode();
  });

  describe('execute', () => {
    it('should validate P3_1 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_2_IDENTIFY_GDUS,
        lastCompletedStep: StepId.P3_1_ALIGN_STRUCTURES,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P3_1 output not found');
    });

    it('should validate all_refined_dus_with_iv_and_ids exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_2_IDENTIFY_GDUS,
        lastCompletedStep: StepId.P3_1_ALIGN_STRUCTURES,
        stepOutputs: {
          [StepId.P3_1_ALIGN_STRUCTURES]: {
            aligned_structures_report: 'Test report',
            common_patterns_summary: 'Test patterns',
            key_differences: ['Difference 1'],
            dependent_variable_focus: ['attention']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('all_refined_dus_with_iv_and_ids not found in metadata');
    });

    it('should validate at least 1 RDU for clustering', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_2_IDENTIFY_GDUS,
        lastCompletedStep: StepId.P3_1_ALIGN_STRUCTURES,
        stepOutputs: {
          [StepId.P3_1_ALIGN_STRUCTURES]: {
            aligned_structures_report: 'Test report',
            common_patterns_summary: 'Test patterns',
            key_differences: ['Difference 1'],
            dependent_variable_focus: ['attention']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          all_refined_dus_with_iv_and_ids: []
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('At least 1 RDU is needed for GDU identification');
    });

    it('should successfully identify GDUs', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_2_IDENTIFY_GDUS,
        lastCompletedStep: StepId.P3_1_ALIGN_STRUCTURES,
        stepOutputs: {
          [StepId.P3_1_ALIGN_STRUCTURES]: {
            aligned_structures_report: 'Both structures show similar orientation patterns followed by exploration phases.',
            common_patterns_summary: 'Common three-phase pattern: orientation, exploration, resolution.',
            key_differences: [
              'Control condition shows direct progression',
              'Experimental condition includes extended exploration'
            ],
            dependent_variable_focus: ['attention', 'perception']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          all_refined_dus_with_iv_and_ids: [
            {
              transcript_id: 'transcript-1',
              refined_du_id: 'rdu_1',
              name: 'Initial Orientation',
              description: 'Participant orients to the task environment',
              temporal_phase: 'Beginning',
              confidence: 0.9,
              iv_details: 'Control condition'
            },
            {
              transcript_id: 'transcript-1',
              refined_du_id: 'rdu_2',
              name: 'Task Execution',
              description: 'Participant executes the main task',
              temporal_phase: 'Core Event',
              confidence: 0.95,
              iv_details: 'Control condition'
            },
            {
              transcript_id: 'transcript-2',
              refined_du_id: 'rdu_1',
              name: 'Environmental Orientation',
              description: 'Participant familiarizes with the environment',
              temporal_phase: 'Beginning',
              confidence: 0.85,
              iv_details: 'Experimental condition'
            },
            {
              transcript_id: 'transcript-2',
              refined_du_id: 'rdu_2',
              name: 'Extended Exploration',
              description: 'Participant explores multiple aspects before execution',
              temporal_phase: 'Exploration',
              confidence: 0.8,
              iv_details: 'Experimental condition'
            }
          ],
          global_dv_focus: ['attention', 'perception']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            identified_gdus: [
              {
                gdu_id: 'GDU_Orientation',
                definition: 'Initial familiarization and orientation to task environment',
                supporting_transcripts_count: 2,
                iv_variation_notes: 'Control shows direct orientation, experimental shows extended environmental exploration',
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-1', refined_du_id: 'rdu_1' },
                  { transcript_id: 'transcript-2', refined_du_id: 'rdu_1' }
                ]
              },
              {
                gdu_id: 'GDU_TaskExecution',
                definition: 'Core task execution and exploration behaviors',
                supporting_transcripts_count: 2,
                iv_variation_notes: 'Control shows direct execution, experimental includes extended exploration phase',
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-1', refined_du_id: 'rdu_2' },
                  { transcript_id: 'transcript-2', refined_du_id: 'rdu_2' }
                ]
              }
            ],
            criteria_for_gdu_identification: 'Semantic clustering based on functional similarity and temporal positioning across conditions',
            dependent_variable_focus: ['attention', 'perception'],
            tot_rdus: 4
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P3_2_IDENTIFY_GDUS);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P3_2_IDENTIFY_GDUS);
      
      const output = result.stepOutputs![StepId.P3_2_IDENTIFY_GDUS];
      expect(output).toBeDefined();
      expect(output.identified_gdus).toHaveLength(2);
      expect(output.identified_gdus[0].gdu_id).toBe('GDU_Orientation');
      expect(output.identified_gdus[0].supporting_transcripts_count).toBe(2);
      expect(output.identified_gdus[0].contributing_refined_du_ids).toHaveLength(2);
      expect(output.tot_rdus).toBe(4);
      expect(output.dependent_variable_focus).toEqual(['attention', 'perception']);
    });

    it('should handle LLM JSON parsing errors', async () => {
      const state = createValidState();
      
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON response'
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow(LLMResponseError);
    });

    it('should validate RDU count consistency', async () => {
      const state = createValidState();
      
      // Mock response with inconsistent RDU count
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            identified_gdus: [
              {
                gdu_id: 'GDU_Test',
                definition: 'Test GDU',
                supporting_transcripts_count: 1,
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-1', refined_du_id: 'rdu_1' }
                ]
              }
            ],
            criteria_for_gdu_identification: 'Test criteria',
            dependent_variable_focus: ['attention'],
            tot_rdus: 5 // Wrong count - should be 2 based on state
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('RDU count mismatch');
    });

    it('should validate all RDUs are assigned', async () => {
      const state = createValidState();
      
      // Mock response missing some RDUs
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            identified_gdus: [
              {
                gdu_id: 'GDU_Partial',
                definition: 'Partial GDU',
                supporting_transcripts_count: 1,
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-1', refined_du_id: 'rdu_1' }
                  // Missing rdu_2!
                ]
              }
            ],
            criteria_for_gdu_identification: 'Test criteria',
            dependent_variable_focus: ['attention'],
            tot_rdus: 2
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Not all RDUs are assigned to GDUs');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P3_1 output not found');
      expect(node['isRecoverable'](error)).toBe(false);
    });

    it('should mark LLM errors as recoverable', () => {
      const error = new LLMResponseError('Failed to parse', 'response text');
      expect(node['isRecoverable'](error)).toBe(true);
    });
  });
});

// Helper function to create a valid state
function createValidState(): GraphState {
  return {
    currentStep: StepId.P3_2_IDENTIFY_GDUS,
    lastCompletedStep: StepId.P3_1_ALIGN_STRUCTURES,
    stepOutputs: {
      [StepId.P3_1_ALIGN_STRUCTURES]: {
        aligned_structures_report: 'Test report',
        common_patterns_summary: 'Test patterns',
        key_differences: ['Test difference'],
        dependent_variable_focus: ['attention']
      }
    },
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      all_refined_dus_with_iv_and_ids: [
        {
          transcript_id: 'transcript-1',
          refined_du_id: 'rdu_1',
          name: 'Test RDU 1',
          description: 'Test description 1',
          temporal_phase: 'Beginning',
          confidence: 0.9,
          iv_details: 'Control'
        },
        {
          transcript_id: 'transcript-1',
          refined_du_id: 'rdu_2',
          name: 'Test RDU 2',
          description: 'Test description 2',
          temporal_phase: 'Core Event',
          confidence: 0.85,
          iv_details: 'Control'
        }
      ],
      global_dv_focus: ['attention']
    }
  };
}