import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P7_3_AssembleDAGAndIdentifyPatternsNode } from '../P7_3_AssembleDAGAndIdentifyPatternsNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P7_3_AssembleDAGAndIdentifyPatternsNode', () => {
  let node: P7_3_AssembleDAGAndIdentifyPatternsNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P7_3_AssembleDAGAndIdentifyPatternsNode();
  });

  describe('execute', () => {
    it('should validate P7_2 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P7_2 output not found');
    });

    it('should validate P7_1 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [],
            link_justifications: [],
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
        .rejects.toThrow('P7_1 output not found');
    });

    it('should handle LLM failures gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [
              {
                variable_id: 'var1',
                variable_name: 'Variable 1',
                definition: 'Test variable',
                measurement_approach: 'Test measurement',
                data_source: 'Test source'
              }
            ],
            iv_formalization: {
              variable_id: 'var1',
              levels: ['Low', 'High'],
              operationalization: 'Test operationalization'
            },
            dv_formalizations: [],
            dependent_variable_focus: ['attention']
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [
              {
                from_variable_id: 'var1',
                to_variable_id: 'var2',
                relationship_type: 'direct_cause' as const,
                confidence: 'High' as const,
                evidence_basis: 'Test evidence',
                temporal_precedence: true
              }
            ],
            link_justifications: [],
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
        .rejects.toThrow('P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS LLM call failed: Network error');
    });

    it('should handle malformed LLM response', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [
              {
                variable_id: 'var1',
                variable_name: 'Variable 1',
                definition: 'Test variable',
                measurement_approach: 'Test measurement',
                data_source: 'Test source'
              }
            ],
            iv_formalization: {
              variable_id: 'var1',
              levels: ['Low', 'High'],
              operationalization: 'Test operationalization'
            },
            dv_formalizations: [],
            dependent_variable_focus: ['attention']
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [],
            link_justifications: [],
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
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [
              {
                variable_id: 'var1',
                variable_name: 'Variable 1',
                definition: 'Test variable',
                measurement_approach: 'Test measurement',
                data_source: 'Test source'
              }
            ],
            iv_formalization: {
              variable_id: 'var1',
              levels: ['Low', 'High'],
              operationalization: 'Test operationalization'
            },
            dv_formalizations: [],
            dependent_variable_focus: ['attention']
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [],
            link_justifications: [],
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
        response: { text: () => JSON.stringify({ causal_dag: { variables: [], causal_links: [], identified_patterns: [] } }) }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing required field: dag_validation_notes');
    });

    it('should validate DAG structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [
              {
                variable_id: 'var1',
                variable_name: 'Variable 1',
                definition: 'Test variable',
                measurement_approach: 'Test measurement',
                data_source: 'Test source'
              }
            ],
            iv_formalization: {
              variable_id: 'var1',
              levels: ['Low', 'High'],
              operationalization: 'Test operationalization'
            },
            dv_formalizations: [],
            dependent_variable_focus: ['attention']
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [],
            link_justifications: [],
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

      // Invalid DAG structure
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            causal_dag: {
              variables: [], // Missing required fields
              causal_links: [],
              identified_patterns: []
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });
      expect(result.stepOutputs?.[StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]).toBeDefined();
    });

    it('should validate identified patterns structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [
              {
                variable_id: 'var1',
                variable_name: 'Variable 1',
                definition: 'Test variable',
                measurement_approach: 'Test measurement',
                data_source: 'Test source'
              }
            ],
            iv_formalization: {
              variable_id: 'var1',
              levels: ['Low', 'High'],
              operationalization: 'Test operationalization'
            },
            dv_formalizations: [],
            dependent_variable_focus: ['attention']
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [],
            link_justifications: [],
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

      // Invalid pattern structure
      mockLLMClient.generateContent.mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            causal_dag: {
              variables: [],
              causal_links: [],
              identified_patterns: [
                { pattern_type: 'chain' } // Missing required fields
              ]
            },
            dag_validation_notes: 'Test notes',
            identified_confounders: [],
            dependent_variable_focus: ['attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Pattern missing required field: involved_variables');
    });

    it('should successfully assemble DAG and identify patterns', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [
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
            iv_formalization: {
              variable_id: 'visual_complexity',
              levels: ['Low', 'Medium', 'High'],
              operationalization: 'Controlled scene complexity manipulation'
            },
            dv_formalizations: [
              {
                variable_id: 'attention_duration',
                measurement_indicators: ['fixation_time', 'dwell_duration'],
                operationalization: 'Eye-tracking temporal measurements'
              }
            ],
            dependent_variable_focus: ['attention']
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [
              {
                from_variable_id: 'visual_complexity',
                to_variable_id: 'attention_duration',
                relationship_type: 'direct_cause' as const,
                confidence: 'High' as const,
                evidence_basis: 'Strong empirical support from comparative analysis',
                temporal_precedence: true
              }
            ],
            link_justifications: [
              {
                link_id: 'visual_complexity->attention_duration',
                theoretical_basis: 'Cognitive load theory',
                empirical_support: 'P5_1 findings'
              }
            ],
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
        dag_validation_notes: 'DAG structure is coherent with no cycles detected',
        identified_confounders: ['environmental_lighting'],
        dependent_variable_focus: ['attention']
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.currentStep).toBe(StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS);
      expect(result.lastCompletedStep).toBe(StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS);
      expect(result.stepOutputs?.[StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]).toEqual(mockResponse);
      expect(result.metadata?.lastUpdateTime).toBeGreaterThanOrEqual(state.metadata!.lastUpdateTime!);
    });

    it('should handle empty inputs gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        lastCompletedStep: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        stepOutputs: {
          [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
            candidate_variables: [],
            iv_formalization: {
              variable_id: 'nonexistent',
              levels: [],
              operationalization: 'None'
            },
            dv_formalizations: [],
            dependent_variable_focus: []
          },
          [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
            proposed_causal_links: [],
            link_justifications: [],
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
        causal_dag: {
          variables: [],
          causal_links: [],
          identified_patterns: []
        },
        dag_validation_notes: 'No variables or links available for DAG construction',
        identified_confounders: [],
        dependent_variable_focus: []
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockResponse) }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result.stepOutputs?.[StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]).toEqual(mockResponse);
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