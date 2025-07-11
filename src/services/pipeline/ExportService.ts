import { 
  StepId, 
  PromptHistoryEntry, 
  RawTranscript, 
  TranscriptProcessedData, 
  GenericAnalysisState,
  CurrentStepInfo
} from '../../../types'
import { downloadFile, generateTsvForPromptHistory } from '../../utils/tsvHelper'
import { generateMarkdownReportProgrammatically, ReportData } from '../../utils/reportHelper'
import { 
  generateHtmlAppendix as generateHtmlAppendixUtil,
  calculateGduUtteranceCounts,
  calculateGssCategoryUtteranceCounts,
  calculateGduTransitionCounts
} from '../../utils/htmlHelper'

export interface ExportServiceDependencies {
  getTranscriptData?: () => {
    rawTranscripts: RawTranscript[]
    processedData: Map<string, TranscriptProcessedData>
  }
  getGenericAnalysisState?: () => GenericAnalysisState
  getPromptHistory?: () => PromptHistoryEntry[]
  getCurrentStepInfo?: () => CurrentStepInfo
}

export class ExportService {
  constructor(private dependencies: ExportServiceDependencies = {}) {}
  
  /**
   * Enhanced downloadOutput that handles different data types and generates appropriate filenames
   */
  downloadOutput(
    stepIdToDownload?: StepId,
    transcriptId?: string,
    dataToDownload?: any,
    currentStepInfo?: CurrentStepInfo,
    outputDirectory?: string
  ): void {
    // Use provided data or get from current step
    let data = dataToDownload
    const actualCurrentStepInfo = currentStepInfo || this.dependencies.getCurrentStepInfo?.() || { stepId: StepId.IDLE, status: 'idle' }
    const stepId = stepIdToDownload || actualCurrentStepInfo.stepId
    const transcriptIdToUse = transcriptId || actualCurrentStepInfo.transcriptId
    
    // If no specific data provided and we have dependencies, try to get it
    if (!data && this.dependencies.getGenericAnalysisState) {
      const genericAnalysisState = this.dependencies.getGenericAnalysisState()
      if (stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
        data = genericAnalysisState.p6_1_output
      } else {
        data = actualCurrentStepInfo.outputData
      }
    }
    
    if (!data) {
      if (typeof window !== 'undefined') {
        alert('No output data available to download.')
      }
      return
    }
    
    // Generate filename
    let filename = `${stepId}-output`
    
    if (transcriptIdToUse && this.dependencies.getTranscriptData) {
      const { processedData } = this.dependencies.getTranscriptData()
      const transcriptData = processedData.get(transcriptIdToUse)
      if (transcriptData) {
        filename = `${stepId}-${transcriptData.filename}-output`
      }
    }
    
    const extension = typeof data === 'string' ? '.txt' : '.json'
    const fullFilename = `${filename}-${Date.now()}${extension}`
    
    // Format content
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    const mimeType = typeof data === 'string' ? 'text/plain;charset=utf-8' : 'application/json'
    
    downloadFile(content, fullFilename, mimeType)
  }
  
  /**
   * Enhanced downloadPromptHistory with proper dependency handling
   */
  downloadPromptHistory(
    format: 'tsv' | 'json' = 'json',
    outputDirectory: string = ''
  ): void {
    // Get prompt history from dependencies or use provided
    const history = this.dependencies.getPromptHistory?.() || []
    
    if (history.length === 0) {
      if (typeof window !== 'undefined') {
        alert('No history to download.')
      }
      return
    }
    
    const dateStr = new Date().toISOString().slice(0, 10)
    const baseFilename = `prompt_history_${dateStr}`
    const filename = outputDirectory 
      ? `${outputDirectory}/${baseFilename}.${format}`
      : `${baseFilename}.${format}`
    
    if (format === 'tsv') {
      const content = generateTsvForPromptHistory(history)
      downloadFile(content, filename, 'text/tab-separated-values;charset=utf-8')
    } else {
      const content = JSON.stringify(history, null, 2)
      downloadFile(content, filename, 'application/json')
    }
  }
  
  generateMarkdownReport(reportData: ReportData, outputDirectory: string): void {
    const content = generateMarkdownReportProgrammatically(reportData)
    const filename = `${outputDirectory}/uPATH-report-${Date.now()}.md`
    downloadFile(content, filename)
  }
  
  /**
   * Enhanced generateAppendix that supports both HTML and Markdown formats
   */
  generateAppendix(
    type: 'markdown' | 'html' = 'markdown',
    outputDirectory: string = ''
  ): void {
    // Get data from dependencies
    if (!this.dependencies.getTranscriptData || !this.dependencies.getGenericAnalysisState) {
      if (typeof window !== 'undefined') {
        alert('Missing required dependencies for appendix generation.')
      }
      return
    }
    
    const { rawTranscripts, processedData } = this.dependencies.getTranscriptData()
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    
    if (rawTranscripts.length === 0) {
      if (typeof window !== 'undefined') {
        alert('No transcripts to generate appendix for.')
      }
      return
    }
    
    // Calculate counts
    const gduCounts = calculateGduUtteranceCounts(processedData, genericAnalysisState.p3_2_output)
    const gssCounts = calculateGssCategoryUtteranceCounts(processedData, genericAnalysisState.p4s_outputs_by_gdu)
    const transitionCounts = calculateGduTransitionCounts(
      processedData, 
      genericAnalysisState.p3_2_output, 
      genericAnalysisState.p3_3_output
    )
    
    const dateStr = new Date().toISOString().slice(0, 10)
    
    if (type === 'html') {
      const htmlContent = generateHtmlAppendixUtil(gduCounts, gssCounts, transitionCounts, false)
      const filename = outputDirectory
        ? `${outputDirectory}/appendix_${dateStr}.html`
        : `appendix_${dateStr}.html`
      downloadFile(htmlContent, filename, 'text/html;charset=utf-8')
    } else {
      // Generate markdown appendix
      const markdownContent = `# Analysis Appendix

Generated on: ${new Date().toISOString()}

## GDU Counts
${JSON.stringify(gduCounts, null, 2)}

## GSS Counts  
${JSON.stringify(gssCounts, null, 2)}

## Transition Counts
${JSON.stringify(transitionCounts, null, 2)}`
      
      const filename = outputDirectory
        ? `${outputDirectory}/appendix_${dateStr}.md`
        : `appendix_${dateStr}.md`
      downloadFile(markdownContent, filename, 'text/markdown;charset=utf-8')
    }
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