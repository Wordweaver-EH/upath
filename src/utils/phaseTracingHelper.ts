import {
  TranscriptProcessedData,
  P1_3_Output,
  P1_4_Output,
  SelectedUtterance
} from '../types';

export interface PhaseTraceData {
  phaseName: string;
  phaseDescription: string;
  rdus: RDUTraceData[];
}

export interface RDUTraceData {
  rduId: string;
  rduDescription: string;
  temporalPhase: string;
  dus: DUTraceData[];
}

export interface DUTraceData {
  duId: string;
  duDescription: string;
  utterances: UtteranceTraceData[];
}

export interface UtteranceTraceData {
  lineNumber: string;
  text: string;
  segments?: string[];
}

/**
 * Traces from a phase name back through RDUs, DUs, segments to original utterances
 */
export function tracePhaseToUtterances(
  phaseName: string,
  transcriptData: TranscriptProcessedData
): PhaseTraceData | null {
  if (!transcriptData.p1_4_output?.specific_diachronic_structure?.phases) {
    return null;
  }

  // Find the phase
  const phase = transcriptData.p1_4_output.specific_diachronic_structure.phases.find(
    p => p.phase_name === phaseName
  );
  
  if (!phase) {
    return null;
  }

  const phaseTrace: PhaseTraceData = {
    phaseName: phase.phase_name || '',
    phaseDescription: phase.description || '',
    rdus: []
  };

  // Get RDUs for this phase
  if (phase.units_involved && transcriptData.p1_3_output?.refined_diachronic_units) {
    for (const rduId of phase.units_involved) {
      const rdu = transcriptData.p1_3_output.refined_diachronic_units.find(
        r => r.unit_id === rduId
      );
      
      if (rdu) {
        const rduTrace: RDUTraceData = {
          rduId: rdu.unit_id,
          rduDescription: rdu.description || '',
          temporalPhase: rdu.temporal_phase || '',
          dus: []
        };

        // Get DUs for this RDU
        if (rdu.source_p1_2_du_ids && transcriptData.p1_2_output?.diachronic_units) {
          for (const duId of rdu.source_p1_2_du_ids) {
            const du = transcriptData.p1_2_output.diachronic_units.find(
              d => d.unit_id === duId
            );
            
            if (du) {
              const duTrace: DUTraceData = {
                duId: du.unit_id,
                duDescription: du.description || '',
                utterances: []
              };

              // Get utterances for this DU
              if (du.source_segment_ids && transcriptData.p1_1_output?.segmented_utterances) {
                // Group segments by utterance
                const utteranceMap = new Map<string, string[]>();
                
                for (const segId of du.source_segment_ids) {
                  // Find which utterance contains this segment
                  for (const segUtt of transcriptData.p1_1_output.segmented_utterances) {
                    const segment = segUtt.segments?.find(s => s.segment_id === segId);
                    if (segment && segUtt.original_utterance?.original_line_num) {
                      const lineNum = segUtt.original_utterance.original_line_num;
                      if (!utteranceMap.has(lineNum)) {
                        utteranceMap.set(lineNum, []);
                      }
                      utteranceMap.get(lineNum)!.push(segId);
                      break;
                    }
                  }
                }

                // Create utterance traces
                for (const [lineNum, segs] of utteranceMap) {
                  const segUtt = transcriptData.p1_1_output.segmented_utterances.find(
                    s => s.original_utterance?.original_line_num === lineNum
                  );
                  
                  if (segUtt && segUtt.original_utterance) {
                    duTrace.utterances.push({
                      lineNumber: lineNum,
                      text: segUtt.original_utterance.utterance_text || '',
                      segments: segs
                    });
                  }
                }
              }

              if (duTrace.utterances.length > 0) {
                rduTrace.dus.push(duTrace);
              }
            }
          }
        }

        if (rduTrace.dus.length > 0) {
          phaseTrace.rdus.push(rduTrace);
        }
      }
    }
  }

  return phaseTrace;
}

/**
 * Get a simplified summary of units in a phase
 */
export function getPhaseUnitSummary(
  phaseName: string,
  transcriptData: TranscriptProcessedData
): { rduCount: number; utteranceCount: number } {
  const trace = tracePhaseToUtterances(phaseName, transcriptData);
  if (!trace) {
    return { rduCount: 0, utteranceCount: 0 };
  }

  const utteranceSet = new Set<string>();
  for (const rdu of trace.rdus) {
    for (const du of rdu.dus) {
      for (const utt of du.utterances) {
        utteranceSet.add(utt.lineNumber);
      }
    }
  }

  return {
    rduCount: trace.rdus.length,
    utteranceCount: utteranceSet.size
  };
}