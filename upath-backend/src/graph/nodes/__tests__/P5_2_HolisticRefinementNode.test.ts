import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P5_2_HolisticRefinementNode } from '../P5_2_HolisticRefinementNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P5_2_HolisticRefinementNode', () => {
  let node: P5_2_HolisticRefinementNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P5_2_HolisticRefinementNode();
  });

  describe('execute', () => {
    it('should validate P5_1 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        lastCompletedStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P5_1 output not found');
    });

    it('should validate P3_3 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        lastCompletedStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        stepOutputs: {
          [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: {
            comparative_analysis_summary: 'Test summary',
            identified_iv_patterns: [],
            iv_effect_on_gds: 'Test effect',
            dv_outcome_patterns: [],
            methodological_insights: ['Test insight'],
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
        .rejects.toThrow('P3_3 output not found');
    });

    it('should successfully perform holistic refinement', async () => {
      const state: GraphState = {
        currentStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        lastCompletedStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        stepOutputs: {
          [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: {
            comparative_analysis_summary: 'Visual complexity significantly affects orientation behavior patterns',
            identified_iv_patterns: [
              {
                iv_value: 'High visual complexity',
                pattern_description: 'Extended assessment phase with detailed scanning',
                supporting_transcript_ids: ['transcript-1', 'transcript-3'],
                gds_alignment_notes: 'Extends core GDU duration'
              },
              {
                iv_value: 'Low visual complexity',
                pattern_description: 'Rapid assessment with minimal scanning',
                supporting_transcript_ids: ['transcript-2'],
                gds_alignment_notes: 'Shortened version of generic pattern'
              }
            ],
            iv_effect_on_gds: 'Complexity modulates GDU_Visual_Assessment duration and detail',
            dv_outcome_patterns: [
              {
                dv_name: 'attention',
                pattern_across_iv_levels: 'Higher complexity requires sustained attention'
              }
            ],
            methodological_insights: [
              'IV manipulation reveals cognitive flexibility',
              'Generic structure captures essential pattern'
            ],
            dependent_variable_focus: ['attention', 'perception']
          },
          [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: {
            generic_diachronic_structure_definition: {
              name: 'Orientation Process',
              description: 'Generic structure for spatial orientation behavior',
              core_gdus: ['GDU_Visual_Assessment', 'GDU_Spatial_Mapping'],
              optional_gdus: ['GDU_Environmental_Scan'],
              typical_sequence: ['GDU_Visual_Assessment', 'GDU_Spatial_Mapping', 'GDU_Environmental_Scan']
            },
            variants_summary: 'Some participants skip environmental scan under low complexity',
            confidence_level: 'High' as const,
            dependent_variable_focus: ['attention', 'perception']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          global_dv_focus: ['attention', 'perception']
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            holistic_assessment: 'The analysis successfully identified robust patterns in spatial orientation behavior, with clear IV effects on cognitive processes. The generic diachronic structure effectively captures core patterns while accommodating IV-driven variations.',
            refinement_recommendations: [
              {
                area: 'Generic Diachronic Structure',
                recommendation: 'Consider formalizing duration parameters for GDU_Visual_Assessment to capture complexity effects',
                rationale: 'IV analysis revealed systematic duration variations that could enhance the generic model',
                priority: 'Medium' as const
              },
              {
                area: 'Dependent Variable Measurement',
                recommendation: 'Add sustained attention metrics for high complexity conditions',
                rationale: 'Pattern analysis shows attention sustaining is key discriminator',
                priority: 'High' as const
              },
              {
                area: 'Independent Variable Design',
                recommendation: 'Expand complexity manipulation to include intermediate levels',
                rationale: 'Current binary manipulation may miss nuanced complexity effects',
                priority: 'Low' as const
              }
            ],
            final_confidence_rating: 'High' as const,
            study_limitations: [
              'Limited sample size may not capture full range of individual differences',
              'Binary IV manipulation may oversimplify complexity effects',
              'Single experimental context limits generalizability'
            ],
            future_research_directions: [
              'Investigate individual differences in orientation strategies',
              'Examine orientation behavior in different environmental contexts',
              'Develop computational models of the identified processes'
            ],
            dependent_variable_focus: ['attention', 'perception']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P5_2_HOLISTIC_REFINEMENT);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P5_2_HOLISTIC_REFINEMENT);
      
      const output = result.stepOutputs![StepId.P5_2_HOLISTIC_REFINEMENT];
      expect(output).toBeDefined();
      expect(output.holistic_assessment).toContain('spatial orientation behavior');
      expect(output.refinement_recommendations).toHaveLength(3);
      expect(output.final_confidence_rating).toBe('High');
      expect(output.study_limitations).toHaveLength(3);
      expect(output.future_research_directions).toHaveLength(3);
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
            holistic_assessment: 'Test assessment',
            // Missing other required fields!
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field');
    });

    it('should validate refinement recommendation structure', async () => {
      const state = createValidState();
      
      // Mock response with invalid refinement recommendation
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            holistic_assessment: 'Test assessment',
            refinement_recommendations: [
              {
                area: 'Test area',
                // Missing recommendation field!
                rationale: 'Test rationale',
                priority: 'High'
              }
            ],
            final_confidence_rating: 'High',
            study_limitations: ['limitation'],
            future_research_directions: ['direction'],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Refinement recommendation missing required fields');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P5_1 output not found');
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
    currentStep: StepId.P5_2_HOLISTIC_REFINEMENT,
    lastCompletedStep: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
    stepOutputs: {
      [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: {
        comparative_analysis_summary: 'Test summary',
        identified_iv_patterns: [
          {
            iv_value: 'Test IV',
            pattern_description: 'Test pattern',
            supporting_transcript_ids: ['transcript-1'],
            gds_alignment_notes: 'Test alignment'
          }
        ],
        iv_effect_on_gds: 'Test effect',
        dv_outcome_patterns: [
          {
            dv_name: 'attention',
            pattern_across_iv_levels: 'Test pattern'
          }
        ],
        methodological_insights: ['Test insight'],
        dependent_variable_focus: ['attention']
      },
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
      global_dv_focus: ['attention']
    }
  };
}