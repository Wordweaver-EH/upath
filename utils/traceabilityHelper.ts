import {
    TranscriptProcessedData,
    P3_2_Output,
    P2S_2_SynchronicUnit,
    SelectedUtterance
} from '../types';

// --- Interfaces moved from htmlHelper.ts ---

interface AnnotatedLineSynchronicGroup {
    group_label: string;
    justification: string;
}

interface AnnotatedLineSynchronicIsu {
    unit_name: string;
    intensional_definition: string;
}

export interface ContributingP0_3UtteranceTrace {
    p0_3_original_line_num: string;
    p0_3_utterance_text: string;
    p1_1_segment_ids: string[];
    p1_2_du_id?: string;
    p1_2_du_description?: string;
    p1_3_refined_du_id?: string;
    p1_3_refined_du_description?: string;
    p1_3_temporal_phase?: string; 
    p1_4_phase_name?: string; 
    synchronic_p2s1_groups?: AnnotatedLineSynchronicGroup[];
    synchronic_p2s2_isus?: AnnotatedLineSynchronicIsu[];
}

export interface AnnotatedLine {
    lineNumber: number;
    text: string;
    isProcedural: boolean; 
    dominantTemporalPhase?: string; 
    involvedTemporalPhases: string[];
    contributingP0_3Utterances: ContributingP0_3UtteranceTrace[];
}

// --- Function moved from htmlHelper.ts ---

export function prepareAnnotationDataForTranscript(transcriptData: TranscriptProcessedData): AnnotatedLine[] {
    const annotatedLines: AnnotatedLine[] = [];
    if (!transcriptData.p0_1_output?.line_numbered_transcript) return [];
    const p0_1_lines = transcriptData.p0_1_output.line_numbered_transcript;

    for (const lineWithNum of p0_1_lines) {
        const match = lineWithNum.match(/^(\d+):\s*(.*)$/); if (!match) continue;
        const lineNumber = parseInt(match[1], 10); const lineText = match[2];
        const lineUniqueTemporalPhases = new Set<string>();
        const currentAnnotatedLine: AnnotatedLine = { lineNumber, text: lineText, isProcedural: false, dominantTemporalPhase: undefined, involvedTemporalPhases: [], contributingP0_3Utterances: [] };
        const p0_3_utterances = transcriptData.p0_3_output?.selected_procedural_utterances.filter(utt => utt.original_line_num === String(lineNumber) || utt.original_line_num.startsWith(String(lineNumber) + ".")) || [];
        if (p0_3_utterances.length > 0) currentAnnotatedLine.isProcedural = true;

        for (const p0_3_utt of p0_3_utterances) {
            const trace: ContributingP0_3UtteranceTrace = { p0_3_original_line_num: p0_3_utt.original_line_num, p0_3_utterance_text: p0_3_utt.utterance_text, p1_1_segment_ids: [], synchronic_p2s1_groups: [], synchronic_p2s2_isus: [] };
            const p1_1_container = transcriptData.p1_1_output?.segmented_utterances.find(seg_utt => seg_utt.original_utterance.original_line_num === p0_3_utt.original_line_num);
            if (p1_1_container?.segments.length > 0) {
                trace.p1_1_segment_ids = p1_1_container.segments.map(s => s.segment_id);
                const first_seg_id = trace.p1_1_segment_ids[0];
                const p1_2_du = transcriptData.p1_2_output?.diachronic_units.find(du => du.source_segment_ids.includes(first_seg_id));
                if (p1_2_du) {
                    trace.p1_2_du_id = p1_2_du.unit_id; trace.p1_2_du_description = p1_2_du.description;
                    const p1_3_rdu = transcriptData.p1_3_output?.refined_diachronic_units.find(rdu => rdu.source_p1_2_du_ids.includes(p1_2_du.unit_id));
                    if (p1_3_rdu) {
                        trace.p1_3_refined_du_id = p1_3_rdu.unit_id; trace.p1_3_refined_du_description = p1_3_rdu.description; trace.p1_3_temporal_phase = p1_3_rdu.temporal_phase;
                        if (p1_3_rdu.temporal_phase) lineUniqueTemporalPhases.add(p1_3_rdu.temporal_phase);
                        if (!currentAnnotatedLine.dominantTemporalPhase && p1_3_rdu.temporal_phase) currentAnnotatedLine.dominantTemporalPhase = p1_3_rdu.temporal_phase;
                        const p1_4_phase = transcriptData.p1_4_output?.specific_diachronic_structure.phases.find(phase => phase.units_involved.includes(p1_3_rdu.unit_id));
                        if (p1_4_phase) {
                            trace.p1_4_phase_name = p1_4_phase.phase_name;
                            const p2sPhaseData = transcriptData.p2s_outputs_by_phase?.[p1_4_phase.phase_name];
                            if (p2sPhaseData) {
                                p2sPhaseData.p2s_1_output?.synchronic_thematic_groups.forEach(g => { if (g.utterances.some(u => u.original_line_num === p0_3_utt.original_line_num && u.utterance_text === p0_3_utt.utterance_text)) trace.synchronic_p2s1_groups?.push({ group_label: g.group_label, justification: g.justification }); });
                                p2sPhaseData.p2s_2_output?.specific_synchronic_units_hierarchy.forEach(isu => { if (isu.utterances?.some(u => u.original_line_num === p0_3_utt.original_line_num && u.utterance_text === p0_3_utt.utterance_text)) trace.synchronic_p2s2_isus?.push({ unit_name: isu.unit_name, intensional_definition: isu.intensional_definition }); });
                            }
                        }
                    }
                }
            }
            currentAnnotatedLine.contributingP0_3Utterances.push(trace);
        }
        currentAnnotatedLine.involvedTemporalPhases = Array.from(lineUniqueTemporalPhases);
        annotatedLines.push(currentAnnotatedLine);
    }
    return annotatedLines;
}

// --- New IRR-specific function ---

/**
 * Maps utterances to their assigned GDUs by tracing through the analysis pipeline.
 * Returns a map where keys are composite IDs (transcriptId|lineNum) and values are arrays of GDU IDs.
 * 
 * @param transcriptData The processed data for a single transcript
 * @param p3_2_output The P3.2 output containing GDU assignments
 * @returns Map of utterance IDs to assigned GDU IDs
 */
export function mapUtteranceToGdu(
    transcriptData: TranscriptProcessedData, 
    p3_2_output: P3_2_Output
): Map<string, string[]> {
    const utteranceToGduMap = new Map<string, string[]>();
    
    if (!transcriptData.p0_3_output?.selected_procedural_utterances || 
        !transcriptData.p1_1_output?.segmented_utterances ||
        !transcriptData.p1_2_output?.diachronic_units ||
        !transcriptData.p1_3_output?.refined_diachronic_units ||
        !p3_2_output?.identified_gdus) {
        return utteranceToGduMap;
    }

    // For each procedural utterance
    for (const p0_3_utt of transcriptData.p0_3_output.selected_procedural_utterances) {
        const utteranceKey = `${transcriptData.id}|${p0_3_utt.original_line_num}`;
        const assignedGdus = new Set<string>();

        // Find P1.1 segments for this utterance
        const p1_1_container = transcriptData.p1_1_output.segmented_utterances.find(
            seg_utt => seg_utt.original_utterance.original_line_num === p0_3_utt.original_line_num
        );

        if (p1_1_container?.segments) {
            // For each segment
            for (const segment of p1_1_container.segments) {
                // Find P1.2 DUs containing this segment
                const p1_2_dus = transcriptData.p1_2_output.diachronic_units.filter(
                    du => du.source_segment_ids.includes(segment.segment_id)
                );

                for (const p1_2_du of p1_2_dus) {
                    // Find P1.3 RDUs containing this DU
                    const p1_3_rdus = transcriptData.p1_3_output.refined_diachronic_units.filter(
                        rdu => rdu.source_p1_2_du_ids.includes(p1_2_du.unit_id)
                    );

                    for (const p1_3_rdu of p1_3_rdus) {
                        // Find GDUs containing this RDU
                        for (const gdu of p3_2_output.identified_gdus) {
                            const hasThisRdu = gdu.contributing_refined_du_ids.some(
                                contrib => contrib.transcript_id === transcriptData.id && 
                                          contrib.refined_du_id === p1_3_rdu.unit_id
                            );
                            if (hasThisRdu) {
                                assignedGdus.add(gdu.gdu_id);
                            }
                        }
                    }
                }
            }
        }

        if (assignedGdus.size > 0) {
            utteranceToGduMap.set(utteranceKey, Array.from(assignedGdus));
        }
    }

    return utteranceToGduMap;
}

/**
 * Builds a complete utterance-to-GDU mapping for all transcripts in an analysis.
 * This is the main function to use for IRR analysis.
 * 
 * @param processedDataMap Map of all transcript data
 * @param p3_2_output The P3.2 output containing GDU assignments
 * @returns Map of utterance IDs to assigned GDU IDs across all transcripts
 */
export function buildCompleteUtteranceToGduMapping(
    processedDataMap: Map<string, TranscriptProcessedData>,
    p3_2_output: P3_2_Output | undefined
): Map<string, string[]> {
    const completeMap = new Map<string, string[]>();
    
    if (!p3_2_output) return completeMap;

    processedDataMap.forEach((transcriptData, transcriptId) => {
        if (transcriptData.id !== transcriptId) {
            transcriptData = { ...transcriptData, id: transcriptId };
        }
        
        const transcriptMapping = mapUtteranceToGdu(transcriptData, p3_2_output);
        transcriptMapping.forEach((gdus, utteranceKey) => {
            completeMap.set(utteranceKey, gdus);
        });
    });

    return completeMap;
}