


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
import { buildCompleteUtteranceToGduMapping } from './utils/traceabilityHelper';
import { calculateKrippendorffsAlpha, buildReliabilityMatrix, validateReliabilityMatrix } from './utils/statisticsHelper';
import { generateTsvForPromptHistory } from './utils/tsvHelper';
import { generateHtmlAppendix, calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from './utils/htmlHelper';
import { callGeminiAPI } from './services/geminiService';
import { stepIdToDataKeyPrefix } from './src/utils/stepIdToDataKeyPrefix';

import MermaidDiagram from './components/MermaidDiagram';
import SettingsPanel from './components/SettingsPanel';
import ControlsPanel from './components/ControlsPanel';
import StatusDisplay from './components/StatusDisplay';
import HilModal from './components/HilModal';
import PipelineOverview, { PipelineStepNode } from './components/PipelineOverview';
import IRRModal from './components/IRRModal';
import GduMappingModal from './components/GduMappingModal';

import { useUIStore, useSettingsStore, usePipelineStore, useIRRStore, initializeStores } from './src/stores';
import { useAutorunManager } from './src/hooks/useAutorunManager';


const APP_VERSION = '0.10.0'; // Version from package.json 

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
  // Initialize stores with dependency injection to avoid circular dependencies
  useEffect(() => {
    initializeStores()
  }, [])

  // Migration to Zustand is now complete - no longer need feature flag

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
    setCurrentStepInfo
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
    seed
  } = useSettingsStore();
  
  // IRR Store - consolidated selector
  const {
    irrWorkflowState,
    openIrrModal,
    closeIrrModal,
    setErrorMessage
  } = useIRRStore();


  const outputDisplayRef = useRef<HTMLDivElement | null>(null);

  // Autorun logic extracted to custom hook for better separation of concerns
  useAutorunManager();



  const handlePipelineStepClick = usePipelineStore(state => state.handlePipelineStepClick);




  

  const inputBaseClasses = "block w-full text-sm rounded-md shadow-sm bg-light-input-bg dark:bg-dark-input-bg text-light-text dark:text-dark-text placeholder-light-sidenote dark:placeholder-dark-sidenote focus:ring-light-accent dark:focus:ring-dark-accent focus:border-light-accent dark:focus:border-dark-accent";
  const baseButtonClasses = "inline-flex items-center justify-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-light-bg-alt dark:focus:ring-offset-dark-bg-alt transition-colors duration-150";
  const primaryButtonClasses = `${baseButtonClasses} bg-light-accent hover:bg-light-accent-hover text-white dark:bg-dark-accent dark:hover:bg-dark-accent-hover dark:text-dark-bg`;
  const secondaryButtonClasses = `${baseButtonClasses} bg-light-btn dark:bg-dark-btn text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border border border-light-border dark:border-dark-border`;
  const disabledButtonClasses = "opacity-50 cursor-not-allowed";

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

  const renderOutput = () => {
    if (currentStepInfo.status === StepStatus.Loading) {
      return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote animate-pulse">Loading output...</div>;
    }
    if (currentStepInfo.status === StepStatus.Error && !currentStepInfo.outputData) { 
      return <div className="text-center py-8 text-red-600 dark:text-red-400">Error occurred. See status bar for details.</div>;
    }
    if (!currentStepInfo.outputData && currentStepInfo.stepId !== StepId.IDLE) {
      return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">No output to display for this step yet.</div>;
    }
    if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length === 0) {
      return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">Upload transcripts to begin.</div>;
    }
    if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0) {
      return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">Ready to start. Click "Autorun" or "Next Step".</div>;
    }

    const outputData = currentStepInfo.outputData;
    let mermaidChart: string | undefined = undefined;
    const tId = currentStepInfo.transcriptId;
    const phase = currentStepInfo.currentPhaseForP2S;
    const gdu = currentStepInfo.currentGduForP4S;

    if (currentStepInfo.stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && tId) mermaidChart = processedData.get(tId)?.p1_4_mermaid_syntax;
    else if (currentStepInfo.stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE && tId && phase) mermaidChart = processedData.get(tId)?.p2s_outputs_by_phase?.[phase]?.p2s_3_mermaid_syntax;
    else if (currentStepInfo.stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) mermaidChart = genericAnalysisState.p3_3_mermaid_syntax;
    else if (currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && gdu) {
        // No mermaid for P4S_1_A, just display output
    } else if (currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && gdu) mermaidChart = genericAnalysisState.p4s_mermaid_syntax_by_gdu?.[gdu];
    else if (currentStepInfo.stepId === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) mermaidChart = genericAnalysisState.p7_3_mermaid_syntax_dag;
    else if (currentStepInfo.stepId === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) mermaidChart = genericAnalysisState.p7_3b_mermaid_syntax_dag;

    if (mermaidChart) return <MermaidDiagram chart={mermaidChart} theme={theme} />;
    
    if (currentStepInfo.stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT || currentStepInfo.stepId === StepId.COMPLETE) {
      if (typeof outputData === 'string' && outputData.trim() !== "") return <ReportRenderer markdown={outputData} theme={theme} />;
      return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">Report not generated or empty.</div>;
    }

    if (typeof outputData === 'object' && outputData !== null) {
      try { return <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(outputData, null, 2)}</pre>; } 
      catch (e) { return <pre className="text-xs whitespace-pre-wrap break-all text-red-600 dark:text-red-400">Error stringifying JSON output: {(e as Error).message}</pre>;}
    }
    if (typeof outputData === 'string') return <pre className="text-xs whitespace-pre-wrap break-all">{outputData}</pre>;
    
    return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">Output format not recognized or no output data.</div>;
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'} font-serif transition-colors duration-300`}>
      <header className="p-4 flex justify-between items-center border-b border-light-border dark:border-dark-border bg-light-bg-alt dark:bg-dark-bg-alt sticky top-0 z-40">
        <h1 className="text-xl font-bold text-light-accent dark:text-dark-accent">
          <span style={{ fontFamily: "'Times New Roman', serif" }}>µ</span>-<span className="font-logoP">P</span>ATH: Micro-Phenomenological Analysis Threader
          <span className="text-xs text-light-sidenote dark:text-dark-sidenote align-middle ml-1">v{APP_VERSION}</span>
        </h1>
        <button onClick={toggleTheme} className={`${secondaryButtonClasses} p-2`} aria-label="Toggle theme">
          {theme === 'light' ? MoonIcon : SunIcon}
        </button>
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
          inputBaseClasses={inputBaseClasses}
          secondaryButtonClasses={secondaryButtonClasses}
          disabledButtonClasses={disabledButtonClasses}
        />

        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <ControlsPanel
              inputBaseClasses={inputBaseClasses} 
              primaryButtonClasses={primaryButtonClasses} 
              secondaryButtonClasses={secondaryButtonClasses} 
              disabledButtonClasses={disabledButtonClasses}
            />
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
        primaryButtonClasses={primaryButtonClasses}
        secondaryButtonClasses={secondaryButtonClasses}
        inputBaseClasses={inputBaseClasses}
        disabledButtonClasses={disabledButtonClasses}
      />
      <GduMappingModal
        onConfirmMapping={handleConfirmGduMapping}
        primaryButtonClasses={primaryButtonClasses}
        secondaryButtonClasses={secondaryButtonClasses}
        inputBaseClasses={inputBaseClasses}
        disabledButtonClasses={disabledButtonClasses}
      />
      <HilModal
        onSubmit={handleHilSubmit}
        getHilPreviousResponseDisplay={getHilPreviousResponseDisplay}
        inputBaseClasses={inputBaseClasses}
        secondaryButtonClasses={secondaryButtonClasses}
        primaryButtonClasses={primaryButtonClasses}
        disabledButtonClasses={disabledButtonClasses}
      />
    </div>
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
