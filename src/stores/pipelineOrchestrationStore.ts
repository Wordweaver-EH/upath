import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { CurrentStepInfo, StepId, StepStatus, HilContext } from '../../types'

interface ExecutionParams {
  stepId: StepId
  transcriptId?: string
  timestamp: number
}

interface PipelineOrchestrationState {
  // Current execution context
  currentStepInfo: CurrentStepInfo
  activeTranscriptIndex: number
  
  // Flow control
  isAutorunning: boolean
  shouldStopAutorun: boolean
  
  // HIL support
  lastHilContext?: HilContext
  
  // Execution metadata
  lastExecutionParams?: ExecutionParams
}

interface PipelineOrchestrationActions {
  setCurrentStepInfo: (info: CurrentStepInfo) => void
  setActiveTranscriptIndex: (index: number) => void
  setAutorunning: (running: boolean) => void
  setShouldStopAutorun: (stop: boolean) => void
  setHilContext: (context: HilContext) => void
  clearHilContext: () => void
  clearShouldStopAutorun: () => void
  recordExecution: (params: { stepId: StepId; transcriptId?: string }) => void
  reset: () => void
}

type PipelineOrchestrationStore = PipelineOrchestrationState & PipelineOrchestrationActions

const initialState: PipelineOrchestrationState = {
  currentStepInfo: {
    stepId: StepId.IDLE,
    status: StepStatus.Idle
  },
  activeTranscriptIndex: 0,
  isAutorunning: false,
  shouldStopAutorun: false
}

export const usePipelineOrchestrationStore = create<PipelineOrchestrationStore>()(
  immer((set, get) => ({
    ...initialState,
    
    setCurrentStepInfo: (info) => {
      set(state => {
        state.currentStepInfo = info
      })
    },
    
    setActiveTranscriptIndex: (index) => {
      set(state => {
        state.activeTranscriptIndex = index
      })
    },
    
    setAutorunning: (running) => {
      set(state => {
        state.isAutorunning = running
      })
    },
    
    setShouldStopAutorun: (stop) => {
      set(state => {
        state.shouldStopAutorun = stop
      })
    },
    
    setHilContext: (context) => {
      set(state => {
        state.lastHilContext = context
      })
    },
    
    clearHilContext: () => {
      set(state => {
        state.lastHilContext = undefined
      })
    },
    
    clearShouldStopAutorun: () => {
      set(state => {
        state.shouldStopAutorun = false
      })
    },
    
    recordExecution: (params) => {
      set(state => {
        state.lastExecutionParams = {
          ...params,
          timestamp: Date.now()
        }
      })
    },
    
    reset: () => {
      set(() => ({
        ...initialState,
        lastHilContext: undefined,
        lastExecutionParams: undefined
      }))
    }
  }))
)