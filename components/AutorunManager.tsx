// components/AutorunManager.tsx
import { useEffect } from 'react';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import { StepStatus } from '../types';

export function AutorunManager() {
  const isAutorunning = useUIStore(state => state.isAutorunning);
  const currentStepInfo = useUIStore(state => state.currentStepInfo);
  const processStartTime = useUIStore(state => state.processStartTime);
  const setAutorunning = useUIStore(state => state.setAutorunning);
  const updateElapsedTime = useUIStore(state => state.updateElapsedTime);
  const setProcessStartTime = useUIStore(state => state.setProcessStartTime);
  const processNextStep = usePipelineStore(state => state.processNextStep);

  // Effect for advancing the pipeline on success
  useEffect(() => {
    if (isAutorunning && currentStepInfo.status === StepStatus.Success) {
      const timeout = setTimeout(() => {
        processNextStep();
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [isAutorunning, currentStepInfo.status, processNextStep]);
  
  // Effect for handling errors during autorun
  useEffect(() => {
    if (isAutorunning && currentStepInfo.status === StepStatus.Error) {
      setAutorunning(false);
      if (processStartTime) {
        updateElapsedTime();
        setProcessStartTime(null);
      }
    }
  }, [isAutorunning, currentStepInfo.status, processStartTime, setAutorunning, updateElapsedTime, setProcessStartTime]);

  // Effect for managing the elapsed time interval
  useEffect(() => {
    let timerInterval: number | undefined;
    if (isAutorunning && processStartTime) {
      timerInterval = setInterval(() => {
        updateElapsedTime();
      }, 1000) as any;
    } else if (!isAutorunning && processStartTime) {
        // If autorun stops but timer was running, do one last update
        updateElapsedTime();
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isAutorunning, processStartTime, updateElapsedTime]);
  
  return null;
}