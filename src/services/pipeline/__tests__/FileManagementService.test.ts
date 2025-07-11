import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { FileManagementService } from '../FileManagementService'
import { StepId, StepStatus } from '../../../../types'

// Mock globals
global.alert = vi.fn()
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock document methods
const mockClick = vi.fn()
const mockCreateElement = vi.fn((tagName: string) => {
  if (tagName === 'a') {
    return {
      href: '',
      download: '',
      click: mockClick
    }
  }
  return {}
})
global.document.createElement = mockCreateElement

// Mock File.prototype.text method
Object.defineProperty(File.prototype, 'text', {
  value: async function() {
    // Return the first argument passed to the File constructor
    const content = this.constructor.prototype._mockContent || ''
    return content
  }
})

// Helper to create File with mocked text content
const createMockFile = (content: string, name: string, options?: FilePropertyBag) => {
  const file = new File([content], name, options)
  // Store content for retrieval in text() method
  Object.defineProperty(file, 'text', {
    value: async () => content
  })
  return file
}

describe('FileManagementService', () => {
  let service: FileManagementService
  let mockDependencies: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockDependencies = {
      addTranscripts: vi.fn().mockResolvedValue(undefined),
      getCurrentStepInfo: vi.fn().mockReturnValue({ stepId: StepId.IDLE, status: StepStatus.Idle }),
      setCurrentStepInfo: vi.fn()
    }
    
    service = new FileManagementService(mockDependencies)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('processFileContent', () => {
    it('should process file content and return RawTranscript', async () => {
      const mockFile = createMockFile('test content', 'test.txt', { type: 'text/plain' })
      
      const result = await service.processFileContent(mockFile)
      
      expect(result).toEqual({
        id: expect.stringMatching(/^transcript-\d+-[a-z0-9]+$/),
        filename: 'test.txt',
        content: 'test content'
      })
    })
  })
  
  describe('processMultipleFiles', () => {
    it('should process multiple files', async () => {
      const files = [
        createMockFile('content1', 'file1.txt'),
        createMockFile('content2', 'file2.txt')
      ]
      
      const results = await service.processMultipleFiles(files)
      
      expect(results).toHaveLength(2)
      expect(results[0].filename).toBe('file1.txt')
      expect(results[1].filename).toBe('file2.txt')
    })
  })
  
  describe('saveStateToFile', () => {
    it('should save state to JSON file', () => {
      const mockState = {
        rawTranscripts: [],
        processedData: [],
        genericAnalysisState: {},
        promptHistory: [],
        settings: {},
        activeTranscriptIndex: 0,
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle }
      }
      
      service.saveStateToFile(mockState, 'test-state.json')
      
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(
        expect.any(Blob)
      )
      expect(mockClick).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })
  })
  
  describe('loadStateFromFile', () => {
    it('should load valid state from file', async () => {
      const validState = {
        rawTranscripts: [],
        processedData: [],
        genericAnalysisState: {},
        promptHistory: [],
        settings: {},
        activeTranscriptIndex: 0,
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle }
      }
      
      const mockFile = createMockFile(JSON.stringify(validState), 'state.json')
      
      const result = await service.loadStateFromFile(mockFile)
      
      expect(result).toEqual(validState)
    })
    
    it('should throw error for invalid JSON', async () => {
      const mockFile = createMockFile('invalid json', 'state.json')
      
      await expect(service.loadStateFromFile(mockFile)).rejects.toThrow('Invalid state file')
    })
    
    it('should validate required fields', async () => {
      const invalidState = { rawTranscripts: [] } // Missing other required fields
      const mockFile = createMockFile(JSON.stringify(invalidState), 'state.json')
      
      await expect(service.loadStateFromFile(mockFile)).rejects.toThrow('Invalid state file: missing processedData')
    })
  })
  
  describe('handleFileInput', () => {
    it('should extract files from input event', () => {
      const mockEvent = {
        target: {
          files: [
            createMockFile('content1', 'file1.txt'),
            createMockFile('content2', 'file2.txt')
          ]
        }
      } as any
      
      const files = service.handleFileInput(mockEvent)
      
      expect(files).toHaveLength(2)
      expect(files[0].name).toBe('file1.txt')
    })
    
    it('should return empty array if no files', () => {
      const mockEvent = {
        target: { files: null }
      } as any
      
      const files = service.handleFileInput(mockEvent)
      
      expect(files).toEqual([])
    })
  })
  
  describe('validateTranscriptFiles', () => {
    it('should validate files by type', () => {
      const files = [
        createMockFile('content', 'valid.txt', { type: 'text/plain' }),
        createMockFile('content', 'invalid.jpg', { type: 'image/jpeg' })
      ]
      
      const { valid, invalid } = service.validateTranscriptFiles(files)
      
      expect(valid).toHaveLength(1)
      expect(valid[0].name).toBe('valid.txt')
      expect(invalid).toHaveLength(1)
      expect(invalid[0].name).toBe('invalid.jpg')
    })
    
    it('should validate files by extension', () => {
      const files = [
        createMockFile('content', 'valid.md', { type: '' }),
        createMockFile('content', 'invalid.exe', { type: '' })
      ]
      
      const { valid, invalid } = service.validateTranscriptFiles(files)
      
      expect(valid).toHaveLength(1)
      expect(valid[0].name).toBe('valid.md')
      expect(invalid).toHaveLength(1)
      expect(invalid[0].name).toBe('invalid.exe')
    })
    
    it('should accept empty type with valid extension', () => {
      const file = createMockFile('content', 'valid.csv', { type: '' })
      
      const { valid, invalid } = service.validateTranscriptFiles([file])
      
      expect(valid).toHaveLength(1)
      expect(invalid).toHaveLength(0)
    })
  })
  
  describe('uploadTranscripts', () => {
    it('should upload transcripts and update state when idle', async () => {
      const files = [
        createMockFile('content1', 'file1.txt'),
        createMockFile('content2', 'file2.txt')
      ]
      const mockEvent = {
        target: { files, value: 'test' }
      } as any
      
      await service.uploadTranscripts(mockEvent)
      
      expect(mockDependencies.addTranscripts).toHaveBeenCalledWith(files)
      expect(mockEvent.target.value).toBe('')
      expect(mockDependencies.setCurrentStepInfo).toHaveBeenCalledWith({
        stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        status: StepStatus.Idle
      })
    })
    
    it('should not update state when not idle', async () => {
      mockDependencies.getCurrentStepInfo.mockReturnValue({
        stepId: StepId.P1_1_PRESPECIFY_IDEAL_DIACHRONIC_STRUCTURE,
        status: StepStatus.Processing
      })
      
      const files = [createMockFile('content', 'file.txt')]
      const mockEvent = {
        target: { files, value: 'test' }
      } as any
      
      await service.uploadTranscripts(mockEvent)
      
      expect(mockDependencies.addTranscripts).toHaveBeenCalled()
      expect(mockDependencies.setCurrentStepInfo).not.toHaveBeenCalled()
    })
    
    it('should handle empty files array', async () => {
      const mockEvent = {
        target: { files: [], value: '' }
      } as any
      
      await service.uploadTranscripts(mockEvent)
      
      expect(mockDependencies.addTranscripts).not.toHaveBeenCalled()
    })
    
    it('should handle errors gracefully', async () => {
      mockDependencies.addTranscripts.mockRejectedValue(new Error('Upload failed'))
      
      const files = [createMockFile('content', 'file.txt')]
      const mockEvent = {
        target: { files, value: 'test' }
      } as any
      
      await expect(service.uploadTranscripts(mockEvent)).rejects.toThrow('Upload failed')
      expect(global.alert).toHaveBeenCalledWith('Failed to upload transcripts. Please try again.')
    })
    
    it('should work without dependencies', async () => {
      service = new FileManagementService({})
      
      const files = [createMockFile('content', 'file.txt')]
      const mockEvent = {
        target: { files, value: 'test' }
      } as any
      
      // Should not throw
      await service.uploadTranscripts(mockEvent)
      expect(mockEvent.target.value).toBe('')
    })
  })
  
  describe('handleDroppedFiles', () => {
    it('should handle dropped files and update state when idle', async () => {
      const files = [
        createMockFile('content1', 'file1.txt'),
        createMockFile('content2', 'file2.txt')
      ]
      
      await service.handleDroppedFiles(files)
      
      expect(mockDependencies.addTranscripts).toHaveBeenCalledWith(files)
      expect(mockDependencies.setCurrentStepInfo).toHaveBeenCalledWith({
        stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        status: StepStatus.Idle
      })
    })
    
    it('should handle empty files array', async () => {
      await service.handleDroppedFiles([])
      
      expect(mockDependencies.addTranscripts).not.toHaveBeenCalled()
    })
    
    it('should handle errors with stack trace', async () => {
      const testError = new Error('Drop failed')
      mockDependencies.addTranscripts.mockRejectedValue(testError)
      
      const files = [createMockFile('content', 'file.txt')]
      
      await expect(service.handleDroppedFiles(files)).rejects.toThrow('Drop failed')
      expect(global.alert).toHaveBeenCalledWith('Failed to upload files. Please try again.')
    })
    
    it('should log appropriate messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const files = [createMockFile('content', 'file.txt')]
      
      await service.handleDroppedFiles(files)
      
      expect(consoleSpy).toHaveBeenCalledWith('🗂️ handleDroppedFiles called with', 1, 'files')
      expect(consoleSpy).toHaveBeenCalledWith('📤 Calling addTranscripts...')
      expect(consoleSpy).toHaveBeenCalledWith('✅ addTranscripts completed successfully')
    })
    
    it('should work without dependencies', async () => {
      service = new FileManagementService({})
      const files = [createMockFile('content', 'file.txt')]
      
      // Should not throw
      await service.handleDroppedFiles(files)
    })
  })
  
  describe('edge cases', () => {
    it('should handle missing getCurrentStepInfo dependency', async () => {
      service = new FileManagementService({
        addTranscripts: mockDependencies.addTranscripts,
        setCurrentStepInfo: mockDependencies.setCurrentStepInfo
      })
      
      const files = [createMockFile('content', 'file.txt')]
      await service.handleDroppedFiles(files)
      
      expect(mockDependencies.setCurrentStepInfo).toHaveBeenCalledWith({
        stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        status: StepStatus.Idle
      })
    })
    
    it('should handle missing setCurrentStepInfo dependency', async () => {
      service = new FileManagementService({
        addTranscripts: mockDependencies.addTranscripts,
        getCurrentStepInfo: mockDependencies.getCurrentStepInfo
      })
      
      const files = [createMockFile('content', 'file.txt')]
      
      // Should not throw
      await service.handleDroppedFiles(files)
      expect(mockDependencies.addTranscripts).toHaveBeenCalled()
    })
  })
})