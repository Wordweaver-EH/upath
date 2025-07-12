import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P4S_1_B_DefineGSSFromGroupsNode } from '../P4S_1_B_DefineGSSFromGroupsNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P4S_1_B_DefineGSSFromGroupsNode', () => {
  let node: P4S_1_B_DefineGSSFromGroupsNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P4S_1_B_DefineGSSFromGroupsNode();
  });

  describe('execute', () => {
    it('should validate current_gdu_id exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        lastCompletedStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('current_gdu_id not found in metadata');
    });

    it('should validate P4S_1_A output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        lastCompletedStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          current_gdu_id: 'GDU_Test'
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P4S_1_A output not found');
    });

    it('should handle case with no grouped data', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        lastCompletedStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        stepOutputs: {
          [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: {
            analyzed_gdu: 'GDU_Test',
            grouped_data: [],
            dependent_variable_focus: ['attention']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          current_gdu_id: 'GDU_Test',
          global_dv_focus: ['attention']
        }
      };

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS);
      
      const output = result.stepOutputs![StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS];
      expect(output).toBeDefined();
      expect(output.analyzed_gdu).toBe('GDU_Test');
      expect(output.generic_synchronic_structure.generic_nodes_categories).toEqual([]);
      expect(output.dependent_variable_focus).toEqual(['attention']);
    });

    it('should successfully define GSS from grouped SSS nodes', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        lastCompletedStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        stepOutputs: {
          [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: {
            analyzed_gdu: 'GDU_Orientation',
            grouped_data: [
              {
                sss_node_id: 'sss_visual_focus',
                transcript_id: 'transcript-1',
                phase_name: 'Beginning',
                sss_node_label: 'Visual Focus',
                group_id: 'visual_attention_processes',
                group_rationale: 'Visual attention mechanisms'
              },
              {
                sss_node_id: 'sss_visual_scan',
                transcript_id: 'transcript-2',
                phase_name: 'Beginning',
                sss_node_label: 'Visual Scanning',
                group_id: 'visual_attention_processes',
                group_rationale: 'Visual attention mechanisms'
              },
              {
                sss_node_id: 'sss_spatial_orient',
                transcript_id: 'transcript-1',
                phase_name: 'Beginning',
                sss_node_label: 'Spatial Orientation',
                group_id: 'spatial_cognition',
                group_rationale: 'Spatial understanding processes'
              }
            ],
            dependent_variable_focus: ['attention', 'perception']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          current_gdu_id: 'GDU_Orientation',
          global_dv_focus: ['attention', 'perception']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            analyzed_gdu: 'GDU_Orientation',
            generic_synchronic_structure: {
              generic_nodes_categories: [
                {
                  category_id: 'visual_attention_category',
                  definition: 'Generic category for visual attention processes',
                  abstraction_level: 'High'
                },
                {
                  category_id: 'spatial_cognition_category',
                  definition: 'Generic category for spatial understanding',
                  abstraction_level: 'High'
                }
              ],
              generic_network_links: [
                {
                  from_category: 'visual_attention_category',
                  to_category: 'spatial_cognition_category',
                  relationship_type: 'feeds_into',
                  description: 'Visual attention informs spatial cognition'
                }
              ],
              instantiation_notes: {
                'visual_attention_category': ['sss_visual_focus', 'sss_visual_scan'],
                'spatial_cognition_category': ['sss_spatial_orient']
              }
            },
            dependent_variable_focus: ['attention', 'perception']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS);
      
      const output = result.stepOutputs![StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS];
      expect(output).toBeDefined();
      expect(output.analyzed_gdu).toBe('GDU_Orientation');
      expect(output.generic_synchronic_structure.generic_nodes_categories).toHaveLength(2);
      expect(output.generic_synchronic_structure.generic_network_links).toHaveLength(1);
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

    it('should validate all group IDs have corresponding categories', async () => {
      const state = createValidState();
      
      // Mock response missing some categories
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            analyzed_gdu: 'GDU_Test',
            generic_synchronic_structure: {
              generic_nodes_categories: [
                {
                  category_id: 'category_1',
                  definition: 'Test category',
                  abstraction_level: 'High'
                }
                // Missing category_2!
              ],
              generic_network_links: [],
              instantiation_notes: {
                'category_1': ['sss_1'],
                'category_2': ['sss_2'] // This category doesn't exist!
              }
            },
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Instantiation note references non-existent category');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('current_gdu_id not found');
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
    currentStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
    lastCompletedStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
    stepOutputs: {
      [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: {
        analyzed_gdu: 'GDU_Test',
        grouped_data: [
          {
            sss_node_id: 'sss_1',
            transcript_id: 'transcript-1',
            phase_name: 'Beginning',
            sss_node_label: 'Test Node 1',
            group_id: 'test_group_1',
            group_rationale: 'Test rationale 1'
          },
          {
            sss_node_id: 'sss_2',
            transcript_id: 'transcript-2',
            phase_name: 'Beginning',
            sss_node_label: 'Test Node 2',
            group_id: 'test_group_2',
            group_rationale: 'Test rationale 2'
          }
        ],
        dependent_variable_focus: ['attention']
      }
    },
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      current_gdu_id: 'GDU_Test',
      global_dv_focus: ['attention']
    }
  };
}