import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2S_3_DefineSpecificSynchronicStructureNode } from '../P2S_3_DefineSpecificSynchronicStructureNode';
import { GraphState, StepId } from '../../types';
import { LLMResponseError } from '../../errors/LLMResponseError';

describe('P2S_3_DefineSpecificSynchronicStructureNode', () => {
  let node: P2S_3_DefineSpecificSynchronicStructureNode;
  let mockLLMClient: any;

  beforeEach(() => {
    mockLLMClient = {
      generateContent: vi.fn()
    };
    node = new P2S_3_DefineSpecificSynchronicStructureNode();
  });

  describe('execute', () => {
    it('should validate required inputs', async () => {
      // Missing currentPhaseName
      const state: GraphState = {
        currentStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        lastCompletedStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        stepOutputs: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          sessionId: 'test-session',
          settings: {}
        }
      };

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Missing currentPhaseName in metadata for P2S.3');
    });

    it('should validate P2S_2 output exists', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        lastCompletedStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
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
        .rejects.toThrow('P2S_2 output not found for phase \'Beginning\'');
    });

    it('should successfully define specific synchronic structure', async () => {
      const state: GraphState = {
        currentStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        lastCompletedStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        stepOutputs: {
          [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: {
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
            specific_synchronic_structure: {
              representation_type: 'network',
              description: 'Network representation of sensory analysis hierarchy',
              network_nodes: [
                { id: 'n0', label: 'Texture Focus', source_isu_id: 'ISU_TextureFocus' },
                { id: 'n1', label: 'Rough Surface', source_isu_id: 'ISU_RoughSurface' },
                { id: 'n2', label: 'Vivid Color', source_isu_id: 'ISU_VividColor' },
                { id: 'n3', label: 'Texture Perception', source_isu_id: 'ISU_TexturePerception' },
                { id: 'n4', label: 'Visual Qualities', source_isu_id: 'ISU_VisualQualities' },
                { id: 'n5', label: 'Sensory Analysis', source_isu_id: 'ISU_SensoryAnalysis' }
              ],
              network_links: [
                { from: 'n0', to: 'n3', type: 'generalization' },
                { from: 'n1', to: 'n3', type: 'generalization' },
                { from: 'n2', to: 'n4', type: 'generalization' },
                { from: 'n3', to: 'n5', type: 'aggregation' },
                { from: 'n4', to: 'n5', type: 'aggregation' }
              ]
            },
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      const result = await node.execute(state, { llmClient: mockLLMClient, settings: {} });

      expect(result).toHaveProperty('currentStep', StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE);
      expect(result).toHaveProperty('lastCompletedStep', StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE);
      
      const output = result.stepOutputs![StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE];
      expect(output).toBeDefined();
      expect(output.transcript_id).toBe('test-transcript');
      expect(output.analyzed_diachronic_unit).toBe('Beginning');
      expect(output.specific_synchronic_structure).toBeDefined();
      expect(output.specific_synchronic_structure.representation_type).toBe('network');
      expect(output.specific_synchronic_structure.network_nodes).toHaveLength(6);
      expect(output.specific_synchronic_structure.network_links).toHaveLength(5);
      
      // Verify node-ISU mapping
      const node0 = output.specific_synchronic_structure.network_nodes[0];
      expect(node0.source_isu_id).toBe('ISU_TextureFocus');
      
      // Verify links represent hierarchy
      const linksFromN0 = output.specific_synchronic_structure.network_links.filter(l => l.from === 'n0');
      expect(linksFromN0).toHaveLength(1);
      expect(linksFromN0[0].to).toBe('n3');
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

    it('should validate network structure consistency', async () => {
      const state = createValidState();
      
      // Mock response with invalid network (link references non-existent node)
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            specific_synchronic_structure: {
              representation_type: 'network',
              description: 'Invalid network',
              network_nodes: [
                { id: 'n0', label: 'Node 0', source_isu_id: 'ISU_TextureFocus' },
                { id: 'n1', label: 'Node 1', source_isu_id: 'ISU_TexturePerception' }
              ],
              network_links: [
                { from: 'n0', to: 'n999', type: 'invalid' } // n999 doesn't exist!
              ]
            },
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Network link references non-existent node: n999');
    });

    it('should validate all ISUs are represented in network', async () => {
      const state = createValidState();
      
      // Mock response missing some ISUs in network
      mockLLMClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-transcript',
            analyzed_diachronic_unit: 'Beginning',
            specific_synchronic_structure: {
              representation_type: 'network',
              description: 'Incomplete network',
              network_nodes: [
                { id: 'n0', label: 'Node 0', source_isu_id: 'ISU_TextureFocus' }
                // Missing other ISUs!
              ],
              network_links: []
            },
            independent_variable_details: 'Visual focus condition',
            dependent_variable_focus: ['visual perception', 'attention']
          })
        }
      });

      await expect(node.execute(state, { llmClient: mockLLMClient, settings: {} }))
        .rejects.toThrow('Not all ISUs are represented in the network');
    });
  });

  describe('isRecoverable', () => {
    it('should mark validation errors as non-recoverable', () => {
      const error = new Error('P2S_2 output not found');
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
    currentStep: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
    lastCompletedStep: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
    stepOutputs: {
      [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: {
        transcript_id: 'test-transcript',
        analyzed_diachronic_unit: 'Beginning',
        specific_synchronic_units_hierarchy: [
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
            unit_name: 'ISU_TexturePerception',
            level: 1,
            abstraction_op: 'Generalization',
            intensional_definition: 'General texture-related perceptual processes',
            constituent_lower_units: ['ISU_TextureFocus']
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