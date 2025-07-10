import { RawTranscript, SavedState } from '../../../types'

export class FileManagementService {
  async processFileContent(file: File): Promise<RawTranscript> {
    const text = await file.text()
    
    return {
      id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      content: text
    }
  }
  
  async processMultipleFiles(files: File[]): Promise<RawTranscript[]> {
    return Promise.all(files.map(file => this.processFileContent(file)))
  }
  
  saveStateToFile(state: SavedState, filename: string): void {
    const dataStr = JSON.stringify(state, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    
    URL.revokeObjectURL(url)
  }
  
  async loadStateFromFile(file: File): Promise<SavedState> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Validate required fields
      if (!data.rawTranscripts || !Array.isArray(data.rawTranscripts)) {
        throw new Error('Invalid state file: missing rawTranscripts')
      }
      if (!data.processedData || !Array.isArray(data.processedData)) {
        throw new Error('Invalid state file: missing processedData')
      }
      if (!data.genericAnalysisState || typeof data.genericAnalysisState !== 'object') {
        throw new Error('Invalid state file: missing genericAnalysisState')
      }
      if (!data.promptHistory || !Array.isArray(data.promptHistory)) {
        throw new Error('Invalid state file: missing promptHistory')
      }
      if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid state file: missing settings')
      }
      if (typeof data.activeTranscriptIndex !== 'number') {
        throw new Error('Invalid state file: missing activeTranscriptIndex')
      }
      if (!data.currentStepInfo || typeof data.currentStepInfo !== 'object') {
        throw new Error('Invalid state file: missing currentStepInfo')
      }
      
      return data as SavedState
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid state file:')) {
        throw error
      }
      throw new Error('Invalid state file')
    }
  }
  
  handleFileInput(event: React.ChangeEvent<HTMLInputElement>): File[] {
    if (!event.target.files) {
      return []
    }
    return Array.from(event.target.files)
  }
  
  validateTranscriptFiles(files: File[]): { valid: File[], invalid: File[] } {
    const valid: File[] = []
    const invalid: File[] = []
    
    const validTypes = ['text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values']
    const validExtensions = ['.txt', '.md', '.csv', '.tsv']
    
    files.forEach(file => {
      const isValidType = validTypes.includes(file.type) || file.type === ''
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      
      if (isValidType || hasValidExtension) {
        valid.push(file)
      } else {
        invalid.push(file)
      }
    })
    
    return { valid, invalid }
  }
}