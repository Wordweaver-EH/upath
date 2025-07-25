import { transformP2SDataToSummary, generateTableRows } from '../p2s4DataTransformer';
import { P2SDuData, P2S_1_Output, P2S_2_Output, P2S_3_Output, P1_4_Output } from '../../../types';

describe('p2s4DataTransformer', () => {
  const createMockP2S1Output = (): P2S_1_Output => ({
    transcript_id: 'transcript1',
    analyzed_du_id: 'DU-1: Initial State',
    synchronic_thematic_groups: [
      {
        group_label: 'Theme 1',
        justification: 'Test justification',
        segments: [
          {
            segment_id: 'seg1',
            segment_text: 'Test utterance 1',
            original_utterance: { speaker: 'P', utterance_text: 'Test utterance 1' },
            temporal_cues: []
          }
        ]
      }
    ],
    independent_variable_details: 'Test IV',
    dependent_variable_focus: ['DV1']
  });

  const createMockP2S2Output = (): P2S_2_Output => ({
    transcript_id: 'transcript1',
    analyzed_du_id: 'DU-1',
    specific_synchronic_units_hierarchy: [
      {
        unit_name: 'ISU-1',
        level: 1,
        abstraction_op: 'generalization',
        intensional_definition: 'Test definition',
        extensional_definition: 'Test extension',
        constituent_lower_units: [],
        segments: [
          {
            segment_id: 'seg1',
            segment_text: 'Test utterance 1',
            original_utterance: { speaker: 'P', utterance_text: 'Test utterance 1' },
            temporal_cues: []
          }
        ]
      }
    ],
    independent_variable_details: 'Test IV',
    dependent_variable_focus: ['DV1']
  });

  const createMockP2S3Output = (): P2S_3_Output => ({
    transcript_id: 'transcript1',
    analyzed_du_id: 'DU-1',
    specific_synchronic_structure: {
      representation_type: 'Semantic Network',
      description: 'Test network',
      network_nodes: [
        { id: 'node1', label: 'Node 1', properties: {} }
      ],
      network_links: [
        { source: 'node1', target: 'node1', relation_type: 'test', strength: 1 }
      ]
    },
    independent_variable_details: 'Test IV',
    dependent_variable_focus: ['DV1']
  });

  describe('transformP2SDataToSummary', () => {
    it('should transform empty data correctly', () => {
      const result = transformP2SDataToSummary('transcript1', new Map());
      
      expect(result).toEqual({
        transcriptId: 'transcript1',
        duRecords: [],
        totalDUs: 0,
        totalISUs: 0,
        totalUtterances: 0
      });
    });

    it('should transform a single DU with P2S outputs', () => {
      const p2sOutputsByDU = new Map<string, P2SDuData>([
        ['du_1', {
          p2s_1_output: createMockP2S1Output(),
          p2s_2_output: createMockP2S2Output(),
          p2s_3_output: createMockP2S3Output(),
          p2s_3_mermaid_syntax: 'graph TD; A-->B;'
        }]
      ]);

      const result = transformP2SDataToSummary('transcript1', p2sOutputsByDU);
      
      expect(result.transcriptId).toBe('transcript1');
      expect(result.totalDUs).toBe(1);
      expect(result.totalISUs).toBe(1);
      expect(result.totalUtterances).toBe(1);
      expect(result.duRecords).toHaveLength(1);
      
      const duRecord = result.duRecords[0];
      expect(duRecord.id).toBe('du_1');
      expect(duRecord.name).toBe('DU-1: Initial State');
      expect(duRecord.description).toBe('No description available');
      expect(duRecord.networkDiagram.mermaidSyntax).toBe('graph TD; A-->B;');
    });

    it('should handle missing P2S outputs gracefully', () => {
      const p2sOutputsByDU = new Map<string, P2SDuData>([
        ['du_1', {
          p2s_1_output: createMockP2S1Output(),
          // p2s_2_output missing
          // p2s_3_output missing
        }]
      ]);

      const result = transformP2SDataToSummary('transcript1', p2sOutputsByDU);
      
      expect(result.totalDUs).toBe(1);
      expect(result.totalISUs).toBe(0);
      expect(result.duRecords[0].isuThemes.size).toBe(0);
    });

    it('should use DU description from P1.4 when available', () => {
      const p2sOutputsByDU = new Map<string, P2SDuData>([
        ['du_1', {
          p2s_1_output: createMockP2S1Output(),
          p2s_2_output: createMockP2S2Output(),
          p2s_3_output: createMockP2S3Output(),
          p2s_3_mermaid_syntax: 'graph TD; A-->B;'
        }]
      ]);

      const p1_4_output: P1_4_Output = {
        transcript_id: 'transcript1',
        diachronic_units: [
          {
            unit_id: 'du_1',
            description: 'Initial awareness and orientation to the experience',
            source_segment_ids: ['seg1']
          }
        ],
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['DV1']
      };

      const result = transformP2SDataToSummary('transcript1', p2sOutputsByDU, p1_4_output);
      
      const duRecord = result.duRecords[0];
      expect(duRecord.description).toBe('Initial awareness and orientation to the experience');
    });
  });

  describe('generateTableRows', () => {
    it('should generate correct row structure', () => {
      const p2sOutputsByDU = new Map<string, P2SDuData>([
        ['du_1', {
          p2s_1_output: createMockP2S1Output(),
          p2s_2_output: createMockP2S2Output(),
          p2s_3_output: createMockP2S3Output(),
          p2s_3_mermaid_syntax: 'graph TD; A-->B;'
        }]
      ]);

      const summaryData = transformP2SDataToSummary('transcript1', p2sOutputsByDU);
      const rows = generateTableRows(summaryData);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].duDisplay).toBeDefined();
      expect(rows[0].isuDisplay).toBeDefined();
      expect(rows[0].networkDiagram).toBeDefined();
      expect(rows[0].duDisplay?.rowSpan).toBe(1);
    });

    it('should handle ISUs with no utterances', () => {
      const p2sOutputsByDU = new Map<string, P2SDuData>([
        ['du_1', {
          p2s_2_output: {
            ...createMockP2S2Output(),
            specific_synchronic_units_hierarchy: [
              {
                unit_name: 'ISU-1',
                level: 1,
                abstraction_op: 'generalization',
                intensional_definition: 'Test definition',
                extensional_definition: 'Test extension',
                constituent_lower_units: [],
                segments: [] // No segments
              }
            ]
          },
        }]
      ]);

      const summaryData = transformP2SDataToSummary('transcript1', p2sOutputsByDU);
      const rows = generateTableRows(summaryData);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].utterance.text).toBe('No utterances');
    });
  });
});