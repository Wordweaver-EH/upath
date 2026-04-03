import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enableMapSet } from 'immer'
import { 
  StepId, 
  RawTranscript, 
  TranscriptProcessedData,
  P1_1_Output,
  P1_4_Output,
  P2S_1_Output,
  P2S_2_Output,
  P2S_3_Output,
  SegmentedUtteranceSegment,
  P2SDuData
} from '../../../../../types'
import { P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG } from '../P2S_1_groupUtterancesByTopic'
import { P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG } from '../P2S_2_identifySpecificSynchronicUnits'
import { P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG } from '../P2S_3_defineSpecificSynchronicStructure'

// Enable Immer MapSet plugin
enableMapSet()

describe('Part 2 - Specific Synchronic Analysis (P2S)', () => {
  let mockTranscript: RawTranscript
  let mockProcessedData: Map<string, TranscriptProcessedData>
  let mockP1_1Output: P1_1_Output
  let mockP1_4Output: P1_4_Output

  beforeEach(() => {
    // Setup mock transcript
    mockTranscript = {
      id: 'transcript-123',
      name: 'Test Interview',
      content: 'Test content',
      createdAt: new Date().toISOString()
    }

    // Setup mock P1.1 output with segments
    const mockSegments: SegmentedUtteranceSegment[] = [
      {
        segment_id: 'seg_1',
        segment_text: 'I felt anxious',
        temporal_cues: []
      },
      {
        segment_id: 'seg_2',
        segment_text: 'My hands were shaking',
        temporal_cues: []
      },
      {
        segment_id: 'seg_3',
        segment_text: 'I took deep breaths',
        temporal_cues: ['then']
      },
      {
        segment_id: 'seg_4',
        segment_text: 'I felt calm afterwards',
        temporal_cues: ['afterwards']
      },
      {
        segment_id: 'seg_5',
        segment_text: 'The situation improved',
        temporal_cues: []
      }
    ]

    mockP1_1Output = {
      transcript_id: 'transcript-123',
      segmented_utterances: [
        {
          original_utterance: {
            original_line_num: '1',
            speaker: 'S',
            utterance_text: 'I felt anxious and my hands were shaking',
            selection_justification: 'Describes initial experience',
            included: true
          },
          segments: [mockSegments[0], mockSegments[1]]
        },
        {
          original_utterance: {
            original_line_num: '2',
            speaker: 'S',
            utterance_text: 'I took deep breaths',
            selection_justification: 'Coping strategy',
            included: true
          },
          segments: [mockSegments[2]]
        },
        {
          original_utterance: {
            original_line_num: '3',
            speaker: 'S',
            utterance_text: 'I felt calm afterwards and the situation improved',
            selection_justification: 'Resolution',
            included: true
          },
          segments: [mockSegments[3], mockSegments[4]]
        }
      ],
      independent_variable_details: 'Stressful presentation',
      dependent_variable_focus: ['anxiety', 'coping']
    }

    // Setup mock P1.4 output with DUs
    mockP1_4Output = {
      transcript_id: 'transcript-123',
      diachronic_units: [
        {
          unit_id: 'du_1',
          name: 'Initial anxiety',
          description: 'Experience of anxiety and physical symptoms',
          source_segment_ids: ['seg_1', 'seg_2']
        },
        {
          unit_id: 'du_2',
          name: 'Coping strategy',
          description: 'Breathing technique used',
          source_segment_ids: ['seg_3']
        },
        {
          unit_id: 'du_3',
          name: 'Resolution',
          description: 'Calm state and improved situation',
          source_segment_ids: ['seg_4', 'seg_5']
        }
      ],
      independent_variable_details: 'Stressful presentation',
      dependent_variable_focus: ['anxiety', 'coping']
    }

    // Setup processed data map
    mockProcessedData = new Map()
    mockProcessedData.set('transcript-123', {
      p1_1_output: mockP1_1Output,
      p1_4_output: mockP1_4Output,
      dus_for_p2s_processing: ['du_1', 'du_2', 'du_3'],
      current_du_for_p2s_processing: 'du_1',
      processed_dus_for_p2s: [],
      p2s_outputs_by_du: {},
      isFullyProcessedSpecificSynchronic: false
    } as TranscriptProcessedData)
  })

  describe('P2S.1 - Group Utterances by Topic', () => {
    it('should validate required inputs', () => {
      // Test missing transcript ID
      const result1 = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        null,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result1.error).toBe('Missing current transcript ID or DU ID for P2S.1.')

      // Test missing DU ID
      const result2 = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        mockTranscript,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        undefined
      )
      expect(result2.error).toBe('Missing current transcript ID or DU ID for P2S.1.')
    })

    it('should handle missing P1.4 output', () => {
      const incompleteData = new Map()
      incompleteData.set('transcript-123', {
        p1_1_output: mockP1_1Output
      } as TranscriptProcessedData)

      const result = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        mockTranscript,
        incompleteData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result.error).toBe('Missing P1.4 output for transcript transcript-123')
    })

    it('should handle non-existent DU', () => {
      const result = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        mockTranscript,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_999' // Non-existent DU
      )
      expect(result.error).toBe('DU du_999 not found in P1.4 output for transcript transcript-123')
    })

    it('should collect segments for valid DU', () => {
      const result = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        mockTranscript,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      
      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data.transcript_id).toBe('transcript-123')
      expect(result.data.analyzed_du_id).toBe('du_1')
      expect(result.data.segments_for_du_analysis).toHaveLength(2)
      expect(result.data.segments_for_du_analysis[0].segment_id).toBe('seg_1')
      expect(result.data.segments_for_du_analysis[1].segment_id).toBe('seg_2')
    })

    it('should handle DU with no mapped segments', () => {
      // Create a DU with segment IDs that don't exist in P1.1
      const modifiedP1_4 = {
        ...mockP1_4Output,
        diachronic_units: [{
          unit_id: 'du_empty',
          name: 'Empty DU',
          description: 'DU with no segments',
          source_segment_ids: ['seg_999', 'seg_1000'] // Non-existent segments
        }]
      }
      
      const modifiedData = new Map()
      modifiedData.set('transcript-123', {
        p1_1_output: mockP1_1Output,
        p1_4_output: modifiedP1_4,
        dus_for_p2s_processing: ['du_empty'],
        current_du_for_p2s_processing: 'du_empty',
        p2s_outputs_by_du: {}
      } as TranscriptProcessedData)

      const result = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        mockTranscript,
        modifiedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_empty'
      )
      
      expect(result.error).toBe("No segments could be mapped to DU 'du_empty' for P2S.1.")
    })
  })

  describe('P2S.2 - Identify Specific Synchronic Units', () => {
    let mockP2S_1Output: P2S_1_Output

    beforeEach(() => {
      // Setup mock P2S.1 output
      mockP2S_1Output = {
        transcript_id: 'transcript-123',
        analyzed_du_id: 'du_1',
        synchronic_thematic_groups: [
          {
            theme: 'Physical anxiety symptoms',
            segment_ids: ['seg_1', 'seg_2'],
            reasoning: 'Both segments describe anxiety manifestations'
          }
        ]
      }

      // Add P2S.1 output to processed data
      const transcriptData = mockProcessedData.get('transcript-123')!
      transcriptData.p2s_outputs_by_du = {
        du_1: {
          p2s_1_output: mockP2S_1Output
        }
      }
    })

    it('should validate required inputs', () => {
      // Test missing transcript ID
      const result1 = P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG.getInput(
        null,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result1.error).toBe('Missing current transcript ID or DU ID for P2S.2.')
    })

    it('should handle missing P2S.1 output', () => {
      const incompleteData = new Map()
      incompleteData.set('transcript-123', {
        p2s_outputs_by_du: {} // Empty P2S outputs
      } as TranscriptProcessedData)

      const result = P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG.getInput(
        mockTranscript,
        incompleteData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result.error).toBe("Missing P2S.1 output for DU 'du_1' for transcript transcript-123")
    })

    it('should validate P2S.1 output structure', () => {
      // Create invalid P2S.1 output (missing synchronic_thematic_groups)
      const invalidData = new Map()
      invalidData.set('transcript-123', {
        p2s_outputs_by_du: {
          du_1: {
            p2s_1_output: {
              transcript_id: 'transcript-123',
              analyzed_du_id: 'du_1'
              // Missing synchronic_thematic_groups
            }
          }
        }
      } as TranscriptProcessedData)

      const result = P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG.getInput(
        mockTranscript,
        invalidData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result.error).toBe("Invalid P2S.1 output structure: missing or invalid synchronic_thematic_groups for DU 'du_1'")
    })

    it('should pass valid P2S.1 output', () => {
      const result = P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG.getInput(
        mockTranscript,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      
      expect(result.error).toBeUndefined()
      expect(result.data).toBe(mockP2S_1Output)
    })

    it('should handle empty thematic groups with warning', () => {
      // Create P2S.1 output with empty groups
      const emptyGroupsData = new Map()
      emptyGroupsData.set('transcript-123', {
        p2s_outputs_by_du: {
          du_1: {
            p2s_1_output: {
              transcript_id: 'transcript-123',
              analyzed_du_id: 'du_1',
              synchronic_thematic_groups: [] // Empty array
            }
          }
        }
      } as TranscriptProcessedData)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const result = P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG.getInput(
        mockTranscript,
        emptyGroupsData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      
      expect(result.error).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith(
        "[P2S_2 Debug] Empty synchronic_thematic_groups for DU 'du_1' - this may indicate no segments were found for this DU"
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('P2S.3 - Define Specific Synchronic Structure', () => {
    let mockP2S_2Output: P2S_2_Output

    beforeEach(() => {
      // Setup mock P2S.2 output
      mockP2S_2Output = {
        transcript_id: 'transcript-123',
        analyzed_du_id: 'du_1',
        specific_synchronic_units_hierarchy: [
          {
            unit_name: 'ISU_1_AnxietyExperience',
            level: 1,
            description: 'Overall anxiety experience',
            abstraction_operation: 'generalization',
            source_segments: ['seg_1', 'seg_2']
          }
        ]
      }

      // Add P2S.2 output to processed data
      const transcriptData = mockProcessedData.get('transcript-123')!
      transcriptData.p2s_outputs_by_du = {
        du_1: {
          p2s_1_output: {} as P2S_1_Output,
          p2s_2_output: mockP2S_2Output
        }
      }
    })

    it('should validate all required inputs', () => {
      // Test missing transcript ID
      const result1 = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        null,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result1.error).toBe('Missing current transcript ID for P2S.3')

      // Test missing DU ID
      const result2 = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        mockTranscript,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        undefined
      )
      expect(result2.error).toBe('Missing current DU ID for P2S.3')

      // Test missing processed data
      const result3 = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        mockTranscript,
        null,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result3.error).toBe('Missing processed data for P2S.3')
    })

    it('should handle missing transcript data', () => {
      const emptyData = new Map()
      
      const result = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        mockTranscript,
        emptyData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result.error).toBe('No processed data found for transcript transcript-123')
    })

    it('should handle missing P2S.2 output', () => {
      const incompleteData = new Map()
      incompleteData.set('transcript-123', {
        p2s_outputs_by_du: {
          du_1: {
            p2s_1_output: {} as P2S_1_Output
            // Missing p2s_2_output
          }
        }
      } as TranscriptProcessedData)

      const result = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        mockTranscript,
        incompleteData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result.error).toBe('P2S.2 output not found for DU "du_1" in P2S.3')
    })

    it('should validate P2S.2 output structure', () => {
      const invalidData = new Map()
      invalidData.set('transcript-123', {
        p2s_outputs_by_du: {
          du_1: {
            p2s_2_output: {
              transcript_id: 'transcript-123',
              analyzed_du_id: 'du_1'
              // Missing specific_synchronic_units_hierarchy
            }
          }
        }
      } as TranscriptProcessedData)

      const result = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        mockTranscript,
        invalidData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      expect(result.error).toBe("Invalid P2S.2 output structure: missing or invalid specific_synchronic_units_hierarchy for DU 'du_1'")
    })

    it('should pass valid P2S.2 output', () => {
      const result = P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG.getInput(
        mockTranscript,
        mockProcessedData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      
      expect(result.error).toBeUndefined()
      expect(result.data).toBe(mockP2S_2Output)
    })
  })

  describe('P2S Pipeline Integration', () => {
    it('should process multiple DUs sequentially', () => {
      // Test that the pipeline can handle all DUs for a transcript
      const dus = ['du_1', 'du_2', 'du_3']
      
      dus.forEach(duId => {
        // Verify each DU can be processed through P2S.1
        const result = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
          mockTranscript,
          mockProcessedData,
          {} as any,
          true,
          { dv_focus: ['anxiety'] },
          [],
          duId
        )
        
        expect(result.error).toBeUndefined()
        expect(result.data?.analyzed_du_id).toBe(duId)
      })
    })

    it('should maintain DU state tracking', () => {
      const transcriptData = mockProcessedData.get('transcript-123')!
      
      // Initial state
      expect(transcriptData.current_du_for_p2s_processing).toBe('du_1')
      expect(transcriptData.processed_dus_for_p2s).toEqual([])
      expect(transcriptData.isFullyProcessedSpecificSynchronic).toBe(false)
      
      // Simulate processing du_1
      transcriptData.processed_dus_for_p2s = ['du_1']
      transcriptData.current_du_for_p2s_processing = 'du_2'
      
      // Verify state update
      expect(transcriptData.current_du_for_p2s_processing).toBe('du_2')
      expect(transcriptData.processed_dus_for_p2s).toContain('du_1')
      
      // Simulate completing all DUs
      transcriptData.processed_dus_for_p2s = ['du_1', 'du_2', 'du_3']
      transcriptData.isFullyProcessedSpecificSynchronic = true
      
      expect(transcriptData.isFullyProcessedSpecificSynchronic).toBe(true)
    })

    it('should handle P2S outputs by DU structure', () => {
      const transcriptData = mockProcessedData.get('transcript-123')!
      
      // Simulate adding P2S outputs for multiple DUs
      const p2sOutputs: Record<string, P2SDuData> = {
        du_1: {
          p2s_1_output: { analyzed_du_id: 'du_1' } as P2S_1_Output,
          p2s_2_output: { analyzed_du_id: 'du_1' } as P2S_2_Output,
          p2s_3_output: { analyzed_du_id: 'du_1' } as P2S_3_Output
        },
        du_2: {
          p2s_1_output: { analyzed_du_id: 'du_2' } as P2S_1_Output
        }
      }
      
      transcriptData.p2s_outputs_by_du = p2sOutputs
      
      // Verify structure
      expect(transcriptData.p2s_outputs_by_du['du_1']).toBeDefined()
      expect(transcriptData.p2s_outputs_by_du['du_1'].p2s_1_output?.analyzed_du_id).toBe('du_1')
      expect(transcriptData.p2s_outputs_by_du['du_2']).toBeDefined()
      expect(transcriptData.p2s_outputs_by_du['du_3']).toBeUndefined()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle transcript with no DUs', () => {
      const noDuData = new Map()
      noDuData.set('transcript-123', {
        p1_1_output: mockP1_1Output,
        p1_4_output: {
          ...mockP1_4Output,
          diachronic_units: [] // No DUs
        },
        dus_for_p2s_processing: [],
        p2s_outputs_by_du: {}
      } as TranscriptProcessedData)

      const result = P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
        mockTranscript,
        noDuData,
        {} as any,
        true,
        { dv_focus: ['anxiety'] },
        [],
        'du_1'
      )
      
      expect(result.error).toBe('DU du_1 not found in P1.4 output for transcript transcript-123')
    })

    it('should handle malformed segment data gracefully', () => {
      const malformedData = new Map()
      malformedData.set('transcript-123', {
        p1_1_output: {
          transcript_id: 'transcript-123',
          segmented_utterances: [
            {
              original_utterance: {
                original_line_num: '1',
                speaker: 'S',
                utterance_text: 'Test',
                selection_justification: 'Test',
                included: true
              },
              segments: null as any // Malformed segments
            }
          ]
        },
        p1_4_output: mockP1_4Output,
        dus_for_p2s_processing: ['du_1'],
        p2s_outputs_by_du: {}
      } as TranscriptProcessedData)

      // Should handle gracefully without throwing
      expect(() => {
        P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG.getInput(
          mockTranscript,
          malformedData,
          {} as any,
          true,
          { dv_focus: ['anxiety'] },
          [],
          'du_1'
        )
      }).not.toThrow()
    })
  })
})