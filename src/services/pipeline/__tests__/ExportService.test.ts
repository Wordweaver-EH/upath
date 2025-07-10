import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ExportService } from '../ExportService'
import { StepId, PromptHistoryEntry } from '../../../../types'
import * as tsvHelper from '../../../utils/tsvHelper'
import * as reportHelper from '../../../utils/reportHelper'
import * as htmlHelper from '../../../utils/htmlHelper'

// Mock the helper modules
vi.mock('../../../utils/tsvHelper')
vi.mock('../../../utils/reportHelper')
vi.mock('../../../utils/htmlHelper')

describe('ExportService', () => {
  let service: ExportService
  
  beforeEach(() => {
    service = new ExportService()
    vi.clearAllMocks()
  })
  
  describe('downloadOutput', () => {
    test('should download step output as JSON', () => {
      const outputData = {
        step: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        result: { hasCleanSpeakerLabels: true }
      }
      
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.downloadOutput(StepId.P0_1_TRANSCRIPTION_ADHERENCE, outputData, 'test-output.json')
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        JSON.stringify(outputData, null, 2),
        'test-output.json'
      )
    })
    
    test('should generate default filename if not provided', () => {
      const outputData = { test: 'data' }
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      // Mock Date to get consistent filename
      const mockDate = new Date('2024-01-01T12:00:00Z')
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
      
      service.downloadOutput(StepId.P3_1_ALIGN_STRUCTURES, outputData)
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        JSON.stringify(outputData, null, 2),
        expect.stringMatching(/^P3_1_ALIGN_STRUCTURES-output-\d+\.json$/)
      )
    })
    
    test('should handle null data gracefully', () => {
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.downloadOutput(StepId.P0_1_TRANSCRIPTION_ADHERENCE, null, 'output.json')
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'null',
        'output.json'
      )
    })
  })
  
  describe('downloadPromptHistory', () => {
    test('should download history as TSV', () => {
      const history: PromptHistoryEntry[] = [
        {
          timestamp: Date.now(),
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          prompt: 'Test prompt',
          response: 'Test response',
          status: 'success'
        }
      ]
      
      const mockGenerateTsv = vi.mocked(tsvHelper.generateTsvForPromptHistory).mockReturnValue('tsv content')
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.downloadPromptHistory(history, 'tsv', '/output/dir')
      
      expect(mockGenerateTsv).toHaveBeenCalledWith(history)
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'tsv content',
        expect.stringMatching(/^\/output\/dir\/prompt-history-\d+\.tsv$/)
      )
    })
    
    test('should download history as JSON', () => {
      const history: PromptHistoryEntry[] = [
        {
          timestamp: Date.now(),
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          prompt: 'Test prompt',
          response: 'Test response',
          status: 'success'
        }
      ]
      
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.downloadPromptHistory(history, 'json', '/output/dir')
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        JSON.stringify(history, null, 2),
        expect.stringMatching(/^\/output\/dir\/prompt-history-\d+\.json$/)
      )
    })
  })
  
  describe('generateMarkdownReport', () => {
    test('should generate markdown report', () => {
      const reportData: reportHelper.ReportData = {
        transcripts: [],
        genericAnalysis: {},
        promptHistory: []
      }
      
      const mockGenerateReport = vi.mocked(reportHelper.generateMarkdownReportProgrammatically)
        .mockReturnValue('# Report Content')
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.generateMarkdownReport(reportData, '/output/dir')
      
      expect(mockGenerateReport).toHaveBeenCalledWith(reportData)
      expect(mockDownloadFile).toHaveBeenCalledWith(
        '# Report Content',
        expect.stringMatching(/^\/output\/dir\/uPATH-report-\d+\.md$/)
      )
    })
  })
  
  describe('generateHtmlAppendix', () => {
    test('should generate HTML appendix', () => {
      const transcripts = [
        { id: 't1', filename: 'test.txt', content: 'content' }
      ]
      const processedData = new Map([
        ['t1', { id: 't1', filename: 'test.txt' }]
      ])
      const genericState = {
        p3_3_output: {
          generic_diachronic_structure_definition: {
            core_gdus: []
          }
        }
      }
      
      const mockGenerateHtml = vi.mocked(htmlHelper.generateHtmlAppendix)
        .mockReturnValue('<html>Appendix</html>')
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.generateHtmlAppendix(transcripts, processedData, genericState, '/output/dir')
      
      expect(mockGenerateHtml).toHaveBeenCalledWith(
        transcripts,
        processedData,
        genericState
      )
      expect(mockDownloadFile).toHaveBeenCalledWith(
        '<html>Appendix</html>',
        expect.stringMatching(/^\/output\/dir\/uPATH-appendix-\d+\.html$/)
      )
    })
  })
  
  describe('exportVisualization', () => {
    test('should export mermaid diagram as SVG', () => {
      const mermaidSyntax = 'graph TD\n  A --> B'
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.exportVisualization(mermaidSyntax, 'diagram.svg', 'svg')
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        expect.stringContaining('<svg'),
        'diagram.svg'
      )
    })
    
    test('should export mermaid diagram as mermaid text', () => {
      const mermaidSyntax = 'graph TD\n  A --> B'
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.exportVisualization(mermaidSyntax, 'diagram.mmd', 'mermaid')
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        mermaidSyntax,
        'diagram.mmd'
      )
    })
  })
  
  describe('createBatchExport', () => {
    test('should create zip file with multiple exports', async () => {
      const exports = [
        { filename: 'file1.txt', content: 'Content 1' },
        { filename: 'file2.json', content: '{"data": "test"}' }
      ]
      
      // This would require JSZip or similar library
      // For now, we'll mock the implementation
      const result = await service.createBatchExport(exports, 'export.zip')
      
      expect(result).toBeDefined()
      // In real implementation, this would create a zip file
    })
  })
})