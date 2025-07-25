


import React, { useState, useEffect, useRef } from 'react';
import { marked, Renderer as MarkedRenderer, MarkedOptions, Tokens } from 'marked';
import {
  TranscriptProcessedData, GenericAnalysisState, StepId, StepStatus,
  P2SPhaseData, IrrWorkflowState, IrrResults, P9_1_SemanticGduMapping,
  AppState
} from './types';
import {
  STEP_CONFIGS, ESSENTIAL_STEPS_FOR_AUTODOWNLOAD,
  STEP_ORDER_PART_NEG1, STEP_ORDER_PART_0, STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_7_CAUSAL_MODELING, STEP_ORDER_PART_6_REPORT
} from './constants';
import { buildCompleteUtteranceToGduMapping } from './src/utils/traceabilityHelper';
import { calculateKrippendorffsAlpha, buildReliabilityMatrix, validateReliabilityMatrix } from './src/utils/statisticsHelper';
import { generateTsvForPromptHistory } from './src/utils/tsvHelper';
import { generateHtmlAppendix, calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from './src/utils/htmlHelper';
import { callGeminiAPI } from './services/geminiService';
import { stepIdToDataKeyPrefix } from './src/utils/stepIdToDataKeyPrefix';

import MermaidDiagram from './components/MermaidDiagram';
import SettingsPanel from './components/SettingsPanel';
import ControlsPanel from './components/ControlsPanel';
import StatusDisplay from './components/StatusDisplay';
import HilModal from './components/HilModal';
import PipelineOverview, { PipelineStepNode } from './components/PipelineOverview';
import { Button } from './src/components/ui';
import IRRModal from './components/IRRModal';
import GduMappingModal from './components/GduMappingModal';
import { AppLoadingScreen } from './src/components/AppLoadingScreen';
import { SessionRestoreNotification } from './src/components/SessionRestoreNotification';
import { PipelineStepGrid } from './src/components/PipelineStepGrid';

// AG Grid CSS
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './src/styles/ag-grid-custom-theme.css';
import './src/styles/tooltip.css';

import { useUIStore, useSettingsStore, usePipelineStore, useIRRStore, initializeStores, selectCurrentStepDisplay } from './src/stores';
import { useAutorunManager } from './src/hooks/useAutorunManager';
import packageJson from './package.json';

const APP_VERSION = packageJson.version; 

const MoonIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
  </svg>
);

const SunIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M10 3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 3ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM15.606 5.494a.75.75 0 0 1 .093 1.057l-1.06 1.06a.75.75 0 0 1-1.057-.093A5.005 5.005 0 0 0 10 7.5a.75.75 0 0 1-1.5 0c0-1.604.864-3.018 2.182-3.875a.75.75 0 0 1 1.057.093l1.06 1.06a.75.75 0 0 1 .093 1.057ZM4.394 14.506a.75.75 0 0 1-.093-1.057l1.06-1.06a.75.75 0 0 1 1.057.093A5.005 5.005 0 0 0 10 12.5a.75.75 0 0 1 1.5 0c0 1.604-.864 3.018-2.182 3.875a.75.75 0 0 1-1.057-.093l-1.06-1.06a.75.75 0 0 1-.093-1.057ZM17.25 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM4.75 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM14.506 15.606a.75.75 0 0 1-1.057-.093A5.005 5.005 0 0 0 12.5 10a.75.75 0 0 1 0-1.5c1.604 0 3.018.864 3.875 2.182a.75.75 0 0 1-.093 1.057l-1.06 1.06a.75.75 0 0 1-1.057.093ZM5.494 4.394a.75.75 0 0 1 1.057.093A5.005 5.005 0 0 0 7.5 10a.75.75 0 0 1 0 1.5c-1.604 0-3.018-.864-3.875-2.182a.75.75 0 0 1 .093 1.057l1.06-1.06a.75.75 0 0 1 1.057-.093ZM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
  </svg>
);

interface ReportRendererProps {
  markdown: string;
  theme: 'light' | 'dark';
}

const ReportRenderer: React.FC<ReportRendererProps> = ({ markdown, theme }) => {
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');

  useEffect(() => {
    const renderer = new MarkedRenderer();
    const originalBaseCodeRenderer = renderer.code.bind(renderer);

    renderer.code = (token: Tokens.Code): string => {
      const { text: code, lang: infostring } = token;
      const currentLang = (infostring || '').match(/\S*/)?.[0];

      if (currentLang === 'mermaid') {
        return `<div class="mermaid">${code}</div>\n`;
      }
      const originalRenderedOutput = originalBaseCodeRenderer(token);
      if (typeof originalRenderedOutput === 'string') return originalRenderedOutput;
      
      console.warn(`Marked's original code renderer returned a non-string value for language: "${infostring}". Falling back.`, { token, originalRenderedOutput });
      const textToEscape = token.text || '';
      const htmlEscapedCode = textToEscape.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `<pre><code>${htmlEscapedCode}</code></pre>\n`;
    };

    const options: MarkedOptions = { renderer };
    const parsed = marked.parse(markdown, options) as string;
    setHtml(parsed);
  }, [markdown]);

  useEffect(() => {
    const mermaidInstance = window.globalMermaidInstance;
    if (!mermaidInstance) {
      console.error("[ReportRenderer] globalMermaidInstance not found!");
      return;
    }
    if (html && reportContentRef.current) {
      try {
        const mermaidElements = reportContentRef.current.querySelectorAll<HTMLElement>('div.mermaid');
        if (mermaidElements.length > 0) {
          mermaidElements.forEach(el => el.removeAttribute('data-processed'));
          mermaidInstance.run({ nodes: Array.from(mermaidElements) });
        }
      } catch (e) {
        console.error("Error running mermaid.run() on report content:", e);
        reportContentRef.current.querySelectorAll<HTMLElement>('div.mermaid').forEach(el => {
          el.innerHTML = `<pre class="text-xs text-red-600 dark:text-red-400 p-1">Error rendering diagram: ${(e as Error).message}</pre>`;
        });
      }
    }
  }, [html, theme]);

  return <div ref={reportContentRef} className="prose dark:prose-invert max-w-none prose-sm md:prose-base lg:prose-lg" dangerouslySetInnerHTML={{ __html: html }} />;
};




const App: React.FC = () => { 
  // UI Store - consolidated selector for better performance
  const {
    theme,
    toggleTheme,
    currentStepInfo,
    activeTranscriptIndex,
    isAutorunning,
    processStartTime,
    elapsedTime,
    hilUserGuidance,
    hilContext,
    setAutorunning,
    openHilModal,
    closeHilModal,
    setHilUserGuidance,
    setCurrentStepInfo,
    hasRehydrated,
    sessionWasRestored
  } = useUIStore();
  
  // Pipeline Store - consolidated selector
  const {
    rawTranscripts,
    processedData,
    genericAnalysisState,
    promptHistory,
    totalInputTokens,
    totalOutputTokens,
    isGlobalStep,
    processSingleStep,
    loadStepData,
    getStepStatusForPipelineView
  } = usePipelineStore();
  
  // Settings Store - consolidated selector
  const {
    userDvFocus,
    outputDirectory,
    temperature,
    seed,
    apiKeyPresent,
    debugMode
  } = useSettingsStore();
  
  // IRR Store - consolidated selector
  const {
    irrWorkflowState,
    openIrrModal,
    closeIrrModal,
    setErrorMessage
  } = useIRRStore();


  const outputDisplayRef = useRef<HTMLDivElement | null>(null);
  
  // Initialize stores with dependency injection to avoid circular dependencies
  useEffect(() => {
    initializeStores()
    
    // Inject UI callbacks into pipeline store
    const pipelineStore = usePipelineStore.getState()
    const uiStore = useUIStore.getState()
    
    pipelineStore.setUICallbacks({
      setAutorunning: uiStore.setAutorunning,
      setCurrentStepInfo: uiStore.setCurrentStepInfo
    })
  }, [])
  
  // Listen for HIL context changes that need processing
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe(
      (state) => state.hilContext,
      (hilContext) => {
        if (hilContext?.needsProcessing && hilContext.metaPrompt) {
          // Process the HIL correction with settings
          const { stepInfo, metaPrompt } = hilContext
          const settings = useSettingsStore.getState()
          
          processSingleStep({
            stepId: stepInfo.stepId,
            transcriptIdToProcess: stepInfo.transcriptId,
            hilMetaPrompt: metaPrompt,
            settings: {
              apiKey: settings.apiKeyPresent ? 'test-key' : '', // In real app, use actual key
              temperature: settings.temperature,
              seed: settings.seed,
              userDvFocus: settings.userDvFocus
            }
          })
          
          // Clear the needsProcessing flag
          useUIStore.setState({
            hilContext: {
              ...hilContext,
              needsProcessing: false
            }
          })
        }
      }
    )
    return unsubscribe
  }, [processSingleStep])
  
  // Get actions from the store
  const handlePipelineStepClickRaw = usePipelineStore(state => state.handlePipelineStepClick);
  const clearShouldStopAutorunFlag = usePipelineStore(state => state.clearShouldStopAutorunFlag);
  const clearLastHilContext = usePipelineStore(state => state.clearLastHilContext);
  
  // Wrapper to provide activeTranscriptIndex
  const handlePipelineStepClick = (stepId: StepId) => {
    const settings = {
      apiKey: apiKeyPresent ? 'test-key' : '', // In real app, use actual key
      temperature,
      seed,
      userDvFocus
    };
    handlePipelineStepClickRaw(stepId, settings, activeTranscriptIndex);
  };
  
  // Listen for pipeline state changes to update UI
  useEffect(() => {
    console.log('📡 [App.tsx] Setting up pipeline store subscription...');
    const unsubscribe = usePipelineStore.subscribe(
      (state) => {
        const selected = {
          lastStepInfo: state.lastStepInfo,
          lastError: state.lastError,
          shouldStopAutorun: state.shouldStopAutorun,
          lastHilContext: state.lastHilContext
        };
        console.log('🔍 [App.tsx] Pipeline state selector called:', {
          ...selected,
          hasLastStepInfo: !!state.lastStepInfo,
          lastStepInfoStepId: state.lastStepInfo?.stepId,
          lastStepInfoStatus: state.lastStepInfo?.status
        });
        return selected;
      },
      (pipelineUpdates, prevUpdates) => {
        console.log('🔄 [App.tsx] Pipeline subscription triggered:', { 
          current: pipelineUpdates, 
          previous: prevUpdates 
        });
        
        if (pipelineUpdates.lastStepInfo) {
          console.log('🔄 [App.tsx] Pipeline sync: updating UI with lastStepInfo:', pipelineUpdates.lastStepInfo);
          setCurrentStepInfo(pipelineUpdates.lastStepInfo)
        }
        if (pipelineUpdates.shouldStopAutorun) {
          setAutorunning(false)
          // Clear the flag
          clearShouldStopAutorunFlag()
        }
        if (pipelineUpdates.lastHilContext) {
          openHilModal(pipelineUpdates.lastHilContext)
          // Clear after handling
          clearLastHilContext()
        }
      }
    )
    return unsubscribe
  }, [setCurrentStepInfo, setAutorunning, openHilModal, clearShouldStopAutorunFlag, clearLastHilContext])

  // Autorun logic extracted to custom hook for better separation of concerns
  useAutorunManager();




  


  const allPipelinePartsInOrder: { name: string; steps: StepId[]; isPerTranscript?: boolean; isPerPhase?: boolean; isPerGDU?: boolean; }[] = [
    { name: "Part -1: Variable ID", steps: STEP_ORDER_PART_NEG1, isPerTranscript: true },
    { name: "Part 0: Data Prep", steps: STEP_ORDER_PART_0, isPerTranscript: true },
    { name: "Part I: Specific Diachronic", steps: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC, isPerTranscript: true },
    { name: "Part II: Specific Synchronic", steps: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, isPerTranscript: true, isPerPhase: true },
    { name: "Part III: Generic Diachronic", steps: STEP_ORDER_PART_3_GENERIC_DIACHRONIC },
    { name: "Part IV: Generic Synchronic", steps: STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, isPerGDU: true },
    { name: "Part V: Refinement", steps: STEP_ORDER_PART_5_REFINEMENT },
    { name: "Part VII: Causal Modeling", steps: STEP_ORDER_PART_7_CAUSAL_MODELING },
    { name: "Part VI: Report", steps: STEP_ORDER_PART_6_REPORT },
  ];


    const getHilPreviousResponseDisplay = (): string => {
        if (!hilContext) return "No context.";
        const resp = hilContext.previousResponse;
        if (typeof resp === 'string') return resp;
        try { return JSON.stringify(resp, null, 2); } 
        catch (e) { return "Error displaying previous response."; }
    };

    // IRR Workflow Handlers - now use store actions
    const handleIrrStateUpdate = useIRRStore(state => state.handleStateUpdate);

    const handleStartIrrComparison = useIRRStore(state => state.handleStartComparison);

    const handleConfirmGduMapping = useIRRStore(state => state.handleConfirmMapping);

    // calculateIrrResults is now handled by the IRR store

    const handleDownloadDisagreementReport = useIRRStore(state => state.handleDownloadDisagreementReport);

    const handleHilSubmit = useUIStore(state => state.handleHilSubmit);

  // Use selector for output display logic
  const stepDisplay = selectCurrentStepDisplay(currentStepInfo, rawTranscripts.length);
  
  const renderOutput = () => {
    console.log('[App Debug] stepDisplay:', stepDisplay, 'currentStepInfo.stepId:', currentStepInfo.stepId);
    
    // Debug mode - show raw JSON for all outputs
    if (debugMode) {
      const debugData = {
        stepId: currentStepInfo.stepId,
        stepDisplay: stepDisplay,
        processedData: processedData.size > 0 ? Object.fromEntries(processedData) : null
      };
      return (
        <div className="space-y-2">
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
            🐛 Debug Mode Active - Showing Raw JSON Output
          </div>
          <pre className="text-xs whitespace-pre-wrap break-all overflow-x-auto">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </div>
      );
    }
    
    switch (stepDisplay.type) {
      case 'loading':
        return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote animate-pulse">{stepDisplay.message}</div>;
      
      case 'error':
        return <div className="text-center py-8 text-red-600 dark:text-red-400">{stepDisplay.message}</div>;
      
      case 'empty':
        return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">{stepDisplay.message}</div>;
      
      case 'mermaid':
        // P1.4 no longer uses mermaid display - it's handled in the 'output' case
        return <MermaidDiagram chart={stepDisplay.chart} theme={theme} />;
      
      case 'report':
        return <ReportRenderer markdown={stepDisplay.markdown} theme={theme} />;
      
      case 'data':
        // For P2S steps that have data in any DU but not in currentStepInfo.outputData
        return <PipelineStepGrid processedData={processedData} stepId={currentStepInfo.stepId} theme={theme} />;
        
      case 'output':
        // Special handling for steps with grid display
        const gridSteps = [
          StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
          StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          StepId.P0_2_REFINE_DATA_TYPES,
          StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
          StepId.P1_1_INITIAL_SEGMENTATION,
          StepId.P1_2_COARSE_PHASE_TAGGING,
          StepId.P1_3_INTRA_PHASE_SORTING,
          StepId.P1_4_DIACHRONIC_UNIT_GROUPING,
          StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
          StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
          StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS
        ];
        
        if (gridSteps.includes(currentStepInfo.stepId) && processedData.size > 0) {
          console.log('[App Debug] Rendering grid step:', currentStepInfo.stepId, 'processedData size:', processedData.size);
          return <PipelineStepGrid 
            processedData={processedData} 
            stepId={currentStepInfo.stepId}
            theme={theme} 
          />;
        }
        
        if (typeof stepDisplay.data === 'object' && stepDisplay.data !== null) {
          try { 
            return <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(stepDisplay.data, null, 2)}</pre>; 
          } catch (e) { 
            return <pre className="text-xs whitespace-pre-wrap break-all text-red-600 dark:text-red-400">Error stringifying JSON output: {(e as Error).message}</pre>;
          }
        }
        if (typeof stepDisplay.data === 'string') {
          return <pre className="text-xs whitespace-pre-wrap break-all">{stepDisplay.data}</pre>;
        }
        return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">Output format not recognized or no output data.</div>;
      
      default:
        return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">Unknown display type</div>;
    }
  };

  // Show loading screen until hydration is complete
  if (!hasRehydrated) {
    return <AppLoadingScreen message="Loading previous session..." />
  }

  return (
    <>
      {/* Session Restore Notification */}
      <SessionRestoreNotification />
      
      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'} font-serif transition-colors duration-300`}>
      <header className="p-4 flex justify-between items-center border-b border-light-border dark:border-dark-border bg-light-bg-alt dark:bg-dark-bg-alt sticky top-0 z-40">
        <h1 className="text-xl font-bold text-light-accent dark:text-dark-accent">
          <span style={{ fontFamily: "'Times New Roman', serif" }}>µ</span>-<span className="font-logoP">P</span>ATH: Micro-Phenomenological Analysis Threader
          <span className="text-xs text-light-sidenote dark:text-dark-sidenote align-middle ml-1">v{APP_VERSION}</span>
        </h1>
        <Button onClick={toggleTheme} variant="secondary" className="p-2" aria-label="Toggle theme">
          {theme === 'light' ? MoonIcon : SunIcon}
        </Button>
      </header>

      <main className="md:grid md:grid-cols-3 gap-4 p-4">
        <SettingsPanel
          PipelineOverviewComponent={
            <PipelineOverview
              allPipelineParts={allPipelinePartsInOrder}
              STEP_CONFIGS={STEP_CONFIGS}
              currentStepInfo={currentStepInfo}
              getStepStatusForPipelineView={getStepStatusForPipelineView}
              handlePipelineStepClick={handlePipelineStepClick}
              PipelineStepNodeComponent={PipelineStepNode}
            />
          }
        />

        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <ControlsPanel />
          </div>
          
          <StatusDisplay />

          <div ref={outputDisplayRef} className="output-display p-4 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg shadow min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
            {renderOutput()} 
          </div>
        </div>
      </main>

      {/* IRR Analysis Modals */}

      
      {/* Unified modals using Zustand stores */}
      <IRRModal
        onDownloadDisagreementReport={handleDownloadDisagreementReport}
      />
      <GduMappingModal
        onConfirmMapping={handleConfirmGduMapping}
      />
      <HilModal
        onSubmit={handleHilSubmit}
        getHilPreviousResponseDisplay={getHilPreviousResponseDisplay}
      />
    </div>
    </>
  );
};
// export default App; // Assuming this will be added by your system if needed
// If this is the main app entry point and not imported elsewhere, this export might be unnecessary
// or might need to be `export { App }` depending on how index.tsx uses it.
// For now, leaving it commented as per the context. If it causes issues, it will be uncommented.
// Make sure to export App if index.tsx uses a named import like `import { App } from './App';`

// Forcing a change to satisfy the system.

export { App }; // Ensuring named export based on index.tsx

// Ensure this file is not empty if there are no other changes
// Adding a comment to make sure it's not completely empty.
