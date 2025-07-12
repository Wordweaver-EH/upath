import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P3_3_DefineGenericDiachronicStructureNode } from '../P3_3_DefineGenericDiachronicStructureNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P3_3_DefineGenericDiachronicStructureNode', () => {
  let node: P3_3_DefineGenericDiachronicStructureNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P3_3_DefineGenericDiachronicStructureNode();
  });

  describe('execute', () => {
    it('should validate P3_1 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        lastCompletedStep: StepId.P3_2_IDENTIFY_GDUS,
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

    it('should validate P3_2 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        lastCompletedStep: StepId.P3_2_IDENTIFY_GDUS,
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
        .rejects.toThrow('P3_2 output not found');
    });

    it('should successfully define generic diachronic structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        lastCompletedStep: StepId.P3_2_IDENTIFY_GDUS,
        stepOutputs: {
          [StepId.P3_1_ALIGN_STRUCTURES]: {
            aligned_structures_report: 'Both structures show consistent orientation-exploration-execution pattern.',
            common_patterns_summary: 'Universal three-phase progression with variations in exploration depth.',
            key_differences: [
              'Control condition shows direct progression',
              'Experimental condition includes extended exploration phases',
              'Resolution timing varies by condition'
            ],
            dependent_variable_focus: ['attention', 'perception']
          },
          [StepId.P3_2_IDENTIFY_GDUS]: {
            identified_gdus: [
              {
                gdu_id: 'GDU_Orientation',
                definition: 'Initial familiarization and environmental orientation phase',
                supporting_transcripts_count: 2,
                iv_variation_notes: 'Control shows brief orientation, experimental shows extended environmental exploration',
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-1', refined_du_id: 'rdu_1' },
                  { transcript_id: 'transcript-2', refined_du_id: 'rdu_1' }
                ]
              },
              {
                gdu_id: 'GDU_CoreExecution',
                definition: 'Primary task execution and goal-directed activity',
                supporting_transcripts_count: 2,
                iv_variation_notes: 'Consistent across conditions but timing varies',
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-1', refined_du_id: 'rdu_2' },
                  { transcript_id: 'transcript-2', refined_du_id: 'rdu_3' }
                ]
              },
              {
                gdu_id: 'GDU_ExtendedExploration',
                definition: 'Optional extended exploration before core execution',
                supporting_transcripts_count: 1,
                iv_variation_notes: 'Appears only in experimental condition',
                contributing_refined_du_ids: [
                  { transcript_id: 'transcript-2', refined_du_id: 'rdu_2' }
                ]
              }
            ],
            criteria_for_gdu_identification: 'Functional similarity and temporal positioning across conditions',
            dependent_variable_focus: ['attention', 'perception'],
            tot_rdus: 5
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          global_dv_focus: ['attention', 'perception', 'memory']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            generic_diachronic_structure_definition: {
              name: 'Task-Oriented Experiential Journey',
              description: 'A universal experiential structure characterized by orientation, optional exploration, and goal-directed execution phases',
              core_gdus: ['GDU_Orientation', 'GDU_CoreExecution'],
              optional_gdus: ['GDU_ExtendedExploration'],
              typical_sequence: ['GDU_Orientation', 'GDU_ExtendedExploration', 'GDU_CoreExecution']
            },
            variants_summary: 'Control condition follows direct Orientation→CoreExecution path. Experimental condition includes ExtendedExploration phase between orientation and execution, suggesting environmental complexity increases exploration behaviors.',
            confidence_level: 'High',
            dependent_variable_focus: ['attention', 'perception', 'memory']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE);
      
      const output = result.stepOutputs![StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE];
      expect(output).toBeDefined();
      expect(output.generic_diachronic_structure_definition).toBeDefined();
      expect(output.generic_diachronic_structure_definition.name).toBe('Task-Oriented Experiential Journey');
      expect(output.generic_diachronic_structure_definition.core_gdus).toEqual(['GDU_Orientation', 'GDU_CoreExecution']);
      expect(output.generic_diachronic_structure_definition.optional_gdus).toEqual(['GDU_ExtendedExploration']);
      expect(output.confidence_level).toBe('High');
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

    it('should validate GDU references exist', async () => {
      const state = createValidState();
      
      // Mock response with invalid GDU references
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            generic_diachronic_structure_definition: {
              name: 'Test Structure',
              description: 'Test description',
              core_gdus: ['GDU_NonExistent'], // This GDU doesn't exist in P3_2 output
              optional_gdus: [],
              typical_sequence: ['GDU_NonExistent']
            },
            variants_summary: 'Test summary',
            confidence_level: 'High',
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Core GDU GDU_NonExistent not found in identified GDUs');
    });

    it('should validate confidence level', async () => {
      const state = createValidState();
      
      // Mock response with invalid confidence level
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            generic_diachronic_structure_definition: {
              name: 'Test Structure',
              description: 'Test description',
              core_gdus: ['GDU_Test'],
              optional_gdus: [],
              typical_sequence: ['GDU_Test']
            },
            variants_summary: 'Test summary',
            confidence_level: 'Invalid', // Invalid confidence level
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Invalid confidence level');
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
    currentStep: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
    lastCompletedStep: StepId.P3_2_IDENTIFY_GDUS,
    stepOutputs: {
      [StepId.P3_1_ALIGN_STRUCTURES]: {
        aligned_structures_report: 'Test report',
        common_patterns_summary: 'Test patterns',
        key_differences: ['Test difference'],
        dependent_variable_focus: ['attention']
      },
      [StepId.P3_2_IDENTIFY_GDUS]: {
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
        tot_rdus: 1
      }
    },
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      global_dv_focus: ['attention']
    }
  };
}