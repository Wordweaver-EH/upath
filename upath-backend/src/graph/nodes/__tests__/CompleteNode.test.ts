import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompleteNode } from '../CompleteNode';
import { GraphState, StepId } from '../../types';

describe('CompleteNode', () => {
  let node: CompleteNode;

  beforeEach(() => {
    node = new CompleteNode();
  });

  describe('execute', () => {
    it('should validate P5_2 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.COMPLETE,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: {}, settings: {} }))
        .rejects.toThrow('P5_2 output not found');
    });

    it('should successfully complete pipeline analysis', async () => {
      const state: GraphState = {
        currentStep: StepId.COMPLETE,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {
          [StepId.P5_2_HOLISTIC_REFINEMENT]: {
            holistic_assessment: 'Comprehensive analysis successfully completed',
            refinement_recommendations: [
              {
                area: 'Generic Structure',
                recommendation: 'Consider temporal parameters',
                rationale: 'Better capture timing variations',
                priority: 'Medium' as const
              }
            ],
            final_confidence_rating: 'High' as const,
            study_limitations: ['Limited sample size'],
            future_research_directions: ['Expand to multiple contexts'],
            dependent_variable_focus: ['attention', 'perception']
          }
        },
        metadata: {
          startTime: Date.now() - 3600000, // 1 hour ago
          lastUpdateTime: Date.now() - 1000, // 1 second ago
          sessionId: 'test-session',
          settings: {},
          global_dv_focus: ['attention', 'perception']
        }
      };

      const result = await node.execute(state, { llmClient: {}, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.COMPLETE);
      expect(result).toHaveProperty('lastCompletedStep', StepId.COMPLETE);
      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('progress', 100);
      
      const output = result.stepOutputs![StepId.COMPLETE];
      expect(output).toBeDefined();
      expect(output.completion_status).toBe('success');
      expect(output.analysis_complete).toBe(true);
      expect(output.final_confidence_rating).toBe('High');
      expect(output.total_processing_time_ms).toBeGreaterThan(0);
      expect(output.completion_timestamp).toBeDefined();
      expect(output.dependent_variable_focus).toEqual(['attention', 'perception']);
    });

    it('should calculate processing time correctly', async () => {
      const startTime = Date.now() - 5000; // 5 seconds ago
      const state: GraphState = {
        currentStep: StepId.COMPLETE,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {
          [StepId.P5_2_HOLISTIC_REFINEMENT]: {
            holistic_assessment: 'Test assessment',
            refinement_recommendations: [],
            final_confidence_rating: 'Medium' as const,
            study_limitations: [],
            future_research_directions: [],
            dependent_variable_focus: ['attention']
          }
        },
        metadata: {
          startTime,
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          global_dv_focus: ['attention']
        }
      };

      const result = await node.execute(state, { llmClient: {}, settings: {} });
      
      const output = result.stepOutputs![StepId.COMPLETE];
      expect(output.total_processing_time_ms).toBeGreaterThanOrEqual(4900); // Allow some tolerance
      expect(output.total_processing_time_ms).toBeLessThan(6000);
    });

    it('should handle missing global_dv_focus gracefully', async () => {
      const state: GraphState = {
        currentStep: StepId.COMPLETE,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {
          [StepId.P5_2_HOLISTIC_REFINEMENT]: {
            holistic_assessment: 'Test assessment',
            refinement_recommendations: [],
            final_confidence_rating: 'Low' as const,
            study_limitations: [],
            future_research_directions: [],
            dependent_variable_focus: ['attention']
          }
        },
        metadata: {
          startTime: Date.now() - 1000,
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
          // No global_dv_focus
        }
      };

      const result = await node.execute(state, { llmClient: {}, settings: {} });
      
      const output = result.stepOutputs![StepId.COMPLETE];
      expect(output.dependent_variable_focus).toEqual([]);
    });

    it('should preserve summary information from P5_2', async () => {
      const holistic_assessment = 'Detailed holistic assessment of the entire analysis pipeline';
      const refinement_recommendations = [
        {
          area: 'Data Collection',
          recommendation: 'Increase sample size',
          rationale: 'Better statistical power',
          priority: 'High' as const
        }
      ];

      const state: GraphState = {
        currentStep: StepId.COMPLETE,
        lastCompletedStep: StepId.P5_2_HOLISTIC_REFINEMENT,
        stepOutputs: {
          [StepId.P5_2_HOLISTIC_REFINEMENT]: {
            holistic_assessment,
            refinement_recommendations,
            final_confidence_rating: 'High' as const,
            study_limitations: ['Limitation 1', 'Limitation 2'],
            future_research_directions: ['Direction 1', 'Direction 2'],
            dependent_variable_focus: ['attention', 'memory']
          }
        },
        metadata: {
          startTime: Date.now() - 2000,
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          global_dv_focus: ['attention', 'memory']
        }
      };

      const result = await node.execute(state, { llmClient: {}, settings: {} });
      
      const output = result.stepOutputs![StepId.COMPLETE];
      expect(output.holistic_assessment).toBe(holistic_assessment);
      expect(output.refinement_recommendations).toEqual(refinement_recommendations);
      expect(output.study_limitations).toEqual(['Limitation 1', 'Limitation 2']);
      expect(output.future_research_directions).toEqual(['Direction 1', 'Direction 2']);
    });
  });

  describe('isRecoverable', () => {
    it('should mark all errors as non-recoverable', () => {
      const error = new Error('P5_2 output not found');
      expect(node['isRecoverable'](error)).toBe(false);
    });
  });
});