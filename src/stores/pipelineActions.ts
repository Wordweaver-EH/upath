import { StepId, StepStatus, TranscriptProcessedData, GenericAnalysisState, P1_4_Output, P2S_3_Output, P3_3_Output, P4S_1_A_Output, P4S_1_Output, SSSNodeGroup, P6_1_Output, PromptHistoryEntry, P2SPhaseData, P3_2_Output, P7_3_Output, P7_3b_Output } from '../../types'
import { STEP_CONFIGS, STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, ALL_PIPELINE_STEP_IDS_IN_ORDER, STEP_ORDER_PART_NEG1, STEP_ORDER_PART_0, STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC, P3_2_APPROACH } from '../../constants'
import { stepIdToDataKeyPrefix, isGlobalStep } from '../utils/stepIdToDataKeyPrefix'
import { callGeminiAPI } from '../../services/geminiService'
import { generateMarkdownReportProgrammatically, ReportData } from '../../utils/reportHelper'
import { transformDiachronicToMermaid, transformSynchronicToMermaid, transformGenericDiachronicToMermaid, transformDagToMermaid } from '../../utils/visualizationHelper'
import { useUIStore } from './uiStore'
import { useSettingsStore } from './settingsStore'
import { WritableDraft } from 'immer'

export interface ProcessSingleStepParams {
  stepId: StepId
  transcriptIdToProcess?: string
  overrideSeed?: number
  hilMetaPrompt?: string
}

export interface ProcessSingleStepContext {
  rawTranscripts: any[]
  processedData: Map<string, TranscriptProcessedData>
  genericAnalysisState: GenericAnalysisState
  set: (fn: (state: any) => void) => void
  get: () => any
}

export const processSingleStepImplementation = async (
  params: ProcessSingleStepParams,
  context: ProcessSingleStepContext
) => {
  const { stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt } = params
  const { rawTranscripts, processedData, genericAnalysisState, set, get } = context
  
  const isReportStepForThisCall = stepId === StepId.P6_1_GENERATE_MARKDOWN_REPORT
  const uiStore = useUIStore.getState()
  const settingsStore = useSettingsStore.getState()
  const { apiKeyPresent, userDvFocus, dvFocusError, temperature, seed } = settingsStore
  
  // Get step config
  const config = STEP_CONFIGS[stepId]
  if (!config) {
    uiStore.setCurrentStepInfo({ 
      stepId, 
      status: StepStatus.Error, 
      error: `Config for ${stepId} not found.` 
    })
    uiStore.setAutorunning(false)
    return
  }
  
  // Prepare context variables
  const currentTranscript = transcriptIdToProcess 
    ? rawTranscripts.find(t => t.id === transcriptIdToProcess) 
    : undefined
  let currentPhase: string | undefined = undefined
  let currentGDU: string | undefined = undefined
  let tempGenericState = { ...genericAnalysisState }
  
  // Handle P2S phase context
  if (transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
    const tData = processedData.get(transcriptIdToProcess)
    if (tData) {
      currentPhase = tData.current_phase_for_p2s_processing
      if (!currentPhase && stepId === STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0] && (tData.phases_for_p2s_processing?.length || 0) > 0) {
        currentPhase = tData.phases_for_p2s_processing?.[0]
        set((state) => {
          const d = state.processedData.get(transcriptIdToProcess)
          if (d) {
            state.processedData.set(transcriptIdToProcess, {
              ...d,
              current_phase_for_p2s_processing: currentPhase
            })
          }
        })
      }
      if (!currentPhase && (tData.phases_for_p2s_processing?.length || 0) > 0 && !tData.isFullyProcessedSpecificSynchronic) {
        uiStore.setCurrentStepInfo({ 
          stepId, 
          transcriptId: transcriptIdToProcess, 
          status: StepStatus.Error, 
          error: `P2S Error: Current phase not set for ${transcriptIdToProcess}` 
        })
        uiStore.setAutorunning(false)
        return
      }
    }
  }
  
  // Handle P4S GDU context
  if (STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
    currentGDU = tempGenericState.current_gdu_for_p4s_processing
    if (!currentGDU && stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && (tempGenericState.core_gdus_for_sync_analysis?.length || 0) > 0) {
      const firstNonProcessed = tempGenericState.core_gdus_for_sync_analysis?.find(g => 
        !(tempGenericState.processed_gdus_for_p4s || []).includes(g)
      )
      if (firstNonProcessed) {
        currentGDU = firstNonProcessed
        tempGenericState = { 
          ...tempGenericState, 
          current_gdu_for_p4s_processing: firstNonProcessed, 
          p4s_1_a_error: undefined, 
          p4s_1_b_error: undefined 
        }
        set((state) => {
          state.genericAnalysisState.current_gdu_for_p4s_processing = firstNonProcessed
          state.genericAnalysisState.p4s_1_a_error = undefined
          state.genericAnalysisState.p4s_1_b_error = undefined
        })
      } else if (!tempGenericState.isFullyProcessedGenericSynchronic) {
        uiStore.setCurrentStepInfo({
          stepId,
          status: StepStatus.Error,
          error: "P4S.1.A: All GDUs processed but P4S not complete.",
          currentGduForP4S: currentGDU
        })
        uiStore.setAutorunning(false)
        return
      }
    }
    if (!currentGDU && (tempGenericState.core_gdus_for_sync_analysis || []).length > 0 && !tempGenericState.isFullyProcessedGenericSynchronic) {
      uiStore.setCurrentStepInfo({
        stepId,
        status: StepStatus.Error,
        error: `P4S Error: No GDU to process for ${stepId}, but P4S not complete.`,
        currentGduForP4S: currentGDU
      })
      uiStore.setAutorunning(false)
      return
    }
  }
  
  // Get input data
  let inputResult = config.getInput(
    currentTranscript, 
    processedData, 
    tempGenericState, 
    apiKeyPresent, 
    userDvFocus, 
    rawTranscripts, 
    currentPhase, 
    currentGDU
  )
  
  if (inputResult === null || inputResult?.error) {
    const errText = `Input error for ${stepId}: ${inputResult?.error || 'Input null'}`
    uiStore.setCurrentStepInfo({ 
      stepId, 
      transcriptId: transcriptIdToProcess, 
      status: StepStatus.Error, 
      error: errText, 
      currentGduForP4S: currentGDU, 
      currentPhaseForP2S: currentPhase 
    })
    
    if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
      set((state) => { state.genericAnalysisState.p4s_1_a_error = errText })
    } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
      set((state) => { state.genericAnalysisState.p4s_1_b_error = errText })
    }
    
    uiStore.setAutorunning(false)
    return
  }
  
  const inputData = inputResult.data
  uiStore.setCurrentStepInfo({ 
    stepId, 
    transcriptId: transcriptIdToProcess, 
    status: StepStatus.Loading, 
    inputData, 
    currentGduForP4S: currentGDU, 
    currentPhaseForP2S: currentPhase 
  })
  
  // Process the step
  let output: string | any
  let apiError: string | undefined
  let groundingSources: PromptHistoryEntry['groundingSources']
  let estIn: number | undefined = 0
  let estOut: number | undefined = 0
  let promptForHistory = hilMetaPrompt || config.generatePrompt(inputData)
  
  if (isReportStepForThisCall) {
    // Generate report programmatically
    try {
      output = generateMarkdownReportProgrammatically(inputData as ReportData)
      apiError = undefined
    } catch (e: any) {
      console.error("Error generating report programmatically:", e)
      output = ""
      apiError = `Programmatic report generation failed: ${e.message || String(e)}`
    }
    promptForHistory = "Programmatic report generation."
  } else {
    // Call Gemini API
    const effectiveSeed = overrideSeed !== undefined ? overrideSeed : seed
    const apiResult = await callGeminiAPI(
      promptForHistory, 
      1, // maxRetries
      config.isJsonOutput, 
      false, // useGrounding
      temperature, 
      effectiveSeed
    )
    output = config.isJsonOutput ? apiResult.parsedJson : apiResult.text
    apiError = apiResult.error
    
    // Apply parseOutput validation if available and no API error
    if (!apiError && output && config.parseOutput) {
      try {
        output = config.parseOutput(output, inputData)
      } catch (validationError: any) {
        apiError = `Output validation failed: ${validationError.message || String(validationError)}`
        console.error(`Validation failed for ${stepId}:`, validationError)
      }
    }
    
    groundingSources = apiResult.groundingSources
    estIn = apiResult.estimatedInputTokens
    estOut = apiResult.estimatedOutputTokens
    
    // Update token counts
    if (estIn != null) {
      set((state) => { state.totalInputTokens += estIn! })
    }
    if (estOut != null) {
      set((state) => { state.totalOutputTokens += estOut! })
    }
  }
  
  // Add to prompt history
  const historyEntry: PromptHistoryEntry = {
    stepId,
    transcriptId: transcriptIdToProcess,
    timestamp: new Date().toISOString(),
    prompt: promptForHistory,
    requestPayload: isReportStepForThisCall 
      ? { programmaticInput: inputData } 
      : { 
          model: 'gemini-2.5-flash-preview-04-17', 
          contents: promptForHistory, 
          temperature, 
          seed: (!isReportStepForThisCall ? (overrideSeed !== undefined ? overrideSeed : seed) : undefined) 
        },
    responseRaw: typeof output === 'string' ? output : (output ? JSON.stringify(output) : ''),
    responseParsed: output,
    error: apiError,
    groundingSources,
    estimatedInputTokens: estIn,
    estimatedOutputTokens: estOut
  }
  
  set((state) => {
    state.promptHistory.push(historyEntry)
  })
  
  // Handle errors
  if (apiError) {
    handleStepError(stepId, transcriptIdToProcess, apiError, inputData, output, groundingSources, currentGDU, currentPhase, isReportStepForThisCall, set, uiStore)
    return
  }
  
  // Handle successful output
  if (isReportStepForThisCall) {
    handleReportGeneration(output, set, uiStore)
  } else {
    handleSuccessfulStep(stepId, transcriptIdToProcess, output, inputData, groundingSources, currentGDU, currentPhase, processedData, set, uiStore)
  }
}

// Helper functions for handling different outcomes
function handleStepError(
  stepId: StepId,
  transcriptIdToProcess: string | undefined,
  apiError: string,
  inputData: any,
  output: any,
  groundingSources: any,
  currentGDU: string | undefined,
  currentPhase: string | undefined,
  isReportStepForThisCall: boolean,
  set: any,
  uiStore: any
) {
  uiStore.setCurrentStepInfo({ 
    stepId, 
    transcriptId: transcriptIdToProcess, 
    status: StepStatus.Error, 
    error: apiError, 
    inputData, 
    outputData: output, 
    groundingSources, 
    currentGduForP4S: currentGDU, 
    currentPhaseForP2S: currentPhase 
  })
  
  const key = stepIdToDataKeyPrefix[stepId]
  
  if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES) {
    set((state: any) => { state.genericAnalysisState.p4s_1_a_error = apiError })
  } else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS) {
    set((state: any) => { state.genericAnalysisState.p4s_1_b_error = apiError })
  } else if (isReportStepForThisCall) {
    set((state: any) => { 
      state.genericAnalysisState.p6_1_error = apiError
      state.genericAnalysisState.isReportGenerated = false
      state.genericAnalysisState.p6_1_output = undefined
    })
  } else if (key) {
    const eKey = `${key.toString().replace('_output', '_error')}`
    
    if (transcriptIdToProcess && currentPhase && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId)) {
      set((state: any) => {
        const d = state.processedData.get(transcriptIdToProcess)
        if (d) {
          const p2sU = {
            ...(d.p2s_outputs_by_phase || {}),
            [currentPhase!]: {
              ...(d.p2s_outputs_by_phase?.[currentPhase!] || {}),
              [eKey]: apiError,
              [key as keyof P2SPhaseData]: undefined
            }
          }
          state.processedData.set(transcriptIdToProcess, { ...d, p2s_outputs_by_phase: p2sU })
        }
      })
    } else if (transcriptIdToProcess) {
      set((state: any) => {
        const d = state.processedData.get(transcriptIdToProcess)
        if (d) {
          state.processedData.set(transcriptIdToProcess, {
            ...d,
            [eKey]: apiError,
            [key as keyof TranscriptProcessedData]: undefined
          } as any)
        }
      })
    } else {
      set((state: any) => {
        state.genericAnalysisState[eKey] = apiError
        state.genericAnalysisState[key as keyof GenericAnalysisState] = undefined
      })
    }
  }
  
  uiStore.setAutorunning(false)
}

function handleReportGeneration(output: any, set: any, uiStore: any) {
  if (typeof output === 'string' && output.trim() !== '') {
    set((state: any) => {
      state.genericAnalysisState.isReportGenerated = true
      state.genericAnalysisState.p6_1_output = output as P6_1_Output
      state.genericAnalysisState.p6_1_error = undefined
    })
    
    uiStore.setCurrentStepInfo({ 
      stepId: StepId.P6_1_GENERATE_MARKDOWN_REPORT, 
      status: StepStatus.Success, 
      outputData: output 
    })
  } else {
    const rptErr = "Report generation resulted in empty/invalid content."
    uiStore.setCurrentStepInfo({
      stepId: StepId.P6_1_GENERATE_MARKDOWN_REPORT,
      status: StepStatus.Error,
      error: rptErr,
      outputData: output
    })
    
    set((state: any) => {
      state.genericAnalysisState.isReportGenerated = false
      state.genericAnalysisState.p6_1_output = undefined
      state.genericAnalysisState.p6_1_error = rptErr
    })
    
    uiStore.setAutorunning(false)
  }
}

function handleSuccessfulStep(
  stepId: StepId,
  transcriptIdToProcess: string | undefined,
  output: any,
  inputData: any,
  groundingSources: any,
  currentGDU: string | undefined,
  currentPhase: string | undefined,
  processedData: Map<string, TranscriptProcessedData>,
  set: any,
  uiStore: any
) {
  uiStore.setCurrentStepInfo({ 
    stepId, 
    transcriptId: transcriptIdToProcess, 
    status: StepStatus.Success, 
    inputData, 
    outputData: output, 
    groundingSources, 
    currentGduForP4S: currentGDU, 
    currentPhaseForP2S: currentPhase 
  })
  
  const key = stepIdToDataKeyPrefix[stepId]
  
  // Handle transcript-specific outputs
  if (transcriptIdToProcess && key && typeof key === 'string' && !STEP_ORDER_PART_4_GENERIC_SYNCHRONIC.includes(stepId)) {
    set((state: any) => {
      const d = state.processedData.get(transcriptIdToProcess)
      if (d) {
        const nD: TranscriptProcessedData = {
          ...d,
          [key as keyof TranscriptProcessedData]: output,
          [`${key.replace('_output','_error')}` as keyof TranscriptProcessedData]: undefined
        } as any
        
        // Special handling for P1.4
        if (stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && output) {
          nD.isFullyProcessedSpecificDiachronic = true
          nD.p1_4_mermaid_syntax = transformDiachronicToMermaid((output as P1_4_Output).specific_diachronic_structure)
          const phases = (output as P1_4_Output)?.specific_diachronic_structure?.phases.map(p => p.phase_name) || []
          nD.phases_for_p2s_processing = phases
          nD.current_phase_for_p2s_processing = phases[0] || undefined
          nD.processed_phases_for_p2s = []
          nD.p2s_outputs_by_phase = {}
          nD.isFullyProcessedSpecificSynchronic = phases.length === 0
        }
        
        state.processedData.set(transcriptIdToProcess, nD)
      }
    })
  }
  
  // Handle P2S phase outputs
  if (currentPhase && transcriptIdToProcess && STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepId) && key && typeof key === 'string') {
    set((state: any) => {
      const tD = state.processedData.get(transcriptIdToProcess)
      if (tD) {
        let mermaid: string | undefined = undefined
        if (stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE && output) {
          mermaid = transformSynchronicToMermaid((output as P2S_3_Output).specific_synchronic_structure, currentPhase)
        }
        
        const uP2S = {
          ...(tD.p2s_outputs_by_phase || {}),
          [currentPhase!]: {
            ...(tD.p2s_outputs_by_phase?.[currentPhase!] || {}),
            [key as keyof P2SPhaseData]: output,
            [`${key.replace('_output','_error')}` as keyof P2SPhaseData]: undefined,
            ...(mermaid && { p2s_3_mermaid_syntax: mermaid })
          }
        }
        
        let newProcPhases = [...(tD.processed_phases_for_p2s || [])]
        let allDone = tD.isFullyProcessedSpecificSynchronic
        let nextPhase: string | undefined = currentPhase
        
        if (stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
          newProcPhases = Array.from(new Set([...newProcPhases, currentPhase!]))
          const transcriptPhases = tD.phases_for_p2s_processing || []
          allDone = transcriptPhases.length > 0 ? newProcPhases.length === transcriptPhases.length : true
          if (!allDone) {
            nextPhase = transcriptPhases.find(p => !newProcPhases.includes(p))
          } else {
            nextPhase = undefined
          }
        }
        
        state.processedData.set(transcriptIdToProcess, {
          ...tD,
          p2s_outputs_by_phase: uP2S,
          processed_phases_for_p2s: newProcPhases,
          isFullyProcessedSpecificSynchronic: allDone,
          current_phase_for_p2s_processing: nextPhase
        })
      }
    })
  } 
  // Handle global step outputs
  else if (stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE && output) {
    const p3_3 = (output as P3_3_Output)
    const core = p3_3?.generic_diachronic_structure_definition?.core_gdus || []
    const mermaid = p3_3 ? transformGenericDiachronicToMermaid(p3_3.generic_diachronic_structure_definition) : undefined
    
    set((state: any) => {
      state.genericAnalysisState.p3_3_output = p3_3
      state.genericAnalysisState.p3_3_mermaid_syntax = mermaid
      state.genericAnalysisState.p3_3_error = undefined
      state.genericAnalysisState.isFullyProcessedGenericDiachronic = true
      state.genericAnalysisState.core_gdus_for_sync_analysis = core
      state.genericAnalysisState.processed_gdus_for_p4s = []
      state.genericAnalysisState.current_gdu_for_p4s_processing = core[0] || undefined
      state.genericAnalysisState.p4s_outputs_by_gdu = {}
      state.genericAnalysisState.p4s_mermaid_syntax_by_gdu = {}
      state.genericAnalysisState.p4s_1_a_error = undefined
      state.genericAnalysisState.p4s_1_b_error = undefined
      state.genericAnalysisState.isFullyProcessedGenericSynchronic = (core.length === 0)
    })
  }
  // Handle P4S.1.A output processing
  else if (stepId === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && output && currentGDU) {
    const llmResponse = output as { 
      grouped_data: Array<{
        transcript_id: string;
        phase_name: string;
        sss_node_id: string;
        sss_node_label: string;
        group_id: string;
        group_rationale: string;
      }>;
      classification_notes?: string;
    }
    
    // Validate SSS nodes exist in their respective P2S_3 outputs
    const validatedNodes: typeof llmResponse.grouped_data = []
    const invalidNodes: Array<{ nodeId: string; transcriptId: string; phase: string; reason: string }> = []
    
    llmResponse.grouped_data.forEach(nodeData => {
      const txData = processedData.get(nodeData.transcript_id)
      if (!txData) {
        invalidNodes.push({ 
          nodeId: nodeData.sss_node_id, 
          transcriptId: nodeData.transcript_id, 
          phase: nodeData.phase_name, 
          reason: "transcript not found" 
        })
        return
      }
      
      const phaseData = txData.p2s_outputs_by_phase?.[nodeData.phase_name]
      if (!phaseData?.p2s_3_output?.specific_synchronic_structure) {
        invalidNodes.push({ 
          nodeId: nodeData.sss_node_id, 
          transcriptId: nodeData.transcript_id, 
          phase: nodeData.phase_name, 
          reason: "phase data not found" 
        })
        return
      }
      
      const sssNodeExists = phaseData.p2s_3_output.specific_synchronic_structure.network_nodes.some(
        n => n.id === nodeData.sss_node_id
      )
      if (!sssNodeExists) {
        invalidNodes.push({ 
          nodeId: nodeData.sss_node_id, 
          transcriptId: nodeData.transcript_id, 
          phase: nodeData.phase_name, 
          reason: "SSS node not found in P2S_3 data" 
        })
        return
      }
      
      validatedNodes.push(nodeData)
    })
    
    if (invalidNodes.length > 0) {
      console.warn(`[P4S.1.A Processing] Found ${invalidNodes.length} invalid node references from LLM:`, invalidNodes)
      console.log(`[P4S.1.A Processing] Proceeding with ${validatedNodes.length} valid nodes, excluding invalid ones`)
    }
    
    // Group nodes by group_id (excluding "N/A")
    const groupsMap = new Map<string, Array<{
      transcript_id: string;
      phase_name: string;
      sss_node_id: string;
      sss_node_label: string;
      group_rationale: string;
    }>>()
    
    validatedNodes.forEach(nodeData => {
      if (nodeData.group_id !== "N/A") {
        if (!groupsMap.has(nodeData.group_id)) {
          groupsMap.set(nodeData.group_id, [])
        }
        groupsMap.get(nodeData.group_id)!.push({
          transcript_id: nodeData.transcript_id,
          phase_name: nodeData.phase_name,
          sss_node_id: nodeData.sss_node_id,
          sss_node_label: nodeData.sss_node_label,
          group_rationale: nodeData.group_rationale
        })
      }
    })
    
    // Validate cross-transcript requirement for each group
    const validatedGroups: P4S_1_A_Output['sss_node_groups'] = []
    const idiosyncraticGroups: SSSNodeGroup[] = []
    let groupCounter = 1
    let idiosyncraticCounter = 1
    
    groupsMap.forEach((nodes, groupId) => {
      const transcriptIds = new Set(nodes.map(n => n.transcript_id))
      if (transcriptIds.size >= 2) {
        // Valid cross-transcript group
        const groupRationale = nodes[0]?.group_rationale || `Generic group for concept: ${groupId}`
        validatedGroups.push({
          group_id: `gss_node_group_${groupCounter}_${groupId}`,
          group_rationale: groupRationale,
          contributing_sss_nodes: nodes.map(n => ({
            transcript_id: n.transcript_id,
            phase_name: n.phase_name,
            sss_node_id: n.sss_node_id,
            sss_node_label: n.sss_node_label
          }))
        })
        groupCounter++
        console.log(`[P4S.1.A Processing] Created valid group ${groupId} with ${nodes.length} nodes from ${transcriptIds.size} transcripts`)
      } else {
        const groupRationale = `Idiosyncratic group for concept: ${groupId}. ` + (nodes[0]?.group_rationale || 'No specific rationale provided.')
        idiosyncraticGroups.push({
          group_id: `idiosyncratic_group_${idiosyncraticCounter}_${groupId}`,
          group_rationale: groupRationale,
          contributing_sss_nodes: nodes.map(n => ({
            transcript_id: n.transcript_id,
            phase_name: n.phase_name,
            sss_node_id: n.sss_node_id,
            sss_node_label: n.sss_node_label
          }))
        })
        idiosyncraticCounter++
        console.log(`[P4S.1.A Processing] Identified idiosyncratic group ${groupId} from transcript ${Array.from(transcriptIds)[0]}`)
      }
    })
    
    if (validatedGroups.length === 0) {
      const noValidGroupsError = `No valid cross-transcript groups created for GDU ${currentGDU}. All groups failed the minimum 2-transcript requirement.`
      console.error(`[P4S.1.A Processing] ${noValidGroupsError}`)
      uiStore.setCurrentStepInfo({ 
        stepId, 
        transcriptId: transcriptIdToProcess, 
        status: StepStatus.Error, 
        error: noValidGroupsError,
        currentGduForP4S: currentGDU
      })
      set((state: any) => { state.genericAnalysisState.p4s_1_a_error = noValidGroupsError })
      uiStore.setAutorunning(false)
      return
    }
    
    // Reconstruct final P4S_1_A_Output
    const p4s1a_out: P4S_1_A_Output = {
      analyzed_gdu: currentGDU,
      sss_node_groups: validatedGroups,
      idiosyncratic_sss_node_groups: idiosyncraticGroups.length > 0 ? idiosyncraticGroups : undefined,
      dependent_variable_focus: inputData?.userDvFocus?.dv_focus || [],
      grouping_process_notes: `Reconstructed from LLM classification. Original nodes: ${llmResponse.grouped_data.length}, Valid groups: ${validatedGroups.length}, Idiosyncratic groups: ${idiosyncraticGroups.length}. ${llmResponse.classification_notes || ''}`
    }
    
    console.log(`[P4S.1.A Processing] Successfully reconstructed P4S_1_A output with ${validatedGroups.length} valid groups`)
    
    set((state: any) => {
      state.genericAnalysisState.p4s_1_a_outputs_by_gdu = {
        ...(state.genericAnalysisState.p4s_1_a_outputs_by_gdu || {}),
        [currentGDU]: p4s1a_out
      }
      state.genericAnalysisState.p4s_1_a_error = undefined
    })
  }
  // Handle P4S.1.B output processing
  else if (stepId === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && output && currentGDU) {
    const p4s1b_out = output as P4S_1_Output
    const mermaid = p4s1b_out ? transformSynchronicToMermaid(p4s1b_out.generic_synchronic_structure, currentGDU) : undefined
    
    set((state: any) => {
      const newP4SOut = { 
        ...(state.genericAnalysisState.p4s_outputs_by_gdu || {}), 
        [currentGDU]: p4s1b_out 
      }
      const newP4SMermaid = { 
        ...(state.genericAnalysisState.p4s_mermaid_syntax_by_gdu || {}), 
        [currentGDU]: mermaid 
      }
      const newProcGDUs = Array.from(new Set([
        ...(state.genericAnalysisState.processed_gdus_for_p4s || []), 
        currentGDU
      ]))
      const allCoreDone = state.genericAnalysisState.core_gdus_for_sync_analysis 
        ? newProcGDUs.length === state.genericAnalysisState.core_gdus_for_sync_analysis.length 
        : (state.genericAnalysisState.core_gdus_for_sync_analysis || []).length === 0
      
      let nextGDUforP4S: string | undefined = undefined
      if (!allCoreDone && state.genericAnalysisState.core_gdus_for_sync_analysis) {
        nextGDUforP4S = state.genericAnalysisState.core_gdus_for_sync_analysis.find((g: string) => !newProcGDUs.includes(g))
      }
      
      state.genericAnalysisState.p4s_outputs_by_gdu = newP4SOut
      state.genericAnalysisState.p4s_mermaid_syntax_by_gdu = newP4SMermaid
      state.genericAnalysisState.processed_gdus_for_p4s = newProcGDUs
      state.genericAnalysisState.p4s_1_b_error = undefined
      state.genericAnalysisState.isFullyProcessedGenericSynchronic = allCoreDone
      state.genericAnalysisState.current_gdu_for_p4s_processing = nextGDUforP4S
      state.genericAnalysisState.p4s_1_a_error = nextGDUforP4S ? undefined : state.genericAnalysisState.p4s_1_a_error
    })
  }
  // Handle P3.2 output processing
  else if (stepId === StepId.P3_2_IDENTIFY_GDUS && output) {
    // All approaches now produce the original schema directly - validate and clean for duplicates
    console.log(`[P3.2 ${P3_2_APPROACH}] Using direct output from LLM with original schema`)
    
    // Apply defensive validation - clean any duplicate RDU assignments with first-assignment-wins
    const cleanedOutput = STEP_CONFIGS[StepId.P3_2_IDENTIFY_GDUS]?.validateAndClean 
      ? STEP_CONFIGS[StepId.P3_2_IDENTIFY_GDUS].validateAndClean(output, inputData?.tot_rdus || 0)
      : output
    
    const p3_2_output = cleanedOutput as P3_2_Output
    
    set((state: any) => {
      state.genericAnalysisState.p3_2_output = p3_2_output
      state.genericAnalysisState.p3_2_error = undefined
    })
  }
  // Handle other global outputs 
  else if (key && !transcriptIdToProcess && typeof key === 'string') {
    const eKey = `${key.replace('_output','_error')}` as keyof GenericAnalysisState
    set((state: any) => {
      state.genericAnalysisState[key as keyof GenericAnalysisState] = output
      state.genericAnalysisState[eKey] = undefined
    })
    
    // Special handling for steps that generate diagrams
    if (stepId === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS && output) {
      const p7_3 = output as P7_3_Output
      const mermaid = p7_3.final_dag ? transformDagToMermaid(p7_3.final_dag) : undefined
      set((state: any) => { state.genericAnalysisState.p7_3_mermaid_syntax_dag = mermaid })
    } else if (stepId === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG && output) {
      const p7_3b = output as P7_3b_Output
      const mermaid = p7_3b.final_dag ? transformDagToMermaid(p7_3b.final_dag) : undefined
      set((state: any) => { state.genericAnalysisState.p7_3b_mermaid_syntax_dag = mermaid })
    } else if (stepId === StepId.P5_2_HOLISTIC_REFINEMENT) {
      set((state: any) => { state.genericAnalysisState.isRefinementDone = true })
    } else if (stepId === StepId.P7_5_GENERATE_FORMAL_HYPOTHESES) {
      set((state: any) => { state.genericAnalysisState.isCausalModelingDone = true })
    }
  }
}

// Invalidation logic
export function getInvalidatedStates(
  startInvalidationFromStepId: StepId,
  currentActiveTxId: string | undefined,
  currentProcessedData: Map<string, TranscriptProcessedData>,
  currentGenericState: GenericAnalysisState
): {
  invalidatedProcessedData: Map<string, TranscriptProcessedData>
  invalidatedGenericState: GenericAnalysisState
} {
  let newProcessedData = new Map(currentProcessedData)
  let newGenericState = { ...currentGenericState }
  
  // Flag to track when per-transcript changes require global cascade
  let globalCascadeRequired = false
  
  const startIndex = ALL_PIPELINE_STEP_IDS_IN_ORDER.indexOf(startInvalidationFromStepId)
  if (startIndex === -1) return { invalidatedProcessedData: newProcessedData, invalidatedGenericState: newGenericState }
  
  for (let i = startIndex; i < ALL_PIPELINE_STEP_IDS_IN_ORDER.length; i++) {
    const stepToInvalidate = ALL_PIPELINE_STEP_IDS_IN_ORDER[i]
    if (stepToInvalidate === StepId.COMPLETE || stepToInvalidate === StepId.IDLE) continue
    
    const keyPrefix = stepIdToDataKeyPrefix[stepToInvalidate]
    if (!keyPrefix) continue
    const errorKey = `${String(keyPrefix).replace('_output', '_error')}` as any
    
    // Per-transcript invalidation logic
    if (currentActiveTxId && !isGlobalStep(stepToInvalidate)) {
      if (STEP_ORDER_PART_NEG1.includes(stepToInvalidate) || 
          STEP_ORDER_PART_0.includes(stepToInvalidate) || 
          STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC.includes(stepToInvalidate)) {
        const tData = newProcessedData.get(currentActiveTxId)
        if (tData) {
          let updatedTData = { ...tData, [keyPrefix]: undefined, [errorKey]: undefined }
          if (stepToInvalidate === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
            updatedTData = { 
              ...updatedTData, 
              isFullyProcessedSpecificDiachronic: false, 
              p1_4_mermaid_syntax: undefined, 
              phases_for_p2s_processing: [], 
              current_phase_for_p2s_processing: undefined, 
              processed_phases_for_p2s: [], 
              p2s_outputs_by_phase: {}, 
              isFullyProcessedSpecificSynchronic: false 
            }
          }
          newProcessedData.set(currentActiveTxId, updatedTData as TranscriptProcessedData)
        }
      } else if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(stepToInvalidate)) {
        const tData = newProcessedData.get(currentActiveTxId)
        if (tData) {
          // Invalidation for P2S steps is scoped to the currently active phase.
          const currentPhase = tData.current_phase_for_p2s_processing
          
          if (currentPhase && tData.p2s_outputs_by_phase?.[currentPhase]) {
            const keyPrefixToClear = stepIdToDataKeyPrefix[stepToInvalidate] as keyof P2SPhaseData
            if (keyPrefixToClear) {
              // Create a mutable copy of the data for the specific phase we are invalidating
              const phaseDataToUpdate = { ...tData.p2s_outputs_by_phase[currentPhase] }
              
              // Delete the output and error for this specific step
              delete phaseDataToUpdate[keyPrefixToClear]
              const errorKeyToClear = `${String(keyPrefixToClear).replace('_output', '_error')}` as keyof P2SPhaseData
              delete phaseDataToUpdate[errorKeyToClear]
              
              // Special handling for P2S.3 which also generates mermaid syntax
              if (stepToInvalidate === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
                delete phaseDataToUpdate.p2s_3_mermaid_syntax
              }
              
              // Construct the new state for p2s_outputs_by_phase
              const updatedP2SOutputs = {
                ...tData.p2s_outputs_by_phase,
                [currentPhase]: phaseDataToUpdate,
              }
              
              // Since we are invalidating a step, this phase is no longer fully processed.
              // We must remove it from the list of completed phases.
              const newProcessedPhases = tData.processed_phases_for_p2s?.filter(p => p !== currentPhase) || []
              
              // Update the transcript data in the map
              newProcessedData.set(currentActiveTxId, {
                ...tData,
                p2s_outputs_by_phase: updatedP2SOutputs,
                isFullyProcessedSpecificSynchronic: false, // The transcript is no longer fully synchronic processed
                processed_phases_for_p2s: newProcessedPhases,
              })
            }
          }
        }
      }
      globalCascadeRequired = true
    } else if (isGlobalStep(stepToInvalidate) || globalCascadeRequired) {
      // Invalidate global step if downstream OR if cascade required from per-transcript changes
      newGenericState = { ...newGenericState, [keyPrefix]: undefined, [errorKey]: undefined }
      if (stepToInvalidate === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE) {
        newGenericState.isFullyProcessedGenericDiachronic = false
        newGenericState.p3_3_mermaid_syntax = undefined
        newGenericState.core_gdus_for_sync_analysis = []
        newGenericState.p4s_1_a_outputs_by_gdu = {}
        newGenericState.p4s_1_a_error = undefined
        newGenericState.p4s_outputs_by_gdu = {}
        newGenericState.p4s_mermaid_syntax_by_gdu = {}
        newGenericState.p4s_1_b_error = undefined
        newGenericState.current_gdu_for_p4s_processing = undefined
        newGenericState.processed_gdus_for_p4s = []
        newGenericState.isFullyProcessedGenericSynchronic = false
      } else if (stepToInvalidate === StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES && globalCascadeRequired) {
        newGenericState.p4s_1_a_outputs_by_gdu = {}
        newGenericState.p4s_1_a_error = undefined
        newGenericState.p4s_outputs_by_gdu = {}
        newGenericState.p4s_mermaid_syntax_by_gdu = {}
        newGenericState.p4s_1_b_error = undefined
        newGenericState.processed_gdus_for_p4s = []
        newGenericState.isFullyProcessedGenericSynchronic = false
      } else if (stepToInvalidate === StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS && globalCascadeRequired) {
        newGenericState.p4s_outputs_by_gdu = {}
        newGenericState.p4s_mermaid_syntax_by_gdu = {}
        newGenericState.p4s_1_b_error = undefined
        newGenericState.processed_gdus_for_p4s = []
        newGenericState.isFullyProcessedGenericSynchronic = false
      } else if (stepToInvalidate === StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS) {
        newGenericState.p7_3_mermaid_syntax_dag = undefined
      } else if (stepToInvalidate === StepId.P7_3B_VALIDATE_AND_CLEAN_DAG) {
        newGenericState.p7_3b_mermaid_syntax_dag = undefined
      } else if (stepToInvalidate === StepId.P6_1_GENERATE_MARKDOWN_REPORT) {
        newGenericState.isReportGenerated = false
      }
    }
  }
  
  return {
    invalidatedProcessedData: newProcessedData,
    invalidatedGenericState: newGenericState
  }
}