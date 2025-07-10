import { StepId, PromptHistoryEntry, RawTranscript, TranscriptProcessedData, GenericAnalysisState } from '../../../types'
import { downloadFile, generateTsvForPromptHistory } from '../../utils/tsvHelper'
import { generateMarkdownReportProgrammatically, ReportData } from '../../utils/reportHelper'
import { generateHtmlAppendix } from '../../utils/htmlHelper'

export class ExportService {
  downloadOutput(stepId: StepId, data: any, filename?: string): void {
    const defaultFilename = `${stepId}-output-${Date.now()}.json`
    const content = JSON.stringify(data, null, 2)
    downloadFile(content, filename || defaultFilename)
  }
  
  downloadPromptHistory(
    history: PromptHistoryEntry[], 
    format: 'tsv' | 'json', 
    outputDirectory: string
  ): void {
    const timestamp = Date.now()
    const filename = `${outputDirectory}/prompt-history-${timestamp}.${format}`
    
    if (format === 'tsv') {
      const content = generateTsvForPromptHistory(history)
      downloadFile(content, filename)
    } else {
      const content = JSON.stringify(history, null, 2)
      downloadFile(content, filename)
    }
  }
  
  generateMarkdownReport(reportData: ReportData, outputDirectory: string): void {
    const content = generateMarkdownReportProgrammatically(reportData)
    const filename = `${outputDirectory}/uPATH-report-${Date.now()}.md`
    downloadFile(content, filename)
  }
  
  generateHtmlAppendix(
    transcripts: RawTranscript[],
    processedData: Map<string, TranscriptProcessedData>,
    genericState: GenericAnalysisState,
    outputDirectory: string
  ): void {
    const content = generateHtmlAppendix(transcripts, processedData, genericState)
    const filename = `${outputDirectory}/uPATH-appendix-${Date.now()}.html`
    downloadFile(content, filename)
  }
  
  exportVisualization(
    mermaidSyntax: string, 
    filename: string, 
    format: 'svg' | 'mermaid' = 'svg'
  ): void {
    if (format === 'mermaid') {
      downloadFile(mermaidSyntax, filename)
    } else {
      // For SVG export, we would need to render the mermaid diagram
      // For now, we'll create a simple SVG wrapper
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <text x="10" y="30" font-family="monospace" font-size="12">
    <!-- Mermaid diagram would be rendered here -->
    ${mermaidSyntax.split('\n').map((line, i) => 
      `<tspan x="10" dy="20">${line}</tspan>`
    ).join('\n    ')}
  </text>
</svg>`
      downloadFile(svgContent, filename)
    }
  }
  
  async createBatchExport(
    exports: Array<{ filename: string, content: string }>, 
    zipFilename: string
  ): Promise<Blob> {
    // In a real implementation, this would use a library like JSZip
    // For now, we'll create a mock implementation
    const combinedContent = exports.map(exp => 
      `=== ${exp.filename} ===\n${exp.content}\n`
    ).join('\n')
    
    return new Blob([combinedContent], { type: 'application/zip' })
  }
}