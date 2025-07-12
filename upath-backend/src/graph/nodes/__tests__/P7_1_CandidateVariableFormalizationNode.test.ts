import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P7_1_CandidateVariableFormalizationNode } from '../P7_1_CandidateVariableFormalizationNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P7_1_CandidateVariableFormalizationNode', () => {
  let node: P7_1_CandidateVariableFormalizationNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P7_1_CandidateVariableFormalizationNode();
  });

  describe('execute', () => {
    it('should validate P5_2 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P5_2 output not found');
    });

    it('should validate P5_1 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {
          [StepId.P5_2_HOLISTIC_REFINEMENT]: {
            holistic_assessment: 'Test assessment',
            refinement_recommendations: [],
            final_confidence_rating: 'High' as const,
            study_limitations: [],
            future_research_directions: [],
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
        .rejects.toThrow('P5_1 output not found');
    });

    it('should successfully formalize candidate variables', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {
          [StepId.P5_2_HOLISTIC_REFINEMENT]: {
            holistic_assessment: 'Strong evidence for visual complexity effects on orientation behavior',
            refinement_recommendations: [],
            final_confidence_rating: 'High' as const,
            study_limitations: [],
            future_research_directions: [],
            dependent_variable_focus: ['attention', 'perception']
          },
          [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: {
            comparative_analysis_summary: 'Visual complexity significantly affects orientation patterns',
            identified_iv_patterns: [
              {
                iv_value: 'High visual complexity',
                pattern_description: 'Extended visual assessment phase',
                supporting_transcript_ids: ['transcript-1'],
                gds_alignment_notes: 'Extends assessment duration'
              }
            ],
            iv_effect_on_gds: 'Modulates assessment duration and detail',
            dv_outcome_patterns: [
              {
                dv_name: 'attention',
                pattern_across_iv_levels: 'Sustained attention in high complexity'
              },
              {
                dv_name: 'perception',
                pattern_across_iv_levels: 'Detailed perceptual processing in high complexity'
              }
            ],
            methodological_insights: ['IV manipulation effective'],
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
            candidate_variables: [
              {
                variable_id: 'visual_complexity',
                variable_name: 'Visual Complexity',
                definition: 'Degree of visual information density in the environment',
                measurement_approach: 'Categorical manipulation with high/low levels',
                data_source: 'P5_1_IV_patterns'
              },
              {
                variable_id: 'attention_duration',
                variable_name: 'Attention Duration',
                definition: 'Time spent in sustained visual attention during orientation',
                measurement_approach: 'Temporal measurement from transcript analysis',
                data_source: 'P5_1_DV_patterns'
              },
              {
                variable_id: 'perceptual_detail',
                variable_name: 'Perceptual Detail Level',
                definition: 'Depth of perceptual processing during environmental assessment',
                measurement_approach: 'Content analysis of verbalizations',
                data_source: 'P5_1_DV_patterns'
              }
            ],
            iv_formalization: {
              variable_id: 'visual_complexity',
              levels: ['High', 'Low'],
              operationalization: 'Environmental scenes with varied information density'
            },
            dv_formalizations: [
              {
                variable_id: 'attention_duration',
                measurement_indicators: ['Time in visual assessment phase', 'Sustained gaze duration'],
                operationalization: 'Quantitative temporal measures from coded transcripts'
              },
              {
                variable_id: 'perceptual_detail',
                measurement_indicators: ['Specificity of environmental descriptions', 'Detail in spatial references'],
                operationalization: 'Qualitative content analysis with detail scoring'
              }
            ],
            dependent_variable_focus: ['attention', 'perception']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION);
      
      const output = result.stepOutputs![StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION];
      expect(output).toBeDefined();
      expect(output.candidate_variables).toHaveLength(3);
      expect(output.iv_formalization.variable_id).toBe('visual_complexity');
      expect(output.dv_formalizations).toHaveLength(2);
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
            candidate_variables: [],
            // Missing iv_formalization and dv_formalizations!
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field');
    });

    it('should validate candidate variable structure', async () => {
      const state = createValidState();
      
      // Mock response with invalid candidate variable
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            candidate_variables: [
              {
                variable_id: 'test_var',
                // Missing other required fields!
              }
            ],
            iv_formalization: {
              variable_id: 'test_var',
              levels: ['A', 'B'],
              operationalization: 'Test'
            },
            dv_formalizations: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Candidate variable missing required fields');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P5_2 output not found');
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
    currentStep: StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
    lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
    stepOutputs: {
      [StepId.P5_2_HOLISTIC_REFINEMENT]: {
        holistic_assessment: 'Test assessment',
        refinement_recommendations: [],
        final_confidence_rating: 'High' as const,
        study_limitations: [],
        future_research_directions: [],
        dependent_variable_focus: ['attention']
      },
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