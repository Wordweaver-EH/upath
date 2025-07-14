import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P7_4_AnalyzePathsAndBiasesNode } from '../P7_4_AnalyzePathsAndBiasesNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P7_4_AnalyzePathsAndBiasesNode', () => {
  let node: P7_4_AnalyzePathsAndBiasesNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P7_4_AnalyzePathsAndBiasesNode();
  });

  describe('execute', () => {
    it('should validate P7_3B output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P7_3B output not found');
    });

    it('should handle LLM failures gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [
                {
                  variable_id: 'var1',
                  variable_name: 'Variable 1',
                  definition: 'Test variable',
                  measurement_approach: 'Test measurement',
                  data_source: 'Test source'
                }
              ],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.8,
              coherence: 0.9
            },
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
        .rejects.toThrow('P7_4_ANALYZE_PATHS_AND_BIASES LLM call failed: Network error');
    });

    it('should handle malformed LLM response', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.8,
              coherence: 0.9
            },
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
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.8,
              coherence: 0.9
            },
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
        response: { text: () => JSON.stringify({ identified_causal_paths: [] }) }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field: bias_analysis');
    });

    it('should validate causal paths structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.8,
              coherence: 0.9
            },
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

      // Invalid causal path structure
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            identified_causal_paths: [
              { path_id: 'path1' } // Missing required fields
            ],
            bias_analysis: [],
            path_significance_ranking: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Causal path missing required field: variables_sequence');
    });

    it('should validate bias analysis structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.8,
              coherence: 0.9
            },
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

      // Invalid bias analysis structure
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            identified_causal_paths: [],
            bias_analysis: [
              { bias_type: 'selection_bias' } // Missing required fields
            ],
            path_significance_ranking: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Bias analysis missing required field: affected_paths');
    });

    it('should successfully analyze paths and biases', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [
                {
                  variable_id: 'visual_complexity',
                  variable_name: 'Visual Complexity',
                  definition: 'Degree of visual elements in environment',
                  measurement_approach: 'Scene complexity rating scale',
                  data_source: 'P5_1 comparative analysis'
                },
                {
                  variable_id: 'attention_duration',
                  variable_name: 'Attention Duration',
                  definition: 'Time spent attending to visual elements',
                  measurement_approach: 'Temporal analysis of fixation patterns',
                  data_source: 'P5_2 holistic assessment'
                }
              ],
              causal_links: [
                {
                  from_variable_id: 'visual_complexity',
                  to_variable_id: 'attention_duration',
                  relationship_type: 'direct_cause' as const,
                  confidence: 'High' as const,
                  evidence_basis: 'Strong empirical support from comparative analysis',
                  temporal_precedence: true
                }
              ],
              identified_patterns: [
                {
                  pattern_type: 'chain' as const,
                  involved_variables: ['visual_complexity', 'attention_duration'],
                  description: 'Simple causal chain from IV to DV'
                }
              ]
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.85,
              coherence: 0.90
            },
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
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.currentStep).toBe(StepId.P7_4_ANALYZE_PATHS_AND_BIASES);
      expect(result.lastCompletedStep).toBe(StepId.P7_4_ANALYZE_PATHS_AND_BIASES);
      expect(result.stepOutputs?.[StepId.P7_4_ANALYZE_PATHS_AND_BIASES]).toEqual(mockResponse);
      expect(result.metadata?.lastUpdateTime).toBeGreaterThanOrEqual(state.metadata!.lastUpdateTime!);
    });

    it('should handle empty DAG gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'Low' as const,
              completeness: 0.0,
              coherence: 0.0
            },
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
        identified_causal_paths: [],
        bias_analysis: [],
        path_significance_ranking: [],
        dependent_variable_focus: []
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.stepOutputs?.[StepId.P7_4_ANALYZE_PATHS_AND_BIASES]).toEqual(mockResponse);
    });

    it('should validate path type values', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
        lastCompletedStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        stepOutputs: {
          [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
            validated_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'High' as const,
              completeness: 0.8,
              coherence: 0.9
            },
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

      // Invalid path type
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            identified_causal_paths: [
              {
                path_id: 'path1',
                variables_sequence: ['var1', 'var2'],
                path_type: 'invalid_type', // Invalid type
                effect_strength: 'Strong',
                potential_biases: []
              }
            ],
            bias_analysis: [],
            path_significance_ranking: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Invalid path_type: invalid_type');
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