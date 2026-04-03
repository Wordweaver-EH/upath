import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  convertJsonToTsv, 
  downloadFile, 
  generateTsvForP0_1, 
  generateTsvForP0_2, 
  generateTsvForP0_3, 
  generateTsvForPromptHistory, 
  generateTsvForTranscriptDiachronic, 
  generateTsvForTranscriptSynchronic, 
  genericJsonToTsv 
} from './tsvHelper'
import type { 
  P0_1_Output, 
  P0_2_Output, 
  P0_3_Output, 
  PromptHistoryEntry, 
  TranscriptProcessedData,
  RefinedLine,
  SelectedUtterance
} from '../types'

// Mock DOM APIs for downloadFile
const mockCreateElement = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockClick = vi.fn()

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks()
  
  // Mock document
  global.document = {
    createElement: mockCreateElement,
    body: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild,
    },
  } as any
  
  // Mock URL
  global.URL = {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  } as any
  
  // Mock Blob
  global.Blob = vi.fn() as any
  
  // Setup default mock returns
  const mockElement = {
    href: '',
    download: '',
    click: mockClick,
  }
  mockCreateElement.mockReturnValue(mockElement)
  mockCreateObjectURL.mockReturnValue('blob:mock-url')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('convertJsonToTsv', () => {
  it('should convert simple array of objects to TSV', () => {
    const data = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Boston' }
    ]
    const columns = ['name', 'age', 'city']
    const result = convertJsonToTsv(data, columns)
    
    expect(result).toBe('name\tage\tcity\nJohn\t30\tNew York\nJane\t25\tBoston')
  })

  it('should handle empty array', () => {
    const data: any[] = []
    const columns = ['name', 'age']
    const result = convertJsonToTsv(data, columns)
    
    expect(result).toBe('name\tage\n')
  })

  it('should handle null and undefined values', () => {
    const data = [
      { name: 'John', age: null, city: undefined },
      { name: null, age: 25, city: 'Boston' }
    ]
    const columns = ['name', 'age', 'city']
    const result = convertJsonToTsv(data, columns)
    
    expect(result).toBe('name\tage\tcity\nJohn\t\t\n\t25\tBoston')
  })

  it('should escape special characters', () => {
    const data = [
      { text: 'Hello\tworld\nwith\rcarriage' },
      { text: 'Normal text' }
    ]
    const columns = ['text']
    const result = convertJsonToTsv(data, columns)
    
    expect(result).toBe('text\nHello world with carriage\nNormal text')
  })

  it('should handle arrays by joining them', () => {
    const data = [
      { tags: ['tag1', 'tag2', 'tag3'], name: 'Item1' },
      { tags: [], name: 'Item2' }
    ]
    const columns = ['name', 'tags']
    const result = convertJsonToTsv(data, columns)
    
    expect(result).toBe('name\ttags\nItem1\ttag1, tag2, tag3\nItem2\t')
  })

  it('should handle missing properties', () => {
    const data = [
      { name: 'John', age: 30 },
      { name: 'Jane' } // missing age
    ]
    const columns = ['name', 'age', 'city'] // city missing in both
    const result = convertJsonToTsv(data, columns)
    
    expect(result).toBe('name\tage\tcity\nJohn\t30\t\nJane\t\t')
  })
})

describe('downloadFile', () => {
  it('should create blob and trigger download', () => {
    const content = 'test content'
    const filename = 'test.txt'
    const contentType = 'text/plain'
    
    downloadFile(content, filename, contentType)
    
    expect(global.Blob).toHaveBeenCalledWith([content], { type: contentType })
    expect(mockCreateElement).toHaveBeenCalledWith('a')
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Object))
    expect(mockAppendChild).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockRemoveChild).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('should set correct download attributes', () => {
    const mockElement = {
      href: '',
      download: '',
      click: mockClick,
    }
    mockCreateElement.mockReturnValue(mockElement)
    
    downloadFile('content', 'myfile.csv', 'text/csv')
    
    expect(mockElement.href).toBe('blob:mock-url')
    expect(mockElement.download).toBe('myfile.csv')
  })
})

describe('generateTsvForP0_1', () => {
  it('should convert P0_1 output to TSV', () => {
    const data: P0_1_Output = {
      line_numbered_transcript: [
        '1: Hello world',
        '2: This is a test',
        '3: Final line'
      ]
    }
    
    const result = generateTsvForP0_1(data)
    
    expect(result).toBe('line_num\ttext\n1\tHello world\n2\tThis is a test\n3\tFinal line')
  })

  it('should handle malformed line numbers', () => {
    const data: P0_1_Output = {
      line_numbered_transcript: [
        '1: Normal line',
        'Malformed line without number',
        '3: Another normal line'
      ]
    }
    
    const result = generateTsvForP0_1(data)
    
    expect(result).toBe('line_num\ttext\n1\tNormal line\n\tMalformed line without number\n3\tAnother normal line')
  })

  it('should handle empty transcript', () => {
    const data: P0_1_Output = {
      line_numbered_transcript: []
    }
    
    const result = generateTsvForP0_1(data)
    
    expect(result).toBe('line_num\ttext\n')
  })
})

describe('generateTsvForP0_2', () => {
  it('should convert P0_2 output to TSV', () => {
    const data: P0_2_Output = {
      refined_data_transcript: [
        {
          line_num: '1',
          text: 'Hello world',
          information_tags: ['greeting', 'casual'],
          decision_notes: 'Standard greeting'
        },
        {
          line_num: '2',
          text: 'How are you?',
          information_tags: ['question', 'social'],
          decision_notes: 'Inquiry about wellbeing'
        }
      ] as RefinedLine[]
    }
    
    const result = generateTsvForP0_2(data)
    
    expect(result).toBe('line_num\ttext\tinformation_tags\tdecision_notes\n1\tHello world\tgreeting, casual\tStandard greeting\n2\tHow are you?\tquestion, social\tInquiry about wellbeing')
  })

  it('should handle empty information_tags array', () => {
    const data: P0_2_Output = {
      refined_data_transcript: [
        {
          line_num: '1',
          text: 'Simple text',
          information_tags: [],
          decision_notes: 'No tags'
        }
      ] as RefinedLine[]
    }
    
    const result = generateTsvForP0_2(data)
    
    expect(result).toBe('line_num\ttext\tinformation_tags\tdecision_notes\n1\tSimple text\t\tNo tags')
  })
})

describe('generateTsvForP0_3', () => {
  it('should convert P0_3 output to TSV', () => {
    const data: P0_3_Output = {
      selected_procedural_utterances: [
        {
          original_line_num: '5',
          utterance_text: 'Let me explain the process',
          selection_justification: 'Describes methodology'
        },
        {
          original_line_num: '12',
          utterance_text: 'Here is what happened',
          selection_justification: 'Narrative content'
        }
      ] as SelectedUtterance[]
    }
    
    const result = generateTsvForP0_3(data)
    
    expect(result).toBe('original_line_num\tutterance_text\tselection_justification\n5\tLet me explain the process\tDescribes methodology\n12\tHere is what happened\tNarrative content')
  })

  it('should handle empty selected utterances', () => {
    const data: P0_3_Output = {
      selected_procedural_utterances: []
    }
    
    const result = generateTsvForP0_3(data)
    
    expect(result).toBe('original_line_num\tutterance_text\tselection_justification\n')
  })
})

describe('generateTsvForPromptHistory', () => {
  it('should convert prompt history to TSV', () => {
    const history: PromptHistoryEntry[] = [
      {
        timestamp: '2023-01-01T12:00:00Z',
        stepId: 'P1_1',
        transcriptId: 'transcript1',
        requestPayload: { prompt: 'Test prompt' },
        responseParsed: { result: 'Success' },
        responseRaw: 'Raw response',
        error: null,
        groundingSources: [
          { web: { uri: 'http://example.com' } }
        ]
      } as PromptHistoryEntry
    ]
    
    const result = generateTsvForPromptHistory(history)
    
    expect(result).toContain('timestamp\tstepId\ttranscriptId\trequestPayloadSummary\tresponseSummary\terror\tgroundingSources')
    expect(result).toContain('2023-01-01T12:00:00Z\tP1_1\ttranscript1')
    expect(result).toContain('http://example.com')
  })

  it('should handle entries without transcriptId', () => {
    const history: PromptHistoryEntry[] = [
      {
        timestamp: '2023-01-01T12:00:00Z',
        stepId: 'P3_1',
        requestPayload: { prompt: 'Generic prompt' },
        responseParsed: null,
        responseRaw: 'Response text',
        error: null,
        groundingSources: null
      } as PromptHistoryEntry
    ]
    
    const result = generateTsvForPromptHistory(history)
    
    expect(result).toContain('N/A') // Should use N/A for missing transcriptId
    expect(result).toContain('\t\t') // Empty grounding sources and error
  })

  it('should truncate long content', () => {
    const longContent = 'x'.repeat(300)
    const history: PromptHistoryEntry[] = [
      {
        timestamp: '2023-01-01T12:00:00Z',
        stepId: 'P1_1',
        requestPayload: { prompt: longContent },
        responseParsed: { result: longContent },
        responseRaw: longContent,
        error: null,
        groundingSources: null
      } as PromptHistoryEntry
    ]
    
    const result = generateTsvForPromptHistory(history)
    
    expect(result).toContain('...')
    // Should not contain the full long content
    expect(result.length).toBeLessThan(longContent.length * 3)
  })
})

describe('generateTsvForTranscriptDiachronic', () => {
  it('should return error message when P1.1 or P1.2 data missing', () => {
    const transcriptData: Partial<TranscriptProcessedData> = {
      filename: 'test.txt'
    }
    
    const result = generateTsvForTranscriptDiachronic(transcriptData as TranscriptProcessedData, 'test-id')
    
    expect(result).toBe('P1.1 or P1.2 data not available for this transcript.')
  })

  it('should generate TSV when data is available', () => {
    const transcriptData: Partial<TranscriptProcessedData> = {
      filename: 'test.txt',
      p1_1_output: {
        segmented_utterances: [
          {
            original_utterance: {
              original_line_num: '1',
              utterance_text: 'Test utterance'
            },
            segments: [
              { segment_id: 'seg1' }
            ]
          }
        ]
      },
      p1_2_output: {
        diachronic_units: [
          {
            unit_id: 'du1',
            description: 'Test DU',
            source_segment_ids: ['seg1']
          }
        ]
      }
    }
    
    const result = generateTsvForTranscriptDiachronic(transcriptData as TranscriptProcessedData, 'test-id')
    
    expect(result).toContain('transcript_id\ttranscript_filename\toriginal_line_num\tutterance_text\tdu_id\tdu_description')
    expect(result).toContain('test-id\ttest.txt\t1\tTest utterance\tdu1\tTest DU')
  })

  it('should handle empty mappings', () => {
    const transcriptData: Partial<TranscriptProcessedData> = {
      filename: 'test.txt',
      p1_1_output: {
        segmented_utterances: []
      },
      p1_2_output: {
        diachronic_units: []
      }
    }
    
    const result = generateTsvForTranscriptDiachronic(transcriptData as TranscriptProcessedData, 'test-id')
    
    expect(result).toBe('No utterance-to-DU mappings found for this transcript.')
  })
})

describe('generateTsvForTranscriptSynchronic', () => {
  it('should return error message when P2S data missing', () => {
    const transcriptData: Partial<TranscriptProcessedData> = {
      filename: 'test.txt'
    }
    
    const result = generateTsvForTranscriptSynchronic(transcriptData as TranscriptProcessedData, 'test-id')
    
    expect(result).toBe('P2S data not available for this transcript.')
  })

  it('should handle empty P2S outputs', () => {
    const transcriptData: Partial<TranscriptProcessedData> = {
      filename: 'test.txt',
      p2s_outputs_by_du: {},
      p1_1_output: {
        transcript_id: 'test-id',
        segmented_utterances: [],
        independent_variable_details: '',
        dependent_variable_focus: []
      }
    }
    
    const result = generateTsvForTranscriptSynchronic(transcriptData as TranscriptProcessedData, 'test-id')
    
    expect(result).toBe('No utterance-to-synchronic-element mappings found for this transcript.')
  })
})

describe('genericJsonToTsv', () => {
  it('should convert array of objects to TSV', () => {
    const data = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ]
    
    const result = genericJsonToTsv(data)
    
    expect(result).toBe('id\tname\n1\tItem 1\n2\tItem 2')
  })

  it('should handle non-array data by stringifying', () => {
    const data = { single: 'object' }
    
    const result = genericJsonToTsv(data)
    
    expect(result).toBe('{\n  "single": "object"\n}')
  })

  it('should handle string data directly', () => {
    const data = 'plain string'
    
    const result = genericJsonToTsv(data)
    
    expect(result).toBe('plain string')
  })

  it('should handle empty array', () => {
    const data: any[] = []
    
    const result = genericJsonToTsv(data)
    
    expect(result).toBe('[]')
  })

  it('should handle array of non-objects', () => {
    const data = [1, 2, 3, 'string']
    
    const result = genericJsonToTsv(data)
    
    expect(result).toBe('[\n  1,\n  2,\n  3,\n  "string"\n]')
  })

  it('should handle null values in array', () => {
    const data = [null, undefined, { id: 1 }]
    
    const result = genericJsonToTsv(data)
    
    expect(result).toBe('[\n  null,\n  null,\n  {\n    "id": 1\n  }\n]')
  })
})