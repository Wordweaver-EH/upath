import { useEffect, useRef } from 'react'
import { StepId, StepStatus } from '../../types'
import { ESSENTIAL_STEPS_FOR_AUTODOWNLOAD, STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, STEP_CONFIGS } from '../../constants'
import { useUIStore } from '../stores'
import { usePipelineStore } from '../stores'
import { useSettingsStore } from '../stores'
import { PipelineOrchestrator } from '../services/PipelineOrchestrator'

// Create orchestrator instance
const orchestrator = new PipelineOrchestrator()

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
  const processedData = usePipelineStore(state => state.processedData)
  const genericAnalysisState = usePipelineStore(state => state.genericAnalysisState)
  const processState = usePipelineStore(state => state.processState)
  const updateProcessState = usePipelineStore(state => state.updateProcessState)
  const processSingleStep = usePipelineStore(state => state.processSingleStep)
  const downloadOutput = usePipelineStore(state => state.downloadOutput)
  const isGlobalStep = usePipelineStore(state => state.isGlobalStep)
  const autorunResumePosition = usePipelineStore(state => state.autorunResumePosition)

  // Settings Store state
  const autoDownloadResults = useSettingsStore(state => state.autoDownloadResults)
  const apiKey = useSettingsStore(state => state.apiKeyPresent ? 'present' : '')
  const temperature = useSettingsStore(state => state.temperature)
  const seed = useSettingsStore(state => state.seed)
  const userDvFocus = useSettingsStore(state => state.userDvFocus)

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
      
      // Use orchestrator instead of getNextStepDetails
      const nextStep = orchestrator.getNextStep(
        processState,
        currentStepInfo,
        { rawTranscripts, processedData, genericAnalysisState },
        activeTranscriptIndex
      );
      
      // Convert orchestrator response to legacy format for compatibility
      const details = nextStep ? {
        nextStepId: nextStep.nextStepId,
        nextTranscriptIndex: nextStep.nextTranscriptIndex ?? activeTranscriptIndex
      } : null;
      
      console.log(`- orchestrator.getNextStep result:`, details);
      
      if (details) {
        console.log(`🎯 Found next step: ${details.nextStepId} (transcript index: ${details.nextTranscriptIndex})`);
        setActiveTranscript(details.nextTranscriptIndex);
        
        // Update process state
        const newProcessState = orchestrator.updateProcessState(
          processState,
          currentStepInfo.stepId,
          currentStepInfo.status
        );
        updateProcessState(newProcessState); 
        
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
            processSingleStep({ 
              stepId: details.nextStepId, 
              transcriptIdToProcess: nextTxId,
              settings: {
                apiKey,
                temperature,
                seed,
                userDvFocus
              }
            });
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
         // Save resume checkpoint before stopping
         const updatedProcessState = orchestrator.createResumeCheckpoint(processState);
         updateProcessState(updatedProcessState);
         setAutorunning(false);
      }
    } else if (isAutorunning && currentStepInfo.status === StepStatus.Error) {
      console.log(`💥 Autorun active but step failed - stopping`);
      console.log(`- Error step: ${currentStepInfo.stepId}`);
      console.log(`🛑 Autorun stopped (error)`);
      // Save resume checkpoint before stopping
      const updatedProcessState = orchestrator.createResumeCheckpoint(processState);
      updateProcessState(updatedProcessState);
      setAutorunning(false);
    } else if (isAutorunning && currentStepInfo.status === StepStatus.Idle && rawTranscripts.length > 0) {
      console.log(`🚀 Autorun starting from Idle - checking for resume point`);
      
      // First check if we have an explicit autorun resume position from clearing a part
      if (autorunResumePosition) {
        console.log(`📍 Found autorun resume position from part clear: ${autorunResumePosition}`);
        const isResumeGlobal = isGlobalStep(autorunResumePosition) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(autorunResumePosition);
        const resumeTxId = isResumeGlobal ? undefined : rawTranscripts[activeTranscriptIndex]?.id;
        
        processSingleStep({ 
          stepId: autorunResumePosition, 
          transcriptIdToProcess: resumeTxId,
          settings: {
            apiKey,
            temperature,
            seed,
            userDvFocus
          }
        });
        return; // Exit early after processing the resume position
      }
      
      // Check if we should resume from a previous point by getting next step details
      // This handles the case where the pipeline was paused and we're resuming
      const resumeNextStep = orchestrator.getNextStep(
        processState,
        { stepId: StepId.IDLE, status: StepStatus.Idle },
        { rawTranscripts, processedData, genericAnalysisState },
        activeTranscriptIndex
      );
      
      const resumeDetails = resumeNextStep ? {
        nextStepId: resumeNextStep.nextStepId,
        nextTranscriptIndex: resumeNextStep.nextTranscriptIndex ?? activeTranscriptIndex
      } : null;
      
      if (resumeDetails) {
        console.log(`📍 Resuming from: ${resumeDetails.nextStepId} (transcript index: ${resumeDetails.nextTranscriptIndex})`);
        setActiveTranscript(resumeDetails.nextTranscriptIndex);
        
        const isResumeGlobal = isGlobalStep(resumeDetails.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(resumeDetails.nextStepId);
        const resumeTxId = isResumeGlobal ? undefined : rawTranscripts[resumeDetails.nextTranscriptIndex]?.id;
        
        processSingleStep({ 
          stepId: resumeDetails.nextStepId, 
          transcriptIdToProcess: resumeTxId,
          settings: {
            apiKey,
            temperature,
            seed,
            userDvFocus
          }
        });
      } else {
        // Only start from beginning if no progress has been made
        console.log(`🆕 Starting fresh from first step`);
        const firstStepId = StepId.P_NEG1_1_VARIABLE_IDENTIFICATION;
        const firstTranscriptId = rawTranscripts[0]?.id;
        console.log(`- Starting with: ${firstStepId}`);
        console.log(`- First transcript: ${firstTranscriptId}`);
        processSingleStep({ 
          stepId: firstStepId, 
          transcriptIdToProcess: firstTranscriptId,
          settings: {
            apiKey,
            temperature,
            seed,
            userDvFocus
          }
        });
      }
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
    isGlobalStep,
    processState,
    updateProcessState,
    activeTranscriptIndex
  ]);

  // Effect to save resume checkpoint when autorun is paused
  const prevIsAutorunningRef = useRef(isAutorunning);
  
  useEffect(() => {
    // Only save checkpoint when transitioning from running to not running
    if (prevIsAutorunningRef.current === true && isAutorunning === false) {
      // Check if we have a valid state to save
      if (processState.status === 'running' && 
          currentStepInfo.status === StepStatus.Success &&
          !processState.resumeCheckpoint) { // Avoid saving if already saved
        console.log('📌 Saving resume checkpoint on pause');
        const updatedProcessState = orchestrator.createResumeCheckpoint(processState);
        updateProcessState(updatedProcessState);
      }
    }
    
    prevIsAutorunningRef.current = isAutorunning;
  }, [isAutorunning]); // Only watch isAutorunning to avoid loops
}