


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marked, Renderer as MarkedRenderer, MarkedOptions, Tokens } from 'marked';
import {
  RawTranscript, TranscriptProcessedData, GenericAnalysisState, StepId, StepStatus,
  PromptHistoryEntry, CurrentStepInfo, UserDVFocus, P2SPhaseData,
  P1_4_Output, P2S_1_Output, P2S_2_Output, P2S_3_Output, P3_2_Output, P3_2_Classification, P3_2_IdentifiedGdu, P3_3_Output, P4S_1_A_Output, P4S_1_Output, P6_1_Output, AppState, P7_3_Output, P7_3b_Output,
  P0_1_Output, P0_2_Output, P0_3_Output, P_neg1_1_Output
} from './types';
import {
  STEP_CONFIGS, ALL_PIPELINE_STEP_IDS_IN_ORDER, ESSENTIAL_STEPS_FOR_AUTODOWNLOAD,
  STEP_ORDER_PART_NEG1, STEP_ORDER_PART_0, STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_7_CAUSAL_MODELING, STEP_ORDER_PART_6_REPORT,
  PlayIcon, PauseIcon, DownloadIcon, NextIcon, PreviousIcon, RetryIcon,
  SaveIcon, LoadIcon, LightbulbIcon, CheckCircleIcon, UploadIcon, FileTextIcon, InfoIcon, AppendixIcon, ChevronDownIcon, ChevronUpIcon,
  USE_TWO_PHASE_P3_2
} from './constants';
import { callGeminiAPI, isApiKeySet } from './services/geminiService';
import { downloadFile, generateTsvForPromptHistory, genericJsonToTsv, generateTsvForP0_1, generateTsvForP0_2, generateTsvForP0_3, generateTsvForTranscriptDiachronic, generateTsvForTranscriptSynchronic } from './utils/tsvHelper';
import { generateHtmlAppendix, calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from './utils/htmlHelper';
import { generateMarkdownReportProgrammatically, ReportData } from './utils/reportHelper';
import {
    transformDiachronicToMermaid, transformSynchronicToMermaid,
    transformGenericDiachronicToMermaid, transformDagToMermaid
} from './utils/visualizationHelper';

import CollapsibleSection from './components/CollapsibleSection';
import MermaidDiagram from './components/MermaidDiagram';
import SettingsPanel from './components/SettingsPanel';
import ControlsPanel from './components/ControlsPanel';
import StatusDisplay from './components/StatusDisplay';
import HilModal from './components/HilModal';
import PipelineOverview, { PipelineStepNode } from './components/PipelineOverview';


const APP_VERSION = "1.9.1"; 

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

const stepIdToDataKeyPrefix: Partial<Record<StepId, keyof GenericAnalysisState | keyof TranscriptProcessedData | keyof P2SPhaseData>> = {
  [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: "p_neg1_1_output",
  [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: "p0_1_output",
  [StepId.P0_2_REFINE_DATA_TYPES]: "p0_2_output",
  [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: "p0_3_output",
  [StepId.P1_1_INITIAL_SEGMENTATION]: "p1_1_output",
  [StepId.P1_2_DIACHRONIC_UNIT_ID]: "p1_2_output",
  [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: "p1_3_output",
  [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: "p1_4_output",
  [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: "p2s_1_output",
  [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: "p2s_2_output",
  [StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE]: "p2s_3_output",
  [StepId.P3_1_ALIGN_STRUCTURES]: "p3_1_output",
  [StepId.P3_2_IDENTIFY_GDUS]: "p3_2_output",
  [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: "p3_3_output",
  [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: "p4s_1_a_outputs_by_gdu",
  [StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS]: "p4s_outputs_by_gdu",
  [StepId.P5_1_HOLISTIC_REVIEW_REFINEMENT]: "p5_1_output",
  [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: "p7_1_output",
  [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: "p7_2_output",
  [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: "p7_3_output",
  [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: "p7_3b_output",
  [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: "p7_4_output",
  [StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]: "p7_5_output",
  [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: "p6_1_output",
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


interface PreviousStepResult {
  prevStepId: StepId;
  prevTranscriptIndex: number;
  prevPhaseForP2S?: string;
  prevGduForP4S?: string;
}


const App: React.FC = () => { 
  const [rawTranscripts, setRawTranscripts] = useState<RawTranscript[]>([]);
  const [processedData, setProcessedData] = useState<Map<string, TranscriptProcessedData>>(new Map());
  const [genericAnalysisState, setGenericAnalysisState] = useState<GenericAnalysisState>({
    isFullyProcessedGenericDiachronic: false, p3_1_output: undefined, p3_1_error: undefined,
    p3_2_output: undefined, p3_2_error: undefined, p3_3_output: undefined, p3_3_mermaid_syntax: undefined, p3_3_error: undefined,
    
    p4s_1_a_outputs_by_gdu: {}, 
    p4s_1_a_error: undefined,
    p4s_outputs_by_gdu: {}, 
    p4s_mermaid_syntax_by_gdu: {}, 
    p4s_1_b_error: undefined,
    current_gdu_for_p4s_processing: undefined,
    core_gdus_for_sync_analysis: [], 
    processed_gdus_for_p4s: [], 
    isFullyProcessedGenericSynchronic: false,

    p5_1_output: undefined, p5_1_error: undefined, isRefinementDone: false,
    p7_1_output: undefined, p7_1_error: undefined, p7_2_output: undefined, p7_2_error: undefined,
    p7_3_output: undefined, p7_3_mermaid_syntax_dag: undefined, p7_3_error: undefined,
    p7_3b_output: undefined, p7_3b_mermaid_syntax_dag: undefined, p7_3b_error: undefined,
    p7_4_output: undefined, p7_4_error: undefined, p7_5_output: undefined, p7_5_error: undefined, isCausalModelingDone: false,
    p6_1_output: undefined, p6_1_error: undefined, isReportGenerated: false,
  });
  
  const [currentStepInfo, setCurrentStepInfo] = useState<CurrentStepInfo>({ stepId: StepId.IDLE, status: StepStatus.Idle });
  const [activeTranscriptIndex, setActiveTranscriptIndex] = useState<number>(0);
  const [isAutorunning, setIsAutorunning] = useState<boolean>(false);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [apiKeyPresent, setApiKeyPresent] = useState<boolean>(false);
  const [userDvFocus, setUserDvFocus] = useState<UserDVFocus>({ dv_focus: [] });
  const [dvFocusInput, setDvFocusInput] = useState<string>('cognitions, emotions, sensations, imagination, internal_experiences');
  const [dvFocusError, setDvFocusError] = useState<string>('');
  const [outputDirectory, setOutputDirectory] = useState<string>('MicroPheno_Analysis_Outputs');
  const [autoDownloadResults, setAutoDownloadResults] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(0.0);
  const [seedInput, setSeedInput] = useState<string>('42'); 
  const [seed, setSeed] = useState<number | undefined>(42);  
  const [retrySeedInput, setRetrySeedInput] = useState<string>('');
  const [totalInputTokens, setTotalInputTokens] = useState<number>(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState<number>(0);
  const [processStartTime, setProcessStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isHilModalOpen, setIsHilModalOpen] = useState<boolean>(false);
  const [hilUserGuidance, setHilUserGuidance] = useState<string>('');
  const [hilContext, setHilContext] = useState<{ stepInfo: CurrentStepInfo; originalPrompt: string; previousResponse: string; } | null>(null);

  const outputDisplayRef = useRef<HTMLDivElement | null>(null);
  const loadStateInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('app-theme');
      if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light'; 
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      const body = window.document.body;
      root.classList.remove(theme === 'light' ? 'dark' : 'light');
      root.classList.add(theme);
      body.classList.remove(theme === 'light' ? 'dark' : 'light');
      body.classList.add(theme);
      localStorage.setItem('app-theme', theme);
      if (window.reinitializeMermaidTheme) window.reinitializeMermaidTheme();
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');

  useEffect(() => setApiKeyPresent(isApiKeySet()), []);

  useEffect(() => {
    const focuses = dvFocusInput.split(',').map(focus => focus.trim()).filter(focus => focus.length > 0);
    if (dvFocusInput.trim() === '') setDvFocusError("DV Focus is required.");
    else if (focuses.length === 0) setDvFocusError("No valid DVs found.");
    else { setUserDvFocus({ dv_focus: focuses }); setDvFocusError(''); }
  }, [dvFocusInput]);

  useEffect(() => {
    const num = parseInt(seedInput, 10);
    if (!isNaN(num) && num > 0) { setSeed(num); setRetrySeedInput(seedInput); }
    else { setSeed(undefined); setRetrySeedInput(''); }
  }, [seedInput]);

  useEffect(() => {
    let timerInterval: number | undefined;
    const timerIsActive = (isAutorunning || currentStepInfo.status === StepStatus.Loading) && processStartTime !== null;
    if (timerIsActive) {
      timerInterval = setInterval(() => {
        if (processStartTime) setElapsedTime(Math.floor((Date.now() - processStartTime) / 1000));
      }, 1000) as any;
    } else if (processStartTime) {
      setElapsedTime(Math.floor((Date.now() - processStartTime) / 1000));
    }
    return () => { if (timerInterval) clearInterval(timerInterval); };
  }, [isAutorunning, currentStepInfo.status, processStartTime]);

  const resetAllStateForLoadOrNew = () => {
    setRawTranscripts([]); setProcessedData(new Map());
    setGenericAnalysisState({
        isFullyProcessedGenericDiachronic: false, p3_1_output: undefined, p3_1_error: undefined,
        p3_2_output: undefined, p3_2_error: undefined, p3_3_output: undefined, p3_3_mermaid_syntax: undefined, p3_3_error: undefined,
        
        p4s_1_a_outputs_by_gdu: {}, 
        p4s_1_a_error: undefined,
        p4s_outputs_by_gdu: {}, 
        p4s_mermaid_syntax_by_gdu: {}, 
        p4s_1_b_error: undefined,
        current_gdu_for_p4s_processing: undefined,
        core_gdus_for_sync_analysis: [], 
        processed_gdus_for_p4s: [], 
        isFullyProcessedGenericSynchronic: false,
    
        p5_1_output: undefined, p5_1_error: undefined, isRefinementDone: false,
        p7_1_output: undefined, p7_1_error: undefined, p7_2_output: undefined, p7_2_error: undefined,
        p7_3_output: undefined, p7_3_mermaid_syntax_dag: undefined, p7_3_error: undefined,
        p7_3b_output: undefined, p7_3b_mermaid_syntax_dag: undefined, p7_3b_error: undefined,
        p7_4_output: undefined, p7_4_error: undefined, p7_5_output: undefined, p7_5_error: undefined, isCausalModelingDone: false,
        p6_1_output: undefined, p6_1_error: undefined, isReportGenerated: false,
    });
    setCurrentStepInfo({ stepId: StepId.IDLE, status: StepStatus.Idle });
    setPromptHistory([]); setActiveTranscriptIndex(0);
    setTotalInputTokens(0); setTotalOutputTokens(0);
    setProcessStartTime(null); setElapsedTime(0); setIsAutorunning(false);
  };

  const processFiles = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
        resetAllStateForLoadOrNew();
        const newTranscripts: RawTranscript[] = Array.from(files).map((file, index) => ({
            id: `transcript_${Date.now()}_${index}`, filename: file.name, content: '',
        }));
        const filesArray = Array.from(files);
        newTranscripts.forEach(transcript => {
            const currentFile = filesArray.find(f => f.name === transcript.filename);
            if (currentFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    setRawTranscripts(prev => prev.map(t => t.id === transcript.id ? { ...t, content } : t));
                    setProcessedData(prevMap => new Map(prevMap).set(transcript.id, {
                        id: transcript.id, filename: transcript.filename, isFullyProcessedSpecificDiachronic: false,
                        p2s_outputs_by_phase: {}, phases_for_p2s_processing: [], current_phase_for_p2s_processing: undefined,
                        processed_phases_for_p2s: [], isFullyProcessedSpecificSynchronic: false,
                    }));
                };
                reader.readAsText(currentFile);
            }
        });
        setRawTranscripts(newTranscripts);
    }
  }, []);

  const handleRegularFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    if (fileUploadInputRef.current) fileUploadInputRef.current.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (!apiKeyPresent || !!dvFocusError) return;
    setIsDraggingOver(true);
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(false);
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(false);
    if (!apiKeyPresent || !!dvFocusError) return;
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const textFiles = Array.from(files).filter(file => file.type === "text/plain" || file.name.endsWith(".txt"));
      if (textFiles.length > 0) {
        const dataTransfer = new DataTransfer();
        textFiles.forEach(file => dataTransfer.items.add(file));
        processFiles(dataTransfer.files);
      } else alert("Please drop .txt files only.");
    }
  };
  
  const isGlobalStep = (stepId: StepId) => STEP_ORDER_PART_3_GENERIC_DIACHRONIC.includes(stepId) ||
    STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId) || STEP_ORDER_PART_5_REFINEMENT.includes(stepId) ||
    STEP_ORDER_PART_7_CAUSAL_MODELING.includes(stepId) || STEP_ORDER_PART_6_REPORT.includes(stepId) || stepId === StepId.COMPLETE;

  const getNextStepDetails = useCallback((): { nextStepId: StepId; nextTranscriptIndex: number } | null => {
    const currentTranscriptId = rawTranscripts[activeTranscriptIndex]?.id;
    const currentTData = currentTranscriptId ? processedData.get(currentTranscriptId) : undefined;

    if (currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0) {
      return { nextStepId: STEP_ORDER_PART_NEG1[0], nextTranscriptIndex: 0 };
    }

    const currentPartNeg1StepIndex = STEP_ORDER_PART_NEG1.indexOf(currentStepInfo.stepId);
    if (currentPartNeg1StepIndex !== -1) {
      const pNeg1DoneThisTranscript = currentTData?.p_neg1_1_output || currentTData?.p_neg1_1_error;
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || pNeg1DoneThisTranscript) {
        if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_NEG1[0], nextTranscriptIndex: activeTranscriptIndex + 1 };
        const allVarIdDone = rawTranscripts.every(rt => processedData.get(rt.id)?.p_neg1_1_output || processedData.get(rt.id)?.p_neg1_1_error);
        if (allVarIdDone) return { nextStepId: STEP_ORDER_PART_0[0], nextTranscriptIndex: 0 };
      }
    }
    
    const currentPart0StepIndex = STEP_ORDER_PART_0.indexOf(currentStepInfo.stepId);
    if (currentPart0StepIndex !== -1) {
      const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof TranscriptProcessedData;
      const part0OutputExists = key && (currentTData?.[key] || currentTData?.[`${key.replace('_output', '_error')}` as keyof TranscriptProcessedData]);
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || part0OutputExists) {
        if (currentPart0StepIndex < STEP_ORDER_PART_0.length - 1) return { nextStepId: STEP_ORDER_PART_0[currentPart0StepIndex + 1], nextTranscriptIndex: activeTranscriptIndex };
        if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_0[0], nextTranscriptIndex: activeTranscriptIndex + 1 };
        if (rawTranscripts.every(rt => STEP_ORDER_PART_0.every(s => { const k=stepIdToDataKeyPrefix[s]as keyof TranscriptProcessedData; return k&&(processedData.get(rt.id)?.[k]||processedData.get(rt.id)?.[`${k.replace('_output','_error')}` as keyof TranscriptProcessedData]); })))
          return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: 0 };
      }
    }

    const currentPart1StepIndex = STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.indexOf(currentStepInfo.stepId);
    if (currentPart1StepIndex !== -1) {
      const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof TranscriptProcessedData;
      const part1OutputExists = key && (currentTData?.[key] || currentTData?.[`${key.replace('_output', '_error')}` as keyof TranscriptProcessedData]);
      if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || part1OutputExists) {
        if (currentPart1StepIndex < STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.length - 1) return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[currentPart1StepIndex + 1], nextTranscriptIndex: activeTranscriptIndex };
        if (currentStepInfo.stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && currentTData?.isFullyProcessedSpecificDiachronic) {
            if (currentTData.phases_for_p2s_processing?.length > 0 && !currentTData.isFullyProcessedSpecificSynchronic) return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], nextTranscriptIndex: activeTranscriptIndex };
            if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: activeTranscriptIndex + 1 };
            if (rawTranscripts.every(rt => processedData.get(rt.id)?.isFullyProcessedSpecificDiachronic) && rawTranscripts.every(rt => { const d=processedData.get(rt.id); return !d||(!d.phases_for_p2s_processing?.length||d.isFullyProcessedSpecificSynchronic); }))
              return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], nextTranscriptIndex: 0 };
        }
      }
    }
    
    const currentP2SStepIndex = STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.indexOf(currentStepInfo.stepId);
    if (currentP2SStepIndex !== -1 && currentTData) {
        const phaseDone = currentStepInfo.currentPhaseForP2S;
        let p2sOutputForCurrentPhaseAndStepExists = false;
        if (phaseDone) {
            const key = stepIdToDataKeyPrefix[currentStepInfo.stepId] as keyof P2SPhaseData;
            if (key) {
                const pData = currentTData.p2s_outputs_by_phase?.[phaseDone];
                p2sOutputForCurrentPhaseAndStepExists = !!(pData?.[key] || pData?.[`${key.replace('_output', '_error')}` as keyof P2SPhaseData]);
            }
        } else if (currentTData.isFullyProcessedSpecificSynchronic && !currentTData.phases_for_p2s_processing?.length) p2sOutputForCurrentPhaseAndStepExists = true;

        if (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || p2sOutputForCurrentPhaseAndStepExists) {
            if (currentP2SStepIndex < STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length - 1) return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[currentP2SStepIndex + 1], nextTranscriptIndex: activeTranscriptIndex };
            if (currentStepInfo.stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
                if (currentTData.current_phase_for_p2s_processing) return { nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0], nextTranscriptIndex: activeTranscriptIndex }; // Next phase for P2S.1
                if (activeTranscriptIndex < rawTranscripts.length - 1) return { nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0], nextTranscriptIndex: activeTranscriptIndex + 1 }; // Next transcript for P1.1
                if (rawTranscripts.every(rt => { const d=processedData.get(rt.id); return d&&d.isFullyProcessedSpecificDiachronic&& (d.isFullyProcessedSpecificSynchronic||!d.phases_for_p2s_processing?.length); }))
                  return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], nextTranscriptIndex: 0 }; // All P1/P2S done, move to P3
            }
        }
    }

    const currentPart3StepIndex = STEP_ORDER_PART_3_GENERIC_DIACHRONIC.indexOf(currentStepInfo.stepId);
    if (currentPart3StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isFullyProcessedGenericDiachronic)) {
        if (genericAnalysisState.isFullyProcessedGenericDiachronic) { // If P3.3 is already done (e.g. loaded state)
            if (genericAnalysisState.core_gdus_for_sync_analysis?.length > 0 && !genericAnalysisState.isFullyProcessedGenericSynchronic) return { nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, nextTranscriptIndex: 0 };
            if (STEP_ORDER_PART_5_REFINEMENT.length > 0 && !genericAnalysisState.isRefinementDone) return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 };
            if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0 && !genericAnalysisState.isCausalModelingDone) return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 };
            return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 };
        }
        if (currentPart3StepIndex < STEP_ORDER_PART_3_GENERIC_DIACHRONIC.length - 1) return { nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[currentPart3StepIndex + 1], nextTranscriptIndex: 0 };
    }
    
    const currentP4SStepIndex = STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.indexOf(currentStepInfo.stepId);
    if (currentP4SStepIndex !== -1) {
        const stepErrorExists = currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES ? genericAnalysisState.p4s_1_a_error : genericAnalysisState.p4s_1_b_error;
        const gduContextIsDone = (
            currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_outputs_by_gdu?.[currentStepInfo.currentGduForP4S || '']
        ) || (
            currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.processed_gdus_for_p4s?.includes(currentStepInfo.currentGduForP4S || '')
        );

        if (currentStepInfo.status === StepStatus.Success || (currentStepInfo.status === StepStatus.Error && stepErrorExists) || gduContextIsDone) {
            if (currentStepInfo.stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
                return { nextStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, nextTranscriptIndex: 0 }; 
            } else if (currentStepInfo.stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
                const allP4SBDone = genericAnalysisState.core_gdus_for_sync_analysis?.every(gdu => genericAnalysisState.processed_gdus_for_p4s?.includes(gdu));
                if (allP4SBDone || genericAnalysisState.isFullyProcessedGenericSynchronic) { 
                    if (STEP_ORDER_PART_5_REFINEMENT.length > 0) return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 };
                    if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0) return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 };
                    return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 };
                } else {
                    const nextGDU = genericAnalysisState.core_gdus_for_sync_analysis?.find(gdu => !(genericAnalysisState.processed_gdus_for_p4s || []).includes(gdu));
                    if (nextGDU) return { nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, nextTranscriptIndex: 0 };
                    if (STEP_ORDER_PART_5_REFINEMENT.length > 0) return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[0], nextTranscriptIndex: 0 };
                    return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 };
                }
            }
        }
    }
    
    const currentPart5StepIndex = STEP_ORDER_PART_5_REFINEMENT.indexOf(currentStepInfo.stepId);
    if (currentPart5StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isRefinementDone)) {
        if (genericAnalysisState.isRefinementDone) {
             if (STEP_ORDER_PART_7_CAUSAL_MODELING.length > 0 && !genericAnalysisState.isCausalModelingDone) return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0], nextTranscriptIndex: 0 };
             if (STEP_ORDER_PART_6_REPORT.length > 0 && !genericAnalysisState.isReportGenerated) return { nextStepId: STEP_ORDER_PART_6_REPORT[0], nextTranscriptIndex: 0 };
             return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 };
        }
        if (currentPart5StepIndex < STEP_ORDER_PART_5_REFINEMENT.length - 1) return { nextStepId: STEP_ORDER_PART_5_REFINEMENT[currentPart5StepIndex + 1], nextTranscriptIndex: 0 };
    }

    const currentPart7StepIndex = STEP_ORDER_PART_7_CAUSAL_MODELING.indexOf(currentStepInfo.stepId);
    if (currentPart7StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isCausalModelingDone)) {
        if (genericAnalysisState.isCausalModelingDone) {
            if (STEP_ORDER_PART_6_REPORT.length > 0 && !genericAnalysisState.isReportGenerated) return { nextStepId: STEP_ORDER_PART_6_REPORT[0], nextTranscriptIndex: 0 };
            return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 };
        }
        if (currentPart7StepIndex < STEP_ORDER_PART_7_CAUSAL_MODELING.length - 1) return { nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[currentPart7StepIndex + 1], nextTranscriptIndex: 0 };
    }
    
    const currentPart6StepIndex = STEP_ORDER_PART_6_REPORT.indexOf(currentStepInfo.stepId);
    if (currentPart6StepIndex !== -1 && (currentStepInfo.status === StepStatus.Success || currentStepInfo.status === StepStatus.Error || genericAnalysisState.isReportGenerated)) {
        if (genericAnalysisState.isReportGenerated) return { nextStepId: StepId.COMPLETE, nextTranscriptIndex: 0 };
        if (currentPart6StepIndex < STEP_ORDER_PART_6_REPORT.length - 1) return { nextStepId: STEP_ORDER_PART_6_REPORT[currentPart6StepIndex + 1], nextTranscriptIndex: 0 };
    }
    if (currentStepInfo.stepId === StepId.COMPLETE) return null;
    return null; 
  }, [currentStepInfo, activeTranscriptIndex, rawTranscripts, processedData, genericAnalysisState]);

  const getPreviousStepDetails = useCallback((): PreviousStepResult | null => {
    const { stepId: currentId, currentPhaseForP2S, currentGduForP4S } = currentStepInfo;
    let currentActiveTxIdx = activeTranscriptIndex;

    if (currentId === StepId.IDLE || (currentId === STEP_ORDER_PART_NEG1[0] && currentActiveTxIdx === 0)) return null;
    if (currentId === StepId.COMPLETE) return { prevStepId: STEP_ORDER_PART_6_REPORT[STEP_ORDER_PART_6_REPORT.length - 1], prevTranscriptIndex: currentActiveTxIdx };

    const part6Idx = STEP_ORDER_PART_6_REPORT.indexOf(currentId);
    if (part6Idx !== -1) {
        if (part6Idx > 0) return { prevStepId: STEP_ORDER_PART_6_REPORT[part6Idx - 1], prevTranscriptIndex: currentActiveTxIdx };
        return { prevStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[STEP_ORDER_PART_7_CAUSAL_MODELING.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    const part7Idx = STEP_ORDER_PART_7_CAUSAL_MODELING.indexOf(currentId);
    if (part7Idx !== -1) {
        if (part7Idx > 0) return { prevStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[part7Idx - 1], prevTranscriptIndex: currentActiveTxIdx };
        return { prevStepId: STEP_ORDER_PART_5_REFINEMENT[STEP_ORDER_PART_5_REFINEMENT.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    const part5Idx = STEP_ORDER_PART_5_REFINEMENT.indexOf(currentId);
    if (part5Idx !== -1) {
        if (part5Idx > 0) return { prevStepId: STEP_ORDER_PART_5_REFINEMENT[part5Idx - 1], prevTranscriptIndex: currentActiveTxIdx };
        const { core_gdus_for_sync_analysis = [], processed_gdus_for_p4s = [] } = genericAnalysisState;
        if (core_gdus_for_sync_analysis.length > 0 && processed_gdus_for_p4s.length === core_gdus_for_sync_analysis.length && genericAnalysisState.isFullyProcessedGenericSynchronic) {
            const lastGdu = core_gdus_for_sync_analysis[core_gdus_for_sync_analysis.length - 1];
            return { prevStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, prevTranscriptIndex: currentActiveTxIdx, prevGduForP4S: lastGdu };
        }
        return { prevStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[STEP_ORDER_PART_3_GENERIC_DIACHRONIC.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    
    if (currentId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
        const { core_gdus_for_sync_analysis = [] } = genericAnalysisState;
        const currentGduIdx = currentGduForP4S ? core_gdus_for_sync_analysis.indexOf(currentGduForP4S) : -1;
        if (currentGduIdx > 0) {
            return { prevStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, prevTranscriptIndex: currentActiveTxIdx, prevGduForP4S: core_gdus_for_sync_analysis[currentGduIdx - 1] };
        }
        return { prevStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[STEP_ORDER_PART_3_GENERIC_DIACHRONIC.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    if (currentId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
        return { prevStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, prevTranscriptIndex: currentActiveTxIdx, prevGduForP4S: currentGduForP4S };
    }

    const part3Idx = STEP_ORDER_PART_3_GENERIC_DIACHRONIC.indexOf(currentId);
    if (part3Idx !== -1) {
        if (part3Idx > 0) return { prevStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[part3Idx - 1], prevTranscriptIndex: currentActiveTxIdx };
        const lastTxIdx = rawTranscripts.length - 1;
        if (lastTxIdx < 0) return null; 
        const lastTData = processedData.get(rawTranscripts[lastTxIdx].id);
        if (lastTData?.isFullyProcessedSpecificSynchronic && lastTData.phases_for_p2s_processing?.length > 0) { 
            const lastPhase = lastTData.processed_phases_for_p2s?.[lastTData.processed_phases_for_p2s.length - 1] || lastTData.phases_for_p2s_processing[lastTData.phases_for_p2s_processing.length - 1];
            return { prevStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length - 1], prevTranscriptIndex: lastTxIdx, prevPhaseForP2S: lastPhase };
        } 
        return { prevStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.length - 1], prevTranscriptIndex: lastTxIdx };
    }
    const currentTId = rawTranscripts[currentActiveTxIdx]?.id; if (!currentTId) return null;
    const currentTData = processedData.get(currentTId); if (!currentTData) return null;

    const part2sIdx = STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.indexOf(currentId);
    if (part2sIdx !== -1 && currentPhaseForP2S) { 
        if (part2sIdx > 0) return { prevStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[part2sIdx - 1], prevTranscriptIndex: currentActiveTxIdx, prevPhaseForP2S: currentPhaseForP2S };
        const phases = currentTData.phases_for_p2s_processing || [];
        const currentPhaseIdx = phases.indexOf(currentPhaseForP2S);
        if (currentPhaseIdx > 0) {
            const prevPhase = phases[currentPhaseIdx - 1];
            return { prevStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length - 1], prevTranscriptIndex: currentActiveTxIdx, prevPhaseForP2S: prevPhase };
        }
        return { prevStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    const part1Idx = STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.indexOf(currentId);
    if (part1Idx !== -1) {
        if (part1Idx > 0) return { prevStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[part1Idx - 1], prevTranscriptIndex: currentActiveTxIdx };
        return { prevStepId: STEP_ORDER_PART_0[STEP_ORDER_PART_0.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    const part0Idx = STEP_ORDER_PART_0.indexOf(currentId);
    if (part0Idx !== -1) {
        if (part0Idx > 0) return { prevStepId: STEP_ORDER_PART_0[part0Idx - 1], prevTranscriptIndex: currentActiveTxIdx };
        return { prevStepId: STEP_ORDER_PART_NEG1[STEP_ORDER_PART_NEG1.length - 1], prevTranscriptIndex: currentActiveTxIdx };
    }
    const partNeg1Idx = STEP_ORDER_PART_NEG1.indexOf(currentId);
    if (partNeg1Idx !== -1 && currentActiveTxIdx > 0) { 
        return { prevStepId: STEP_ORDER_PART_NEG1[0], prevTranscriptIndex: currentActiveTxIdx - 1 };
    }
    return null;
  }, [currentStepInfo, activeTranscriptIndex, rawTranscripts, processedData, genericAnalysisState]);

  const loadStepData = useCallback((stepIdToLoad: StepId, transcriptId?: string, phaseName?: string, gduId?: string): { inputData?: any, outputData?: any, error?: string, groundingSources?: any[] } => {
      const keyPrefix = stepIdToDataKeyPrefix[stepIdToLoad];
      let output: any; let error: string | undefined; let currentInputData: any;
      const reversedHistory = [...promptHistory].reverse();
      
      let historyEntryPayloadFieldForPhase: keyof P2S_1_Output | keyof P2S_2_Output | keyof P2S_3_Output | undefined;
      if(phaseName && (stepIdToLoad === StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC || stepIdToLoad === StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS || stepIdToLoad === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE)){
         historyEntryPayloadFieldForPhase = 'analyzed_diachronic_unit';
      }

      let historyEntryPayloadFieldForGdu: keyof P4S_1_A_Output | keyof P4S_1_Output | undefined;
      if (gduId) {
          if (stepIdToLoad === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) historyEntryPayloadFieldForGdu = 'analyzed_gdu'; // from P4S_1_A_Output
          else if (stepIdToLoad === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) historyEntryPayloadFieldForGdu = 'analyzed_gdu'; // from P4S_1_A_Output which is input to P4S_1_B
      }
      
      let historyEntry = reversedHistory.find(entry => 
          entry.stepId === stepIdToLoad && 
          (transcriptId ? entry.transcriptId === transcriptId : true) && 
          (!phaseName || (historyEntryPayloadFieldForPhase && entry.requestPayload?.[historyEntryPayloadFieldForPhase] === phaseName)) &&
          (!gduId || (historyEntryPayloadFieldForGdu && entry.requestPayload?.[historyEntryPayloadFieldForGdu] === gduId) || (stepIdToLoad === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && entry.requestPayload?.p4s_1_a_data?.analyzed_gdu === gduId))
      );
      
      if (!historyEntry && (phaseName || gduId)) { // Broader search if specific not found
           historyEntry = reversedHistory.find(entry => 
              entry.stepId === stepIdToLoad && 
              (transcriptId ? entry.transcriptId === transcriptId : !entry.transcriptId) &&
              (!phaseName || (historyEntryPayloadFieldForPhase && entry.requestPayload?.[historyEntryPayloadFieldForPhase] === phaseName)) &&
              (!gduId || (historyEntryPayloadFieldForGdu && entry.requestPayload?.[historyEntryPayloadFieldForGdu] === gduId) || (stepIdToLoad === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && entry.requestPayload?.p4s_1_a_data?.analyzed_gdu === gduId))
          );
      } else if (!historyEntry && isGlobalStep(stepIdToLoad)) {
           historyEntry = reversedHistory.find(entry => entry.stepId === stepIdToLoad && !entry.transcriptId);
      }

      currentInputData = historyEntry?.requestPayload; 
      const currentGroundingSources = historyEntry?.groundingSources;

      if (transcriptId && phaseName && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepIdToLoad) && keyPrefix) {
          const tData = processedData.get(transcriptId);
          output = tData?.p2s_outputs_by_phase?.[phaseName]?.[keyPrefix as keyof P2SPhaseData];
          error = tData?.p2s_outputs_by_phase?.[phaseName]?.[`${keyPrefix.toString().replace('_output', '_error')}` as keyof P2SPhaseData] as string | undefined;
      } else if (transcriptId && keyPrefix && (STEP_ORDER_PART_NEG1.includes(stepIdToLoad) || STEP_ORDER_PART_0.includes(stepIdToLoad) || STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepIdToLoad))) {
          const tData = processedData.get(transcriptId);
          output = tData?.[keyPrefix as keyof TranscriptProcessedData];
          error = tData?.[`${keyPrefix.toString().replace('_output', '_error')}` as keyof TranscriptProcessedData] as string | undefined;
      } else if (gduId && keyPrefix) {
          if (stepIdToLoad === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
              output = genericAnalysisState.p4s_1_a_outputs_by_gdu?.[gduId];
              if (genericAnalysisState.p4s_1_a_error && genericAnalysisState.current_gdu_for_p4s_processing === gduId && !output) error = genericAnalysisState.p4s_1_a_error;
          } else if (stepIdToLoad === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
              output = genericAnalysisState.p4s_outputs_by_gdu?.[gduId];
              if (genericAnalysisState.p4s_1_b_error && genericAnalysisState.current_gdu_for_p4s_processing === gduId && !output) error = genericAnalysisState.p4s_1_b_error;
          }
      } else if (keyPrefix && isGlobalStep(stepIdToLoad)) {
          output = genericAnalysisState[keyPrefix as keyof GenericAnalysisState];
          error = genericAnalysisState[`${keyPrefix.toString().replace('_output', '_error')}` as keyof GenericAnalysisState] as string | undefined;
      }
      return { outputData: output, error: error, inputData: currentInputData, groundingSources: currentGroundingSources };
  }, [processedData, genericAnalysisState, promptHistory]);

  const handleDownloadOutput = useCallback((stepIdToDownload = currentStepInfo.stepId, idSegmentForDownloadArg = currentStepInfo.transcriptId, dataToDownloadArg?: any) => {
    let dataToDownload: any = dataToDownloadArg;
    let filenameSuffix = "output"; 
    let currentPhaseName = currentStepInfo.currentPhaseForP2S;
    let gduName = currentStepInfo.currentGduForP4S || genericAnalysisState.current_gdu_for_p4s_processing;
    let idSegmentForDownload: string = typeof idSegmentForDownloadArg === 'string' ? idSegmentForDownloadArg : "unknown_id";

    if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepIdToDownload) && gduName) {
        if (stepIdToDownload === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) dataToDownload = dataToDownloadArg || genericAnalysisState.p4s_1_a_outputs_by_gdu?.[gduName];
        else if (stepIdToDownload === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) dataToDownload = dataToDownloadArg || genericAnalysisState.p4s_outputs_by_gdu?.[gduName];
        idSegmentForDownload = `gdu_${gduName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    } else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepIdToDownload) && idSegmentForDownloadArg && currentPhaseName) {
        const tData = processedData.get(idSegmentForDownloadArg); 
        const p2sOutput = tData?.p2s_outputs_by_phase?.[currentPhaseName];
        const key = stepIdToDataKeyPrefix[stepIdToDownload] as keyof P2SPhaseData | undefined;
        dataToDownload = dataToDownloadArg || (key && p2sOutput ? p2sOutput[key] : undefined);
        idSegmentForDownload = `${idSegmentForDownloadArg}_phase_${currentPhaseName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    } else if (!dataToDownloadArg) dataToDownload = currentStepInfo.outputData;
    
    if ((stepIdToDownload === StepId.COMPLETE || stepIdToDownload === StepId.P6_1_GENERATE_MARKDOWN_REPORT) && genericAnalysisState.p6_1_output) {
        dataToDownload = genericAnalysisState.p6_1_output;
        idSegmentForDownload = (stepIdToDownload === StepId.COMPLETE) ? "final_analysis_report" : (idSegmentForDownload || "report");
    }
    if (dataToDownload === undefined || dataToDownload === null) { alert("No output data to download."); return; }
    
    let content: string; let filename: string; let contentType = 'text/plain;charset=utf-8';
    const safeId = idSegmentForDownload || "generic_step";
    const baseFilename = `${outputDirectory}/${safeId}_${stepIdToDownload}`;

    if (stepIdToDownload === StepId.P6_1_GENERATE_MARKDOWN_REPORT || stepIdToDownload === StepId.COMPLETE) {
      content = typeof dataToDownload === 'string' ? dataToDownload : JSON.stringify(dataToDownload, null, 2);
      filename = `${outputDirectory}/${safeId}.md`; contentType = 'text/markdown;charset=utf-8';
    } else if (typeof dataToDownload === 'object' && dataToDownload !== null) {
      if (stepIdToDownload === StepId.P0_1_TRANSCRIPTION_ADHERENCE) content = generateTsvForP0_1(dataToDownload as P0_1_Output);
      else if (stepIdToDownload === StepId.P0_2_REFINE_DATA_TYPES) content = generateTsvForP0_2(dataToDownload as P0_2_Output);
      else if (stepIdToDownload === StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES) content = generateTsvForP0_3(dataToDownload as P0_3_Output);
      else content = Array.isArray(dataToDownload) ? genericJsonToTsv(dataToDownload) : JSON.stringify(dataToDownload, null, 2);
      filenameSuffix = stepIdToDownload.startsWith("P0_") ? stepIdToDataKeyPrefix[stepIdToDownload]?.toString().replace("_output","") || "output" : "output";
      contentType = (Array.isArray(dataToDownload) && dataToDownload.length > 0 && typeof dataToDownload[0] === 'object') || stepIdToDownload.startsWith("P0_") ? 'text/tab-separated-values;charset=utf-8' : 'application/json;charset=utf-8';
      filename = `${baseFilename}_${filenameSuffix}.${contentType.includes('json') ? 'json' : 'tsv'}`;
    } else { 
      content = String(dataToDownload); filename = `${baseFilename}_${filenameSuffix}.txt`;
    }
    downloadFile(content, filename, contentType);
  }, [currentStepInfo, genericAnalysisState, processedData, outputDirectory]);

  const processSingleStep = useCallback(async (stepId: StepId, transcriptIdToProcess?: string, overrideSeed?: number, hilMetaPrompt?: string) => {
    const isReportStepForThisCall = stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT;

    if (!apiKeyPresent) {
      if (!isReportStepForThisCall) { 
        setCurrentStepInfo({ stepId, status: StepStatus.Error, error: "API Key not set." });
        setIsAutorunning(false);
        return;
      }
    }

    if (dvFocusError) { setCurrentStepInfo({ stepId, status: StepStatus.Error, error: `DV Focus Error: ${dvFocusError}` }); setIsAutorunning(false); return; }

    const config = STEP_CONFIGS[stepId];
    if (!config) { setCurrentStepInfo({ stepId, status: StepStatus.Error, error: `Config for ${stepId} not found.` }); setIsAutorunning(false); return; }
    
    const currentTranscript = transcriptIdToProcess ? rawTranscripts.find(t => t.id === transcriptIdToProcess) : undefined;
    let currentPhase: string | undefined = undefined; 
    let currentGDU: string | undefined = undefined;
    let tempGenericState = { ...genericAnalysisState }; 

    if (transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
        const tData = processedData.get(transcriptIdToProcess);
        if (tData) {
            currentPhase = tData.current_phase_for_p2s_processing;
            if (!currentPhase && stepId === STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0] && tData.phases_for_p2s_processing?.length > 0) {
                 currentPhase = tData.phases_for_p2s_processing[0];
                 setProcessedData(prev => { const u=new Map(prev); const d=u.get(transcriptIdToProcess); if(d)u.set(transcriptIdToProcess,{...d,current_phase_for_p2s_processing:currentPhase}); return u; });
            }
            if (!currentPhase && tData.phases_for_p2s_processing?.length > 0 && !tData.isFullyProcessedSpecificSynchronic) {
                 setCurrentStepInfo({ stepId, transcriptId:transcriptIdToProcess, status:StepStatus.Error, error:`P2S Error: Current phase not set for ${transcriptIdToProcess}` }); setIsAutorunning(false); return;
            }
        }
    }
    
    if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
        currentGDU = tempGenericState.current_gdu_for_p4s_processing;
        if (!currentGDU && stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && tempGenericState.core_gdus_for_sync_analysis?.length > 0) {
            const firstNonProcessed = tempGenericState.core_gdus_for_sync_analysis.find(g => !(tempGenericState.processed_gdus_for_p4s || []).includes(g));
            if (firstNonProcessed) {
                currentGDU = firstNonProcessed;
                tempGenericState = { ...tempGenericState, current_gdu_for_p4s_processing: firstNonProcessed, p4s_1_a_error: undefined, p4s_1_b_error: undefined }; // Clear errors for new GDU
                setGenericAnalysisState(prev => ({ ...prev, current_gdu_for_p4s_processing: firstNonProcessed, p4s_1_a_error: undefined, p4s_1_b_error: undefined }));
            } else if (!tempGenericState.isFullyProcessedGenericSynchronic) {
                 setCurrentStepInfo({stepId,status:StepStatus.Error,error:"P4S.1.A: All GDUs processed but P4S not complete.",currentGduForP4S:currentGDU}); setIsAutorunning(false); return;
            }
        }
        if (!currentGDU && (tempGenericState.core_gdus_for_sync_analysis || []).length > 0 && !tempGenericState.isFullyProcessedGenericSynchronic) {
             setCurrentStepInfo({stepId,status:StepStatus.Error,error:`P4S Error: No GDU to process for ${stepId}, but P4S not complete.`,currentGduForP4S:currentGDU}); setIsAutorunning(false); return;
        }
    }

    let inputResult = config.getInput(currentTranscript, processedData, tempGenericState, apiKeyPresent, userDvFocus, rawTranscripts, currentPhase, currentGDU);
    if (inputResult === null || inputResult?.error) { 
        const errText = `Input error for ${stepId}: ${inputResult?.error || 'Input null'}`;
        setCurrentStepInfo({ stepId, transcriptId:transcriptIdToProcess, status:StepStatus.Error, error:errText, currentGduForP4S:currentGDU, currentPhaseForP2S:currentPhase }); 
        if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) setGenericAnalysisState(prev => ({ ...prev, p4s_1_a_error: errText})); 
        else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) setGenericAnalysisState(prev => ({ ...prev, p4s_1_b_error: errText})); 
        setIsAutorunning(false); return; 
    }
    const inputData = inputResult.data;
    setCurrentStepInfo({ stepId, transcriptId:transcriptIdToProcess, status:StepStatus.Loading, inputData, currentGduForP4S:currentGDU, currentPhaseForP2S:currentPhase });

    let output: string | any; 
    let apiError: string | undefined;
    let groundingSources: PromptHistoryEntry['groundingSources'];
    let estIn: number | undefined = 0; 
    let estOut: number | undefined = 0;
    let promptForHistory = hilMetaPrompt || config.generatePrompt(inputData);

    if (isReportStepForThisCall) {
        try {
            output = generateMarkdownReportProgrammatically(inputData as ReportData);
            apiError = undefined;
        } catch (e: any) {
            console.error("Error generating report programmatically:", e);
            output = "";
            apiError = `Programmatic report generation failed: ${e.message || String(e)}`;
        }
        promptForHistory = "Programmatic report generation.";
    } else { 
        const effectiveSeed = overrideSeed !== undefined ? overrideSeed : seed;
        const apiResult = await callGeminiAPI(promptForHistory, config.isJsonOutput, false, temperature, effectiveSeed);
        output = config.isJsonOutput ? apiResult.parsedJson : apiResult.text;
        apiError = apiResult.error;
        groundingSources = apiResult.groundingSources;
        estIn = apiResult.estimatedInputTokens;
        estOut = apiResult.estimatedOutputTokens;
        if (estIn) setTotalInputTokens(prev => prev + estIn);
        if (estOut) setTotalOutputTokens(prev => prev + estOut);
    }
    
    const historyEntry: PromptHistoryEntry = { 
        stepId, 
        transcriptId: transcriptIdToProcess, 
        timestamp: new Date().toISOString(), 
        prompt: promptForHistory, 
        requestPayload: isReportStepForThisCall ? { programmaticInput: inputData } : { model: (STEP_CONFIGS[stepId] as any)?.model || 'gemini-2.5-flash-preview-04-17', contents: promptForHistory, temperature, seed: (!isReportStepForThisCall ? (overrideSeed !== undefined ? overrideSeed : seed) : undefined) },
        responseRaw: typeof output === 'string' ? output : (output ? JSON.stringify(output) : ''),
        responseParsed: output, 
        error: apiError, 
        groundingSources, 
        estimatedInputTokens: estIn, 
        estimatedOutputTokens: estOut 
    };
    setPromptHistory(prev => [...prev, historyEntry]);
    
    const key = stepIdToDataKeyPrefix[stepId];

    if (apiError) { 
        setCurrentStepInfo({ stepId, transcriptId:transcriptIdToProcess, status:StepStatus.Error, error:apiError, inputData, outputData:output, groundingSources, currentGduForP4S:currentGDU, currentPhaseForP2S:currentPhase }); 
        if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) setGenericAnalysisState(prev => ({ ...prev, p4s_1_a_error: apiError })); 
        else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) setGenericAnalysisState(prev => ({ ...prev, p4s_1_b_error: apiError })); 
        else if (isReportStepForThisCall) setGenericAnalysisState(prev => ({ ...prev, p6_1_error: apiError, isReportGenerated: false, p6_1_output: undefined }));
        else if (key) { 
            const eKey = `${key.toString().replace('_output', '_error')}`; 
            if (transcriptIdToProcess && currentPhase && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) { 
                setProcessedData(prev => { const u=new Map(prev); const d=u.get(transcriptIdToProcess); if(d){const p2sU={...(d.p2s_outputs_by_phase||{}),[currentPhase!]:{...(d.p2s_outputs_by_phase?.[currentPhase!]||{}),[eKey]:apiError,[key as keyof P2SPhaseData]:undefined}}; u.set(transcriptIdToProcess,{...d,p2s_outputs_by_phase:p2sU});} return u; }); 
            } else if (transcriptIdToProcess) setProcessedData(prev => { const u=new Map(prev); const d=u.get(transcriptIdToProcess); if(d)u.set(transcriptIdToProcess,{...d,[eKey]:apiError,[key as keyof TranscriptProcessedData]:undefined}as any); return u; }); 
            else setGenericAnalysisState(prev => ({ ...prev,[eKey]:apiError,[key as keyof GenericAnalysisState]:undefined}as any)); 
        } 
        setIsAutorunning(false); return; 
    }
    
    if (isReportStepForThisCall) {
        if (typeof output === 'string' && output.trim() !== '') {
            setGenericAnalysisState(prev => ({ ...prev, isReportGenerated: true, p6_1_output: output as P6_1_Output, p6_1_error: undefined }));
        } else {
            const rptErr = "Report generation resulted in empty/invalid content.";
            setCurrentStepInfo(pI => ({...pI,stepId,status:StepStatus.Error,error:rptErr,outputData:output})); 
            setGenericAnalysisState(prev => ({ ...prev, isReportGenerated:false, p6_1_output:undefined, p6_1_error:rptErr }));
            if (isAutorunning) setIsAutorunning(false); return; 
        }
    }
    setCurrentStepInfo({ stepId, transcriptId:transcriptIdToProcess, status:StepStatus.Success, inputData, outputData:output, groundingSources, currentGduForP4S:currentGDU, currentPhaseForP2S:currentPhase });
    
    if (transcriptIdToProcess && key && typeof key === 'string' && !(STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) ) {
      setProcessedData(prev => {
        const u = new Map(prev); const d = u.get(transcriptIdToProcess);
        if (d) {
          const nD: TranscriptProcessedData = {...d, [key as keyof TranscriptProcessedData]:output, [`${key.replace('_output','_error')}` as keyof TranscriptProcessedData]:undefined } as any;
          if (stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && output) {
            nD.isFullyProcessedSpecificDiachronic = true; nD.p1_4_mermaid_syntax = transformDiachronicToMermaid((output as P1_4_Output).specific_diachronic_structure);
            const phases = (output as P1_4_Output)?.specific_diachronic_structure?.phases.map(p=>p.phase_name)||[];
            nD.phases_for_p2s_processing = phases; nD.current_phase_for_p2s_processing = phases[0]||undefined;
            nD.processed_phases_for_p2s=[]; nD.p2s_outputs_by_phase={}; nD.isFullyProcessedSpecificSynchronic=phases.length===0;
          }
          u.set(transcriptIdToProcess, nD);
        } return u;
      });
    }
    
    if (currentPhase && transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId) && key && typeof key === 'string') {
        setProcessedData(prev => {
            const uM=new Map(prev); const tD=uM.get(transcriptIdToProcess); 
            if (tD) {
                let mermaid:string|undefined=undefined;
                if (stepId===StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE && output) mermaid=transformSynchronicToMermaid((output as P2S_3_Output).specific_synchronic_structure, currentPhase);
                const uP2S = {...(tD.p2s_outputs_by_phase||{}), [currentPhase!]:{...(tD.p2s_outputs_by_phase?.[currentPhase!]||{}), [key as keyof P2SPhaseData]:output, [`${key.replace('_output','_error')}` as keyof P2SPhaseData]:undefined, ...(mermaid&&{p2s_3_mermaid_syntax:mermaid}) }};
                let newProcPhases = [...(tD.processed_phases_for_p2s||[])]; let allDone = tD.isFullyProcessedSpecificSynchronic; let nextPhase:string|undefined=tD.current_phase_for_p2s_processing;
                if (stepId===StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
                    newProcPhases = Array.from(new Set([...newProcPhases,currentPhase!]));
                    const transcriptPhases = tD.phases_for_p2s_processing||[];
                    allDone = transcriptPhases.length > 0 ? newProcPhases.length === transcriptPhases.length : true; 
                    if (!allDone) nextPhase = transcriptPhases.find(p=>!newProcPhases.includes(p)); else nextPhase = undefined;
                }
                uM.set(transcriptIdToProcess, {...tD,p2s_outputs_by_phase:uP2S,processed_phases_for_p2s:newProcPhases,isFullyProcessedSpecificSynchronic:allDone,current_phase_for_p2s_processing:nextPhase});
            } return uM;
        });
    } else if (stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE && output) {
        const p3_3=(output as P3_3_Output); const core=p3_3?.generic_diachronic_structure_definition?.core_gdus||[];
        const mermaid=p3_3?transformGenericDiachronicToMermaid(p3_3.generic_diachronic_structure_definition):undefined;
        setGenericAnalysisState(prev=>({...prev,p3_3_output:p3_3,p3_3_mermaid_syntax:mermaid,p3_3_error:undefined,isFullyProcessedGenericDiachronic:true,core_gdus_for_sync_analysis:core,processed_gdus_for_p4s:[],current_gdu_for_p4s_processing:core[0]||undefined,p4s_outputs_by_gdu:{},p4s_mermaid_syntax_by_gdu:{}, p4s_1_a_error: undefined, p4s_1_b_error: undefined, isFullyProcessedGenericSynchronic:(core.length===0) }));
    } else if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && output) {
        const gduProc = currentGDU; 
        if (gduProc) {
            // Phase 3: Programmatic output reconstruction from LLM's grouped_data
            const llmResponse = output as { analyzed_gdu: string; grouped_data: Array<{ sss_node_id: string; transcript_id: string; phase_name: string; sss_node_label: string; group_id: string; group_rationale: string; }>; classification_notes?: string; };
            
            console.log(`[P4S.1.A Processing] Reconstructing output for GDU ${gduProc} from ${llmResponse.grouped_data?.length || 0} classified nodes`);
            
            // Verify data integrity: every node should be from the original TSV
            if (!llmResponse.grouped_data || !Array.isArray(llmResponse.grouped_data)) {
                const reconstructionError = "LLM response missing or invalid grouped_data array";
                console.error(`[P4S.1.A Processing] ${reconstructionError}`);
                setCurrentStepInfo(prev => ({ ...prev, status: StepStatus.Error, error: reconstructionError }));
                setGenericAnalysisState(prev => ({ ...prev, p4s_1_a_error: reconstructionError }));
                setIsAutorunning(false);
                return;
            }
            
            // Validate that all referenced SSS nodes actually exist in P2S_3 data
            const validatedNodes: typeof llmResponse.grouped_data = [];
            const invalidNodes: Array<{ nodeId: string; transcriptId: string; phase: string; reason: string }> = [];
            
            llmResponse.grouped_data.forEach(nodeData => {
                const txData = processedData.get(nodeData.transcript_id);
                if (!txData) {
                    invalidNodes.push({ nodeId: nodeData.sss_node_id, transcriptId: nodeData.transcript_id, phase: nodeData.phase_name, reason: "transcript not found" });
                    return;
                }
                
                const phaseData = txData.p2s_outputs_by_phase?.[nodeData.phase_name];
                if (!phaseData?.p2s_3_output?.specific_synchronic_structure) {
                    invalidNodes.push({ nodeId: nodeData.sss_node_id, transcriptId: nodeData.transcript_id, phase: nodeData.phase_name, reason: "phase data not found" });
                    return;
                }
                
                const sssNodeExists = phaseData.p2s_3_output.specific_synchronic_structure.network_nodes.some(n => n.id === nodeData.sss_node_id);
                if (!sssNodeExists) {
                    invalidNodes.push({ nodeId: nodeData.sss_node_id, transcriptId: nodeData.transcript_id, phase: nodeData.phase_name, reason: "SSS node not found in P2S_3 data" });
                    return;
                }
                
                validatedNodes.push(nodeData);
            });
            
            if (invalidNodes.length > 0) {
                console.warn(`[P4S.1.A Processing] Found ${invalidNodes.length} invalid node references from LLM:`, invalidNodes);
                console.log(`[P4S.1.A Processing] Proceeding with ${validatedNodes.length} valid nodes, excluding invalid ones`);
            }
            
            // Use validated nodes instead of all LLM nodes
            const processedGroupedData = validatedNodes;
            
            // Group nodes by group_id (excluding "N/A")
            const groupsMap = new Map<string, Array<{ transcript_id: string; phase_name: string; sss_node_id: string; sss_node_label: string; group_rationale: string; }>>();
            
            processedGroupedData.forEach(nodeData => {
                if (nodeData.group_id !== "N/A") {
                    if (!groupsMap.has(nodeData.group_id)) {
                        groupsMap.set(nodeData.group_id, []);
                    }
                    groupsMap.get(nodeData.group_id)!.push({
                        transcript_id: nodeData.transcript_id,
                        phase_name: nodeData.phase_name,
                        sss_node_id: nodeData.sss_node_id,
                        sss_node_label: nodeData.sss_node_label,
                        group_rationale: nodeData.group_rationale
                    });
                }
            });
            
            // Validate cross-transcript requirement for each group
            const validatedGroups: P4S_1_A_Output['sss_node_groups'] = [];
            let groupCounter = 1;
            
            groupsMap.forEach((nodes, groupId) => {
                const transcriptIds = new Set(nodes.map(n => n.transcript_id));
                if (transcriptIds.size >= 2) {
                    // Valid cross-transcript group
                    const groupRationale = nodes[0]?.group_rationale || `Generic group for concept: ${groupId}`;
                    validatedGroups.push({
                        group_id: `gss_node_group_${groupCounter}_${groupId}`,
                        group_rationale: groupRationale,
                        contributing_sss_nodes: nodes.map(n => ({
                            transcript_id: n.transcript_id,
                            phase_name: n.phase_name,
                            sss_node_id: n.sss_node_id,
                            sss_node_label: n.sss_node_label
                        }))
                    });
                    groupCounter++;
                    console.log(`[P4S.1.A Processing] Created valid group ${groupId} with ${nodes.length} nodes from ${transcriptIds.size} transcripts`);
                } else {
                    console.log(`[P4S.1.A Processing] Rejected group ${groupId}: only ${transcriptIds.size} transcript(s), requires 2+`);
                }
            });
            
            if (validatedGroups.length === 0) {
                const noValidGroupsError = `No valid cross-transcript groups created for GDU ${gduProc}. All groups failed the minimum 2-transcript requirement.`;
                console.error(`[P4S.1.A Processing] ${noValidGroupsError}`);
                setCurrentStepInfo(prev => ({ ...prev, status: StepStatus.Error, error: noValidGroupsError }));
                setGenericAnalysisState(prev => ({ ...prev, p4s_1_a_error: noValidGroupsError }));
                setIsAutorunning(false);
                return;
            }
            
            // Reconstruct final P4S_1_A_Output
            const p4s1a_out: P4S_1_A_Output = {
                analyzed_gdu: gduProc,
                sss_node_groups: validatedGroups,
                dependent_variable_focus: userDvFocus?.dv_focus || [],
                grouping_process_notes: `Reconstructed from LLM classification. Original nodes: ${llmResponse.grouped_data.length}, Valid groups: ${validatedGroups.length}. ${llmResponse.classification_notes || ''}`
            };
            
            console.log(`[P4S.1.A Processing] Successfully reconstructed P4S_1_A output with ${validatedGroups.length} valid groups`);
            
            setGenericAnalysisState(prev => ({
                ...prev,
                p4s_1_a_outputs_by_gdu: { ...(prev.p4s_1_a_outputs_by_gdu || {}), [gduProc]: p4s1a_out },
                p4s_1_a_error: undefined, // Clear error on success for this GDU
            }));
        }
    } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && output) {
        const gduProc = currentGDU;
        if (gduProc) {
            const p4s1b_out = (output as P4S_1_Output);
            const mermaid = p4s1b_out ? transformSynchronicToMermaid(p4s1b_out.generic_synchronic_structure, gduProc) : undefined;
            setGenericAnalysisState(prev => {
                const newP4SOut = { ...(prev.p4s_outputs_by_gdu || {}), [gduProc]: p4s1b_out };
                const newP4SMermaid = { ...(prev.p4s_mermaid_syntax_by_gdu || {}), [gduProc]: mermaid };
                const newProcGDUs = Array.from(new Set([...(prev.processed_gdus_for_p4s || []), gduProc]));
                const allCoreDone = prev.core_gdus_for_sync_analysis ? newProcGDUs.length === prev.core_gdus_for_sync_analysis.length : (prev.core_gdus_for_sync_analysis || []).length === 0; 
                let nextGDUforP4S: string | undefined = undefined;
                if (!allCoreDone && prev.core_gdus_for_sync_analysis) {
                    nextGDUforP4S = prev.core_gdus_for_sync_analysis.find(g => !newProcGDUs.includes(g));
                }
                return {
                    ...prev,
                    p4s_outputs_by_gdu: newP4SOut,
                    p4s_mermaid_syntax_by_gdu: newP4SMermaid,
                    processed_gdus_for_p4s: newProcGDUs,
                    p4s_1_b_error: undefined, // Clear error on success for this GDU
                    isFullyProcessedGenericSynchronic: allCoreDone,
                    current_gdu_for_p4s_processing: nextGDUforP4S, // Set next GDU for P4S_1_A
                    p4s_1_a_error: nextGDUforP4S ? undefined : prev.p4s_1_a_error, // Clear P4S_1_A error if moving to a new GDU
                };
            });
        }
    } else if (stepId === StepId.P3_2_IDENTIFY_GDUS && output && USE_TWO_PHASE_P3_2) {
        // Phase 2: Programmatic Aggregation and Validation for Two-Phase P3_2
        console.log('[P3.2 Two-Phase] Starting aggregation phase...');
        const classifications = output as P3_2_Classification[]; // The LLM's raw classification output
        
        // 1. Get all valid RDU IDs from the source data for validation
        const validRduMap = new Map<string, { transcript_id: string }>();
        processedData.forEach((tData, tId) => {
            tData.p1_3_output?.refined_diachronic_units.forEach(rdu => {
                validRduMap.set(rdu.unit_id, { transcript_id: tId });
            });
        });

        // 2. Group validated classifications from the LLM response
        const gduGroups = new Map<string, { rationales: string[], iv_variation_notes: string[], contributing_rdus: { transcript_id: string; refined_du_id: string }[] }>();
        
        classifications.forEach(item => {
            // Data Integrity Check: Ensure the RDU ID from the LLM exists in our source data
            if (validRduMap.has(item.refined_du_id)) {
                const transcriptInfo = validRduMap.get(item.refined_du_id)!;
                const groupId = item.gdu_group_id;

                if (!gduGroups.has(groupId)) {
                    gduGroups.set(groupId, { rationales: [], iv_variation_notes: [], contributing_rdus: [] });
                }
                gduGroups.get(groupId)!.rationales.push(item.rationale);
                
                // Collect IV variation notes if available from LLM output
                if (item.iv_variation_note) {
                    gduGroups.get(groupId)!.iv_variation_notes.push(item.iv_variation_note);
                }
                
                gduGroups.get(groupId)!.contributing_rdus.push({
                    transcript_id: transcriptInfo.transcript_id,
                    refined_du_id: item.refined_du_id,
                });
            } else {
                console.warn(`[P3.2 Aggregation] Discarding classification for hallucinated refined_du_id: ${item.refined_du_id}`);
            }
        });

        // 3. Filter for truly "generic" groups (must span >= 2 transcripts)
        const finalGdus: P3_2_IdentifiedGdu[] = [];
        gduGroups.forEach((groupData, gdu_id) => {
            const supportingTranscriptIds = new Set(groupData.contributing_rdus.map(r => r.transcript_id));
            if (supportingTranscriptIds.size >= 2) {
                // Synthesize a definition (e.g., from the most common rationale)
                const rationaleCounts = groupData.rationales.reduce((acc, r) => acc.set(r, (acc.get(r) || 0) + 1), new Map<string, number>());
                const mostCommonRationale = [...rationaleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "A recurring diachronic unit.";

                // Synthesize IV variation notes from LLM classifications
                let synthesizedIvNotes = "To be analyzed."; // Fallback
                if (groupData.iv_variation_notes.length > 0) {
                    // Combine unique IV observations, removing duplicates
                    const uniqueIvNotes = [...new Set(groupData.iv_variation_notes)];
                    synthesizedIvNotes = uniqueIvNotes.join('; ');
                }

                finalGdus.push({
                    gdu_id,
                    definition: mostCommonRationale,
                    supporting_transcripts_count: supportingTranscriptIds.size,
                    iv_variation_notes: synthesizedIvNotes,
                    contributing_refined_du_ids: groupData.contributing_rdus,
                });
            } else {
                 console.log(`[P3.2 Aggregation] Discarding group '${gdu_id}' because it only appeared in ${supportingTranscriptIds.size} transcript(s).`);
            }
        });

        // 4. Construct the final P3_2_Output object and update state
        const p3_2_final_output: P3_2_Output = {
            identified_gdus: finalGdus,
            criteria_for_gdu_identification: "GDUs were formed by classifying RDUs based on semantic similarity of their descriptions. A group was confirmed as a GDU only if it was supported by RDUs from at least two different transcripts.",
            dependent_variable_focus: userDvFocus?.dv_focus || [],
        };
        
        console.log(`[P3.2 Two-Phase] Generated ${finalGdus.length} validated GDUs from ${gduGroups.size} initial groups`);
        
        // Save the programmatically generated, validated output
        setGenericAnalysisState(prev => ({
            ...prev,
            p3_2_output: p3_2_final_output,
            p3_2_error: undefined
        }));

    } else if (key && !transcriptIdToProcess && typeof key === 'string') { 
         const eKey=`${key.replace('_output','_error')}`as keyof GenericAnalysisState;
         setGenericAnalysisState(prev=>({...prev,[key as keyof GenericAnalysisState]:output,[eKey]:undefined}as any));
         if (stepId === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS && output) { const p7_3=(output as P7_3_Output); const mermaid=p7_3.final_dag?transformDagToMermaid(p7_3.final_dag):undefined; setGenericAnalysisState(prev=>({...prev,p7_3_mermaid_syntax_dag:mermaid})); }
         else if (stepId === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG && output) { const p7_3b=(output as P7_3b_Output); const mermaid=p7_3b.final_dag?transformDagToMermaid(p7_3b.final_dag):undefined; setGenericAnalysisState(prev=>({...prev,p7_3b_mermaid_syntax_dag:mermaid})); }
         else if (stepId === StepId.P5_1_HOLISTIC_REVIEW_REFINEMENT) setGenericAnalysisState(prev=>({...prev,isRefinementDone:true}));
         else if (stepId === StepId.P7_5_GENERATE_FORMAL_HYPOTHESES) setGenericAnalysisState(prev=>({...prev,isCausalModelingDone:true}));
    }

    if (autoDownloadResults && output && ESSENTIAL_STEPS_FOR_AUTODOWNLOAD.includes(stepId)) { 
      let idSeg = transcriptIdToProcess; 
      if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) idSeg = `gdu_${currentGDU||'unknownGDU'}`;
      else if (stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE && transcriptIdToProcess && currentPhase) idSeg = `${transcriptIdToProcess}_phase_${currentPhase.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
      else if (isGlobalStep(stepId) && !transcriptIdToProcess) idSeg = "generic_analysis";
      handleDownloadOutput(stepId, idSeg, output);
    }
  }, [apiKeyPresent, processedData, genericAnalysisState, userDvFocus, dvFocusError, rawTranscripts, autoDownloadResults, outputDirectory, temperature, seed, isAutorunning, promptHistory, handleDownloadOutput]);

  useEffect(() => { 
    if (isAutorunning && currentStepInfo.status === StepStatus.Success) {
      const details = getNextStepDetails();
      if (details) {
        setActiveTranscriptIndex(details.nextTranscriptIndex); 
        if (details.nextStepId === StepId.COMPLETE) {
            const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "Processing complete.";
            setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData:report }); setIsAutorunning(false); 
            if (processStartTime) { setElapsedTime(Math.floor((Date.now()-processStartTime)/1000)); setProcessStartTime(null); }
            if (autoDownloadResults && report!=="Processing complete." && ESSENTIAL_STEPS_FOR_AUTODOWNLOAD.includes(StepId.P6_1_GENERATE_MARKDOWN_REPORT)) handleDownloadOutput(StepId.COMPLETE, "final_analysis_report", report);
        } else {
            const isNextGlobal = isGlobalStep(details.nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(details.nextStepId);
            const nextTxId = isNextGlobal ? undefined : rawTranscripts[details.nextTranscriptIndex]?.id;
            processSingleStep(details.nextStepId, nextTxId);
        }
      } else if (currentStepInfo.stepId !== StepId.COMPLETE && genericAnalysisState.isReportGenerated) { 
        const report = typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All processing complete.";
        setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData:report }); setIsAutorunning(false); 
        if (processStartTime) { setElapsedTime(Math.floor((Date.now()-processStartTime)/1000)); setProcessStartTime(null); }
      } else if (currentStepInfo.stepId !== StepId.COMPLETE && !details) { 
         if (genericAnalysisState.isReportGenerated) setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData: typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All complete." });
         setIsAutorunning(false); if (processStartTime) { setElapsedTime(Math.floor((Date.now()-processStartTime)/1000)); setProcessStartTime(null); }
      }
    } else if (isAutorunning && currentStepInfo.status === StepStatus.Error) {
      setIsAutorunning(false); if (processStartTime) { setElapsedTime(Math.floor((Date.now()-processStartTime)/1000)); setProcessStartTime(null); }
    }
  }, [isAutorunning, currentStepInfo, processSingleStep, getNextStepDetails, genericAnalysisState, rawTranscripts, autoDownloadResults, processStartTime, handleDownloadOutput]);

  const handleNextStep = () => {
    if (currentStepInfo.status === StepStatus.Loading) return;
    const details = getNextStepDetails();
    if (!details) {
        if (currentStepInfo.stepId !== StepId.COMPLETE && rawTranscripts.length > 0 && genericAnalysisState.isReportGenerated) setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData: typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All complete." });
        if (isAutorunning) setIsAutorunning(false); if (processStartTime) { setElapsedTime(Math.floor((Date.now()-processStartTime)/1000)); setProcessStartTime(null); } return;
    }
    const newActiveIdx = details.nextTranscriptIndex; setActiveTranscriptIndex(newActiveIdx);
    const nextStepId = details.nextStepId;
    if (nextStepId === StepId.COMPLETE) {
        setCurrentStepInfo({ stepId:StepId.COMPLETE, status:StepStatus.Success, outputData: typeof genericAnalysisState.p6_1_output === 'string' ? genericAnalysisState.p6_1_output : "All complete." });
        if (isAutorunning) setIsAutorunning(false); if (processStartTime) { setElapsedTime(Math.floor((Date.now()-processStartTime)/1000)); setProcessStartTime(null); } return;
    }
    let txIdNav:string|undefined=undefined; let phaseNav:string|undefined=undefined; let gduNav:string|undefined=undefined;
    const isNextGlobal = isGlobalStep(nextStepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(nextStepId);
    if (!isNextGlobal && rawTranscripts[newActiveIdx]) txIdNav = rawTranscripts[newActiveIdx].id;

    if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(nextStepId) && txIdNav) {
        const tData = processedData.get(txIdNav);
        if (tData) {
            phaseNav = tData.current_phase_for_p2s_processing;
            if (!phaseNav && nextStepId === STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0]) phaseNav = tData.phases_for_p2s_processing?.find(p=>!(tData.processed_phases_for_p2s||[]).includes(p));
            if (!phaseNav && nextStepId === STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0] && tData.phases_for_p2s_processing?.length>0) phaseNav = tData.phases_for_p2s_processing[0];
        }
    } else if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(nextStepId)) {
        gduNav = genericAnalysisState.current_gdu_for_p4s_processing;
        if (!gduNav && nextStepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) { // If starting P4S.1.A for next GDU
            gduNav = genericAnalysisState.core_gdus_for_sync_analysis?.find(g=>!(genericAnalysisState.processed_gdus_for_p4s||[]).includes(g));
        } else if (gduNav && nextStepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) { // If moving from P4S.1.A to P4S.1.B for same GDU
            // gduNav is already set from currentStepInfo.currentGduForP4S implicitly
        }
    }
    const loaded = loadStepData(nextStepId, txIdNav, phaseNav, gduNav);
    setCurrentStepInfo({ stepId:nextStepId, transcriptId:txIdNav, currentPhaseForP2S:phaseNav, currentGduForP4S:gduNav, status:loaded.error?StepStatus.Error:(loaded.outputData?StepStatus.Success:StepStatus.Idle), inputData:loaded.inputData, outputData:loaded.outputData, error:loaded.error, groundingSources:loaded.groundingSources });
  };

  const handlePreviousStep = () => {
    if (currentStepInfo.status === StepStatus.Loading || currentStepInfo.stepId === StepId.IDLE) return;
    if (isAutorunning) setIsAutorunning(false);
    const prevDetails = getPreviousStepDetails();
    if (prevDetails) {
        setActiveTranscriptIndex(prevDetails.prevTranscriptIndex);
        const data = loadStepData(prevDetails.prevStepId, rawTranscripts[prevDetails.prevTranscriptIndex]?.id, prevDetails.prevPhaseForP2S, prevDetails.prevGduForP4S);
        setCurrentStepInfo({ stepId:prevDetails.prevStepId, transcriptId:rawTranscripts[prevDetails.prevTranscriptIndex]?.id, currentPhaseForP2S:prevDetails.prevPhaseForP2S, currentGduForP4S:prevDetails.prevGduForP4S, status:data.error?StepStatus.Error:StepStatus.Success, inputData:data.inputData, outputData:data.outputData, error:data.error, groundingSources:data.groundingSources });
    }
  };

  const handlePipelineStepClick = (clickedStepId: StepId) => {
    if (isAutorunning) setIsAutorunning(false);
    let txIdNav:string|undefined=undefined; let phaseNav:string|undefined=undefined; let gduNav:string|undefined=undefined;
    const stepConfig = STEP_CONFIGS[clickedStepId]; if (!stepConfig) return;

    if (STEP_ORDER_PART_NEG1.includes(clickedStepId) || STEP_ORDER_PART_0.includes(clickedStepId) || STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(clickedStepId)) txIdNav = rawTranscripts[activeTranscriptIndex]?.id;
    else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(clickedStepId)) {
        txIdNav = rawTranscripts[activeTranscriptIndex]?.id;
        const tData = txIdNav ? processedData.get(txIdNav) : undefined;
        phaseNav = tData?.current_phase_for_p2s_processing || tData?.phases_for_p2s_processing?.[0];
        if (!phaseNav && tData?.processed_phases_for_p2s?.length > 0) phaseNav = tData.processed_phases_for_p2s[tData.processed_phases_for_p2s.length-1];
    } else if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(clickedStepId)) {
        gduNav = genericAnalysisState.current_gdu_for_p4s_processing || genericAnalysisState.core_gdus_for_sync_analysis?.[0];
        if (!gduNav && genericAnalysisState.processed_gdus_for_p4s?.length > 0) gduNav = genericAnalysisState.processed_gdus_for_p4s[genericAnalysisState.processed_gdus_for_p4s.length - 1];
    }
    const data = loadStepData(clickedStepId, txIdNav, phaseNav, gduNav);
    setCurrentStepInfo({ stepId:clickedStepId, transcriptId:txIdNav, currentPhaseForP2S:phaseNav, currentGduForP4S:gduNav, status:data.error?StepStatus.Error:(data.outputData?StepStatus.Success:StepStatus.Idle), inputData:data.inputData, outputData:data.outputData, error:data.error, groundingSources:data.groundingSources });
  };

  function getInvalidatedStates(
    startInvalidationFromStepId: StepId,
    currentActiveTxId: string | undefined,
    currentProcessedData: Map<string, TranscriptProcessedData>,
    currentGenericState: GenericAnalysisState
  ): {
    invalidatedProcessedData: Map<string, TranscriptProcessedData>;
    invalidatedGenericState: GenericAnalysisState;
  } {
      let newProcessedData = new Map(currentProcessedData);
      let newGenericState = { ...currentGenericState };
  
      const startIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(startInvalidationFromStepId);
      if (startIndex === -1) return { invalidatedProcessedData: newProcessedData, invalidatedGenericState: newGenericState };
  
      for (let i = startIndex; i < ALL_PIPELINE_STEP_IDS_IN_ORDER.length; i++) {
          const stepToInvalidate = ALL_PIPELINE_STEP_IDS_IN_ORDER[i];
          if (stepToInvalidate === StepId.COMPLETE || stepToInvalidate === StepId.IDLE) continue;
  
          const keyPrefix = stepIdToDataKeyPrefix[stepToInvalidate];
          if (!keyPrefix) continue;
          const errorKey = `${String(keyPrefix).replace('_output', '_error')}` as any;
          
          if (currentActiveTxId && (STEP_ORDER_PART_NEG1.includes(stepToInvalidate) || STEP_ORDER_PART_0.includes(stepToInvalidate) || STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepToInvalidate))) {
              const tData = newProcessedData.get(currentActiveTxId);
              if (tData) {
                  let updatedTData = { ...tData, [keyPrefix]: undefined, [errorKey]: undefined };
                  if (stepToInvalidate === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
                      updatedTData = {
                          ...updatedTData,
                          isFullyProcessedSpecificDiachronic: false, p1_4_mermaid_syntax: undefined,
                          phases_for_p2s_processing: [], current_phase_for_p2s_processing: undefined,
                          processed_phases_for_p2s: [], p2s_outputs_by_phase: {},
                          isFullyProcessedSpecificSynchronic: false,
                      };
                  }
                  newProcessedData.set(currentActiveTxId, updatedTData as TranscriptProcessedData);
              }
          } else if (currentActiveTxId && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepToInvalidate)) {
              const tData = newProcessedData.get(currentActiveTxId);
              if (tData) {
                   const firstPhaseForP2S = tData.phases_for_p2s_processing?.[0];
                   newProcessedData.set(currentActiveTxId, {
                      ...tData,
                      p2s_outputs_by_phase: {}, 
                      current_phase_for_p2s_processing: firstPhaseForP2S, 
                      processed_phases_for_p2s: [],
                      isFullyProcessedSpecificSynchronic: false,
                  });
              }
          }
          else if (isGlobalStep(stepToInvalidate)) {
              newGenericState = { ...newGenericState, [keyPrefix]: undefined, [errorKey]: undefined };
              if (stepToInvalidate === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) {
                  newGenericState.isFullyProcessedGenericDiachronic = false; newGenericState.p3_3_mermaid_syntax = undefined;
                  newGenericState.core_gdus_for_sync_analysis = [];
                  newGenericState.p4s_1_a_outputs_by_gdu = {}; newGenericState.p4s_1_a_error = undefined;
                  newGenericState.p4s_outputs_by_gdu = {}; newGenericState.p4s_mermaid_syntax_by_gdu = {};
                  newGenericState.p4s_1_b_error = undefined;
                  newGenericState.current_gdu_for_p4s_processing = undefined; newGenericState.processed_gdus_for_p4s = [];
                  newGenericState.isFullyProcessedGenericSynchronic = false;
              } else if (stepToInvalidate === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
                  newGenericState.p4s_1_a_outputs_by_gdu = {}; newGenericState.p4s_1_a_error = undefined;
                  newGenericState.p4s_outputs_by_gdu = {}; newGenericState.p4s_mermaid_syntax_by_gdu = {}; 
                  newGenericState.p4s_1_b_error = undefined;
                  newGenericState.processed_gdus_for_p4s = []; 
                  newGenericState.isFullyProcessedGenericSynchronic = false;
              } else if (stepToInvalidate === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
                  newGenericState.p4s_outputs_by_gdu = {}; newGenericState.p4s_mermaid_syntax_by_gdu = {};
                  newGenericState.p4s_1_b_error = undefined;
                  newGenericState.processed_gdus_for_p4s = [];
                  newGenericState.isFullyProcessedGenericSynchronic = false;
              } else if (stepToInvalidate === StepId.P5_1_HOLISTIC_REVIEW_REFINEMENT) {
                  newGenericState.isRefinementDone = false;
              } else if (STEP_ORDER_PART_7_CAUSAL_MODELING.includes(stepToInvalidate)) {
                  newGenericState.isCausalModelingDone = false;
                  // Primary output & error for stepToInvalidate (a P7 step) are cleared by the general line above.
                  // Clear any additional P7-specific state for the current stepToInvalidate.
                  if (stepToInvalidate === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) {
                      newGenericState.p7_3_mermaid_syntax_dag = undefined;
                  } else if (stepToInvalidate === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) {
                      newGenericState.p7_3b_mermaid_syntax_dag = undefined;
                  }
                  // No need to loop through ALL P7 steps here; the outer loop handles subsequent P7 steps.
              } else if (stepToInvalidate === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
                  newGenericState.isReportGenerated = false; newGenericState.p6_1_output = undefined; newGenericState.p6_1_error = undefined;
              }
          }
      }
      return { invalidatedProcessedData: newProcessedData, invalidatedGenericState: newGenericState };
  }
  
  const toggleAutorun = () => {
    if (isAutorunning) {
      setIsAutorunning(false);
      if (processStartTime) {
        setElapsedTime(Math.floor((Date.now() - processStartTime) / 1000));
        setProcessStartTime(null); 
      }
    } else { 
      if (!processStartTime && currentStepInfo.stepId !== StepId.COMPLETE) {
        setProcessStartTime(Date.now());
        setElapsedTime(0); 
      }
  
      const stepToStartFrom = currentStepInfo.stepId === StepId.IDLE && rawTranscripts.length > 0 
                              ? STEP_ORDER_PART_NEG1[0] 
                              : currentStepInfo.stepId;
      
      const activeTxIdForInvalidation = rawTranscripts[activeTranscriptIndex]?.id;
  
      const { invalidatedProcessedData, invalidatedGenericState } = getInvalidatedStates(
        stepToStartFrom,
        activeTxIdForInvalidation,
        processedData,
        genericAnalysisState
      );
  
      setProcessedData(invalidatedProcessedData);
      setGenericAnalysisState(invalidatedGenericState);
  
      let effectiveStepToRun = stepToStartFrom;
      let effectiveTranscriptIndex = activeTranscriptIndex;
      let txIdToProcessRun: string | undefined = activeTxIdForInvalidation;

      if (stepToStartFrom === StepId.IDLE && rawTranscripts.length > 0) {
        effectiveStepToRun = STEP_ORDER_PART_NEG1[0];
        effectiveTranscriptIndex = 0;
        txIdToProcessRun = rawTranscripts[0]?.id;
        setActiveTranscriptIndex(0);
      }
      
      if (isGlobalStep(effectiveStepToRun) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(effectiveStepToRun)) {
        txIdToProcessRun = undefined; 
      }
      
      setCurrentStepInfo(prev => ({
        ...prev,
        stepId: effectiveStepToRun,
        transcriptId: txIdToProcessRun, 
        status: StepStatus.Idle, 
        outputData: undefined,
        error: undefined,
        inputData: undefined,
      }));
      setIsAutorunning(true);
  
      setTimeout(() => {
        if (effectiveStepToRun !== StepId.IDLE && effectiveStepToRun !== StepId.COMPLETE) {
          processSingleStep(effectiveStepToRun, txIdToProcessRun);
        } else if (effectiveStepToRun === StepId.IDLE && rawTranscripts.length === 0) {
          setIsAutorunning(false);
          if (processStartTime) { setElapsedTime(Math.floor((Date.now() - processStartTime) / 1000)); setProcessStartTime(null); }
        }
      }, 0);
    }
  };

  const handleRunStep = () => {
    if (currentStepInfo.stepId === StepId.IDLE || currentStepInfo.status === StepStatus.Loading) return;
    let txIdToRun:string|undefined; 
    const stepIsGlobal = isGlobalStep(currentStepInfo.stepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(currentStepInfo.stepId);
    if (!stepIsGlobal && rawTranscripts[activeTranscriptIndex]) txIdToRun = rawTranscripts[activeTranscriptIndex].id;
    if (!processStartTime && currentStepInfo.stepId !== StepId.COMPLETE) { setProcessStartTime(Date.now()); setElapsedTime(0); }
    processSingleStep(currentStepInfo.stepId, txIdToRun);
  };

  const handleRetryWithUserSeed = () => {
    const userSeed = parseInt(retrySeedInput, 10);
    if (isNaN(userSeed) || userSeed <= 0) { alert("Please enter a valid positive integer for the seed."); return; }
    if (currentStepInfo.stepId === StepId.IDLE || currentStepInfo.status === StepStatus.Loading) return;
    let txIdToRun:string|undefined; 
    const stepIsGlobal = isGlobalStep(currentStepInfo.stepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(currentStepInfo.stepId);
    if (!stepIsGlobal && rawTranscripts[activeTranscriptIndex]) txIdToRun = rawTranscripts[activeTranscriptIndex].id;
    processSingleStep(currentStepInfo.stepId, txIdToRun, userSeed);
  };
  
  const handleTranscriptItemClick = (index: number) => {
    if (isAutorunning) setIsAutorunning(false);
    setActiveTranscriptIndex(index);
    let stepToLoad = currentStepInfo.stepId; let phaseToLoad = currentStepInfo.currentPhaseForP2S; let gduToLoad = currentStepInfo.currentGduForP4S;
    
    if (isGlobalStep(currentStepInfo.stepId)) { // If current step is global, default to last specific step for selected transcript
        stepToLoad = STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.length -1]; 
    }
    
    if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepToLoad)) {
        const tData = processedData.get(rawTranscripts[index].id);
        phaseToLoad = tData?.current_phase_for_p2s_processing || tData?.phases_for_p2s_processing?.[0];
        if (!phaseToLoad && tData?.processed_phases_for_p2s?.length > 0) phaseToLoad = tData.processed_phases_for_p2s[tData.processed_phases_for_p2s.length -1];
    } else if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepToLoad)) {
        // Keep current GDU if P4S step is selected, or default to first if not set.
        gduToLoad = genericAnalysisState.current_gdu_for_p4s_processing || genericAnalysisState.core_gdus_for_sync_analysis?.[0];
        if (!gduToLoad && genericAnalysisState.processed_gdus_for_p4s?.length > 0) {
            gduToLoad = genericAnalysisState.processed_gdus_for_p4s[genericAnalysisState.processed_gdus_for_p4s.length - 1];
        }
    }


    const data = loadStepData(stepToLoad, rawTranscripts[index].id, phaseToLoad, gduToLoad);
    setCurrentStepInfo({ stepId:stepToLoad, transcriptId:rawTranscripts[index].id, currentPhaseForP2S: phaseToLoad, currentGduForP4S:gduToLoad, status:data.error?StepStatus.Error:(data.outputData?StepStatus.Success:StepStatus.Idle), inputData:data.inputData, outputData:data.outputData, error:data.error, groundingSources:data.groundingSources });
  };

  const getStepStatusForPipelineView = (stepId: StepId): { status: StepStatus; error?: string } => {
    const isStepGlobal = isGlobalStep(stepId);
    let status = StepStatus.Idle; let error: string | undefined;

    if (isStepGlobal) {
        if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
            if (genericAnalysisState.isFullyProcessedGenericSynchronic) status = StepStatus.Success;
            else if (genericAnalysisState.processed_gdus_for_p4s?.length > 0) status = StepStatus.Loading; 
            // Check for specific P4S_A or P4S_B error
            if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && genericAnalysisState.p4s_1_a_error) error = genericAnalysisState.p4s_1_a_error;
            if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && genericAnalysisState.p4s_1_b_error) error = genericAnalysisState.p4s_1_b_error;
        } else {
            const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof GenericAnalysisState;
            if (genericAnalysisState[keyPrefix]) status = StepStatus.Success;
            error = genericAnalysisState[`${String(keyPrefix).replace('_output', '_error')}` as keyof GenericAnalysisState] as string | undefined;
            if (error) status = StepStatus.Error;
        }
    } else { 
        const currentTId = rawTranscripts[activeTranscriptIndex]?.id;
        if (currentTId) {
            const tData = processedData.get(currentTId);
            if (tData) {
                if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
                    if(tData.isFullyProcessedSpecificSynchronic) status = StepStatus.Success;
                    else if (tData.processed_phases_for_p2s?.length > 0) status = StepStatus.Loading; 
                    if (currentStepInfo.stepId === stepId && currentStepInfo.transcriptId === currentTId && currentStepInfo.error) error = currentStepInfo.error;
                } else {
                    const keyPrefix = stepIdToDataKeyPrefix[stepId] as keyof TranscriptProcessedData;
                    if (tData[keyPrefix]) status = StepStatus.Success;
                    error = tData[`${String(keyPrefix).replace('_output', '_error')}` as keyof TranscriptProcessedData] as string | undefined;
                    if (error) status = StepStatus.Error;
                }
            }
        }
    }
    if (currentStepInfo.stepId === stepId) {
        if (isStepGlobal || currentStepInfo.transcriptId === rawTranscripts[activeTranscriptIndex]?.id) {
            if (currentStepInfo.status === StepStatus.Loading) status = StepStatus.Loading;
            else if (currentStepInfo.status === StepStatus.Error) { status = StepStatus.Error; error = currentStepInfo.error; }
            else if (currentStepInfo.status === StepStatus.Success) status = StepStatus.Success;
        }
    }
    return { status, error };
  };

  const getTranscriptStatusDisplay = (transcriptId: string): string => {
    const tData = processedData.get(transcriptId); if (!tData) return "Pending";
    if (tData.isFullyProcessedSpecificSynchronic) return "Specific Done";
    if (tData.p2s_outputs_by_phase && Object.keys(tData.p2s_outputs_by_phase).length > 0) return `P2S: ${tData.processed_phases_for_p2s?.length || 0}/${tData.phases_for_p2s_processing?.length || 0}`;
    if (tData.isFullyProcessedSpecificDiachronic) return "P1 Done";
    if (tData.p0_3_output) return "P0 Done";
    if (tData.p_neg1_1_output) return "IV/DV Done";
    return "Processing";
  };
  
  const handleSaveState = () => {
    const stateToSave: AppState = {
      version: APP_VERSION, rawTranscripts,
      processedDataArray: Array.from(processedData.entries()),
      genericAnalysisState, promptHistory, currentStepInfo, activeTranscriptIndex,
      userDvFocus, dvFocusInput, temperature, seedInput, outputDirectory, autoDownloadResults,
      totalInputTokens, totalOutputTokens, elapsedTime,
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    downloadFile(jsonString, `${outputDirectory}/uPATH_state_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  };

  const handleLoadStateFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedState = JSON.parse(e.target?.result as string) as AppState;
          if (loadedState.version !== APP_VERSION) { console.warn(`Loading state from a different app version (Loaded: ${loadedState.version}, Current: ${APP_VERSION}). Compatibility issues may arise.`); }
          resetAllStateForLoadOrNew(); 
          setRawTranscripts(loadedState.rawTranscripts || []);
          setProcessedData(new Map(loadedState.processedDataArray || []));
          setGenericAnalysisState(loadedState.genericAnalysisState || {
              isFullyProcessedGenericDiachronic:false, 
              p4s_1_a_outputs_by_gdu: {}, p4s_1_a_error: undefined,
              p4s_outputs_by_gdu:{}, p4s_mermaid_syntax_by_gdu:{}, p4s_1_b_error: undefined,
              isFullyProcessedGenericSynchronic:false, isRefinementDone: false, isCausalModelingDone:false, isReportGenerated:false
          });
          setPromptHistory(loadedState.promptHistory || []);
          setCurrentStepInfo(loadedState.currentStepInfo || { stepId: StepId.IDLE, status: StepStatus.Idle });
          setActiveTranscriptIndex(loadedState.activeTranscriptIndex || 0);
          setUserDvFocus(loadedState.userDvFocus || { dv_focus: [] });
          setDvFocusInput(loadedState.dvFocusInput || 'cognitions, emotions, sensations, imagination, internal_experiences');
          setTemperature(loadedState.temperature ?? 0.0);
          setSeedInput(loadedState.seedInput || '42');
          setOutputDirectory(loadedState.outputDirectory || 'MicroPheno_Analysis_Outputs');
          setAutoDownloadResults(loadedState.autoDownloadResults || false);
          setTotalInputTokens(loadedState.totalInputTokens || 0);
          setTotalOutputTokens(loadedState.totalOutputTokens || 0);
          setElapsedTime(loadedState.elapsedTime || 0);
          setProcessStartTime(null); 
          alert("State loaded successfully. Check API key and DV Focus, then proceed.");
        } catch (error) { console.error("Error loading state:", error); alert("Failed to load state. File may be corrupted or invalid."); }
      };
      reader.readAsText(file);
      if (loadStateInputRef.current) loadStateInputRef.current.value = "";
    }
  };

  const handleDownloadHistory = (format: 'tsv' | 'json') => {
    if (promptHistory.length === 0) { alert("No history to download."); return; }
    const filename = `${outputDirectory}/prompt_history_${new Date().toISOString().slice(0,10)}`;
    if (format === 'tsv') {
      const tsvContent = generateTsvForPromptHistory(promptHistory);
      downloadFile(tsvContent, `${filename}.tsv`, 'text/tab-separated-values;charset=utf-8');
    } else {
      const jsonContent = JSON.stringify(promptHistory, null, 2);
      downloadFile(jsonContent, `${filename}.json`, 'application/json');
    }
  };

  const handleGenerateAppendix = async (type: 'markdown' | 'html' = 'markdown') => {
    if (rawTranscripts.length === 0) { alert("No transcripts to generate appendix for."); return; }
    
    const gduCounts = calculateGduUtteranceCounts(processedData, genericAnalysisState.p3_2_output);
    const gssCounts = calculateGssCategoryUtteranceCounts(processedData, genericAnalysisState.p4s_outputs_by_gdu);
    const transitionCounts = calculateGduTransitionCounts(processedData, genericAnalysisState.p3_2_output, genericAnalysisState.p3_3_output);
    
    const allMermaidDiagrams: Record<string, {title: string, syntax: string}> = {};
    processedData.forEach((tData) => {
        if(tData.p1_4_mermaid_syntax && tData.p1_4_output) allMermaidDiagrams[`sds_${tData.id}`] = {title: `Specific Diachronic: ${tData.filename}`, syntax: tData.p1_4_mermaid_syntax};
        if(tData.p2s_outputs_by_phase) Object.entries(tData.p2s_outputs_by_phase).forEach(([phase, pData]) => { if(pData.p2s_3_mermaid_syntax) allMermaidDiagrams[`sss_${tData.id}_${phase.replace(/[^a-zA-Z0-9_]/g, '_')}`] = {title: `Specific Synchronic: ${tData.filename} - Phase: ${phase}`, syntax: pData.p2s_3_mermaid_syntax}; });
    });
    if(genericAnalysisState.p3_3_mermaid_syntax && genericAnalysisState.p3_3_output) allMermaidDiagrams['gds_main'] = {title: `Generic Diachronic Structure`, syntax: genericAnalysisState.p3_3_mermaid_syntax};
    if(genericAnalysisState.p4s_mermaid_syntax_by_gdu && genericAnalysisState.p4s_outputs_by_gdu) Object.entries(genericAnalysisState.p4s_mermaid_syntax_by_gdu).forEach(([gduId, syntax]) => { if(syntax) allMermaidDiagrams[`gss_${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}`] = {title: `Generic Synchronic for GDU: ${gduId}`, syntax: syntax}; });
    if(genericAnalysisState.p7_3b_mermaid_syntax_dag) allMermaidDiagrams['cleaned_causal_dag'] = {title: `Cleaned Causal DAG`, syntax: genericAnalysisState.p7_3b_mermaid_syntax_dag};
    else if(genericAnalysisState.p7_3_mermaid_syntax_dag) allMermaidDiagrams['causal_dag'] = {title: `Proposed Causal DAG`, syntax: genericAnalysisState.p7_3_mermaid_syntax_dag};

    if (type === 'html') {
        const htmlContent = generateHtmlAppendix(processedData, genericAnalysisState, rawTranscripts, allMermaidDiagrams, gduCounts, gssCounts, transitionCounts);
        downloadFile(htmlContent, `${outputDirectory}/appendix_detailed_analyses.html`, 'text/html;charset=utf-8');
    } else { 
        let mdContent = `# Detailed Analysis Appendix\n\nThis appendix provides a transcript-by-transcript breakdown of specific diachronic and synchronic analyses, along with relevant visualizations and quantitative summaries.\n\n`;
        processedData.forEach((tData) => {
            mdContent += `## Transcript: ${tData.filename}\n`;
            mdContent += `### Specific Diachronic Structure\n\`\`\`mermaid\n${tData.p1_4_mermaid_syntax || "Not available"}\n\`\`\`\n`;
            if (tData.p2s_outputs_by_phase) {
                Object.entries(tData.p2s_outputs_by_phase).forEach(([phase, phaseData]) => {
                    if (phaseData.p2s_3_mermaid_syntax) {
                        mdContent += `### Specific Synchronic Structure (Phase: ${phase})\n\`\`\`mermaid\n${phaseData.p2s_3_mermaid_syntax}\n\`\`\`\n`;
                    }
                });
            }
        });
        mdContent += `\n## Quantitative Summaries\n(Data tables similar to HTML version would be inserted here)\n`;
        downloadFile(mdContent, `${outputDirectory}/appendix_detailed_analyses.md`, 'text/markdown;charset=utf-8');
    }
  };

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

  const formatElapsedTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };
  
  const handleOpenHilModal = () => {
      if (currentStepInfo.inputData && (currentStepInfo.outputData || currentStepInfo.error)) {
        const config = STEP_CONFIGS[currentStepInfo.stepId];
        if (config) {
          const originalPrompt = config.generatePrompt(currentStepInfo.inputData);
          setHilContext({
            stepInfo: currentStepInfo,
            originalPrompt,
            previousResponse: currentStepInfo.outputData ? (typeof currentStepInfo.outputData === 'string' ? currentStepInfo.outputData : JSON.stringify(currentStepInfo.outputData, null, 2)) : (currentStepInfo.error || "No previous response data.")
          });
          setIsHilModalOpen(true);
        }
      }
    };

    const getHilPreviousResponseDisplay = (): string => {
        if (!hilContext) return "No context.";
        const resp = hilContext.previousResponse;
        if (typeof resp === 'string') return resp;
        try { return JSON.stringify(resp, null, 2); } 
        catch (e) { return "Error displaying previous response."; }
    };

    const handleHilSubmit = () => {
      if (hilContext && hilUserGuidance.trim()) {
        const { stepInfo, originalPrompt } = hilContext;
        const config = STEP_CONFIGS[stepInfo.stepId];
        if (config) {
          const metaPrompt = `The original prompt was:
--- ORIGINAL PROMPT START ---
${originalPrompt}
--- ORIGINAL PROMPT END ---

The AI's previous response was problematic. User guidance for correction:
--- USER GUIDANCE START ---
${hilUserGuidance}
--- USER GUIDANCE END ---

Based on this guidance, please re-attempt the original task. Your output MUST strictly follow the JSON schema or format requested in the ORIGINAL prompt. Do not add explanations unless the original prompt asked for them. If the original prompt asked for JSON, output ONLY the JSON.`;
          
          let txIdToRun: string | undefined;
          const stepIsGlobal = isGlobalStep(stepInfo.stepId) || STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepInfo.stepId);
          if (!stepIsGlobal && stepInfo.transcriptId) {
            txIdToRun = stepInfo.transcriptId;
          }
          
          processSingleStep(stepInfo.stepId, txIdToRun, undefined, metaPrompt);
          setIsHilModalOpen(false);
          setHilUserGuidance('');
          setHilContext(null);
        }
      }
    };

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
          apiKeyPresent={apiKeyPresent} dvFocusInput={dvFocusInput} onDvFocusInputChange={setDvFocusInput} dvFocusError={dvFocusError}
          temperature={temperature} onTemperatureChange={setTemperature} seedInput={seedInput} onSeedInputChange={setSeedInput}
          outputDirectory={outputDirectory} onOutputDirectoryChange={setOutputDirectory} autoDownloadResults={autoDownloadResults} onAutoDownloadResultsChange={setAutoDownloadResults}
          onSaveState={handleSaveState} onLoadStateFileChange={handleLoadStateFileChange} loadStateInputRef={loadStateInputRef}
          onFileUpload={handleRegularFileUpload} fileUploadInputRef={fileUploadInputRef}
          isDraggingOver={isDraggingOver} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          rawTranscripts={rawTranscripts} activeTranscriptIndex={activeTranscriptIndex} isGlobalStep={isGlobalStep} currentStepInfo={currentStepInfo}
          onTranscriptItemClick={handleTranscriptItemClick} getTranscriptStatusDisplay={getTranscriptStatusDisplay}
          PipelineOverviewComponent={
            <PipelineOverview
              allPipelineParts={allPipelinePartsInOrder} STEP_CONFIGS={STEP_CONFIGS} currentStepInfo={currentStepInfo}
              getStepStatusForPipelineView={getStepStatusForPipelineView} handlePipelineStepClick={handlePipelineStepClick}
              PipelineStepNodeComponent={PipelineStepNode}
            />
          }
          inputBaseClasses={inputBaseClasses} secondaryButtonClasses={secondaryButtonClasses} disabledButtonClasses={disabledButtonClasses}
        />

        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <ControlsPanel
              isAutorunning={isAutorunning} onToggleAutorun={toggleAutorun}
              isAutorunPauseButtonEffectivelyDisabled={!apiKeyPresent || !!dvFocusError || (rawTranscripts.length === 0 && currentStepInfo.stepId === StepId.IDLE) || currentStepInfo.stepId === StepId.COMPLETE}
              onPreviousStep={handlePreviousStep} isPreviousStepDisabled={currentStepInfo.status === StepStatus.Loading || !getPreviousStepDetails()}
              onNextStep={handleNextStep} isNextStepDisabled={currentStepInfo.status === StepStatus.Loading || (!getNextStepDetails() && currentStepInfo.stepId !== StepId.COMPLETE && !genericAnalysisState.isReportGenerated)}
              onRunStep={handleRunStep} isRunStepDisabled={currentStepInfo.stepId === StepId.IDLE || currentStepInfo.status === StepStatus.Loading || currentStepInfo.stepId === StepId.COMPLETE || (!apiKeyPresent && currentStepInfo.stepId !== StepId.P6_1_GENERATE_MARKDOWN_REPORT) || !!dvFocusError}
              onOpenHilModal={handleOpenHilModal}
              isHilModalDisabled={currentStepInfo.stepId === StepId.IDLE || currentStepInfo.status === StepStatus.Loading || currentStepInfo.stepId === StepId.COMPLETE || !currentStepInfo.inputData || (!currentStepInfo.outputData && !currentStepInfo.error) }
              onDownloadOutput={() => handleDownloadOutput()}
              isDownloadOutputDisabled={currentStepInfo.stepId === StepId.IDLE || (!currentStepInfo.outputData && !genericAnalysisState.p6_1_output) || (currentStepInfo.stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT && !genericAnalysisState.p6_1_output)}
              onDownloadHistory={handleDownloadHistory} isDownloadHistoryDisabled={promptHistory.length === 0}
              onGenerateAppendix={() => handleGenerateAppendix('markdown')}
              isAppendixDataAvailable={rawTranscripts.length > 0 && genericAnalysisState.isReportGenerated}
              onGenerateHtmlAppendix={() => handleGenerateAppendix('html')}
              showRetryWithNewSeedUI={currentStepInfo.status === StepStatus.Error && !!currentStepInfo.error?.match(/parse JSON/i)}
              retrySeedInput={retrySeedInput} onRetrySeedInputChange={setRetrySeedInput} onRetryWithUserSeed={handleRetryWithUserSeed}
              inputBaseClasses={inputBaseClasses} primaryButtonClasses={primaryButtonClasses} secondaryButtonClasses={secondaryButtonClasses} disabledButtonClasses={disabledButtonClasses}
            />
          </div>
          
          <StatusDisplay
            currentStepInfo={currentStepInfo} STEP_CONFIGS={STEP_CONFIGS} processedData={processedData}
            totalInputTokens={totalInputTokens} totalOutputTokens={totalOutputTokens}
            processStartTime={processStartTime} elapsedTime={elapsedTime} formatElapsedTime={formatElapsedTime}
          />

          <div ref={outputDisplayRef} className="output-display p-4 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg shadow min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
            {renderOutput()} 
          </div>
        </div>
      </main>

      <HilModal
        isOpen={isHilModalOpen} onClose={() => setIsHilModalOpen(false)} hilContext={hilContext}
        STEP_CONFIGS={STEP_CONFIGS} processedData={processedData}
        hilUserGuidance={hilUserGuidance} onHilUserGuidanceChange={setHilUserGuidance} onSubmit={handleHilSubmit}
        getHilPreviousResponseDisplay={getHilPreviousResponseDisplay}
        inputBaseClasses={inputBaseClasses} secondaryButtonClasses={secondaryButtonClasses} primaryButtonClasses={primaryButtonClasses} disabledButtonClasses={disabledButtonClasses}
        CollapsibleSectionComponent={CollapsibleSection}
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
