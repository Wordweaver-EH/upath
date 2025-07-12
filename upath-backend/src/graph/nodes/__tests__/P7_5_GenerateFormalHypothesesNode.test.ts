import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P7_5_GenerateFormalHypothesesNode } from '../P7_5_GenerateFormalHypothesesNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P7_5_GenerateFormalHypothesesNode', () => {
  let node: P7_5_GenerateFormalHypothesesNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P7_5_GenerateFormalHypothesesNode();
  });

  describe('execute', () => {
    it('should validate P7_4 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P7_4 output not found');
    });

    it('should handle LLM failures gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
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

      mockLLMClient.generateContent.mockRejectedValue(new Error('Network error'));

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P7_5 LLM call failed: Network error');
    });

    it('should handle malformed LLM response', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
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

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => 'invalid json response' }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow(LLMResponseError);
    });

    it('should validate output structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
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

      // Missing required fields in response
      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify({ formal_hypotheses: [] }) }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field: causal_model_summary');
    });

    it('should validate formal hypotheses structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
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

      // Invalid hypothesis structure
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            formal_hypotheses: [
              { hypothesis_id: 'h1' } // Missing required fields
            ],
            causal_model_summary: 'Test summary',
            research_implications: [],
            methodological_recommendations: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Hypothesis missing required field: hypothesis_statement');
    });

    it('should successfully generate formal hypotheses', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [
              {
                path_id: 'complexity_to_attention',
                variables_sequence: ['visual_complexity', 'attention_duration'],
                path_type: 'direct' as const,
                effect_strength: 'Strong' as const,
                potential_biases: ['measurement_bias']
              }
            ],
            bias_analysis: [
              {
                bias_type: 'measurement_bias',
                affected_paths: ['complexity_to_attention'],
                mitigation_strategies: ['Use objective complexity measures', 'Multiple measurement approaches']
              }
            ],
            path_significance_ranking: ['complexity_to_attention'],
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

      const mockResponse = {
        formal_hypotheses: [
          {
            hypothesis_id: 'H1_complexity_attention',
            hypothesis_statement: 'Increased visual complexity directly causes increased attention duration',
            involved_variables: ['visual_complexity', 'attention_duration'],
            causal_claim: 'Visual complexity has a direct positive causal effect on attention duration',
            testable_predictions: [
              'Higher complexity scenes will produce longer attention durations',
              'Manipulation of complexity will show dose-response relationship'
            ],
            statistical_approach: 'Regression analysis with complexity as predictor'
          }
        ],
        causal_model_summary: 'The validated causal model demonstrates a direct relationship between visual complexity and attention duration, supported by strong empirical evidence.',
        research_implications: [
          'Complexity manipulation is an effective intervention for attention research',
          'Attention duration can be reliably predicted from scene characteristics'
        ],
        methodological_recommendations: [
          'Use objective complexity measurement to reduce bias',
          'Include multiple attention measures for robustness',
          'Control for environmental confounders'
        ],
        dependent_variable_focus: ['attention']
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.currentStep).toBe(StepId.P7_5_GENERATE_FORMAL_HYPOTHESES);
      expect(result.lastCompletedStep).toBe(StepId.P7_5_GENERATE_FORMAL_HYPOTHESES);
      expect(result.stepOutputs?.[StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]).toEqual(mockResponse);
      expect(result.metadata?.lastUpdateTime).toBeGreaterThanOrEqual(state.metadata!.lastUpdateTime!);
    });

    it('should handle empty paths gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
            dependent_variable_focus: []
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      const mockResponse = {
        formal_hypotheses: [],
        causal_model_summary: 'No significant causal relationships were identified in the analysis',
        research_implications: ['Further data collection may be needed'],
        methodological_recommendations: ['Reconsider variable selection and measurement'],
        dependent_variable_focus: []
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.stepOutputs?.[StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]).toEqual(mockResponse);
    });

    it('should validate hypothesis arrays structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
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

      // Invalid hypothesis with missing array fields
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            formal_hypotheses: [
              {
                hypothesis_id: 'h1',
                hypothesis_statement: 'Test statement',
                involved_variables: 'not_array', // Should be array
                causal_claim: 'Test claim',
                testable_predictions: [],
                statistical_approach: 'Test approach'
              }
            ],
            causal_model_summary: 'Test summary',
            research_implications: [],
            methodological_recommendations: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('involved_variables must be an array');
    });

    it('should validate required array fields', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
        lastCompletedStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        stepOutputs: {
          [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
            identified_causal_paths: [],
            bias_analysis: [],
            path_significance_ranking: [],
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

      // Invalid research implications field
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            formal_hypotheses: [],
            causal_model_summary: 'Test summary',
            research_implications: 'not_array', // Should be array
            methodological_recommendations: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('research_implications must be an array');
    });
  });

  describe('isRecoverable', () => {
    it('should mark LLM errors as recoverable', () => {
      const llmError = new LLMResponseError('LLM failed', 'bad response');
      expect(node.isRecoverable(llmError)).toBe(true);
    });

    it('should mark validation errors as non-recoverable', () => {
      const validationError = new Error('Missing required field');
      expect(node.isRecoverable(validationError)).toBe(false);
    });
  });
});