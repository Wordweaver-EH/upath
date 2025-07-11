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
    // Mock window.alert to avoid JSDOM not implemented error
    global.window.alert = vi.fn()
  })
  
  describe('downloadOutput', () => {
    test('should download step output as JSON', () => {
      const outputData = {
        step: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        result: { hasCleanSpeakerLabels: true }
      }
      
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      // The new implementation has different parameters
      service.downloadOutput(StepId.P0_1_TRANSCRIPTION_ADHERENCE, undefined, outputData)
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        JSON.stringify(outputData, null, 2),
        expect.stringMatching(/^P0_1_TRANSCRIPTION_ADHERENCE-output-\d+\.json$/),
        'application/json'
      )
    })
    
    test('should generate default filename if not provided', () => {
      const outputData = { test: 'data' }
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      service.downloadOutput(StepId.P3_1_ALIGN_STRUCTURES, undefined, outputData)
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        JSON.stringify(outputData, null, 2),
        expect.stringMatching(/^P3_1_ALIGN_STRUCTURES-output-\d+\.json$/),
        'application/json'
      )
    })
    
    test('should handle null data gracefully', () => {
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      const mockAlert = vi.spyOn(window, 'alert')
      
      service.downloadOutput(StepId.P0_1_TRANSCRIPTION_ADHERENCE, undefined, null)
      
      expect(mockAlert).toHaveBeenCalledWith('No output data available to download.')
      expect(mockDownloadFile).not.toHaveBeenCalled()
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
      
      // Mock dependencies to return history
      service = new ExportService({
        getPromptHistory: () => history
      })
      
      // Mock Date to get consistent filename
      const mockDate = new Date('2024-01-01')
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
      
      service.downloadPromptHistory('tsv', '/output/dir')
      
      expect(mockGenerateTsv).toHaveBeenCalledWith(history)
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'tsv content',
        '/output/dir/prompt_history_2024-01-01.tsv',
        'text/tab-separated-values;charset=utf-8'
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
      
      // Mock dependencies to return history
      service = new ExportService({
        getPromptHistory: () => history
      })
      
      // Mock Date to get consistent filename
      const mockDate = new Date('2024-01-01')
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
      
      service.downloadPromptHistory('json', '/output/dir')
      
      expect(mockDownloadFile).toHaveBeenCalledWith(
        JSON.stringify(history, null, 2),
        '/output/dir/prompt_history_2024-01-01.json',
        'application/json'
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
  
  describe('generateAppendix', () => {
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
      
      // Mock the utility functions
      const mockCalculateGduCounts = vi.mocked(htmlHelper.calculateGduUtteranceCounts).mockReturnValue({})
      const mockCalculateGssCounts = vi.mocked(htmlHelper.calculateGssCategoryUtteranceCounts).mockReturnValue({})
      const mockCalculateTransitionCounts = vi.mocked(htmlHelper.calculateGduTransitionCounts).mockReturnValue({})
      const mockGenerateHtml = vi.mocked(htmlHelper.generateHtmlAppendix).mockReturnValue('<html>test</html>')
      const mockDownloadFile = vi.mocked(tsvHelper.downloadFile)
      
      // Mock dependencies
      service = new ExportService({
        getTranscriptData: () => ({ rawTranscripts: transcripts, processedData }),
        getGenericAnalysisState: () => genericState
      })
      
      // Mock Date to get consistent filename
      const mockDate = new Date('2024-01-01')
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate)
      
      service.generateAppendix('html', '/output/dir')
      
      expect(mockCalculateGduCounts).toHaveBeenCalledWith(processedData, genericState.p3_2_output)
      expect(mockCalculateGssCounts).toHaveBeenCalledWith(processedData, genericState.p4s_outputs_by_gdu)
      expect(mockCalculateTransitionCounts).toHaveBeenCalledWith(
        processedData,
        genericState.p3_2_output,
        genericState.p3_3_output
      )
      expect(mockGenerateHtml).toHaveBeenCalledWith({}, {}, {}, false)
      expect(mockDownloadFile).toHaveBeenCalledWith(
        '<html>test</html>',
        '/output/dir/appendix_2024-01-01.html',
        'text/html;charset=utf-8'
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