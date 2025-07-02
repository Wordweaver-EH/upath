import { useEffect } from 'react'
import { StepId, StepStatus } from '../../types'
import { ESSENTIAL_STEPS_FOR_AUTODOWNLOAD, STEP_ORDER_PART_4_GENERIC_SYNCHRONIC } from '../../constants'
import { useUIStore } from '../stores'
import { usePipelineStore } from '../stores'
import { useSettingsStore } from '../stores'

/**
 * Custom hook to manage the autorun logic
 * Extracted from App.tsx to improve separation of concerns and testability
 */
export const useAutorunManager = () => {
  // UI Store state and actions
  const isAutorunning = useUIStore(state => state.isAutorunning)
  const currentStepInfo = useUIStore(state => state.currentStepInfo)
  const processStartTime = useUIStore(state => state.processStartTime)
  const activeTranscriptIndex = useUIStore(state => state.activeTranscriptIndex)
  const setActiveTranscript = useUIStore(state => state.setActiveTranscript)
  const setCurrentStepInfo = useUIStore(state => state.setCurrentStepInfo)
  const setAutorunning = useUIStore(state => state.setAutorunning)
  const updateElapsedTime = useUIStore(state => state.updateElapsedTime)
  const setProcessStartTime = useUIStore(state => state.setProcessStartTime)

  // Pipeline Store state and actions
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts)
  const genericAnalysisState = usePipelineStore(state => state.genericAnalysisState)
  const getNextStepDetails = usePipelineStore(state => state.getNextStepDetails)
  const processSingleStep = usePipelineStore(state => state.processSingleStep)
  const downloadOutput = usePipelineStore(state => state.downloadOutput)
  const isGlobalStep = usePipelineStore(state => state.isGlobalStep)

  // Settings Store state
  const autoDownloadResults = useSettingsStore(state => state.autoDownloadResults)

  useEffect(() => { 
    if (isAutorunning && currentStepInfo.status === StepStatus.Success) {
      const details = getNextStepDetails(currentStepInfo, activeTranscriptIndex);
      if (details) {
        setActiveTranscript(details.nextTranscriptIndex); 
        if (details.nextStepId === StepId.COMPLETE) {
            const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete.";
            setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData:report }); setAutorunning(false); 
            if (processStartTime) { updateElapsedTime(); setProcessStartTime(null); }
            if (autoDownloadResults && report!=="Processing complete." && ESSENTIAL_STEPS_FOR_AUTODOWNLOAD.includes(StepId.P6_1_GENERATE_MARKDOWN_REPORT)) downloadOutput(StepId.COMPLETE, "final_analysis_report", report);
        } else {
            const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId);
            const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id;
            processSingleStep({ stepId: details.nextStepId, transcriptIdToProcess: nextTxId });
        }
      } else if (currentStepInfo.stepId !== StepId.COMPLETE && genericAnalysisState.isReportGenerated) { 
        const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All processing complete.";
        setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData:report }); setAutorunning(false); 
        if (processStartTime) { updateElapsedTime(); setProcessStartTime(null); }
      } else if (currentStepInfo.stepId !== StepId.COMPLETE && !details) { 
         if (genericAnalysisState.isReportGenerated) setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData: typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All complete." });
         setAutorunning(false); if (processStartTime) { updateElapsedTime(); setProcessStartTime(null); }
      }
    } else if (isAutorunning && currentStepInfo.status === StepStatus.Error) {
      setAutorunning(false); if (processStartTime) { updateElapsedTime(); setProcessStartTime(null); }
    }
  }, [
    isAutorunning, 
    currentStepInfo, 
    genericAnalysisState, 
    getNextStepDetails, 
    rawTranscripts, 
    processSingleStep, 
    downloadOutput, 
    autoDownloadResults, 
    processStartTime, 
    updateElapsedTime, 
    setProcessStartTime, 
    setCurrentStepInfo, 
    setAutorunning, 
    setActiveTranscript,
    isGlobalStep
  ]);
}