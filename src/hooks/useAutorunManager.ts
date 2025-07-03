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

  // Effect for live timer updates
  useEffect(() => {
    let intervalId: number | undefined;

    if (isAutorunning && processStartTime) {
      intervalId = window.setInterval(() => {
        updateElapsedTime();
      }, 1000);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isAutorunning, processStartTime]);

  useEffect(() => { 
    console.groupCollapsed(`🤖 [useAutorunManager] Effect triggered`);
    console.log(`- isAutorunning: ${isAutorunning}`);
    console.log(`- currentStepInfo.status: ${currentStepInfo.status}`);
    console.log(`- currentStepInfo.stepId: ${currentStepInfo.stepId}`);
    console.log(`- activeTranscriptIndex: ${activeTranscriptIndex}`);
    
    if (isAutorunning && currentStepInfo.status === StepStatus.Success) {
      console.log(`✅ Autorun active & step successful - checking next step`);
      const details = getNextStepDetails(currentStepInfo, activeTranscriptIndex);
      console.log(`- getNextStepDetails result:`, details);
      
      if (details) {
        console.log(`🎯 Found next step: ${details.nextStepId} (transcript index: ${details.nextTranscriptIndex})`);
        setActiveTranscript(details.nextTranscriptIndex); 
        
        if (details.nextStepId === StepId.COMPLETE) {
            console.log(`🏁 Next step is COMPLETE - finalizing`);
            const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete.";
            console.log(`- Report length: ${report.length} chars`);
            setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData:report }); 
            console.log(`🛑 Autorun stopped (COMPLETE)`);
            setAutorunning(false);
            if (autoDownloadResults && report!=="Processing complete." && ESSENTIAL_STEPS_FOR_AUTODOWNLOAD.includes(StepId.P6_1_GENERATE_MARKDOWN_REPORT)) {
              console.log(`💾 Auto-downloading final report`);
              downloadOutput(StepId.COMPLETE, "final_analysis_report", report);
            }
        } else {
            const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId);
            const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id;
            console.log(`🚀 Processing next step: ${details.nextStepId}`);
            console.log(`- Is global step: ${isNextGlobal}`);
            console.log(`- Transcript ID: ${nextTxId || 'N/A (global)'}`);
            processSingleStep({ stepId: details.nextStepId, transcriptIdToProcess: nextTxId });
        }
      } else if (currentStepInfo.stepId !== StepId.COMPLETE && genericAnalysisState.isReportGenerated) { 
        console.log(`📋 No next step details but report is generated - completing`);
        const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All processing complete.";
        console.log(`- Report length: ${report.length} chars`);
        setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData:report }); 
        console.log(`🛑 Autorun stopped (report generated)`);
        setAutorunning(false);
      } else if (currentStepInfo.stepId !== StepId.COMPLETE && !details) { 
         console.log(`❌ No next step details and not complete - stopping autorun`);
         console.log(`- isReportGenerated: ${genericAnalysisState.isReportGenerated}`);
         if (genericAnalysisState.isReportGenerated) {
           console.log(`📋 Setting COMPLETE status with report`);
           setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData: typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All complete." });
         }
         console.log(`🛑 Autorun stopped (no details)`);
         setAutorunning(false);
      }
    } else if (isAutorunning && currentStepInfo.status === StepStatus.Error) {
      console.log(`💥 Autorun active but step failed - stopping`);
      console.log(`- Error step: ${currentStepInfo.stepId}`);
      console.log(`🛑 Autorun stopped (error)`);
      setAutorunning(false);
    } else if (isAutorunning && currentStepInfo.status === StepStatus.Idle && rawTranscripts.length > 0) {
      console.log(`🚀 Autorun starting from Idle - beginning first step`);
      const firstStepId = StepId.P_NEG1_1_VARIABLE_IDENTIFICATION;
      const firstTranscriptId = rawTranscripts[0]?.id;
      console.log(`- Starting with: ${firstStepId}`);
      console.log(`- First transcript: ${firstTranscriptId}`);
      processSingleStep({ stepId: firstStepId, transcriptIdToProcess: firstTranscriptId });
    } else {
      console.log(`⏸️ Autorun conditions not met`);
      console.log(`- isAutorunning: ${isAutorunning}`);
      console.log(`- currentStepInfo.status: ${currentStepInfo.status}`);
      console.log(`- rawTranscripts.length: ${rawTranscripts.length}`);
      if (isAutorunning) {
        console.log(`- Autorun enabled but status is ${currentStepInfo.status} (need Success to continue)`);
      }
    }
    
    console.groupEnd();
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