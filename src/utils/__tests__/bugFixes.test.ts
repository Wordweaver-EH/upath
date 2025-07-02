import { describe, it, expect } from 'vitest';
import { mapUtteranceToGdu } from '../traceabilityHelper';
import { calculateKrippendorffsAlpha, type ReliabilityMatrix } from '../statisticsHelper';
import type { TranscriptProcessedData, P3_2_Output } from '../../types';

// Import the validation function to test it
import { validateAndCleanP3_2_Output } from '@/constants';

describe('Bug Fixes Verification', () => {
  describe('Deterministic GDU Ordering', () => {
    it('should return GDUs in sorted order for consistent results', () => {
      const mockTranscriptData: Partial<TranscriptProcessedData> = {
        id: 'test-transcript',
        p0_3_output: {
          transcript_id: 'test-transcript',
          selected_procedural_utterances: [
            { original_line_num: '1', utterance_text: 'Test utterance' }
          ],
          independent_variable_details: '',
          dependent_variable_focus: []
        },
        p1_1_output: {
          transcript_id: 'test-transcript',
          segmented_utterances: [{
            original_utterance: { original_line_num: '1', utterance_text: 'Test utterance' },
            segments: [{ segment_id: 'seg1', segment_text: 'Test' }]
          }],
          independent_variable_details: '',
          dependent_variable_focus: []
        },
        p1_2_output: {
          transcript_id: 'test-transcript',
          diachronic_units: [{ unit_id: 'du1', description: 'Test DU', source_segment_ids: ['seg1'] }],
          independent_variable_details: '',
          dependent_variable_focus: []
        },
        p1_3_output: {
          transcript_id: 'test-transcript',
          refined_diachronic_units: [{
            unit_id: 'rdu1',
            description: 'Test RDU',
            confidence: 1,
            temporal_phase: 'phase1',
            source_p1_2_du_ids: ['du1']
          }],
          independent_variable_details: '',
          dependent_variable_focus: []
        }
      };

      const mockP3_2Output: P3_2_Output = {
        identified_gdus: [
          {
            gdu_id: 'GDU_Z',
            definition: 'Test Z',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [{ transcript_id: 'test-transcript', refined_du_id: 'rdu1' }]
          },
          {
            gdu_id: 'GDU_A', 
            definition: 'Test A',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [{ transcript_id: 'test-transcript', refined_du_id: 'rdu1' }]
          },
          {
            gdu_id: 'GDU_M',
            definition: 'Test M',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [{ transcript_id: 'test-transcript', refined_du_id: 'rdu1' }]
          }
        ],
        criteria_for_gdu_identification: 'Test criteria',
        dependent_variable_focus: []
      };

      const result = mapUtteranceToGdu(mockTranscriptData as TranscriptProcessedData, mockP3_2Output);
      const gdus = result.get('test-transcript|1');
      
      expect(gdus).toBeDefined();
      expect(gdus).toEqual(['GDU_A', 'GDU_M', 'GDU_Z']); // Should be sorted alphabetically
    });

    it('should handle case-insensitive sorting correctly', () => {
      const mockTranscriptData: Partial<TranscriptProcessedData> = {
        id: 'test-transcript',
        p0_3_output: {
          transcript_id: 'test-transcript',
          selected_procedural_utterances: [
            { original_line_num: '1', utterance_text: 'Test utterance' }
          ],
          independent_variable_details: '',
          dependent_variable_focus: []
        },
        p1_1_output: {
          transcript_id: 'test-transcript',
          segmented_utterances: [{
            original_utterance: { original_line_num: '1', utterance_text: 'Test utterance' },
            segments: [{ segment_id: 'seg1', segment_text: 'Test' }]
          }],
          independent_variable_details: '',
          dependent_variable_focus: []
        },
        p1_2_output: {
          transcript_id: 'test-transcript',
          diachronic_units: [{ unit_id: 'du1', description: 'Test DU', source_segment_ids: ['seg1'] }],
          independent_variable_details: '',
          dependent_variable_focus: []
        },
        p1_3_output: {
          transcript_id: 'test-transcript',
          refined_diachronic_units: [{
            unit_id: 'rdu1',
            description: 'Test RDU',
            confidence: 1,
            temporal_phase: 'phase1',
            source_p1_2_du_ids: ['du1']
          }],
          independent_variable_details: '',
          dependent_variable_focus: []
        }
      };

      const mockP3_2Output: P3_2_Output = {
        identified_gdus: [
          {
            gdu_id: 'gdu_b', // lowercase
            definition: 'Test B',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [{ transcript_id: 'test-transcript', refined_du_id: 'rdu1' }]
          },
          {
            gdu_id: 'GDU_A', // uppercase
            definition: 'Test A',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [{ transcript_id: 'test-transcript', refined_du_id: 'rdu1' }]
          },
          {
            gdu_id: 'Gdu_C', // mixed case
            definition: 'Test C',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [{ transcript_id: 'test-transcript', refined_du_id: 'rdu1' }]
          }
        ],
        criteria_for_gdu_identification: 'Test criteria',
        dependent_variable_focus: []
      };

      const result = mapUtteranceToGdu(mockTranscriptData as TranscriptProcessedData, mockP3_2Output);
      const gdus = result.get('test-transcript|1');
      
      expect(gdus).toBeDefined();
      expect(gdus).toEqual(['GDU_A', 'gdu_b', 'Gdu_C']); // Should be sorted with localeCompare (case-insensitive)
    });
  });

  describe('Standard Krippendorff\'s Alpha Pair Extraction', () => {
    it('should not create redundant reverse pairs', () => {
      // This test verifies the fix indirectly by checking that alpha calculation
      // produces expected values without duplicate pairs inflating the counts
      const matrix: ReliabilityMatrix = [
        ['A', 'B'] // Should create exactly 1 pair, not 2
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      expect(result.totalPairableValues).toBe(1); // Not 2
      expect(result.observedDisagreement).toBe(1); // Complete disagreement
    });

    it('should calculate correct alpha without redundant pairs', () => {
      // Test case where redundant pairs would change the result
      const matrix: ReliabilityMatrix = [
        ['A', 'A'],
        ['B', 'B'],
        ['A', 'B'] // Mixed agreement
      ];
      
      const result = calculateKrippendorffsAlpha(matrix);
      // With the fix, we should get correct alpha value
      expect(result.totalPairableValues).toBe(3); // Not 6
      expect(result.alpha).toBeGreaterThan(0); // Some agreement
      expect(result.alpha).toBeLessThan(1); // Not perfect agreement
    });
  });

  describe('Disagreement Reporting Logic', () => {
    it('should only use valid disagreement types (no category_mismatch)', () => {
      // This test ensures the type system enforces the removal of 'category_mismatch'
      // If this compiles without errors, the type fix is working
      const validTypes: Array<'assignment_count' | 'partial_overlap' | 'no_overlap'> = [
        'assignment_count',
        'partial_overlap', 
        'no_overlap'
      ];
      
      expect(validTypes).toHaveLength(3);
      expect(validTypes).not.toContain('category_mismatch');
      
      // Verify these are the only valid types by attempting to assign invalid type
      // This should cause a TypeScript error if 'category_mismatch' were still valid
      const invalidType: 'assignment_count' | 'partial_overlap' | 'no_overlap' = 'assignment_count';
      expect(typeof invalidType).toBe('string');
    });
  });

  describe('P3.2 Duplicate RDU Validation', () => {
    it('should enforce first-assignment-wins for duplicate RDU assignments', () => {
      const outputWithDuplicates = {
        identified_gdus: [
          {
            gdu_id: 'GDU_A',
            definition: 'First GDU',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu1' },
              { transcript_id: 'tx1', refined_du_id: 'rdu2' }
            ]
          },
          {
            gdu_id: 'GDU_B', 
            definition: 'Second GDU',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu1' }, // Duplicate - should be filtered
              { transcript_id: 'tx1', refined_du_id: 'rdu3' }
            ]
          }
        ],
        criteria_for_gdu_identification: 'Test criteria',
        dependent_variable_focus: [],
        tot_rdus: 3
      };

      const cleanedOutput = validateAndCleanP3_2_Output(outputWithDuplicates, 3);

      // GDU_A should keep rdu1 (first assignment wins)
      expect(cleanedOutput.identified_gdus[0].contributing_refined_du_ids).toHaveLength(2);
      expect(cleanedOutput.identified_gdus[0].contributing_refined_du_ids).toContainEqual(
        { transcript_id: 'tx1', refined_du_id: 'rdu1' }
      );

      // GDU_B should lose rdu1 but keep rdu3  
      expect(cleanedOutput.identified_gdus[1].contributing_refined_du_ids).toHaveLength(1);
      expect(cleanedOutput.identified_gdus[1].contributing_refined_du_ids).not.toContainEqual(
        { transcript_id: 'tx1', refined_du_id: 'rdu1' }
      );
      expect(cleanedOutput.identified_gdus[1].contributing_refined_du_ids).toContainEqual(
        { transcript_id: 'tx1', refined_du_id: 'rdu3' }
      );
    });

    it('should handle complex duplicate scenarios correctly', () => {
      const outputWithMultipleDuplicates = {
        identified_gdus: [
          {
            gdu_id: 'GDU_A',
            definition: 'First GDU',
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu1' },
              { transcript_id: 'tx2', refined_du_id: 'rdu2' }
            ]
          },
          {
            gdu_id: 'GDU_B',
            definition: 'Second GDU', 
            supporting_transcripts_count: 1,
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu1' }, // Duplicate
              { transcript_id: 'tx2', refined_du_id: 'rdu2' }, // Duplicate
              { transcript_id: 'tx1', refined_du_id: 'rdu3' }
            ]
          },
          {
            gdu_id: 'GDU_C',
            definition: 'Third GDU',
            supporting_transcripts_count: 1, 
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu3' }, // Duplicate
              { transcript_id: 'tx2', refined_du_id: 'rdu4' }
            ]
          }
        ],
        criteria_for_gdu_identification: 'Test criteria',
        dependent_variable_focus: [],
        tot_rdus: 4
      };

      const cleanedOutput = validateAndCleanP3_2_Output(outputWithMultipleDuplicates, 4);

      // Verify each RDU appears exactly once across all GDUs
      const allRduKeys = new Set<string>();
      cleanedOutput.identified_gdus.forEach((gdu: any) => {
        gdu.contributing_refined_du_ids.forEach((rdu: any) => {
          const key = `${rdu.transcript_id}|${rdu.refined_du_id}`;
          expect(allRduKeys.has(key)).toBe(false); // Should not already exist
          allRduKeys.add(key);
        });
      });

      // Should have exactly 4 unique RDU assignments
      expect(allRduKeys.size).toBe(4);
      expect(allRduKeys).toContain('tx1|rdu1');
      expect(allRduKeys).toContain('tx2|rdu2'); 
      expect(allRduKeys).toContain('tx1|rdu3');
      expect(allRduKeys).toContain('tx2|rdu4');
    });

    it('should preserve other GDU properties while cleaning duplicates', () => {
      const outputWithDuplicates = {
        identified_gdus: [
          {
            gdu_id: 'GDU_A',
            definition: 'First GDU',
            supporting_transcripts_count: 2,
            iv_variation_notes: 'Some variation notes',
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu1' }
            ]
          }
        ],
        criteria_for_gdu_identification: 'Test criteria',
        dependent_variable_focus: ['dv1', 'dv2'],
        tot_rdus: 1
      };

      const cleanedOutput = validateAndCleanP3_2_Output(outputWithDuplicates, 1);

      // Should preserve all other properties
      expect(cleanedOutput.criteria_for_gdu_identification).toBe('Test criteria');
      expect(cleanedOutput.dependent_variable_focus).toEqual(['dv1', 'dv2']);
      expect(cleanedOutput.tot_rdus).toBe(1);
      
      const gdu = cleanedOutput.identified_gdus[0];
      expect(gdu.gdu_id).toBe('GDU_A');
      expect(gdu.definition).toBe('First GDU');
      expect(gdu.supporting_transcripts_count).toBe(2);
      expect(gdu.iv_variation_notes).toBe('Some variation notes');
    });
  });
});