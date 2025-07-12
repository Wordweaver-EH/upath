import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P7_3B_ValidateAndCleanDAGNode } from '../P7_3B_ValidateAndCleanDAGNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P7_3B_ValidateAndCleanDAGNode', () => {
  let node: P7_3B_ValidateAndCleanDAGNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P7_3B_ValidateAndCleanDAGNode();
  });

  describe('execute', () => {
    it('should validate P7_3 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P7_3 output not found');
    });

    it('should handle LLM failures gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
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
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
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
        .rejects.toThrow('P7_3B LLM call failed: Network error');
    });

    it('should handle malformed LLM response', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
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
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
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
        response: { text: () => JSON.stringify({ validated_dag: { variables: [], causal_links: [], identified_patterns: [] } }) }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field: removed_links');
    });

    it('should validate removed links structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
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

      // Invalid removed link structure
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            validated_dag: { variables: [], causal_links: [], identified_patterns: [] },
            removed_links: [
              { link: {} } // Missing removal_reason
            ],
            dag_quality_assessment: {
              overall_rating: 'High',
              completeness: 0.8,
              coherence: 0.9
            },
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Removed link missing required field: removal_reason');
    });

    it('should validate quality assessment structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
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

      // Invalid quality assessment
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            validated_dag: { variables: [], causal_links: [], identified_patterns: [] },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'Invalid' // Invalid rating
            },
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field: completeness');
    });

    it('should successfully validate and clean DAG', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
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
                },
                {
                  from_variable_id: 'spurious_var',
                  to_variable_id: 'attention_duration',
                  relationship_type: 'correlates' as const,
                  confidence: 'Low' as const,
                  evidence_basis: 'Weak theoretical support',
                  temporal_precedence: false
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
            dag_validation_notes: 'DAG contains some spurious links that need removal',
            identified_confounders: ['environmental_lighting'],
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
        removed_links: [
          {
            link: {
              from_variable_id: 'spurious_var',
              to_variable_id: 'attention_duration',
              relationship_type: 'correlates' as const,
              confidence: 'Low' as const,
              evidence_basis: 'Weak theoretical support',
              temporal_precedence: false
            },
            removal_reason: 'Spurious correlation with insufficient theoretical justification'
          }
        ],
        dag_quality_assessment: {
          overall_rating: 'High' as const,
          completeness: 0.85,
          coherence: 0.90
        },
        dependent_variable_focus: ['attention']
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.currentStep).toBe(StepId.P7_3B_VALIDATE_AND_CLEAN_DAG);
      expect(result.lastCompletedStep).toBe(StepId.P7_3B_VALIDATE_AND_CLEAN_DAG);
      expect(result.stepOutputs?.[StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]).toEqual(mockResponse);
      expect(result.metadata?.lastUpdateTime).toBeGreaterThanOrEqual(state.metadata!.lastUpdateTime!);
    });

    it('should handle empty DAG gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'No DAG structure available',
            identified_confounders: [],
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
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.stepOutputs?.[StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]).toEqual(mockResponse);
    });

    it('should validate quality assessment rating values', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        lastCompletedStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        stepOutputs: {
          [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
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

      // Invalid overall rating
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            validated_dag: { variables: [], causal_links: [], identified_patterns: [] },
            removed_links: [],
            dag_quality_assessment: {
              overall_rating: 'Invalid', // Invalid rating
              completeness: 0.8,
              coherence: 0.9
            },
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Invalid overall_rating: Invalid');
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