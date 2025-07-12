import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P4S_1_A_IdentifyAndGroupSSSNodesNode } from '../P4S_1_A_IdentifyAndGroupSSSNodesNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P4S_1_A_IdentifyAndGroupSSSNodesNode', () => {
  let node: P4S_1_A_IdentifyAndGroupSSSNodesNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P4S_1_A_IdentifyAndGroupSSSNodesNode();
  });

  describe('execute', () => {
    it('should validate current_gdu_id exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        lastCompletedStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
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

    it('should validate all_sss_data exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        lastCompletedStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          current_gdu_id: 'GDU_Orientation'
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('all_sss_data not found in metadata');
    });

    it('should handle case with no SSS nodes for GDU', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        lastCompletedStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          current_gdu_id: 'GDU_NonExistent',
          all_sss_data: [
            {
              transcript_id: 'transcript-1',
              phase_name: 'Beginning',
              gdu_ids: ['GDU_Other'],
              sss_nodes: [
                {
                  sss_node_id: 'sss_1',
                  sss_node_label: 'Test Node',
                  sss_node_definition: 'Test definition'
                }
              ]
            }
          ],
          global_dv_focus: ['attention']
        }
      };

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES);
      
      const output = result.stepOutputs![StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES];
      expect(output).toBeDefined();
      expect(output.analyzed_gdu).toBe('GDU_NonExistent');
      expect(output.grouped_data).toEqual([]);
      expect(output.dependent_variable_focus).toEqual(['attention']);
    });

    it('should successfully identify and group SSS nodes', async () => {
      const state: GraphState = {
        currentStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        lastCompletedStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          current_gdu_id: 'GDU_Orientation',
          all_sss_data: [
            {
              transcript_id: 'transcript-1',
              phase_name: 'Beginning',
              gdu_ids: ['GDU_Orientation'],
              sss_nodes: [
                {
                  sss_node_id: 'sss_visual_focus',
                  sss_node_label: 'Visual Focus',
                  sss_node_definition: 'Directing visual attention to environment'
                },
                {
                  sss_node_id: 'sss_spatial_orient',
                  sss_node_label: 'Spatial Orientation',
                  sss_node_definition: 'Understanding spatial layout'
                }
              ]
            },
            {
              transcript_id: 'transcript-2',
              phase_name: 'Beginning',
              gdu_ids: ['GDU_Orientation'],
              sss_nodes: [
                {
                  sss_node_id: 'sss_visual_scan',
                  sss_node_label: 'Visual Scanning',
                  sss_node_definition: 'Systematic visual exploration'
                },
                {
                  sss_node_id: 'sss_environ_map',
                  sss_node_label: 'Environment Mapping',
                  sss_node_definition: 'Creating mental map of environment'
                }
              ]
            }
          ],
          global_dv_focus: ['attention', 'perception']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            analyzed_gdu: 'GDU_Orientation',
            grouped_data: [
              {
                sss_node_id: 'sss_visual_focus',
                transcript_id: 'transcript-1',
                phase_name: 'Beginning',
                sss_node_label: 'Visual Focus',
                group_id: 'visual_attention_processes',
                group_rationale: 'Both nodes involve directing visual attention'
              },
              {
                sss_node_id: 'sss_visual_scan',
                transcript_id: 'transcript-2',
                phase_name: 'Beginning',
                sss_node_label: 'Visual Scanning',
                group_id: 'visual_attention_processes',
                group_rationale: 'Both nodes involve directing visual attention'
              },
              {
                sss_node_id: 'sss_spatial_orient',
                transcript_id: 'transcript-1',
                phase_name: 'Beginning',
                sss_node_label: 'Spatial Orientation',
                group_id: 'spatial_cognition',
                group_rationale: 'Nodes related to spatial understanding and mapping'
              },
              {
                sss_node_id: 'sss_environ_map',
                transcript_id: 'transcript-2',
                phase_name: 'Beginning',
                sss_node_label: 'Environment Mapping',
                group_id: 'spatial_cognition',
                group_rationale: 'Nodes related to spatial understanding and mapping'
              }
            ],
            dependent_variable_focus: ['attention', 'perception']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES);
      
      const output = result.stepOutputs![StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES];
      expect(output).toBeDefined();
      expect(output.analyzed_gdu).toBe('GDU_Orientation');
      expect(output.grouped_data).toHaveLength(4);
      expect(output.grouped_data[0].group_id).toBe('visual_attention_processes');
      expect(output.grouped_data[2].group_id).toBe('spatial_cognition');
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

    it('should validate all input SSS nodes are included in output', async () => {
      const state = createValidState();
      
      // Mock response missing some SSS nodes
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            analyzed_gdu: 'GDU_Test',
            grouped_data: [
              {
                sss_node_id: 'sss_1',
                transcript_id: 'transcript-1',
                phase_name: 'Beginning',
                sss_node_label: 'Test Node 1',
                group_id: 'test_group',
                group_rationale: 'Test'
              }
              // Missing sss_2!
            ],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Not all SSS nodes are included in grouped output');
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
    currentStep: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
    lastCompletedStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
    stepOutputs: {},
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      current_gdu_id: 'GDU_Test',
      all_sss_data: [
        {
          transcript_id: 'transcript-1',
          phase_name: 'Beginning',
          gdu_ids: ['GDU_Test'],
          sss_nodes: [
            {
              sss_node_id: 'sss_1',
              sss_node_label: 'Test Node 1',
              sss_node_definition: 'Test definition 1'
            },
            {
              sss_node_id: 'sss_2',
              sss_node_label: 'Test Node 2',
              sss_node_definition: 'Test definition 2'
            }
          ]
        }
      ],
      global_dv_focus: ['attention']
    }
  };
}