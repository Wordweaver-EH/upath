import { StepConfig } from '../types';
import { StepId } from '../../../../types';

export const P2S_4_SUMMARY_TABLE_CONFIG: StepConfig = {
  id: StepId.P2S_4_SUMMARY_TABLE,
  title: "P2S.4: Summary Table - Consolidated View of Part 2 Synchronic Analysis",
  part: "PartII_Sync",
  isJsonOutput: false, // This is a UI-only step
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentDuId?: string) => {
    if (!currentTranscript?.id) {
      console.error('[P2S_4 Debug] Missing transcript ID');
      return { data: null, error: "Missing current transcript ID for P2S.4" };
    }

    // Get processed data from the store, not from currentTranscript
    const processedTranscript = allProcessedData?.get(currentTranscript.id);
    if (!processedTranscript) {
      console.error('[P2S_4 Debug] No processed data found for transcript:', currentTranscript.id);
      return { data: null, error: "No processed data available for this transcript." };
    }

    // Check if P2S outputs exist
    const p2sOutputs = processedTranscript.p2s_outputs_by_du;
    if (!p2sOutputs || Object.keys(p2sOutputs).length === 0) {
      console.error('[P2S_4 Debug] No P2S outputs found for transcript:', currentTranscript.id);
      return { data: null, error: "No P2S outputs available. Please run P2S.1, P2S.2, and P2S.3 first." };
    }

    // Check if any DU has P2S outputs
    const hasP2SOutputs = Object.values(p2sOutputs).some(
      duData => duData.p2s_1_output || duData.p2s_2_output || duData.p2s_3_output
    );

    if (!hasP2SOutputs) {
      console.error('[P2S_4 Debug] P2S outputs exist but are empty');
      return { data: null, error: "P2S outputs are empty. Please run P2S.1, P2S.2, and P2S.3 first." };
    }

    // Return success - the actual rendering is handled by PipelineStepGrid
    return { 
      data: {
        message: "P2S.4 Summary Table is ready to display",
        transcriptId: currentTranscript.id,
        duCount: Object.keys(p2sOutputs).length
      }, 
      error: null 
    };
  },
  getPrompt: () => {
    // This is a UI-only step, no LLM prompt needed
    return {
      systemPrompt: "This is a UI-only step that displays a summary table of P2S.1, P2S.2, and P2S.3 outputs.",
      userPrompt: "No processing required - this step displays existing data in a table format."
    };
  },
  // P2S.4 doesn't process data, it only displays existing P2S outputs
  processApiResponse: (response: any) => {
    // This step doesn't process API responses
    return {
      message: "P2S.4 is a UI-only step",
      display_type: "table"
    };
  },
  // P2S.4 doesn't save output data since it's UI-only
  saveToTranscript: (transcript, _output, _duId) => {
    // No data to save - P2S.4 is display-only
    return transcript;
  },
  displayType: 'grid', // This will trigger the PipelineStepGrid component
  emptyMessage: "No synchronic analysis data available. Please run P2S.1, P2S.2, and P2S.3 first."
};