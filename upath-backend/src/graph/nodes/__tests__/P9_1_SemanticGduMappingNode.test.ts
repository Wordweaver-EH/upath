import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P9_1_SemanticGduMappingNode } from '../P9_1_SemanticGduMappingNode';
import { GraphState, ExecutionContext } from '../../types/state';
import { StepId } from '../../types/enums';
import { ValidationError } from '../../errors/CommonErrors';
import { LLMResponseError } from '../../errors/LLMResponseError';
import { GenericDiachronicUnit } from '../../types/outputs';

describe('P9_1_SemanticGduMappingNode', () => {
  let node: P9_1_SemanticGduMappingNode;
  let mockState: GraphState;
  let mockContext: ExecutionContext;

  const sampleGdusA: GenericDiachronicUnit[] = [
    {
      gdu_id: 'GDU_A1',
      definition: 'Participant begins to focus attention on breathing',
      supporting_transcripts_count: 3,
      contributing_refined_du_ids: [
        { transcript_id: 'T1', refined_du_id: 'RDU1' },
        { transcript_id: 'T2', refined_du_id: 'RDU2' }
      ]
    },
    {
      gdu_id: 'GDU_A2', 
      definition: 'Participant experiences increasing awareness of bodily sensations',
      supporting_transcripts_count: 2,
      contributing_refined_du_ids: [
        { transcript_id: 'T1', refined_du_id: 'RDU3' }
      ]
    }
  ];

  const sampleGdusB: GenericDiachronicUnit[] = [
    {
      gdu_id: 'GDU_B1',
      definition: 'Subject starts concentrating on respiratory process',
      supporting_transcripts_count: 2,
      contributing_refined_du_ids: [
        { transcript_id: 'T3', refined_du_id: 'RDU4' }
      ]
    },
    {
      gdu_id: 'GDU_B2',
      definition: 'Subject notices physical tension release',
      supporting_transcripts_count: 1,
      contributing_refined_du_ids: [
        { transcript_id: 'T3', refined_du_id: 'RDU5' }
      ]
    }
  ];

  beforeEach(() => {
    node = new P9_1_SemanticGduMappingNode();
    mockState = {
      irr_inputs: {
        run_a_gdus: sampleGdusA,
        run_b_gdus: sampleGdusB,
        temperature: 0.7
      },
      stepOutputs: {}
    } as any;
    
    mockContext = {
      llmClient: {
        generateContent: vi.fn()
      },
      settings: {
        temperature: 0.7
      }
    } as any;
    
    vi.clearAllMocks();
  });

  describe('validateInputs', () => {
    it('should validate valid inputs successfully', () => {
      const inputs = {
        run_a_gdus: sampleGdusA,
        run_b_gdus: sampleGdusB,
        temperature: 0.7
      };

      expect(() => node['validateInputs'](inputs)).not.toThrow();
    });

    it('should throw ValidationError for missing run_a_gdus', () => {
      const inputs = {
        run_b_gdus: sampleGdusB
      } as any;

      expect(() => node['validateInputs'](inputs))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for empty run_a_gdus array', () => {
      const inputs = {
        run_a_gdus: [],
        run_b_gdus: sampleGdusB
      };

      expect(() => node['validateInputs'](inputs))
        .toThrow('run_a_gdus cannot be empty');
    });

    it('should throw ValidationError for invalid GDU structure', () => {
      const inputs = {
        run_a_gdus: [{ gdu_id: 'GDU1' }], // missing definition
        run_b_gdus: sampleGdusB
      } as any;

      expect(() => node['validateInputs'](inputs))
        .toThrow('missing required fields');
    });

    it('should throw ValidationError for invalid temperature', () => {
      const inputs = {
        run_a_gdus: sampleGdusA,
        run_b_gdus: sampleGdusB,
        temperature: 1.5
      };

      expect(() => node['validateInputs'](inputs))
        .toThrow('temperature must be between 0 and 1');
    });
  });

  describe('execute', () => {
    it('should generate semantic mapping successfully', async () => {
      const mockLLMResponse = {
        gdu_mappings: [
          {
            run_a_gdu: 'GDU_A1',
            run_b_gdu: 'GDU_B1',
            semantic_similarity: 0.9,
            mapping_justification: 'Both describe initial attention to breathing'
          },
          {
            run_a_gdu: 'GDU_A2',
            run_b_gdu: null,
            semantic_similarity: 0.0,
            mapping_justification: 'No equivalent found in Run B'
          },
          {
            run_a_gdu: null,
            run_b_gdu: 'GDU_B2',
            semantic_similarity: 0.0,
            mapping_justification: 'No equivalent found in Run A'
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockLLMResponse)
        }
      });

      const result = await node.execute(mockState, mockContext);

      expect(mockContext.llmClient.generateContent).toHaveBeenCalledWith({
        contents: [{
          role: 'user',
          parts: [{ text: expect.stringContaining('semantic mapping between Generic Diachronic Units') }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      });

      const output = result.stepOutputs?.[StepId.P9_1_SEMANTIC_GDU_MAPPING];
      expect(output).toBeDefined();
      expect(output.gdu_mappings).toHaveLength(3);
      expect(output.gdu_mappings[0]).toMatchObject({
        run_a_gdu_id: 'GDU_A1',
        run_b_gdu_id: 'GDU_B1',
        semantic_similarity_score: 0.9,
        mapping_justification: 'Both describe initial attention to breathing'
      });

      // Check that metadata was populated from the actual GDU objects
      expect(output.gdu_mappings[0].run_a_definition).toBe(sampleGdusA[0].definition);
      expect(output.gdu_mappings[0].run_a_contributing_rdu_count).toBe(2);
    });

    it('should handle identical GDU sets with 1:1 mapping', async () => {
      const identicalGdus = [
        {
          gdu_id: 'GDU_SAME',
          definition: 'Identical definition',
          supporting_transcripts_count: 1,
          contributing_refined_du_ids: [{ transcript_id: 'T1', refined_du_id: 'RDU1' }]
        }
      ];

      mockState.irr_inputs = {
        run_a_gdus: identicalGdus,
        run_b_gdus: identicalGdus
      };

      const mockLLMResponse = {
        gdu_mappings: [
          {
            run_a_gdu: 'GDU_SAME',
            run_b_gdu: 'GDU_SAME',
            semantic_similarity: 1.0,
            mapping_justification: 'Identical GDU definitions'
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockLLMResponse)
        }
      });

      const result = await node.execute(mockState, mockContext);
      const output = result.stepOutputs?.[StepId.P9_1_SEMANTIC_GDU_MAPPING];
      
      expect(output.gdu_mappings).toHaveLength(1);
      expect(output.gdu_mappings[0].semantic_similarity_score).toBe(1.0);
    });

    it('should add unmapped GDUs as null mappings', async () => {
      // LLM only maps one GDU, leaving others unmapped
      const mockLLMResponse = {
        gdu_mappings: [
          {
            run_a_gdu: 'GDU_A1',
            run_b_gdu: 'GDU_B1',
            semantic_similarity: 0.8,
            mapping_justification: 'Similar breathing focus'
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockLLMResponse)
        }
      });

      const result = await node.execute(mockState, mockContext);
      const output = result.stepOutputs?.[StepId.P9_1_SEMANTIC_GDU_MAPPING];

      // Should have 3 mappings: 1 from LLM + 1 unmapped from A + 1 unmapped from B
      expect(output.gdu_mappings).toHaveLength(3);
      
      // Find the unmapped GDU_A2
      const unmappedA2 = output.gdu_mappings.find(m => m.run_a_gdu_id === 'GDU_A2' && !m.run_b_gdu_id);
      expect(unmappedA2).toBeDefined();
      expect(unmappedA2?.mapping_justification).toBe('No semantic match found in Run B');
    });

    it('should throw ValidationError for missing IRR inputs', async () => {
      mockState.irr_inputs = undefined;

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow('IRR inputs not provided for P9_1 analysis');
    });

    it('should throw LLMResponseError for invalid LLM response structure', async () => {
      const mockLLMResponse = {
        invalid_structure: true
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockLLMResponse)
        }
      });

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow(LLMResponseError);
    });

    it('should throw LLMResponseError for mapping with no GDUs', async () => {
      const mockLLMResponse = {
        gdu_mappings: [
          {
            run_a_gdu: null,
            run_b_gdu: null,
            semantic_similarity: 0.0,
            mapping_justification: 'Invalid mapping'
          }
        ]
      };

      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockLLMResponse)
        }
      });

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow('Mapping 0 must have at least one non-null GDU');
    });

    it('should handle LLM JSON parsing errors', async () => {
      mockContext.llmClient.generateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON response'
        }
      });

      await expect(node.execute(mockState, mockContext))
        .rejects.toThrow(LLMResponseError);
    });
  });

  describe('id property', () => {
    it('should have correct step ID', () => {
      expect(node.id).toBe(StepId.P9_1_SEMANTIC_GDU_MAPPING);
    });
  });
});