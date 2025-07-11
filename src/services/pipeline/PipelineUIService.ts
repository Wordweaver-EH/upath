import { 
  StepId, 
  StepStatus, 
  RawTranscript, 
  TranscriptProcessedData, 
  GenericAnalysisState,
  PromptHistoryEntry,
  CurrentStepInfo,
  P2SPhaseData
} from '../../../types'
import { EnhancedPipelineNavigationService } from './EnhancedPipelineNavigationService'
import { 
  stepIdToDataKeyPrefix, 
  isGlobalStep 
} from '../../utils/stepIdToDataKeyPrefix'
import { 
  getStepDisplayName,
  STEP_CONFIGS,
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  ALL_PIPELINE_STEP_IDS_IN_ORDER
} from '../../../constants'

// Dependencies interface
export interface UIServiceDependencies {
  getTranscriptData: () => {
    rawTranscripts: RawTranscript[]
    processedData: Map<string, TranscriptProcessedData>
  }
  getGenericAnalysisState: () => GenericAnalysisState
  getPromptHistory: () => PromptHistoryEntry[]
  getActiveTranscriptIndex: () => number
  setAutorunning?: (running: boolean) => void
  setCurrentStepInfo?: (info: CurrentStepInfo) => void
}

export interface IPipelineUIService {
  getTranscriptStatusDisplay(transcriptId: string): string
  loadStepData(
    stepId: StepId,
    transcriptId?: string,
    phaseId?: string,
    gduId?: string
  ): {
    inputData?: any
    outputData?: any
    error?: string
    groundingSources?: any[]
  }
  getStepStatusForPipelineView(
    stepId: StepId,
    uiState?: {
      currentStepInfo: CurrentStepInfo
      activeTranscriptIndex: number
    }
  ): {
    status: StepStatus
    error?: string
  }
  handlePipelineStepClick(
    clickedStepId: StepId,
    settings: {
      apiKey: string
      temperature: number
      seed?: number
      userDvFocus: { dv_focus: string[] }
    }
  ): {
    stepId: StepId
    transcriptId?: string
    phaseId?: string
    gduId?: string
    status: StepStatus
    error?: string
  }
  
  // UI state helper methods
  getPreviousStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): { prevStepId: StepId; prevTranscriptIndex: number } | null
  
  isPreviousStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean
  
  isNextStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean
  
  isRunStepDisabled(
    currentStepInfo: CurrentStepInfo,
    apiKeyPresent: boolean,
    dvFocusError?: string
  ): boolean
  
  isHilModalDisabled(currentStepInfo: CurrentStepInfo): boolean
  
  isDownloadOutputDisabled(currentStepInfo: CurrentStepInfo): boolean
  
  isDownloadHistoryDisabled(): boolean
  
  isAppendixDataAvailable(): boolean
}

export class PipelineUIService implements IPipelineUIService {
  constructor(private dependencies: UIServiceDependencies) {}
  
  /**
   * Get display status for a transcript
   */
  getTranscriptStatusDisplay(transcriptId: string): string {
    const { processedData } = this.dependencies.getTranscriptData()
    const data = processedData.get(transcriptId)
    
    if (!data) return 'No Data'
    
    // Check completion status based on pipeline progress
    if (data.isFullyProcessedSpecificDiachronic && data.isFullyProcessedSpecificSynchronic) {
      return `${getStepDisplayName(StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE)} Done`
    }
    if (data.isFullyProcessedSpecificDiachronic) {
      return `${getStepDisplayName(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE)} Done`
    }
    if (data.p0_3_output || data.p0_3_error) {
      return `${getStepDisplayName(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES)} Done`
    }
    if (data.p_neg1_1_output || data.p_neg1_1_error) {
      return `${getStepDisplayName(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION)} Done`
    }
    
    return 'Pending'
  }
  
  /**
   * Load data for a specific step
   */
  loadStepData(
    stepIdToLoad: StepId,
    transcriptId?: string,
    phaseName?: string,
    gduId?: string
  ): {
    inputData?: any
    outputData?: any
    error?: string
    groundingSources?: any[]
  } {
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    const { processedData } = this.dependencies.getTranscriptData()
    const promptHistory = this.dependencies.getPromptHistory()
    
    const keyPrefix = stepIdToDataKeyPrefix[stepIdToLoad]
    let output: any
    let error: string | undefined
    
    // Find the most recent prompt history entry for this step
    const reversedHistory = [...promptHistory].reverse()
    const historyEntry = reversedHistory.find(entry => 
      entry.stepId === stepIdToLoad && 
      (transcriptId ? entry.transcriptId === transcriptId : true)
    )
    
    const currentInputData = historyEntry?.requestPayload
    const currentGroundingSources = historyEntry?.groundingSources
    
    // Get output data based on step type
    if (transcriptId && phaseName && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepIdToLoad) && keyPrefix) {
      const tData = processedData.get(transcriptId)
      output = tData?.p2s_outputs_by_phase?.[phaseName]?.[keyPrefix as keyof P2SPhaseData]
      error = tData?.p2s_outputs_by_phase?.[phaseName]?.[`${keyPrefix.toString().replace('_output', '_error')}` as keyof P2SPhaseData] as string | undefined
    } else if (transcriptId && keyPrefix && (STEP_ORDER_PART_NEG1.includes(stepIdToLoad) || STEP_ORDER_PART_0.includes(stepIdToLoad) || STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepIdToLoad))) {
      const tData = processedData.get(transcriptId)
      output = tData?.[keyPrefix as keyof TranscriptProcessedData]
      error = tData?.[`${keyPrefix.toString().replace('_output', '_error')}` as keyof TranscriptProcessedData] as string | undefined
    } else if (gduId && keyPrefix) {
      if (stepIdToLoad === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
        output = genericAnalysisState.p4s_1_a_outputs_by_gdu?.[gduId]
        if (genericAnalysisState.p4s_1_a_error && genericAnalysisState.current_gdu_for_p4s_processing === gduId && !output) {
          error = genericAnalysisState.p4s_1_a_error
        }
      } else if (stepIdToLoad === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
        output = genericAnalysisState.p4s_outputs_by_gdu?.[gduId]
        if (genericAnalysisState.p4s_1_b_error && genericAnalysisState.current_gdu_for_p4s_processing === gduId && !output) {
          error = genericAnalysisState.p4s_1_b_error
        }
      }
    } else if (keyPrefix && isGlobalStep(stepIdToLoad)) {
      output = genericAnalysisState[keyPrefix as keyof GenericAnalysisState]
      error = genericAnalysisState[`${keyPrefix.toString().replace('_output', '_error')}` as keyof GenericAnalysisState] as string | undefined
    }
    
    return { 
      outputData: output, 
      error: error, 
      inputData: currentInputData, 
      groundingSources: currentGroundingSources 
    }
  }
  
  /**
   * Get step status for pipeline view
   */
  getStepStatusForPipelineView(
    stepId: StepId,
    uiState?: {
      currentStepInfo: CurrentStepInfo
      activeTranscriptIndex: number
    }
  ): {
    status: StepStatus
    error?: string
  } {
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    const { processedData, rawTranscripts } = this.dependencies.getTranscriptData()
    
    // If UI state not provided, try to get it from dependencies
    if (!uiState) {
      uiState = {
        currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
        activeTranscriptIndex: this.dependencies.getActiveTranscriptIndex()
      }
    }
    
    const { currentStepInfo, activeTranscriptIndex } = uiState
    const isStepGlobal = isGlobalStep(stepId)
    let status = StepStatus.Idle
    let error: string | undefined
    
    if (isStepGlobal) {
      if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
        if (genericAnalysisState.isFullyProcessedGenericSynchronic) {
          status = StepStatus.Success
        } else if ((genericAnalysisState.processed_gdus_for_p4s?.length || 0) > 0) {
          status = StepStatus.Loading
        }
        
        // Check for specific P4S_A or P4S_B error
        if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_error) {
          error = genericAnalysisState.p4s_1_a_error
        }
        if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.p4s_1_b_error) {
          error = genericAnalysisState.p4s_1_b_error
        }
      } else {
        const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof GenericAnalysisState
        if (genericAnalysisState[keyPrefix]) {
          status = StepStatus.Success
        }
        error = genericAnalysisState[`${String(keyPrefix).replace('_output', '_error')}` as keyof GenericAnalysisState] as string | undefined
        if (error) {
          status = StepStatus.Error
        }
      }
    } else {
      const currentTId = rawTranscripts[activeTranscriptIndex]?.id
      if (currentTId) {
        const tData = processedData.get(currentTId)
        if (tData) {
          if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
            if (tData.isFullyProcessedSpecificSynchronic) {
              status = StepStatus.Success
            } else if ((tData.processed_phases_for_p2s?.length || 0) > 0) {
              status = StepStatus.Loading
            }
            if (currentStepInfo.stepId === stepId && currentStepInfo.transcriptId === currentTId && currentStepInfo.error) {
              error = currentStepInfo.error
            }
          } else {
            const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof TranscriptProcessedData
            if (tData[keyPrefix]) {
              status = StepStatus.Success
            }
            error = tData[`${String(keyPrefix).replace('_output', '_error')}` as keyof TranscriptProcessedData] as string | undefined
            if (error) {
              status = StepStatus.Error
            }
          }
        }
      }
    }
    
    // Check if this is the current step
    if (currentStepInfo.stepId === stepId) {
      if (isStepGlobal || currentStepInfo.transcriptId === rawTranscripts[activeTranscriptIndex]?.id) {
        if (currentStepInfo.status === StepStatus.Loading) {
          status = StepStatus.Loading
        } else if (currentStepInfo.status === StepStatus.Error) {
          status = StepStatus.Error
          error = currentStepInfo.error
        } else if (currentStepInfo.status === StepStatus.Success) {
          status = StepStatus.Success
        }
      }
    }
    
    return { status, error }
  }
  
  /**
   * Handle pipeline step click
   */
  handlePipelineStepClick(
    clickedStepId: StepId,
    settings: {
      apiKey: string
      temperature: number
      seed?: number
      userDvFocus: { dv_focus: string[] }
    }
  ): {
    stepId: StepId
    transcriptId?: string
    phaseId?: string
    gduId?: string
    status: StepStatus
    error?: string
  } {
    const { rawTranscripts, processedData } = this.dependencies.getTranscriptData()
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    const activeTranscriptIndex = this.dependencies.getActiveTranscriptIndex()
    
    // Update UI state if callbacks are provided
    if (this.dependencies.setAutorunning) {
      this.dependencies.setAutorunning(false)
    }
    if (this.dependencies.setCurrentStepInfo) {
      this.dependencies.setCurrentStepInfo({
        stepId: clickedStepId,
        status: StepStatus.Processing
      })
    }
    
    let txIdNav: string | undefined = undefined
    let phaseNav: string | undefined = undefined
    let gduNav: string | undefined = undefined
    
    const stepConfig = STEP_CONFIGS[clickedStepId]
    if (!stepConfig) {
      return {
        stepId: clickedStepId,
        status: StepStatus.Error,
        error: 'Invalid step configuration'
      }
    }
    
    // Determine navigation parameters based on step type
    if (STEP_ORDER_PART_NEG1.includes(clickedStepId) || 
        STEP_ORDER_PART_0.includes(clickedStepId) || 
        STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(clickedStepId)) {
      txIdNav = rawTranscripts[activeTranscriptIndex]?.id
    } else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(clickedStepId)) {
      txIdNav = rawTranscripts[activeTranscriptIndex]?.id
      const tData = txIdNav ? processedData.get(txIdNav) : undefined
      phaseNav = tData?.current_phase_for_p2s_processing || tData?.phases_for_p2s_processing?.[0]
      if (!phaseNav && (tData?.processed_phases_for_p2s?.length || 0) > 0) {
        phaseNav = tData?.processed_phases_for_p2s?.[tData.processed_phases_for_p2s.length - 1]
      }
    } else if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(clickedStepId)) {
      const gduIds = genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || []
      gduNav = genericAnalysisState.current_gdu_for_p4s_processing || gduIds[0] || undefined
    }
    
    // Load step data
    const data = this.loadStepData(clickedStepId, txIdNav, phaseNav, gduNav)
    
    return {
      stepId: clickedStepId,
      transcriptId: txIdNav,
      phaseId: phaseNav,
      gduId: gduNav,
      status: data.error ? StepStatus.Error : (data.outputData ? StepStatus.Success : StepStatus.Idle),
      error: data.error
    }
  }
  
  /**
   * Get previous step details for navigation
   */
  getPreviousStepDetails(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): { prevStepId: StepId; prevTranscriptIndex: number } | null {
    const { rawTranscripts } = this.dependencies.getTranscriptData()
    
    if (currentStepInfo.stepId === StepId.IDLE) return null
    
    const currentIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(currentStepInfo.stepId)
    if (currentIndex <= 0) return null
    
    // Handle first step of pipeline for transcripts beyond the first
    if (currentStepInfo.stepId === STEP_ORDER_PART_NEG1[0] && activeTranscriptIndex > 0) {
      return { 
        prevStepId: StepId.IDLE,
        prevTranscriptIndex: activeTranscriptIndex - 1 
      }
    }
    
    const prevStepId = ALL_PIPELINE_STEP_IDS_IN_ORDER[currentIndex - 1] as StepId
    return { prevStepId, prevTranscriptIndex: activeTranscriptIndex }
  }
  
  /**
   * Check if previous step navigation is disabled
   */
  isPreviousStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean {
    return currentStepInfo.status === StepStatus.Loading || 
           !this.getPreviousStepDetails(currentStepInfo, activeTranscriptIndex)
  }
  
  /**
   * Check if next step navigation is disabled
   */
  isNextStepDisabled(
    currentStepInfo: CurrentStepInfo,
    activeTranscriptIndex: number
  ): boolean {
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    const navigationService = new EnhancedPipelineNavigationService()
    const transcriptData = this.dependencies.getTranscriptData()
    
    const nextStepDetails = navigationService.getNextStepDetails(
      currentStepInfo,
      activeTranscriptIndex,
      transcriptData,
      genericAnalysisState
    )
    
    return currentStepInfo.status === StepStatus.Loading || 
           (!nextStepDetails && 
            currentStepInfo.stepId !== StepId.COMPLETE && 
            !genericAnalysisState.isReportGenerated)
  }
  
  /**
   * Check if run step is disabled
   */
  isRunStepDisabled(
    currentStepInfo: CurrentStepInfo,
    apiKeyPresent: boolean,
    dvFocusError?: string
  ): boolean {
    return currentStepInfo.stepId === StepId.IDLE || 
           currentStepInfo.status === StepStatus.Loading || 
           currentStepInfo.stepId === StepId.COMPLETE || 
           (!apiKeyPresent && currentStepInfo.stepId !== StepId.P6_1_GENERATE_MARKDOWN_REPORT) || 
           !!dvFocusError
  }
  
  /**
   * Check if HIL modal is disabled
   */
  isHilModalDisabled(currentStepInfo: CurrentStepInfo): boolean {
    return currentStepInfo.stepId === StepId.IDLE || 
           currentStepInfo.status === StepStatus.Loading || 
           currentStepInfo.stepId === StepId.COMPLETE || 
           !currentStepInfo.inputData || 
           (!currentStepInfo.outputData && !currentStepInfo.error)
  }
  
  /**
   * Check if download output is disabled
   */
  isDownloadOutputDisabled(currentStepInfo: CurrentStepInfo): boolean {
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    
    return currentStepInfo.stepId === StepId.IDLE || 
           (!currentStepInfo.outputData && !genericAnalysisState.p6_1_output) || 
           (currentStepInfo.stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT && !genericAnalysisState.p6_1_output)
  }
  
  /**
   * Check if download history is disabled
   */
  isDownloadHistoryDisabled(): boolean {
    const promptHistory = this.dependencies.getPromptHistory()
    return promptHistory.length === 0
  }
  
  /**
   * Check if appendix data is available
   */
  isAppendixDataAvailable(): boolean {
    const genericAnalysisState = this.dependencies.getGenericAnalysisState()
    const { rawTranscripts } = this.dependencies.getTranscriptData()
    return rawTranscripts.length > 0 && genericAnalysisState.isReportGenerated
  }
}