import { RawTranscript, SavedState, StepId, StepStatus, CurrentStepInfo } from '../../../types'

export interface FileManagementDependencies {
  addTranscripts?: (files: File[]) => Promise<void>
  getCurrentStepInfo?: () => CurrentStepInfo
  setCurrentStepInfo?: (info: CurrentStepInfo) => void
}

export class FileManagementService {
  constructor(private dependencies: FileManagementDependencies = {}) {}
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
      if (!data.processedDataArray || !Array.isArray(data.processedDataArray)) {
        throw new Error('Invalid state file: missing processedData')
      }
      if (!data.genericAnalysisState || typeof data.genericAnalysisState !== 'object') {
        throw new Error('Invalid state file: missing genericAnalysisState')
      }
      if (!data.promptHistory || !Array.isArray(data.promptHistory)) {
        throw new Error('Invalid state file: missing promptHistory')
      }
      if (typeof data.activeTranscriptIndex !== 'number') {
        throw new Error('Invalid state file: missing activeTranscriptIndex')
      }
      if (typeof data.currentStepInfo !== 'object' || data.currentStepInfo === null) {
        throw new Error('Invalid state file: missing currentStepInfo')
      }
      
      return data as SavedState
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid state file:')) {
        throw error
      }
      throw new Error(`Invalid state file: ${error instanceof Error ? error.message : String(error)}`)
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
      const isValidType = validTypes.includes(file.type)
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      
      // Accept if has valid type, or if type is empty/unknown but has valid extension
      if (isValidType || (file.type === '' && hasValidExtension)) {
        valid.push(file)
      } else {
        invalid.push(file)
      }
    })
    
    return { valid, invalid }
  }
  
  /**
   * Enhanced uploadTranscripts that handles file input events and updates pipeline state
   */
  async uploadTranscripts(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    
    try {
      // Use dependencies to add transcripts
      if (this.dependencies.addTranscripts) {
        await this.dependencies.addTranscripts(files)
      }
      
      // Reset file input
      event.target.value = ''
      
      // Signal ready state if we're idle
      const currentStepInfo = this.dependencies.getCurrentStepInfo?.() || { stepId: StepId.IDLE, status: 'idle' }
      if (currentStepInfo.stepId === StepId.IDLE && this.dependencies.setCurrentStepInfo) {
        this.dependencies.setCurrentStepInfo({
          stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
          status: StepStatus.Idle
        })
      }
    } catch (error) {
      console.error('Failed to upload transcripts:', error)
      if (typeof window !== 'undefined') {
        alert('Failed to upload transcripts. Please try again.')
      }
      throw error
    }
  }
  
  /**
   * Enhanced handleDroppedFiles that handles drag-and-drop file uploads
   */
  async handleDroppedFiles(files: File[]): Promise<void> {
    console.log('🗂️ handleDroppedFiles called with', files.length, 'files')
    if (files.length === 0) return
    
    try {
      console.log('📤 Calling addTranscripts...')
      // Use dependencies to add transcripts
      if (this.dependencies.addTranscripts) {
        await this.dependencies.addTranscripts(files)
        console.log('✅ addTranscripts completed successfully')
      }
      
      // Signal ready state if we're idle
      const currentStepInfo = this.dependencies.getCurrentStepInfo?.() || { stepId: StepId.IDLE, status: 'idle' }
      if (currentStepInfo.stepId === StepId.IDLE && this.dependencies.setCurrentStepInfo) {
        this.dependencies.setCurrentStepInfo({
          stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
          status: StepStatus.Idle
        })
      }
    } catch (error) {
      console.error('❌ Error in handleDroppedFiles:', error)
      if (error instanceof Error) {
        console.error('❌ Error stack:', error.stack)
      }
      if (typeof window !== 'undefined') {
        alert('Failed to upload files. Please try again.')
      }
      throw error
    }
  }
}