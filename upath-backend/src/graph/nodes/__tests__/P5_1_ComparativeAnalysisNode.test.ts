import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P5_1_ComparativeAnalysisNode } from '../P5_1_ComparativeAnalysisNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P5_1_ComparativeAnalysisNode', () => {
  let node: P5_1_ComparativeAnalysisNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P5_1_ComparativeAnalysisNode();
  });

  describe('execute', () => {
    it('should validate P3_3 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        lastCompletedStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P3_3 output not found');
    });

    it('should validate all_specific_diachronic_structures exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        lastCompletedStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        stepOutputs: {
          [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: {
            generic_diachronic_structure_definition: {
              name: 'Test Structure',
              description: 'Test description',
              core_gdus: ['GDU_1'],
              optional_gdus: ['GDU_2'],
              typical_sequence: ['GDU_1', 'GDU_2']
            },
            variants_summary: 'Test variants',
            confidence_level: 'High' as const,
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
        .rejects.toThrow('all_specific_diachronic_structures not found in metadata');
    });

    it('should successfully perform comparative analysis', async () => {
      const state: GraphState = {
        currentStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        lastCompletedStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        stepOutputs: {
          [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: {
            generic_diachronic_structure_definition: {
              name: 'Orientation Process',
              description: 'Generic structure for orientation behavior',
              core_gdus: ['GDU_Visual_Assessment', 'GDU_Spatial_Mapping'],
              optional_gdus: ['GDU_Environmental_Scan'],
              typical_sequence: ['GDU_Visual_Assessment', 'GDU_Spatial_Mapping', 'GDU_Environmental_Scan']
            },
            variants_summary: 'Some transcripts skip environmental scan',
            confidence_level: 'High' as const,
            dependent_variable_focus: ['attention', 'perception']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          all_specific_diachronic_structures: [
            {
              transcript_id: 'transcript-1',
              filename: 'file1.txt',
              independent_variable_details: 'High visual complexity',
              dependent_variable_focus: ['attention'],
              specific_diachronic_structure: {
                summary: 'Participant 1 orientation process',
                phases: [
                  {
                    phase_name: 'Initial Assessment',
                    description: 'Visual scanning of environment',
                    units_involved: ['RDU_visual_1', 'RDU_attention_1']
                  }
                ],
                visualization_hint: 'Linear progression',
                iv_preliminary_observation: 'High complexity leads to longer scanning'
              }
            },
            {
              transcript_id: 'transcript-2',
              filename: 'file2.txt',
              independent_variable_details: 'Low visual complexity',
              dependent_variable_focus: ['attention'],
              specific_diachronic_structure: {
                summary: 'Participant 2 orientation process',
                phases: [
                  {
                    phase_name: 'Quick Assessment',
                    description: 'Brief visual scanning',
                    units_involved: ['RDU_visual_2']
                  }
                ],
                visualization_hint: 'Rapid progression',
                iv_preliminary_observation: 'Low complexity enables quick scanning'
              }
            }
          ],
          global_dv_focus: ['attention', 'perception']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            comparative_analysis_summary: 'Independent variable (visual complexity) significantly affects orientation behavior',
            identified_iv_patterns: [
              {
                iv_value: 'High visual complexity',
                pattern_description: 'Extended visual assessment phase with detailed environmental scanning',
                supporting_transcript_ids: ['transcript-1'],
                gds_alignment_notes: 'Aligns with generic structure but extends assessment phase'
              },
              {
                iv_value: 'Low visual complexity',
                pattern_description: 'Rapid visual assessment with minimal scanning',
                supporting_transcript_ids: ['transcript-2'],
                gds_alignment_notes: 'Simplified version of generic structure'
              }
            ],
            iv_effect_on_gds: 'Visual complexity modulates the duration and detail of GDU_Visual_Assessment',
            dv_outcome_patterns: [
              {
                dv_name: 'attention',
                pattern_across_iv_levels: 'Higher complexity requires sustained attention, lower complexity allows brief attention'
              }
            ],
            methodological_insights: [
              'IV manipulation successfully reveals cognitive process variations',
              'Generic structure captures core pattern while allowing for IV-driven variations'
            ],
            dependent_variable_focus: ['attention', 'perception']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P5_1_IV_COMPARATIVE_ANALYSIS);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P5_1_IV_COMPARATIVE_ANALYSIS);
      
      const output = result.stepOutputs![StepId.P5_1_IV_COMPARATIVE_ANALYSIS];
      expect(output).toBeDefined();
      expect(output.comparative_analysis_summary).toContain('visual complexity');
      expect(output.identified_iv_patterns).toHaveLength(2);
      expect(output.dv_outcome_patterns).toHaveLength(1);
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

    it('should validate required fields in output', async () => {
      const state = createValidState();
      
      // Mock response missing required fields
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            comparative_analysis_summary: 'Test summary',
            // Missing other required fields!
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P3_3 output not found');
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
    currentStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
    lastCompletedStep: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
    stepOutputs: {
      [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: {
        generic_diachronic_structure_definition: {
          name: 'Test Structure',
          description: 'Test description',
          core_gdus: ['GDU_1'],
          optional_gdus: ['GDU_2'],
          typical_sequence: ['GDU_1', 'GDU_2']
        },
        variants_summary: 'Test variants',
        confidence_level: 'High' as const,
        dependent_variable_focus: ['attention']
      }
    },
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      all_specific_diachronic_structures: [
        {
          transcript_id: 'transcript-1',
          filename: 'file1.txt',
          independent_variable_details: 'IV value 1',
          dependent_variable_focus: ['attention'],
          specific_diachronic_structure: {
            summary: 'Structure 1',
            phases: [{
              phase_name: 'Phase 1',
              description: 'Description 1',
              units_involved: ['unit1']
            }],
            visualization_hint: 'Hint 1',
            iv_preliminary_observation: 'Obs 1'
          }
        }
      ],
      global_dv_focus: ['attention']
    }
  };
}