import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P1_4_ConstructSpecificDiachronicStructureNode } from '../P1_4_ConstructSpecificDiachronicStructureNode';
import { GraphState, ExecutionContext, StepId } from '../../types';
import { createInitialGraphState } from '../../types/state';
import { P1_3_Output, P_NEG1_1_Output } from '../../types/outputs';

describe('P1_4_ConstructSpecificDiachronicStructureNode', () => {
  let node: P1_4_ConstructSpecificDiachronicStructureNode;
  let mockContext: ExecutionContext;
  let baseState: GraphState;

  beforeEach(() => {
    node = new P1_4_ConstructSpecificDiachronicStructureNode();
    
    mockContext = {
      sessionId: 'test-session',
      llmClient: {
        generateContent: vi.fn()
      },
      settings: {
        temperature: 0.3,
        modelName: 'gemini-1.5-pro'
      },
      retryCount: 0,
      maxRetries: 3,
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      }
    };

    // Create base state with P1_3 output
    baseState = createInitialGraphState('test-session', [], {});
    
    // Add P_NEG1_1 output
    baseState.stepOutputs[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION] = {
      transcript_id: 'transcript-1',
      independent_variable_details: 'Type of decision-making strategy used',
      dependent_variable_focus: ['emotional_response', 'cognitive_load']
    } as P_NEG1_1_Output;

    // Add P1_3 output with temporal phases
    baseState.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] = {
      transcript_id: 'transcript-1',
      refined_diachronic_units: [
        {
          unit_id: 'rdu_1',
          original_description: 'Initial setup',
          refined_description: 'Setting up the decision-making environment',
          micro_gestures: [],
          temporal_markers: ['First', 'Initially'],
          source_segment_ids: ['seg_5_1', 'seg_5_2'],
          temporal_phase: 'Beginning'
        },
        {
          unit_id: 'rdu_2',
          original_description: 'Main activity',
          refined_description: 'Evaluating options and making the decision',
          micro_gestures: [],
          temporal_markers: ['Then', 'Next'],
          source_segment_ids: ['seg_15_1', 'seg_20_1'],
          temporal_phase: 'Core Event'
        },
        {
          unit_id: 'rdu_3',
          original_description: 'Follow-up actions',
          refined_description: 'Implementing the decision and reviewing outcome',
          micro_gestures: [],
          temporal_markers: ['Finally', 'Afterwards'],
          source_segment_ids: ['seg_25_1', 'seg_25_2'],
          temporal_phase: 'Core Event'
        },
        {
          unit_id: 'rdu_4',
          original_description: 'Closure',
          refined_description: 'Reflecting on the process and closing',
          micro_gestures: [],
          temporal_markers: ['At the end'],
          source_segment_ids: ['seg_30_1'],
          temporal_phase: 'Ending'
        }
      ],
      refinement_metadata: {
        total_micro_gestures: 0,
        refinement_approach: 'Temporal phase analysis',
        temporal_flow: 'linear'
      },
      independent_variable_details: 'Type of decision-making strategy used',
      dependent_variable_focus: ['emotional_response', 'cognitive_load']
    } as P1_3_Output;
  });

  describe('Validation', () => {
    it('should have correct id', () => {
      expect(node.id).toBe(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE);
    });

    it('should throw error if P1_3 output is missing', async () => {
      delete baseState.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS];

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('P1_3 output not found');
    });

    it('should throw error if refined diachronic units are empty', async () => {
      (baseState.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output)
        .refined_diachronic_units = [];

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('No refined diachronic units to process');
    });
  });

  describe('Successful Execution', () => {
    it('should construct specific diachronic structure with phases', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'The experience follows a linear progression from setup to decision-making to implementation and reflection.',
              phases: [
                {
                  phase_name: 'Beginning',
                  description: 'Initial setup and preparation for decision-making',
                  units_involved: ['rdu_1']
                },
                {
                  phase_name: 'Core Event',
                  description: 'Main decision-making process including evaluation and implementation',
                  units_involved: ['rdu_2', 'rdu_3']
                },
                {
                  phase_name: 'Ending',
                  description: 'Final reflection and closure',
                  units_involved: ['rdu_4']
                }
              ],
              visualization_hint: 'Linear progression',
              iv_preliminary_observation: 'Decision-making strategy appears to influence the structure of evaluation phase.'
            },
            independent_variable_details: 'Type of decision-making strategy used',
            dependent_variable_focus: ['emotional_response', 'cognitive_load'],
            mermaid_syntax_specific_diachronic: 'gantt\ndateFormat X\ntitle Specific Diachronic Structure for transcript-1\naxisFormat %s\n\nsection Phases\nBeginning :ph_beginning, 0, 2d\nCore Event :ph_core, 2, 4d\nEnding :ph_ending, 6, 1d'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);

      expect(result.stepOutputs).toBeDefined();
      expect(result.stepOutputs![StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]).toBeDefined();
      
      const output = result.stepOutputs![StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE];
      expect(output.transcript_id).toBe('transcript-1');
      expect(output.specific_diachronic_structure.phases).toHaveLength(3);
      
      // Verify phase structure
      const beginningPhase = output.specific_diachronic_structure.phases[0];
      expect(beginningPhase.phase_name).toBe('Beginning');
      expect(beginningPhase.units_involved).toEqual(['rdu_1']);
      
      const corePhase = output.specific_diachronic_structure.phases[1];
      expect(corePhase.phase_name).toBe('Core Event');
      expect(corePhase.units_involved).toEqual(['rdu_2', 'rdu_3']);
      
      // Verify IV/DV are preserved
      expect(output.independent_variable_details).toBe('Type of decision-making strategy used');
      expect(output.dependent_variable_focus).toEqual(['emotional_response', 'cognitive_load']);
      
      // Verify mermaid syntax is included
      expect(output.mermaid_syntax_specific_diachronic).toContain('gantt');
      expect(output.mermaid_syntax_specific_diachronic).toContain('Beginning');
      expect(output.mermaid_syntax_specific_diachronic).toContain('Core Event');
      expect(output.mermaid_syntax_specific_diachronic).toContain('Ending');
    });

    it('should handle units without temporal_phase field', async () => {
      // Remove temporal_phase from P1_3 output to test backward compatibility
      const p1_3_output = baseState.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as any;
      p1_3_output.refined_diachronic_units.forEach((unit: any) => {
        delete unit.temporal_phase;
      });

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'Experience organized by sequential flow of activities.',
              phases: [
                {
                  phase_name: 'Phase 1',
                  description: 'Initial activities',
                  units_involved: ['rdu_1', 'rdu_2']
                },
                {
                  phase_name: 'Phase 2',
                  description: 'Later activities',
                  units_involved: ['rdu_3', 'rdu_4']
                }
              ],
              visualization_hint: 'Sequential flow',
              iv_preliminary_observation: 'No immediate IV connection apparent at this stage.'
            },
            independent_variable_details: 'Type of decision-making strategy used',
            dependent_variable_focus: ['emotional_response', 'cognitive_load'],
            mermaid_syntax_specific_diachronic: 'gantt\ndateFormat X\ntitle Specific Diachronic Structure for transcript-1\naxisFormat %s\n\nsection Phases\nPhase 1 :ph_1, 0, 4d\nPhase 2 :ph_2, 4, 3d'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);
      const output = result.stepOutputs![StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE];
      
      expect(output.specific_diachronic_structure.phases).toHaveLength(2);
      expect(output.specific_diachronic_structure.iv_preliminary_observation)
        .toBe('No immediate IV connection apparent at this stage.');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON response'
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('Failed to parse LLM JSON response');
    });

    it('should handle missing specific_diachronic_structure in response', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            independent_variable_details: 'Test',
            dependent_variable_focus: ['test']
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('Invalid response: missing specific_diachronic_structure');
    });

    it('should handle empty phases array', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'Test',
              phases: [],
              visualization_hint: 'Test',
              iv_preliminary_observation: 'Test'
            },
            independent_variable_details: 'Test',
            dependent_variable_focus: ['test'],
            mermaid_syntax_specific_diachronic: 'Test'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await expect(node.execute(baseState, mockContext))
        .rejects.toThrow('No phases identified in specific diachronic structure');
    });

    it('should be marked as recoverable for LLM errors', () => {
      const error = new Error('LLM service temporarily unavailable');
      expect(node.isRecoverable(error)).toBe(true);
    });

    it('should not be recoverable for validation errors', () => {
      const error = new Error('No refined diachronic units to process');
      expect(node.isRecoverable(error)).toBe(false);
    });
  });

  describe('Prompt Building', () => {
    it('should build proper prompt with P1_3 data', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'Test',
              phases: [{
                phase_name: 'Test',
                description: 'Test',
                units_involved: ['rdu_1']
              }],
              visualization_hint: 'Test',
              iv_preliminary_observation: 'Test'
            },
            independent_variable_details: 'Type of decision-making strategy used',
            dependent_variable_focus: ['emotional_response', 'cognitive_load'],
            mermaid_syntax_specific_diachronic: 'Test'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await node.execute(baseState, mockContext);

      const callArgs = mockContext.llmClient.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents[0].parts[0].text;

      // Verify prompt contains key elements
      expect(prompt).toContain('construct the Specific Diachronic Structure');
      expect(prompt).toContain('JSON output from P1.3');
      expect(prompt).toContain('transcript-1');
      expect(prompt).toContain('rdu_1');
      expect(prompt).toContain('rdu_2');
      expect(prompt).toContain('rdu_3');
      expect(prompt).toContain('rdu_4');
      expect(prompt).toContain('Type of decision-making strategy used');
      expect(prompt).toContain('emotional_response');
      expect(prompt).toContain('cognitive_load');
      expect(prompt).toContain('Mermaid.js syntax for a Gantt chart');
    });

    it('should include temporal_phase information when available', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'Test',
              phases: [{
                phase_name: 'Beginning',
                description: 'Test',
                units_involved: ['rdu_1']
              }],
              visualization_hint: 'Test',
              iv_preliminary_observation: 'Test'
            },
            independent_variable_details: 'Type of decision-making strategy used',
            dependent_variable_focus: ['emotional_response', 'cognitive_load'],
            mermaid_syntax_specific_diachronic: 'Test'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      await node.execute(baseState, mockContext);

      const callArgs = mockContext.llmClient.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents[0].parts[0].text;

      // Verify temporal phases are in the prompt
      expect(prompt).toContain('Beginning');
      expect(prompt).toContain('Core Event');
      expect(prompt).toContain('Ending');
    });
  });

  describe('Integration with BaseNode', () => {
    it('should support retry mechanism', async () => {
      const error = new Error('Temporary LLM failure');
      
      // First call fails
      mockContext.llmClient.generateContent.mockRejectedValueOnce(error);
      
      // Second call succeeds
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'Test',
              phases: [{
                phase_name: 'Test',
                description: 'Test',
                units_involved: ['rdu_1']
              }],
              visualization_hint: 'Test',
              iv_preliminary_observation: 'Test'
            },
            independent_variable_details: 'Type of decision-making strategy used',
            dependent_variable_focus: ['emotional_response', 'cognitive_load'],
            mermaid_syntax_specific_diachronic: 'Test'
          })
        }
      };
      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      // Execute with retry should succeed
      const result = await node.executeWithRetry(baseState, mockContext);
      
      expect(result.success).toBe(true);
      expect(mockContext.llmClient.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should update currentStep and lastCompletedStep', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            transcript_id: 'transcript-1',
            specific_diachronic_structure: {
              summary: 'Test',
              phases: [{
                phase_name: 'Test',
                description: 'Test',
                units_involved: ['rdu_1']
              }],
              visualization_hint: 'Test',
              iv_preliminary_observation: 'Test'
            },
            independent_variable_details: 'Type of decision-making strategy used',
            dependent_variable_focus: ['emotional_response', 'cognitive_load'],
            mermaid_syntax_specific_diachronic: 'Test'
          })
        }
      };

      mockContext.llmClient.generateContent.mockResolvedValueOnce(mockResponse);

      const result = await node.execute(baseState, mockContext);

      expect(result.currentStep).toBe(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE);
      expect(result.lastCompletedStep).toBe(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE);
    });
  });
});