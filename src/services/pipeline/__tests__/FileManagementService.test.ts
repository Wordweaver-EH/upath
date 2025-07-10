import { describe, test, expect, vi, beforeEach } from 'vitest'
import { FileManagementService } from '../FileManagementService'
import { RawTranscript, SavedState, StepId, StepStatus } from '../../../../types'

// Mock File.text() since it's not available in test environment
const createMockFile = (content: string, name: string, type = 'text/plain'): File => {
  const file = new File([content], name, { type })
  // Add text() method to the file
  ;(file as any).text = vi.fn().mockResolvedValue(content)
  return file
}

describe('FileManagementService', () => {
  let service: FileManagementService
  
  beforeEach(() => {
    service = new FileManagementService()
    vi.clearAllMocks()
  })
  
  describe('processFileContent', () => {
    test('should process file content into RawTranscript', async () => {
      const file = createMockFile('Test content', 'test.txt')
      
      const result = await service.processFileContent(file)
      
      expect(result).toEqual({
        id: expect.stringMatching(/^transcript-\d+-[a-z0-9]+$/),
        filename: 'test.txt',
        content: 'Test content'
      })
    })
    
    test('should generate unique IDs for each transcript', async () => {
      const file1 = createMockFile('Content 1', 'file1.txt')
      const file2 = createMockFile('Content 2', 'file2.txt')
      
      const result1 = await service.processFileContent(file1)
      const result2 = await service.processFileContent(file2)
      
      expect(result1.id).not.toBe(result2.id)
    })
  })
  
  describe('processMultipleFiles', () => {
    test('should process multiple files in parallel', async () => {
      const files = [
        createMockFile('Content 1', 'file1.txt'),
        createMockFile('Content 2', 'file2.txt'),
        createMockFile('Content 3', 'file3.txt')
      ]
      
      const results = await service.processMultipleFiles(files)
      
      expect(results).toHaveLength(3)
      expect(results[0].filename).toBe('file1.txt')
      expect(results[1].filename).toBe('file2.txt')
      expect(results[2].filename).toBe('file3.txt')
    })
    
    test('should handle empty file array', async () => {
      const results = await service.processMultipleFiles([])
      expect(results).toEqual([])
    })
  })
  
  describe('saveStateToFile', () => {
    test('should create and download state JSON file', () => {
      // Mock URL.createObjectURL and document.createElement
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      const mockRevokeObjectURL = vi.fn()
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL
      
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
      
      const state: SavedState = {
        rawTranscripts: [{ id: 't1', filename: 'test.txt', content: 'content' }],
        processedData: [],
        genericAnalysisState: {},
        promptHistory: [],
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: [] }
        },
        activeTranscriptIndex: 0,
        currentStepInfo: {
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Success
        }
      }
      
      service.saveStateToFile(state, 'test-state.json')
      
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(mockAnchor.download).toBe('test-state.json')
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })
  })
  
  describe('loadStateFromFile', () => {
    test('should load and parse state from file', async () => {
      const state: SavedState = {
        rawTranscripts: [{ id: 't1', filename: 'test.txt', content: 'content' }],
        processedData: [],
        genericAnalysisState: {},
        promptHistory: [],
        settings: {
          apiKey: 'test-key',
          temperature: 0.7,
          userDvFocus: { dv_focus: [] }
        },
        activeTranscriptIndex: 0,
        currentStepInfo: {
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Success
        }
      }
      
      const file = createMockFile(JSON.stringify(state), 'state.json', 'application/json')
      
      const result = await service.loadStateFromFile(file)
      
      expect(result).toEqual(state)
    })
    
    test('should throw error for invalid JSON', async () => {
      const file = createMockFile('invalid json', 'state.json')
      
      await expect(service.loadStateFromFile(file)).rejects.toThrow('Invalid state file')
    })
    
    test('should throw error for missing required fields', async () => {
      const invalidState = { rawTranscripts: [] } // Missing other required fields
      const file = createMockFile(JSON.stringify(invalidState), 'state.json')
      
      await expect(service.loadStateFromFile(file)).rejects.toThrow('Invalid state file')
    })
  })
  
  describe('handleFileInput', () => {
    test('should extract files from input event', () => {
      const files = [
        new File(['Content 1'], 'file1.txt'),
        new File(['Content 2'], 'file2.txt')
      ]
      
      const event = {
        target: {
          files: files
        }
      } as any
      
      const result = service.handleFileInput(event)
      
      expect(result).toEqual(files)
    })
    
    test('should return empty array for no files', () => {
      const event = {
        target: {
          files: null
        }
      } as any
      
      const result = service.handleFileInput(event)
      
      expect(result).toEqual([])
    })
  })
  
  describe('validateTranscriptFiles', () => {
    test('should validate text files', () => {
      const files = [
        new File(['Content'], 'valid.txt', { type: 'text/plain' }),
        new File(['Content'], 'valid.md', { type: 'text/markdown' })
      ]
      
      const result = service.validateTranscriptFiles(files)
      
      expect(result.valid).toEqual(files)
      expect(result.invalid).toEqual([])
    })
    
    test('should reject non-text files', () => {
      const files = [
        new File(['Content'], 'valid.txt', { type: 'text/plain' }),
        new File(['Binary'], 'invalid.pdf', { type: 'application/pdf' }),
        new File(['Binary'], 'invalid.jpg', { type: 'image/jpeg' })
      ]
      
      const result = service.validateTranscriptFiles(files)
      
      expect(result.valid).toHaveLength(1)
      expect(result.valid[0].name).toBe('valid.txt')
      expect(result.invalid).toHaveLength(2)
      expect(result.invalid[0].name).toBe('invalid.pdf')
      expect(result.invalid[1].name).toBe('invalid.jpg')
    })
  })
})