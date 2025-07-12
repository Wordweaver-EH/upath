import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2S_2_IdentifySpecificSynchronicUnitsNode } from '../P2S_2_IdentifySpecificSynchronicUnitsNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P2S_2_IdentifySpecificSynchronicUnitsNode', () => {
  let node: P2S_2_IdentifySpecificSynchronicUnitsNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P2S_2_IdentifySpecificSynchronicUnitsNode();
  });

  describe('execute', () => {
    it('should validate required inputs', async () => {
      // Missing currentPhaseName
      const state: GraphState = {
        currentStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        lastCompletedStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing currentPhaseName in metadata for P2S.2');
    });

    it('should validate P2S_1 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        lastCompletedStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          currentPhaseName: 'Beginning'
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('P2S_1 output not found for phase \'Beginning\'');
    });

    it('should successfully identify specific synchronic units', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        lastCompletedStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        stepOutputs: {
          [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: {
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            synchronic_thematic_groups: [
              {
                group_label: 'Visual texture analysis',
                justification: 'These utterances focus on texture perception aspects',
                utterances: [
                  {
                    original_line_num: '5',
                    utterance_text: 'I focused on the texture'
                  },
                  {
                    original_line_num: '6',
                    utterance_text: 'The surface felt rough'
                  }
                ]
              },
              {
                group_label: 'Color perception',
                justification: 'These utterances describe color-related experiences',
                utterances: [
                  {
                    original_line_num: '7',
                    utterance_text: 'The color seemed vivid'
                  }
                ]
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {},
          currentPhaseName: 'Beginning'
        }
      };

      // Mock LLM response
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            specific_synchronic_units_hierarchy: [
              // Level 0 ISUs - grounded in utterances
              {
                unit_name: 'ISU_TextureFocus',
                level: 0,
                abstraction_op: 'Direct Description',
                intensional_definition: 'The act of focusing attention on texture',
                utterances: [
                  { original_line_num: '5', utterance_text: 'I focused on the texture' }
                ]
              },
              {
                unit_name: 'ISU_RoughSurface',
                level: 0,
                abstraction_op: 'Direct Description',
                intensional_definition: 'Tactile perception of roughness',
                utterances: [
                  { original_line_num: '6', utterance_text: 'The surface felt rough' }
                ]
              },
              {
                unit_name: 'ISU_VividColor',
                level: 0,
                abstraction_op: 'Direct Description', 
                intensional_definition: 'Visual perception of vivid coloration',
                utterances: [
                  { original_line_num: '7', utterance_text: 'The color seemed vivid' }
                ]
              },
              // Level 1 ISUs - abstracted from Level 0
              {
                unit_name: 'ISU_TexturePerception',
                level: 1,
                abstraction_op: 'Generalization',
                intensional_definition: 'General texture-related perceptual processes',
                constituent_lower_units: ['ISU_TextureFocus', 'ISU_RoughSurface']
              },
              {
                unit_name: 'ISU_VisualQualities',
                level: 1,
                abstraction_op: 'Generalization',
                intensional_definition: 'Visual quality perception processes',
                constituent_lower_units: ['ISU_VividColor']
              },
              // Level 2 ISU - highest abstraction
              {
                unit_name: 'ISU_SensoryAnalysis',
                level: 2,
                abstraction_op: 'Aggregation',
                intensional_definition: 'Overall sensory analysis processes',
                constituent_lower_units: ['ISU_TexturePerception', 'ISU_VisualQualities']
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS);
      
      const output = result.stepOutputs![StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS];
      expect(output).toBeDefined();
      expect(output.transcript_id).toBe('test-transcript');
      expect(output.analyzed_diachronic_unit).toBe('Beginning');
      expect(output.specific_synchronic_units_hierarchy).toHaveLength(6);
      
      // Verify Level 0 ISUs have utterances
      const level0Units = output.specific_synchronic_units_hierarchy.filter(u => u.level === 0);
      expect(level0Units).toHaveLength(3);
      level0Units.forEach(unit => {
        expect(unit.utterances).toBeDefined();
        expect(unit.utterances!.length).toBeGreaterThan(0);
      });
      
      // Verify Level 1+ ISUs have constituent_lower_units
      const higherLevelUnits = output.specific_synchronic_units_hierarchy.filter(u => u.level > 0);
      expect(higherLevelUnits).toHaveLength(3);
      higherLevelUnits.forEach(unit => {
        expect(unit.constituent_lower_units).toBeDefined();
        expect(unit.constituent_lower_units!.length).toBeGreaterThan(0);
      });
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

    it('should validate ISU hierarchy structure', async () => {
      const state = createValidState();
      
      // Mock response with invalid hierarchy (Level 0 without utterances)
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            specific_synchronic_units_hierarchy: [
              {
                unit_name: 'ISU_Invalid',
                level: 0,
                abstraction_op: 'Direct Description',
                intensional_definition: 'Invalid ISU without utterances'
                // Missing utterances for Level 0!
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Level 0 ISU must have utterances');
    });

    it('should validate Level 1+ ISUs have constituent units', async () => {
      const state = createValidState();
      
      // Mock response with invalid hierarchy (Level 1 without constituent_lower_units)
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            specific_synchronic_units_hierarchy: [
              {
                unit_name: 'ISU_Invalid',
                level: 1,
                abstraction_op: 'Generalization',
                intensional_definition: 'Invalid higher-level ISU'
                // Missing constituent_lower_units for Level 1+!
              }
            ],
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Level 1+ ISU must have constituent_lower_units');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P2S_1 output not found');
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
    currentStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
    lastCompletedStep: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
    stepOutputs: {
      [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: {
        transcript_id: 'test-transcript',
        analyzed_diachronic_unit: 'Beginning',
        synchronic_thematic_groups: [
          {
            group_label: 'Visual texture analysis',
            justification: 'These utterances focus on texture perception aspects',
            utterances: [
              {
                original_line_num: '5',
                utterance_text: 'I focused on the texture'
              }
            ]
          }
        ],
        independent_variable_details: 'Visual focus condition',
        dependent_variable_focus: ['visual perception', 'attention']
      }
    },
    metadata: {
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      sessionId: 'test-session',
      settings: {},
      currentPhaseName: 'Beginning'
    }
  };
}