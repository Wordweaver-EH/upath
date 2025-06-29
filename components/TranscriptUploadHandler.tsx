import { useEffect } from 'react'
import { usePipelineStore } from '../src/stores/pipelineStore'
import { useUIStore } from '../src/stores/uiStore'

interface TranscriptUploadHandlerProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  fileUploadInputRef: React.RefObject<HTMLInputElement>
}

export function TranscriptUploadHandler({ onFileUpload, fileUploadInputRef }: TranscriptUploadHandlerProps) {
  const addTranscripts = usePipelineStore(state => state.addTranscripts)
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts)
  const setCurrentStepInfo = useUIStore(state => state.setCurrentStepInfo)
  
  // Handle file upload through Zustand
  const handleZustandFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    const fileArray = Array.from(files)
    await addTranscripts(fileArray)
    
    // Reset file input
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.value = ''
    }
  }
  
  // Update step info when transcripts are added
  useEffect(() => {
    if (rawTranscripts.length > 0) {
      const currentStepInfo = useUIStore.getState().currentStepInfo
      if (currentStepInfo.stepId === 'IDLE') {
        setCurrentStepInfo({
          stepId: 'P_NEG1_1_VARIABLE_IDENTIFICATION',
          status: 'idle'
        })
      }
    }
  }, [rawTranscripts.length, setCurrentStepInfo])
  
  // Override the onFileUpload handler
  useEffect(() => {
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.onchange = handleZustandFileUpload
    }
  }, [])
  
  return null
}