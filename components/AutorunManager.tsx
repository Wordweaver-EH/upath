import { useEffect } from 'react'
import { useUIStore } from '../src/stores/uiStore'
import { usePipelineStore } from '../src/stores/pipelineStore'
import { StepStatus } from '../types'

export function AutorunManager() {
  const isAutorunning = useUIStore(state => state.isAutorunning)
  const currentStepInfo = useUIStore(state => state.currentStepInfo)
  const processNextStep = usePipelineStore(state => state.processNextStep)
  
  useEffect(() => {
    if (isAutorunning && currentStepInfo.status === StepStatus.Success) {
      // Use a small delay to avoid rapid-fire processing
      const timeout = setTimeout(() => {
        processNextStep()
      }, 100)
      
      return () => clearTimeout(timeout)
    }
  }, [isAutorunning, currentStepInfo.status, processNextStep])
  
  // Handle errors during autorun
  useEffect(() => {
    if (isAutorunning && currentStepInfo.status === StepStatus.Error) {
      const uiStore = useUIStore.getState()
      uiStore.setAutorunning(false)
      
      // Update elapsed time
      if (uiStore.processStartTime) {
        uiStore.updateElapsedTime()
        uiStore.setProcessStartTime(null)
      }
    }
  }, [isAutorunning, currentStepInfo.status])
  
  return null
}