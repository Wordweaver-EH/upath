
import { P0_1_Output, P0_2_Output, P0_3_Output, PromptHistoryEntry, RefinedLine, SelectedUtterance, TranscriptProcessedData, P1_1_Output, P1_2_Output, P2S_1_Output, P2S_2_Output, P1_4_Output, DiachronicUnit } from '../types';

function escapeTsvValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  // If value is an array (like information_tags), join it. Otherwise, convert to string.
  const strValue = Array.isArray(value) ? value.join(', ') : String(value);
  // Replace tab with space, newline with space, and quote with double quote
  return strValue.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");
}

export function convertJsonToTsv(data: any[], columns: string[]): string {
  const header = columns.map(escapeTsvValue).join("\t") + "\n";
  const rows = data
    .map((row) =>
      columns
        .map((col) => escapeTsvValue(row[col]))
        .join("\t")
    )
    .join("\n");
  return header + rows;
}

export function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function generateTsvForP0_1(data: P0_1_Output): string {
  const lines = data.line_numbered_transcript.map(line => {
    const parts = line.match(/^(\d+):\s*(.*)$/);
    if (parts) {
      return { line_num: parts[1], text: parts[2] };
    }
    return { line_num: "", text: line }; // Fallback if parsing fails
  });
  return convertJsonToTsv(lines, ['line_num', 'text']);
}

export function generateTsvForP0_2(data: P0_2_Output): string {
  const tsvData = data.refined_data_transcript.map((line: RefinedLine) => ({
    ...line,
    information_tags: line.information_tags.join(', '), // Convert array to comma-separated string
  }));
  return convertJsonToTsv(tsvData, ['line_num', 'text', 'information_tags', 'decision_notes']);
}

export function generateTsvForP0_3(data: P0_3_Output): string {
   const tsvData = data.selected_procedural_utterances.map((utt: SelectedUtterance) => ({
    ...utt
  }));
  return convertJsonToTsv(tsvData, ['original_line_num', 'utterance_text', 'selection_justification']);
}

export function generateTsvForPromptHistory(history: PromptHistoryEntry[]): string {
  const tsvData = history.map(entry => ({
    timestamp: entry.timestamp,
    stepId: entry.stepId,
    transcriptId: entry.transcriptId || 'N/A',
    // prompt: entry.prompt, // Prompt can be very long, could make TSV unwieldy.
    requestPayloadSummary: JSON.stringify(entry.requestPayload).substring(0, 200) + "...", // Summary
    responseSummary: (entry.responseParsed ? JSON.stringify(entry.responseParsed) : (entry.responseRaw || "")).substring(0,200) + "...",
    error: entry.error || '',
    groundingSources: entry.groundingSources ? entry.groundingSources.map(s => s.web.uri).join(', ') : '',
  }));
  return convertJsonToTsv(tsvData, ['timestamp', 'stepId', 'transcriptId', 'requestPayloadSummary', 'responseSummary', 'error', 'groundingSources']);
}

export function generateTsvForTranscriptDiachronic(transcriptData: TranscriptProcessedData, transcriptId: string): string {
  const tsvRows: Array<{
    transcript_id: string;
    transcript_filename: string;
    original_line_num: string;
    utterance_text: string;
    du_id: string;
    du_description: string;
  }> = [];

  const p1_1_output = transcriptData.p1_1_output;
  const p1_2_output = transcriptData.p1_2_output;

  if (!p1_1_output || !p1_2_output) {
    return "P1.1 or P1.2 data not available for this transcript.";
  }

  const filename = transcriptData.filename;
  const segmentedUtterancesList = p1_1_output.segmented_utterances;
  const diachronicUnitsList = p1_2_output.diachronic_units;
  const addedMappingsForTranscript = new Set<string>();

  if (Array.isArray(segmentedUtterancesList)) {
    segmentedUtterancesList.forEach(segmentedUtteranceContainer => {
      if (!segmentedUtteranceContainer || !segmentedUtteranceContainer.original_utterance) return;
      const origUtt = segmentedUtteranceContainer.original_utterance;
      
      const segmentIdsFromContainer: string[] = Array.isArray(segmentedUtteranceContainer.segments)
        ? segmentedUtteranceContainer.segments.map(seg => seg.segment_id)
        : [];

      if (Array.isArray(diachronicUnitsList)) {
        diachronicUnitsList.forEach(du => {
          if (!du || !Array.isArray(du.source_segment_ids)) return; // Use source_segment_ids
          
          // Check if any segment_id from the current utterance container is part of the DU's source_segment_ids
          const isMatch = segmentIdsFromContainer.some(containerSegId => 
            du.source_segment_ids.includes(containerSegId)
          );

          if (isMatch) {
            const mappingKey = `${origUtt.original_line_num}|${du.unit_id}`;
            if (!addedMappingsForTranscript.has(mappingKey)) {
              tsvRows.push({
                transcript_id: transcriptId,
                transcript_filename: filename,
                original_line_num: origUtt.original_line_num,
                utterance_text: origUtt.utterance_text,
                du_id: du.unit_id,
                du_description: du.description,
              });
              addedMappingsForTranscript.add(mappingKey);
            }
          }
        });
      }
    });
  }

  if (tsvRows.length === 0) {
    return "No utterance-to-DU mappings found for this transcript.";
  }
  return convertJsonToTsv(tsvRows, [
    'transcript_id',
    'transcript_filename',
    'original_line_num',
    'utterance_text',
    'du_id',
    'du_description',
  ]);
}


export function generateTsvForTranscriptSynchronic(transcriptData: TranscriptProcessedData, transcriptId: string): string {
  const tsvRows: Array<{
    transcript_id: string;
    transcript_filename: string;
    original_line_num: string;
    utterance_text: string;
    p1_4_du_id: string;
    p2s_1_thematic_group_label: string;
    p2s_1_thematic_group_justification: string;
    p2s_2_isu_name: string;
    p2s_2_isu_definition: string;
    p2s_2_isu_level: number | string;
    p2s_2_isu_abstraction_op: string;
  }> = [];

  const filename = transcriptData.filename;
  const p2sOutputsByDu = transcriptData.p2s_outputs_by_du;
  const p1_1_output = transcriptData.p1_1_output;

  if (!p2sOutputsByDu) {
    return "P2S data not available for this transcript.";
  }

  if (!p1_1_output) {
    return "P1.1 data not available for this transcript.";
  }

  // Create a map from segment_id to original utterance for tracing
  const segmentToUtteranceMap = new Map<string, { original_line_num: string; utterance_text: string }>();
  if (Array.isArray(p1_1_output.segmented_utterances)) {
    p1_1_output.segmented_utterances.forEach(segContainer => {
      if (segContainer && segContainer.original_utterance && Array.isArray(segContainer.segments)) {
        const origUtt = segContainer.original_utterance;
        segContainer.segments.forEach(segment => {
          if (segment && segment.segment_id) {
            segmentToUtteranceMap.set(segment.segment_id, {
              original_line_num: origUtt.original_line_num,
              utterance_text: origUtt.utterance_text
            });
          }
        });
      }
    });
  }

  const duNameMap: Map<string, string> = new Map();
  const dusArray = transcriptData.p1_4_output?.diachronic_units;
  if (Array.isArray(dusArray)) {
      dusArray.forEach((du: DiachronicUnit) => {
           if (du && typeof du.unit_id === 'string') {
               duNameMap.set(du.unit_id, du.unit_id);
           }
      });
  }
  
  for (const analyzedDuId in p2sOutputsByDu) {
    const duData = p2sOutputsByDu[analyzedDuId];
    const actualDuIdForDisplay = duNameMap.get(analyzedDuId) || analyzedDuId;

    if (duData?.p2s_1_output) {
      const p2s1Output = duData.p2s_1_output;
      if (Array.isArray(p2s1Output.synchronic_thematic_groups)) {
        p2s1Output.synchronic_thematic_groups.forEach(group => {
          if (group && Array.isArray(group.segments)) {
            // Track unique utterances for this group to avoid duplicates
            const uniqueUtterances = new Map<string, { original_line_num: string; utterance_text: string }>();
            
            group.segments.forEach(segment => {
              if (segment && segment.segment_id) {
                const utteranceInfo = segmentToUtteranceMap.get(segment.segment_id);
                if (utteranceInfo) {
                  const key = `${utteranceInfo.original_line_num}|${utteranceInfo.utterance_text}`;
                  uniqueUtterances.set(key, utteranceInfo);
                }
              }
            });
            
            // Add a row for each unique utterance in this group
            uniqueUtterances.forEach(utteranceInfo => {
              tsvRows.push({
                transcript_id: transcriptId,
                transcript_filename: filename,
                original_line_num: utteranceInfo.original_line_num,
                utterance_text: utteranceInfo.utterance_text,
                p1_4_du_id: actualDuIdForDisplay,
                p2s_1_thematic_group_label: group.group_label,
                p2s_1_thematic_group_justification: group.justification,
                p2s_2_isu_name: '',
                p2s_2_isu_definition: '',
                p2s_2_isu_level: '',
                p2s_2_isu_abstraction_op: '',
              });
            });
          }
        });
      }
    }

    if (duData?.p2s_2_output) {
      const p2s2Output = duData.p2s_2_output;
      if (Array.isArray(p2s2Output.specific_synchronic_units_hierarchy)) {
        p2s2Output.specific_synchronic_units_hierarchy.forEach(isu => {
          if (isu && isu.segments && Array.isArray(isu.segments)) {
            // Track unique utterances for this ISU to avoid duplicates
            const uniqueUtterances = new Map<string, { original_line_num: string; utterance_text: string }>();
            
            isu.segments.forEach(segment => {
              if (segment && segment.segment_id) {
                const utteranceInfo = segmentToUtteranceMap.get(segment.segment_id);
                if (utteranceInfo) {
                  const key = `${utteranceInfo.original_line_num}|${utteranceInfo.utterance_text}`;
                  uniqueUtterances.set(key, utteranceInfo);
                }
              }
            });
            
            // Add a row for each unique utterance in this ISU
            uniqueUtterances.forEach(utteranceInfo => {
              tsvRows.push({
                transcript_id: transcriptId,
                transcript_filename: filename,
                original_line_num: utteranceInfo.original_line_num,
                utterance_text: utteranceInfo.utterance_text,
                p1_4_du_id: actualDuIdForDisplay,
                p2s_1_thematic_group_label: '',
                p2s_1_thematic_group_justification: '',
                p2s_2_isu_name: isu.unit_name,
                p2s_2_isu_definition: isu.intensional_definition,
                p2s_2_isu_level: isu.level,
                p2s_2_isu_abstraction_op: isu.abstraction_op,
              });
            });
          }
        });
      }
    }
  }
  if (tsvRows.length === 0) {
    return "No utterance-to-synchronic-element mappings found for this transcript.";
  }
  return convertJsonToTsv(tsvRows, [
    'transcript_id',
    'transcript_filename',
    'original_line_num',
    'utterance_text',
    'p1_4_du_id',
    'p2s_1_thematic_group_label',
    'p2s_1_thematic_group_justification',
    'p2s_2_isu_name',
    'p2s_2_isu_definition',
    'p2s_2_isu_level',
    'p2s_2_isu_abstraction_op',
  ]);
}


// Fallback for other JSON data - generic JSON to TSV if it's an array of objects
export function genericJsonToTsv(data: any): string {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const columns = Object.keys(data[0]);
    return convertJsonToTsv(data, columns);
  }
  // If not an array of objects, or empty array, just stringify it (not ideal for TSV but a fallback)
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}
