import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2S_1_GroupUtterancesByTopicNode } from '../P2S_1_GroupUtterancesByTopicNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P2S_1_GroupUtterancesByTopicNode', () => {
  let node: P2S_1_GroupUtterancesByTopicNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P2S_1_GroupUtterancesByTopicNode();
  });

  describe('execute', () => {
    it('should validate required inputs', async () => {
      // Missing currentPhaseName
      const state: GraphState = {
        currentStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        lastCompletedStep: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient }))
        .rejects.toThrow('Missing currentPhaseName in metadata for P2S.1');
    });

    it('should validate P0_3 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        lastCompletedStep: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          currentPhaseName: 'Beginning'
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient }))
        .rejects.toThrow('P0_3 output not found');
    });

    it('should validate P1_4 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        lastCompletedStep: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {
          [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: {
            transcript_id: 'test-transcript',
            selected_utterances: [],
            independent_variable_details: 'test IV',
            dependent_variable_focus: ['DV1']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          currentPhaseName: 'Beginning'
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient }))
        .rejects.toThrow('P1_4 output not found');
    });

    it('should validate phase exists in P1_4 output', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        lastCompletedStep: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {
          [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: {
            transcript_id: 'test-transcript',
            selected_utterances: [],
            independent_variable_details: 'test IV',
            dependent_variable_focus: ['DV1']
          },
          [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: {
            transcript_id: 'test-transcript',
            specific_diachronic_structure: {
              summary: 'test summary',
              phases: [
                {
                  phase_name: 'Core Event',
                  description: 'Core phase',
                  units_involved: ['rdu_1']
                }
              ],
              visualization_hint: 'Linear',
              iv_preliminary_observation: 'None'
            },
            independent_variable_details: 'test IV',
            dependent_variable_focus: ['DV1'],
            mermaid_syntax_specific_diachronic: 'gantt'
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          currentPhaseName: 'Beginning' // Phase doesn't exist
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient }))
        .rejects.toThrow('Phase Beginning not found in P1.4 output');
    });

    it('should successfully group utterances by topic for a phase', async () => {
      // Create full chain of data from P0_3 through P1_4
      const state: GraphState = {
        currentStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        lastCompletedStep: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        stepOutputs: {
          [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: {
            transcript_id: 'test-transcript',
            selected_utterances: [
              {
                original_line_num: '5',
                utterance_text: 'I focused on the texture',
                speaker: 'Participant',
                selection_justification: 'Procedural description'
              },
              {
                original_line_num: '7',
                utterance_text: 'The color seemed vivid',
                speaker: 'Participant', 
                selection_justification: 'Experiential content'
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          },
          [StepId.P1_1_INITIAL_SEGMENTATION]: {
            transcript_id: 'test-transcript',
            segmented_utterances: [
              {
                original_utterance: {
                  original_line_num: '5',
                  utterance_text: 'I focused on the texture',
                  speaker: 'Participant',
                  selection_justification: 'Procedural description'
                },
                segments: [
                  {
                    segment_id: 'seg_1',
                    text: 'I focused on the texture',
                    focus: 'texture perception'
                  }
                ]
              },
              {
                original_utterance: {
                  original_line_num: '7',
                  utterance_text: 'The color seemed vivid',
                  speaker: 'Participant',
                  selection_justification: 'Experiential content'
                },
                segments: [
                  {
                    segment_id: 'seg_2',
                    text: 'The color seemed vivid',
                    focus: 'color perception'
                  }
                ]
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          },
          [StepId.P1_2_DIACHRONIC_UNIT_ID]: {
            transcript_id: 'test-transcript',
            diachronic_units: [
              {
                unit_id: 'du_1',
                description: 'Visual analysis phase',
                source_segment_ids: ['seg_1', 'seg_2']
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          },
          [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: {
            transcript_id: 'test-transcript',
            refined_diachronic_units: [
              {
                unit_id: 'rdu_1',
                name: 'Initial visual exploration',
                description: 'Participant explores visual qualities',
                temporal_phase: 'Beginning',
                confidence: 0.9,
                source_p1_2_du_ids: ['du_1']
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          },
          [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: {
            transcript_id: 'test-transcript',
            specific_diachronic_structure: {
              summary: 'Visual exploration process',
              phases: [
                {
                  phase_name: 'Beginning',
                  description: 'Initial visual analysis',
                  units_involved: ['rdu_1']
                }
              ],
              visualization_hint: 'Linear',
              iv_preliminary_observation: 'Visual focus affects attention patterns'
            },
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention'],
            mermaid_syntax_specific_diachronic: 'gantt\n    title SDS\n    Beginning :bgn, 0, 2d'
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          currentPhaseName: 'Beginning'
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            synchronic_thematic_groups: [
              {
                group_label: 'Visual texture analysis',
                justification: 'These utterances focus on texture perception aspects',
                utterances: [
                  {
                    original_line_num: '5',
                    utterance_text: 'I focused on the texture'
                  }
                ]
              },
              {
                group_label: 'Color perception',
                justification: 'These utterances describe color-related experiences',
                utterances: [
                  {
                    original_line_num: '7',
                    utterance_text: 'The color seemed vivid'
                  }
                ]
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      const result = await node.execute(state, { 
        llmClient: mockLLMClient,
        settings: {}
      });

      expect(result).toHaveProperty('currentStep', StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC);
      
      const output = result.stepOutputs![StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC];
      expect(output).toBeDefined();
      expect(output.transcript_id).toBe('test-transcript');
      expect(output.analyzed_diachronic_unit).toBe('Beginning');
      expect(output.synchronic_thematic_groups).toHaveLength(2);
      expect(output.synchronic_thematic_groups[0].group_label).toBe('Visual texture analysis');
      expect(output.synchronic_thematic_groups[1].group_label).toBe('Color perception');
    });

    it('should handle LLM JSON parsing errors', async () => {
      const state = createValidState();
      
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON response'
        }
      });

      await expect(node.execute(state, { 
        llmClient: mockLLMClient,
        settings: {}
      }))
        .rejects.toThrow(LLMResponseError);
    });

    it('should handle empty phase mapping', async () => {
      const state = createValidState();
      // Modify state to have no segments that map to the phase
      state.stepOutputs![StepId.P1_3_REFINE_DIACHRONIC_UNITS] = {
        transcript_id: 'test-transcript',
        refined_diachronic_units: [
          {
            unit_id: 'rdu_1',
            name: 'Initial visual exploration',
            description: 'Participant explores visual qualities',
            temporal_phase: 'Beginning',
            confidence: 0.9,
            source_p1_2_du_ids: ['du_999'] // Non-existent DU
          }
        ],
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention']
      };

      await expect(node.execute(state, { llmClient: mockLLMClient }))
        .rejects.toThrow('No utterances could be mapped to phase \'Beginning\'');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P0_3 output not found');
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
    currentStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
    lastCompletedStep: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
    stepOutputs: {
      [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: {
        transcript_id: 'test-transcript',
        selected_utterances: [
          {
            original_line_num: '5',
            utterance_text: 'I focused on the texture',
            speaker: 'Participant',
            selection_justification: 'Procedural description'
          }
        ],
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention']
      },
      [StepId.P1_1_INITIAL_SEGMENTATION]: {
        transcript_id: 'test-transcript',
        segmented_utterances: [
          {
            original_utterance: {
              original_line_num: '5',
              utterance_text: 'I focused on the texture',
              speaker: 'Participant',
              selection_justification: 'Procedural description'
            },
            segments: [
              {
                segment_id: 'seg_1',
                text: 'I focused on the texture',
                focus: 'texture perception'
              }
            ]
          }
        ],
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention']
      },
      [StepId.P1_2_DIACHRONIC_UNIT_ID]: {
        transcript_id: 'test-transcript',
        diachronic_units: [
          {
            unit_id: 'du_1',
            description: 'Visual analysis phase',
            source_segment_ids: ['seg_1']
          }
        ],
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention']
      },
      [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: {
        transcript_id: 'test-transcript',
        refined_diachronic_units: [
          {
            unit_id: 'rdu_1',
            name: 'Initial visual exploration',
            description: 'Participant explores visual qualities',
            temporal_phase: 'Beginning',
            confidence: 0.9,
            source_p1_2_du_ids: ['du_1']
          }
        ],
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention']
      },
      [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: {
        transcript_id: 'test-transcript',
        specific_diachronic_structure: {
          summary: 'Visual exploration process',
          phases: [
            {
              phase_name: 'Beginning',
              description: 'Initial visual analysis',
              units_involved: ['rdu_1']
            }
          ],
          visualization_hint: 'Linear',
          iv_preliminary_observation: 'Visual focus affects attention patterns'
        },
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention'],
        mermaid_syntax_specific_diachronic: 'gantt'
      }
    },
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      currentPhaseName: 'Beginning'
    }
  };
}