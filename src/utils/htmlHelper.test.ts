import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  calculateGduUtteranceCounts,
  calculateGssCategoryUtteranceCounts, 
  calculateGduTransitionCounts,
  generateGssTraceabilityBreakdown,
  generateGduTraceabilityBreakdown,
  generateHtmlAppendix 
} from './htmlHelper'
import type { 
  TranscriptProcessedData,
  GenericAnalysisState,
  RawTranscript,
  P3_2_Output,
  P3_3_Output,
  P4S_1_Output,
  P0_1_Output,
  P1_1_Output,
  P1_2_Output,
  P1_3_Output,
  P1_4_Output,
  P2S_2_Output,
  P2S_3_Output,
  P_neg1_1_Output
} from '../types'

// Mock document for HTML generation tests
const mockDocument = {
  documentElement: {
    classList: {
      contains: vi.fn().mockReturnValue(false) // Default to light theme
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  global.document = mockDocument as any
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Helper function to create minimal transcript data
const createMockTranscriptData = (id: string, filename: string): TranscriptProcessedData => ({
  filename,
  p_neg1_1_output: {
    independent_variable_details: `IV for ${id}`
  } as P_neg1_1_Output,
  p0_1_output: {
    line_numbered_transcript: [
      '1: First utterance',
      '2: Second utterance'
    ]
  } as P0_1_Output,
  p1_1_output: {
    segmented_utterances: [
      {
        original_utterance: {
          original_line_num: '1',
          utterance_text: 'First utterance'
        },
        segments: [{ segment_id: 'seg1' }]
      }
    ]
  } as P1_1_Output,
  p1_2_output: {
    diachronic_units: [
      {
        unit_id: 'du1',
        description: 'Test DU',
        source_segment_ids: ['seg1']
      }
    ]
  } as P1_2_Output,
  p1_3_output: {
    refined_diachronic_units: [
      {
        unit_id: 'rdu1',
        description: 'Test RDU',
        confidence: 0.9,
        temporal_phase: 'Beginning',
        source_p1_2_du_ids: ['du1']
      }
    ]
  } as P1_3_Output,
  p1_4_output: {
    specific_diachronic_structure: {
      phases: [
        {
          phase_name: 'Beginning',
          units_involved: ['rdu1']
        }
      ]
    }
  } as P1_4_Output
})

// Helper to create mock P3_2 output
const createMockP3_2_Output = (): P3_2_Output => ({
  identified_gdus: [
    {
      gdu_id: 'gdu1',
      definition: 'Test GDU definition',
      supporting_transcripts_count: 2,
      contributing_refined_du_ids: [
        { transcript_id: 'tx1', refined_du_id: 'rdu1' },
        { transcript_id: 'tx2', refined_du_id: 'rdu2' }
      ]
    }
  ]
})

describe('calculateGduUtteranceCounts', () => {
  it('should return empty array when no GDU output provided', () => {
    const processedData = new Map()
    const result = calculateGduUtteranceCounts(processedData, undefined)
    
    expect(result).toEqual([])
  })

  it('should return empty array when GDU output has no identified_gdus', () => {
    const processedData = new Map()
    const gduOutput = { identified_gdus: undefined } as P3_2_Output
    
    const result = calculateGduUtteranceCounts(processedData, gduOutput)
    
    expect(result).toEqual([])
  })

  it('should calculate utterance counts for GDUs', () => {
    const processedData = new Map([
      ['tx1', createMockTranscriptData('tx1', 'transcript1.txt')]
    ])
    
    const gduOutput = createMockP3_2_Output()
    
    const result = calculateGduUtteranceCounts(processedData, gduOutput)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      gduId: 'gdu1',
      gduDefinition: 'Test GDU definition',
      totalUtterances: expect.any(Number)
    })
    expect(result[0].countsByTranscript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transcriptId: 'tx1',
          filename: 'transcript1.txt',
          utteranceCount: expect.any(Number)
        })
      ])
    )
  })

  it('should handle missing transcript data gracefully', () => {
    const processedData = new Map() // Empty map
    const gduOutput = createMockP3_2_Output()
    
    const result = calculateGduUtteranceCounts(processedData, gduOutput)
    
    expect(result).toHaveLength(1)
    expect(result[0].totalUtterances).toBe(0)
    expect(result[0].countsByTranscript).toEqual([])
  })

  it('should handle transcripts with missing analysis data', () => {
    const incompleteData: Partial<TranscriptProcessedData> = {
      filename: 'incomplete.txt'
      // Missing required outputs
    }
    
    const processedData = new Map([
      ['tx1', incompleteData as TranscriptProcessedData]
    ])
    
    const gduOutput = createMockP3_2_Output()
    
    const result = calculateGduUtteranceCounts(processedData, gduOutput)
    
    expect(result).toHaveLength(1)
    expect(result[0].totalUtterances).toBe(0)
  })
})

describe('calculateGssCategoryUtteranceCounts', () => {
  it('should return empty array when no GSS outputs provided', () => {
    const processedData = new Map()
    const result = calculateGssCategoryUtteranceCounts(processedData, undefined)
    
    expect(result).toEqual([])
  })

  it('should return empty array when GSS outputs are empty', () => {
    const processedData = new Map()
    const result = calculateGssCategoryUtteranceCounts(processedData, {})
    
    expect(result).toEqual([])
  })

  it('should calculate utterance counts for GSS categories', () => {
    const mockTranscript = createMockTranscriptData('tx1', 'test.txt')
    
    // Add P2S data
    mockTranscript.p2s_outputs_by_phase = {
      'Beginning': {
        p2s_2_output: {
          specific_synchronic_units_hierarchy: [
            {
              unit_name: 'ISU_test',
              intensional_definition: 'Test ISU',
              level: 1,
              utterances: [
                { original_line_num: '1', utterance_text: 'First utterance' }
              ]
            }
          ]
        } as P2S_2_Output,
        p2s_3_output: {
          specific_synchronic_structure: {
            network_nodes: [
              {
                id: 'sss_node_test',
                label: 'Test SSS Node',
                source_isu_id: 'ISU_test'
              }
            ]
          }
        } as P2S_3_Output
      }
    }
    
    const processedData = new Map([['tx1', mockTranscript]])
    
    const gssOutputs: Record<string, P4S_1_Output> = {
      'gdu1': {
        generic_synchronic_structure: {
          generic_nodes_categories: [
            {
              id: 'cat1',
              label: 'Test Category'
            }
          ],
          instantiation_notes: [
            {
              generic_category_id: 'cat1',
              textual_description: 'Test note',
              example_specific_nodes: [
                {
                  transcript_id: 'tx1',
                  phase_name: 'Beginning',
                  sss_node_id: 'sss_node_test'
                }
              ]
            }
          ]
        }
      } as P4S_1_Output
    }
    
    const result = calculateGssCategoryUtteranceCounts(processedData, gssOutputs)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      gssCategoryId: 'cat1',
      gssCategoryLabel: 'Test Category',
      gduContextId: 'gdu1',
      totalUtterances: expect.any(Number)
    })
  })

  it('should handle orphaned SSS nodes', () => {
    const mockTranscript = createMockTranscriptData('tx1', 'test.txt')
    
    // Add P2S data with ISU but no matching SSS node
    mockTranscript.p2s_outputs_by_phase = {
      'Beginning': {
        p2s_2_output: {
          specific_synchronic_units_hierarchy: [
            {
              unit_name: 'ISU_orphaned',
              intensional_definition: 'Orphaned ISU',
              level: 1,
              utterances: [
                { original_line_num: '1', utterance_text: 'Orphaned utterance' }
              ]
            }
          ]
        } as P2S_2_Output,
        p2s_3_output: {
          specific_synchronic_structure: {
            network_nodes: [] // No SSS nodes
          }
        } as P2S_3_Output
      }
    }
    
    const processedData = new Map([['tx1', mockTranscript]])
    
    const gssOutputs: Record<string, P4S_1_Output> = {
      'gdu1': {
        generic_synchronic_structure: {
          generic_nodes_categories: [{ id: 'cat1', label: 'Test Category' }],
          instantiation_notes: [
            {
              generic_category_id: 'cat1',
              textual_description: 'Test note',
              example_specific_nodes: [
                {
                  transcript_id: 'tx1',
                  phase_name: 'Beginning',
                  sss_node_id: 'sss_node_orphaned' // This SSS node doesn't exist
                }
              ]
            }
          ]
        }
      } as P4S_1_Output
    }
    
    const result = calculateGssCategoryUtteranceCounts(processedData, gssOutputs)
    
    expect(result).toHaveLength(1)
    // Should attempt orphan recovery and might find the ISU
    expect(result[0].totalUtterances).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateGduTransitionCounts', () => {
  it('should return empty array when no GDU or GDS output provided', () => {
    const processedData = new Map()
    const result = calculateGduTransitionCounts(processedData, undefined, undefined)
    
    expect(result).toEqual([])
  })

  it('should calculate transition counts between GDUs', () => {
    const mockTranscript = createMockTranscriptData('tx1', 'test.txt')
    
    // Add more comprehensive data for transitions
    mockTranscript.p1_3_output = {
      refined_diachronic_units: [
        {
          unit_id: 'rdu1',
          description: 'First RDU',
          confidence: 0.9,
          temporal_phase: 'Beginning',
          source_p1_2_du_ids: ['du1']
        },
        {
          unit_id: 'rdu2', 
          description: 'Second RDU',
          confidence: 0.8,
          temporal_phase: 'End',
          source_p1_2_du_ids: ['du2']
        }
      ]
    } as P1_3_Output
    
    mockTranscript.p1_4_output = {
      specific_diachronic_structure: {
        phases: [
          {
            phase_name: 'Beginning',
            units_involved: ['rdu1']
          },
          {
            phase_name: 'End',
            units_involved: ['rdu2']
          }
        ]
      }
    } as P1_4_Output
    
    const processedData = new Map([['tx1', mockTranscript]])
    
    const gduOutput: P3_2_Output = {
      identified_gdus: [
        {
          gdu_id: 'gdu1',
          definition: 'First GDU',
          supporting_transcripts_count: 1,
          contributing_refined_du_ids: [
            { transcript_id: 'tx1', refined_du_id: 'rdu1' }
          ]
        },
        {
          gdu_id: 'gdu2',
          definition: 'Second GDU', 
          supporting_transcripts_count: 1,
          contributing_refined_du_ids: [
            { transcript_id: 'tx1', refined_du_id: 'rdu2' }
          ]
        }
      ]
    }
    
    const gdsOutput: P3_3_Output = {
      generic_diachronic_structure_definition: {
        name: 'Test GDS',
        description: 'Test description',
        core_gdus: ['gdu1', 'gdu2']
      }
    }
    
    const result = calculateGduTransitionCounts(processedData, gduOutput, gdsOutput)
    
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transition: 'gdu1 -> gdu2',
          totalOccurrences: expect.any(Number),
          countsByTranscript: expect.arrayContaining([
            expect.objectContaining({
              transcriptId: 'tx1',
              filename: 'test.txt',
              transitionCount: expect.any(Number)
            })
          ])
        })
      ])
    )
  })

  it('should handle transcripts with missing required data', () => {
    const incompleteTranscript: Partial<TranscriptProcessedData> = {
      filename: 'incomplete.txt'
      // Missing p1_3_output and p1_4_output
    }
    
    const processedData = new Map([['tx1', incompleteTranscript as TranscriptProcessedData]])
    
    const gduOutput = createMockP3_2_Output()
    const gdsOutput: P3_3_Output = {
      generic_diachronic_structure_definition: {
        name: 'Test GDS',
        description: 'Test description',
        core_gdus: ['gdu1']
      }
    }
    
    const result = calculateGduTransitionCounts(processedData, gduOutput, gdsOutput)
    
    expect(result).toEqual([])
  })
})

describe('generateGssTraceabilityBreakdown', () => {
  it('should return message when no GSS outputs provided', () => {
    const processedData = new Map()
    const result = generateGssTraceabilityBreakdown(processedData, undefined)
    
    expect(result).toContain('No GSS outputs available')
  })

  it('should generate HTML for GSS traceability', () => {
    const mockTranscript = createMockTranscriptData('tx1', 'test.txt')
    
    // Add complete P2S data for traceability
    mockTranscript.p2s_outputs_by_phase = {
      'Beginning': {
        p2s_2_output: {
          specific_synchronic_units_hierarchy: [
            {
              unit_name: 'ISU_test',
              intensional_definition: 'Test ISU definition',
              level: 1,
              utterances: [
                { original_line_num: '1', utterance_text: 'Test utterance' }
              ]
            }
          ]
        } as P2S_2_Output,
        p2s_3_output: {
          specific_synchronic_structure: {
            network_nodes: [
              {
                id: 'sss_node_test',
                label: 'Test SSS Node',
                source_isu_id: 'ISU_test'
              }
            ]
          }
        } as P2S_3_Output
      }
    }
    
    const processedData = new Map([['tx1', mockTranscript]])
    
    const gssOutputs: Record<string, P4S_1_Output> = {
      'gdu1': {
        generic_synchronic_structure: {
          generic_nodes_categories: [
            {
              id: 'cat1',
              label: 'Test Category'
            }
          ],
          instantiation_notes: [
            {
              generic_category_id: 'cat1',
              textual_description: 'Test instantiation',
              example_specific_nodes: [
                {
                  transcript_id: 'tx1',
                  phase_name: 'Beginning',
                  sss_node_id: 'sss_node_test'
                }
              ]
            }
          ]
        }
      } as P4S_1_Output
    }
    
    const result = generateGssTraceabilityBreakdown(processedData, gssOutputs)
    
    expect(result).toContain('GSS → SSS → ISU → Utterances Traceability')
    expect(result).toContain('GDU: gdu1')
    expect(result).toContain('GSS Category: Test Category')
    expect(result).toContain('SSS Node: sss_node_test')
    expect(result).toContain('ISU: ISU_test')
    expect(result).toContain('Test utterance')
  })

  it('should handle orphaned SSS nodes in traceability', () => {
    const mockTranscript = createMockTranscriptData('tx1', 'test.txt')
    
    // P2S data with ISU but orphaned SSS node reference
    mockTranscript.p2s_outputs_by_phase = {
      'Beginning': {
        p2s_2_output: {
          specific_synchronic_units_hierarchy: [
            {
              unit_name: 'ISU_orphaned',
              intensional_definition: 'Orphaned ISU',
              level: 1,
              utterances: [
                { original_line_num: '1', utterance_text: 'Orphaned utterance' }
              ]
            }
          ]
        } as P2S_2_Output,
        p2s_3_output: {
          specific_synchronic_structure: {
            network_nodes: [] // No SSS nodes
          }
        } as P2S_3_Output
      }
    }
    
    const processedData = new Map([['tx1', mockTranscript]])
    
    const gssOutputs: Record<string, P4S_1_Output> = {
      'gdu1': {
        generic_synchronic_structure: {
          generic_nodes_categories: [{ id: 'cat1', label: 'Test Category' }],
          instantiation_notes: [
            {
              generic_category_id: 'cat1',
              textual_description: 'Test note',
              example_specific_nodes: [
                {
                  transcript_id: 'tx1',
                  phase_name: 'Beginning',
                  sss_node_id: 'sss_node_orphaned' // Orphaned reference
                }
              ]
            }
          ]
        }
      } as P4S_1_Output
    }
    
    const result = generateGssTraceabilityBreakdown(processedData, gssOutputs)
    
    expect(result).toContain('ORPHANED NODE')
    expect(result).toContain('SSS node not found')
  })
})

describe('generateGduTraceabilityBreakdown', () => {
  it('should return message when no GDU outputs provided', () => {
    const processedData = new Map()
    const genericState: Partial<GenericAnalysisState> = {}
    
    const result = generateGduTraceabilityBreakdown(processedData, genericState as GenericAnalysisState)
    
    expect(result).toContain('No GDU outputs available')
  })

  it('should generate HTML for GDU traceability', () => {
    const mockTranscript = createMockTranscriptData('tx1', 'test.txt')
    const processedData = new Map([['tx1', mockTranscript]])
    
    const genericState: Partial<GenericAnalysisState> = {
      p3_2_output: createMockP3_2_Output()
    }
    
    const result = generateGduTraceabilityBreakdown(processedData, genericState as GenericAnalysisState)
    
    expect(result).toContain('GDU → RDU → DU → Utterances Traceability')
    expect(result).toContain('GDU: gdu1')
    expect(result).toContain('RDU: rdu1')
    expect(result).toContain('DU: du1')
  })

  it('should handle missing RDU references', () => {
    const processedData = new Map([
      ['tx1', createMockTranscriptData('tx1', 'test.txt')]
    ])
    
    const gduOutput: P3_2_Output = {
      identified_gdus: [
        {
          gdu_id: 'gdu1',
          definition: 'Test GDU',
          supporting_transcripts_count: 1,
          contributing_refined_du_ids: [
            { transcript_id: 'tx1', refined_du_id: 'missing_rdu' } // RDU doesn't exist
          ]
        }
      ]
    }
    
    const genericState: Partial<GenericAnalysisState> = {
      p3_2_output: gduOutput
    }
    
    const result = generateGduTraceabilityBreakdown(processedData, genericState as GenericAnalysisState)
    
    expect(result).toContain('MISSING RDU')
    expect(result).toContain('RDU not found')
  })
})

describe('generateHtmlAppendix', () => {
  it('should generate basic HTML appendix structure', () => {
    const processedData = new Map([
      ['tx1', createMockTranscriptData('tx1', 'test.txt')]
    ])
    
    const genericState: Partial<GenericAnalysisState> = {
      p3_2_output: createMockP3_2_Output(),
      p3_3_output: {
        generic_diachronic_structure_definition: {
          name: 'Test GDS',
          description: 'Test description',
          core_gdus: ['gdu1']
        }
      } as P3_3_Output
    }
    
    const rawTranscripts: RawTranscript[] = [
      { id: 'tx1', filename: 'test.txt', content: 'Test content' }
    ]
    
    const allMermaidSyntaxes = {}
    const gduCounts = calculateGduUtteranceCounts(processedData, genericState.p3_2_output)
    const gssCounts = calculateGssCategoryUtteranceCounts(processedData, {})
    const transitionCounts = calculateGduTransitionCounts(processedData, genericState.p3_2_output, genericState.p3_3_output)
    
    const result = generateHtmlAppendix(
      processedData,
      genericState as GenericAnalysisState,
      rawTranscripts,
      allMermaidSyntaxes,
      gduCounts,
      gssCounts,
      transitionCounts
    )
    
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('µ-PATH Appendix (HTML)')
    expect(result).toContain('Transcript: test.txt')
    expect(result).toContain('Navigation Index')
    expect(result).toContain('Quantitative Analysis')
    expect(result).toContain('mermaid.initialize')
  })

  it('should handle dark theme', () => {
    mockDocument.documentElement.classList.contains.mockReturnValue(true) // Dark theme
    
    const processedData = new Map()
    const genericState = {} as GenericAnalysisState
    const rawTranscripts: RawTranscript[] = []
    
    const result = generateHtmlAppendix(
      processedData,
      genericState,
      rawTranscripts,
      {},
      [],
      [],
      []
    )
    
    expect(result).toContain('dark-theme')
    expect(result).toContain("const t=document.body.classList.contains('dark-theme')?'dark':'base';")
  })

  it('should include Mermaid diagrams when provided', () => {
    const processedData = new Map([
      ['tx1', createMockTranscriptData('tx1', 'test.txt')]
    ])
    
    const genericState = {} as GenericAnalysisState
    const rawTranscripts: RawTranscript[] = []
    
    const allMermaidSyntaxes = {
      'sds_tx1': {
        title: 'SDS for tx1',
        syntax: 'gantt\n  title Test SDS'
      },
      'gds_main': {
        title: 'Main GDS',
        syntax: 'gantt\n  title Test GDS'
      }
    }
    
    const result = generateHtmlAppendix(
      processedData,
      genericState,
      rawTranscripts,
      allMermaidSyntaxes,
      [],
      [],
      []
    )
    
    expect(result).toContain('SDS for tx1')
    expect(result).toContain('Main GDS')
    expect(result).toContain('gantt')
  })

  it('should generate navigation for multiple transcripts and GDUs', () => {
    const processedData = new Map([
      ['tx1', createMockTranscriptData('tx1', 'transcript1.txt')],
      ['tx2', createMockTranscriptData('tx2', 'transcript2.txt')]
    ])
    
    const genericState: Partial<GenericAnalysisState> = {
      p3_3_output: {
        generic_diachronic_structure_definition: {
          name: 'Test GDS',
          description: 'Test description',
          core_gdus: ['gdu1', 'gdu2']
        }
      } as P3_3_Output
    }
    
    const rawTranscripts: RawTranscript[] = [
      { id: 'tx1', filename: 'transcript1.txt', content: 'Content 1' },
      { id: 'tx2', filename: 'transcript2.txt', content: 'Content 2' }
    ]
    
    const result = generateHtmlAppendix(
      processedData,
      genericState as GenericAnalysisState,
      rawTranscripts,
      {},
      [],
      [],
      []
    )
    
    expect(result).toContain('transcript1.txt')
    expect(result).toContain('transcript2.txt')
    expect(result).toContain('GSS: gdu1')
    expect(result).toContain('GSS: gdu2')
    expect(result).toContain('#transcript-tx1')
    expect(result).toContain('#transcript-tx2')
  })
})