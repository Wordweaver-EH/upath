import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P3_1_AlignStructuresNode } from '../P3_1_AlignStructuresNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P3_1_AlignStructuresNode', () => {
  let node: P3_1_AlignStructuresNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P3_1_AlignStructuresNode();
  });

  describe('execute', () => {
    it('should validate all_specific_diachronic_structures exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_1_ALIGN_STRUCTURES,
        lastCompletedStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('all_specific_diachronic_structures not found in metadata');
    });

    it('should validate at least 2 structures for alignment', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_1_ALIGN_STRUCTURES,
        lastCompletedStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          all_specific_diachronic_structures: [
            {
              transcript_id: 'transcript-1',
              filename: 'session1.txt',
              independent_variable_details: 'Control condition',
              dependent_variable_focus: ['attention', 'perception'],
              specific_diachronic_structure: {
                summary: 'Standard progression',
                phases: [
                  { phase_name: 'Beginning', description: 'Initial phase', units_involved: ['rdu_1'] }
                ],
                visualization_hint: 'Linear',
                iv_preliminary_observation: 'Normal flow'
              }
            }
          ]
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('At least 2 structures are needed for alignment');
    });

    it('should successfully align multiple structures', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_1_ALIGN_STRUCTURES,
        lastCompletedStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          all_specific_diachronic_structures: [
            {
              transcript_id: 'transcript-1',
              filename: 'session1.txt',
              independent_variable_details: 'Control condition',
              dependent_variable_focus: ['attention', 'perception'],
              specific_diachronic_structure: {
                summary: 'Standard progression',
                phases: [
                  { phase_name: 'Beginning', description: 'Initial orientation', units_involved: ['rdu_1'] },
                  { phase_name: 'Core Event', description: 'Main activity', units_involved: ['rdu_2'] },
                  { phase_name: 'Ending', description: 'Closure', units_involved: ['rdu_3'] }
                ],
                visualization_hint: 'Linear',
                iv_preliminary_observation: 'Normal flow'
              }
            },
            {
              transcript_id: 'transcript-2',
              filename: 'session2.txt',
              independent_variable_details: 'Experimental condition',
              dependent_variable_focus: ['attention', 'perception'],
              specific_diachronic_structure: {
                summary: 'Modified progression',
                phases: [
                  { phase_name: 'Beginning', description: 'Initial orientation', units_involved: ['rdu_1'] },
                  { phase_name: 'Exploration', description: 'Extended exploration', units_involved: ['rdu_2a'] },
                  { phase_name: 'Core Event', description: 'Main activity', units_involved: ['rdu_3'] },
                  { phase_name: 'Ending', description: 'Closure', units_involved: ['rdu_4'] }
                ],
                visualization_hint: 'Linear',
                iv_preliminary_observation: 'Extended with exploration phase'
              }
            }
          ],
          global_dv_focus: ['attention', 'perception', 'memory']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            aligned_structures_report: 'Both structures share Beginning-Core Event-Ending sequence. Experimental condition includes additional Exploration phase.',
            common_patterns_summary: 'All transcripts follow a three-phase core pattern: orientation, main activity, closure.',
            key_differences: [
              'Experimental condition adds Exploration phase between Beginning and Core Event',
              'Control condition shows more direct progression',
              'Experimental condition has 4 phases vs 3 in control'
            ],
            dependent_variable_focus: ['attention', 'perception', 'memory']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P3_1_ALIGN_STRUCTURES);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P3_1_ALIGN_STRUCTURES);
      
      const output = result.stepOutputs![StepId.P3_1_ALIGN_STRUCTURES];
      expect(output).toBeDefined();
      expect(output.aligned_structures_report).toContain('Beginning-Core Event-Ending');
      expect(output.common_patterns_summary).toContain('three-phase core pattern');
      expect(output.key_differences).toHaveLength(3);
      expect(output.key_differences[0]).toContain('Exploration phase');
      expect(output.dependent_variable_focus).toEqual(['attention', 'perception', 'memory']);
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

    it('should handle empty phase arrays', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_1_ALIGN_STRUCTURES,
        lastCompletedStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          all_specific_diachronic_structures: [
            {
              transcript_id: 'transcript-1',
              filename: 'session1.txt',
              independent_variable_details: 'Control',
              dependent_variable_focus: ['attention'],
              specific_diachronic_structure: {
                summary: 'Empty structure',
                phases: [], // Empty phases
                visualization_hint: 'None',
                iv_preliminary_observation: 'No phases'
              }
            },
            {
              transcript_id: 'transcript-2',
              filename: 'session2.txt',
              independent_variable_details: 'Experimental',
              dependent_variable_focus: ['attention'],
              specific_diachronic_structure: {
                summary: 'Another empty',
                phases: [], // Empty phases
                visualization_hint: 'None',
                iv_preliminary_observation: 'No phases'
              }
            }
          ],
          global_dv_focus: ['attention']
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('No phases found in any structure for alignment');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('all_specific_diachronic_structures not found');
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
    currentStep: StepId.P3_1_ALIGN_STRUCTURES,
    lastCompletedStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
    stepOutputs: {},
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      all_specific_diachronic_structures: [
        {
          transcript_id: 'transcript-1',
          filename: 'session1.txt',
          independent_variable_details: 'Control',
          dependent_variable_focus: ['attention'],
          specific_diachronic_structure: {
            summary: 'Test structure',
            phases: [
              { phase_name: 'Beginning', description: 'Start', units_involved: ['rdu_1'] }
            ],
            visualization_hint: 'Linear',
            iv_preliminary_observation: 'Normal'
          }
        },
        {
          transcript_id: 'transcript-2',
          filename: 'session2.txt',
          independent_variable_details: 'Experimental',
          dependent_variable_focus: ['attention'],
          specific_diachronic_structure: {
            summary: 'Test structure 2',
            phases: [
              { phase_name: 'Beginning', description: 'Start', units_involved: ['rdu_1'] }
            ],
            visualization_hint: 'Linear',
            iv_preliminary_observation: 'Modified'
          }
        }
      ],
      global_dv_focus: ['attention']
    }
  };
}