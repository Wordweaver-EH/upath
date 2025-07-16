


import React, { useState, useEffect, useRef } from 'react';
import { marked, Renderer as MarkedRenderer, MarkedOptions, Tokens } from 'marked';
import DOMPurify from 'dompurify';
import {
  TranscriptProcessedData, GenericAnalysisState, StepId, StepStatus,
  P2SPhaseData, IrrWorkflowState, IrrResults, P9_1_SemanticGduMapping,
  AppState
} from './types';
import {
  ESSENTIAL_STEPS_FOR_AUTODOWNLOAD,
  STEP_ORDER_PART_NEG1, STEP_ORDER_PART_0, STEP_ORDER_PART_I as STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_II as STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, STEP_ORDER_PART_III as STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_IV as STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, STEP_ORDER_PART_V as STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_VII as STEP_ORDER_PART_7_CAUSAL_MODELING, STEP_ORDER_PART_VI as STEP_ORDER_PART_6_REPORT
} from './src/config/pipelineConfig';
import { buildCompleteUtteranceToGduMapping } from './src/utils/traceabilityHelper';
import { calculateKrippendorffsAlpha, buildReliabilityMatrix, validateReliabilityMatrix } from './src/utils/statisticsHelper';
import { generateTsvForPromptHistory } from './src/utils/tsvHelper';
import { generateHtmlAppendix, calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from './src/utils/htmlHelper';
import { callGeminiAPI } from './services/geminiService';
import { stepIdToDataKeyPrefix } from './src/utils/stepIdToDataKeyPrefix';

import MermaidDiagram from './src/components/MermaidDiagram';
import SettingsPanel from './src/components/SettingsPanel';
import ControlsPanel from './src/components/ControlsPanel';
import StatusDisplay from './src/components/StatusDisplay';
import HilModal from './src/components/HilModal';
import PipelineOverview, { PipelineStepNode } from './src/components/PipelineOverview';
import { Button } from './src/components/ui';
import { MoonIcon, SunIcon } from './src/components/ui/Icons';
import IRRModal from './src/components/IRRModal';
import GduMappingModal from './src/components/GduMappingModal';
import { P_NEG1_1_VariableDisplay } from './src/components/P_NEG1_1_VariableDisplay';
import { AppLoadingScreen } from './src/components/AppLoadingScreen';
import { SessionRestoreNotification } from './src/components/SessionRestoreNotification';

import { useUIStore, useSettingsStore, useIRRStore, initializeStores, selectCurrentStepDisplay } from './src/stores';
import { useTranscriptStore } from './src/stores/transcriptStore';
import { useAnalysisResultStore } from './src/stores/analysisResultStore';
import { usePromptHistoryStore } from './src/stores/promptHistoryStore';
import { usePipelineOrchestrationStore } from './src/stores/pipelineOrchestrationStore';
import { useStoreActions } from './src/stores/storeComposition';
import { useAutorunManager } from './src/hooks/useAutorunManager';
import { BackendToggle } from './src/components/BackendToggle';
import packageJson from './package.json';

const APP_VERSION = packageJson.version;

// Constants moved outside component to prevent redeclaration on every render
const GLOBAL_STEPS = [
  StepId.P3_1_MERGE_RESULTS,
  StepId.P3_2_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
  StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
  StepId.P4S_2_ANALYZE_SCD,
  StepId.P4S_3_REVIEW_GDC,
  StepId.P4S_4_DRAFT_REFINED_GENERIC_STRUCTURE,
  StepId.P5_1_CONSTRUCT_CAUSAL_MODELS,
  StepId.P5_2_GENERATE_REPORTS
] as const;

const isGlobalStep = (stepId: StepId): boolean => {
  return GLOBAL_STEPS.includes(stepId as any);
};

const ALL_PIPELINE_PARTS_IN_ORDER: { 
  name: string; 
  steps: StepId[]; 
  isPerTranscript?: boolean; 
  isPerPhase?: boolean; 
  isPerGDU?: boolean; 
}[] = [
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

// Helper function moved outside component to prevent recreation on every render
const getHilPreviousResponseDisplay = (hilContext: any): string => {
  if (!hilContext) return "No context.";
  const resp = hilContext.previousResponse;
  if (typeof resp === 'string') return resp;
  try { return JSON.stringify(resp, null, 2); } 
  catch (e) { return "Error displaying previous response."; }
};

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

    renderer.code = (token: Tokens.Code): string | false => {
      const { text: code, lang: infostring } = token;
      const currentLang = (infostring || '').match(/\S*/)?.[0];

      if (currentLang === 'mermaid') {
        return `<div class="mermaid">${code}</div>\n`;
      }
      const originalRenderedOutput = originalBaseCodeRenderer(token);
      
      // Handle string return value (normal case)
      if (typeof originalRenderedOutput === 'string') {
        return originalRenderedOutput;
      }
      
      // Handle false return value (use default renderer)
      if (originalRenderedOutput === false) {
        // Return false to let marked use its default renderer
        return false;
      }
      
      // Handle any other unexpected return values
      console.warn(`Marked's original code renderer returned unexpected value for language: "${infostring}". Falling back to manual rendering.`, { 
        token, 
        originalRenderedOutput, 
        valueType: typeof originalRenderedOutput 
      });
      
      // Manual fallback rendering with proper HTML escaping
      const textToEscape = token.text || '';
      const htmlEscapedCode = textToEscape
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      
      const languageClass = infostring ? ` class="language-${infostring}"` : '';
      return `<pre><code${languageClass}>${htmlEscapedCode}</code></pre>\n`;
    };

    const options: MarkedOptions = { renderer };
    const parsed = marked.parse(markdown, options) as string;
    
    // Sanitize HTML to prevent XSS attacks
    const cleanHtml = DOMPurify.sanitize(parsed, { 
      ADD_TAGS: ['div'], 
      ADD_ATTR: ['class'] 
    });
    setHtml(cleanHtml);
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
  
  // Get data from specific stores
  const rawTranscripts = useTranscriptStore(state => state.rawTranscripts);
  const processedData = useTranscriptStore(state => state.processedData);
  const genericAnalysisState = useAnalysisResultStore(state => state.genericAnalysisState);
  const promptHistory = usePromptHistoryStore(state => state.promptHistory);
  const totalInputTokens = usePromptHistoryStore(state => state.totalInputTokens);
  const totalOutputTokens = usePromptHistoryStore(state => state.totalOutputTokens);
  
  // Get actions from useStoreActions
  const {
    processSingleStep,
    loadStepData,
    getStepStatusForPipelineView,
    handlePipelineStepClick,
    coordinateRehydration
  } = useStoreActions();
  
  
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
  
  // Initialize stores with dependency injection to avoid circular dependencies
  useEffect(() => {
    initializeStores()
  }, [])
  
  // Coordinate rehydration across stores on app start
  useEffect(() => {
    console.log('🚀 [App.tsx] Initializing application and rehydrating stores...');
    coordinateRehydration().then((restored) => {
      console.log(`✅ [App.tsx] Rehydration complete. Session restored: ${restored}`);
    });
  }, []); // Empty dependency array - run only once on mount
  
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
            hilMetaPrompt: metaPrompt
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
  
  // Get orchestration state and actions
  const shouldStopAutorun = usePipelineOrchestrationStore(state => state.shouldStopAutorun);
  const lastHilContext = usePipelineOrchestrationStore(state => state.lastHilContext);
  const clearShouldStopAutorun = usePipelineOrchestrationStore(state => state.clearShouldStopAutorun);
  const clearHilContext = usePipelineOrchestrationStore(state => state.clearHilContext);
  
  // Listen for orchestration state changes to update UI
  useEffect(() => {
    console.log('📡 [App.tsx] Setting up orchestration store subscription...');
    const unsubscribe = usePipelineOrchestrationStore.subscribe(
      (state) => ({
        shouldStopAutorun: state.shouldStopAutorun,
        lastHilContext: state.lastHilContext
      }),
      (orchestrationUpdates) => {
        console.log('🔄 [App.tsx] Orchestration subscription triggered:', orchestrationUpdates);
        
        if (orchestrationUpdates.shouldStopAutorun) {
          setAutorunning(false)
          // Clear the flag
          clearShouldStopAutorun()
        }
        if (orchestrationUpdates.lastHilContext) {
          openHilModal(orchestrationUpdates.lastHilContext)
          // Clear after handling
          clearHilContext()
        }
      }
    )
    return unsubscribe
  }, [setAutorunning, openHilModal, clearShouldStopAutorun, clearHilContext])

  // Autorun logic extracted to custom hook for better separation of concerns
  useAutorunManager();




  





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
    switch (stepDisplay.type) {
      case 'loading':
        return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote animate-pulse">{stepDisplay.message}</div>;
      
      case 'error':
        return <div className="text-center py-8 text-red-600 dark:text-red-400">{stepDisplay.message}</div>;
      
      case 'empty':
        return <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">{stepDisplay.message}</div>;
      
      case 'mermaid':
        return <MermaidDiagram chart={stepDisplay.chart} theme={theme} />;
      
      case 'report':
        return <ReportRenderer markdown={stepDisplay.markdown} theme={theme} />;
      
      case 'variable_table':
        // Render the table directly in the output area instead of JSON
        return <P_NEG1_1_VariableDisplay />;
      
      case 'output':
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
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </Button>
      </header>

      <main className="md:grid md:grid-cols-3 gap-4 p-4">
        <SettingsPanel
          PipelineOverviewComponent={
            <PipelineOverview
              allPipelineParts={ALL_PIPELINE_PARTS_IN_ORDER}
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
            <div className="p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg shadow">
              <BackendToggle />
            </div>
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
        getHilPreviousResponseDisplay={() => getHilPreviousResponseDisplay(hilContext)}
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
