
// utils/htmlHelper.ts
import { 
    TranscriptProcessedData, 
    GenericAnalysisState, 
    RawTranscript, 
    P0_1_Output,
    P0_3_Output,
    P1_1_Output,
    P1_2_Output,
    P1_3_Output,
    P1_4_Output,
    P2S_2_SynchronicUnit, // Added for ISU type
    P2S_3_Output,
    P3_2_Output,
    P3_3_Output,
    P4S_1_Output,
    P7_3_Output,
    SelectedUtterance, 
    SegmentedUtteranceSegment 
} from '../types';

// --- Helper Functions ---

function escapeHtml(unsafe: string | undefined | null): string {
    if (unsafe === undefined || unsafe === null) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function renderMermaidDiagramHTML(title: string, syntax: string | undefined, diagramId: string): string {
    if (!syntax) return `<p><em>Mermaid diagram for "${escapeHtml(title)}" not available.</em></p>`;
    const validDiagramId = diagramId.replace(/[^a-zA-Z0-9\-_:.]/g, '_');
    return `
        <div class="mermaid-diagram-section">
            <h4>Diagram: ${escapeHtml(title)}</h4>
            <div class="mermaid" id="${escapeHtml(validDiagramId)}">
                ${escapeHtml(syntax)}
            </div>
        </div>
    `;
}

interface AnnotatedLineSynchronicGroup {
    group_label: string;
    justification: string;
}

interface AnnotatedLineSynchronicIsu {
    unit_name: string;
    intensional_definition: string;
}

interface ContributingP0_3UtteranceTrace {
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

interface AnnotatedLine {
    lineNumber: number;
    text: string;
    isProcedural: boolean; 
    dominantTemporalPhase?: string; 
    involvedTemporalPhases: string[];
    contributingP0_3Utterances: ContributingP0_3UtteranceTrace[];
}

function prepareAnnotationDataForTranscript(transcriptData: TranscriptProcessedData): AnnotatedLine[] {
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

function renderAnnotatedTranscriptHTML(transcriptData: TranscriptProcessedData): string {
    const annotatedLines = prepareAnnotationDataForTranscript(transcriptData);
    if (annotatedLines.length === 0) return "<h4>Annotated Transcript</h4><p><em>Annotation data could not be prepared.</em></p>";
    let html = `<div class="annotated-transcript-container"><h4>Annotated Transcript</h4>`;
    annotatedLines.forEach(line => {
        const classes = ['transcript-line']; if (line.isProcedural) classes.push('line-is-procedural');
        if (line.dominantTemporalPhase) classes.push(`phase-${line.dominantTemporalPhase.toLowerCase().replace(/\s+/g, '-')}`);
        else if (line.isProcedural) classes.push('phase-default-procedural');
        let linePrefix = ""; if (line.involvedTemporalPhases.length > 1) { classes.push('line-multi-phase'); linePrefix = "* "; }
        const contributionsJson = JSON.stringify(line.contributingP0_3Utterances);
        html += `<div class="${classes.join(' ')}" data-line-num="${escapeHtml(String(line.lineNumber))}" data-line-text="${escapeHtml(line.text)}" data-contributions='${escapeHtml(contributionsJson)}' aria-label="Line ${escapeHtml(String(line.lineNumber))}" role="button" tabindex="0">${linePrefix}${escapeHtml(String(line.lineNumber))}: ${escapeHtml(line.text)}</div>`;
    });
    html += "</div>"; return html;
}

export const calculateGduUtteranceCounts = ( // Make exportable
  processedData: Map<string, TranscriptProcessedData>,
  gduOutput: P3_2_Output | undefined
): Array<{ gduId: string; gduDefinition: string; countsByTranscript: Array<{ transcriptId: string; filename: string; utteranceCount: number; }>; totalUtterances: number; }> => {
  if (!gduOutput?.identified_gdus) return [];
  const allGdusData = [];
  for (const gdu of gduOutput.identified_gdus) {
    const countsByTx: Array<{ transcriptId: string; filename: string; utteranceCount: number; }> = [];
    const refinedDusByTx = new Map<string, string[]>();
    gdu.contributing_refined_du_ids.forEach(c => { if(!refinedDusByTx.has(c.transcript_id))refinedDusByTx.set(c.transcript_id,[]); refinedDusByTx.get(c.transcript_id)!.push(c.refined_du_id); });
    for (const [txId, duIdsInGduForTx] of refinedDusByTx.entries()) {
      const txData = processedData.get(txId); if (!txData?.p1_1_output || !txData.p1_2_output || !txData.p1_3_output) continue;
      const uniqueP0_3Lines = new Set<string>();
      for (const rDuId of duIdsInGduForTx) {
        const p1_3_rdu = txData.p1_3_output.refined_diachronic_units.find(r=>r.unit_id===rDuId); if(!p1_3_rdu)continue;
        for (const p1_2_id of p1_3_rdu.source_p1_2_du_ids) {
          const p1_2_du = txData.p1_2_output.diachronic_units.find(d=>d.unit_id===p1_2_id); if(!p1_2_du)continue;
          for (const segId of p1_2_du.source_segment_ids) {
            for (const segContainer of txData.p1_1_output.segmented_utterances) { if(segContainer.segments.some(s=>s.segment_id===segId)){uniqueP0_3Lines.add(segContainer.original_utterance.original_line_num);break;} }
          }
        }
      }
      countsByTx.push({transcriptId:txId,filename:txData.filename,utteranceCount:uniqueP0_3Lines.size});
    }
    allGdusData.push({ gduId:gdu.gdu_id,gduDefinition:gdu.definition,countsByTranscript:countsByTx,totalUtterances:countsByTx.reduce((s,i)=>s+i.utteranceCount,0)});
  } return allGdusData;
};

// New detailed traceability function
export const generateGssTraceabilityBreakdown = (
  processedData: Map<string, TranscriptProcessedData>,
  gssOutputsByGdu: Record<string, P4S_1_Output | undefined> | undefined
): string => {
  if (!gssOutputsByGdu) return "<p>No GSS outputs available for traceability analysis.</p>";
  
  let html = `
    <div class="gss-traceability-section" style="color: var(--app-text);">
      <h3 style="color: var(--app-accent-red);">GSS → SSS → ISU → Utterances Traceability</h3>
      <p style="color: var(--app-text);"><em>This section provides a complete audit trail from Generic Synchronic Structure categories down to specific utterances.</em></p>
  `;
  
  for (const [gduId, p4sOut] of Object.entries(gssOutputsByGdu)) {
    if (!p4sOut?.generic_synchronic_structure?.generic_nodes_categories) continue;
    
    html += `
      <div class="gdu-section" style="color: var(--app-text);">
        <h4 style="color: var(--app-accent-red);">GDU: ${escapeHtml(gduId)}</h4>
    `;
    
    for (const gssCat of p4sOut.generic_synchronic_structure.generic_nodes_categories) {
      const notesForCat = p4sOut.generic_synchronic_structure.instantiation_notes?.filter(n=>n.generic_category_id===gssCat.id&&n.example_specific_nodes)||[];
      
      html += `
        <div class="gss-category" style="color: var(--app-text);">
          <h5 style="color: var(--app-accent-red);">GSS Category: ${escapeHtml(gssCat.label)} (${escapeHtml(gssCat.id)})</h5>
          <div style="margin-left: 20px; color: var(--app-text);">
      `;
      
      if (notesForCat.length === 0) {
        html += `<p style="color: var(--app-accent-red);"><em>No instantiation notes found for this category</em></p>`;
      }
      
      let categoryTotalUtterances = 0;
      const categoryTranscriptCounts = new Map<string, number>();
      
      for (const note of notesForCat) {
        html += `<div class="instantiation-note" style="margin-bottom: 15px; padding: 10px; background: var(--app-subtle-bg); border-left: 3px solid var(--app-border); color: var(--app-text);">`;
        html += `<p style="color: var(--app-text);"><strong>Description:</strong> ${escapeHtml(note.textual_description)}</p>`;
        
        if (!note.example_specific_nodes || note.example_specific_nodes.length === 0) {
          html += `<p style="color: var(--app-accent-red);"><em>No example SSS nodes provided</em></p>`;
        } else {
          html += `<p style="color: var(--app-text);"><strong>Example SSS Nodes (${note.example_specific_nodes.length}):</strong></p>`;
          html += `<div style="margin-left: 15px;">`;
          
          for (const specNodeRef of note.example_specific_nodes) {
            const txData = processedData.get(specNodeRef.transcript_id);
            const phaseData = txData?.p2s_outputs_by_phase?.[specNodeRef.phase_name || ''];
            
            html += `
              <div class="sss-node" style="margin: 10px 0; padding: 8px; background: var(--app-bg); border: 1px solid var(--app-border); border-radius: 4px; color: var(--app-text);">
                <div style="font-weight: bold; color: var(--app-accent-red);">
                  📍 SSS Node: ${escapeHtml(specNodeRef.sss_node_id)}
                </div>
                <div style="margin-left: 15px; font-size: 0.9em; color: var(--app-text);">
                  <div><strong>Transcript:</strong> ${escapeHtml(specNodeRef.transcript_id)} (${escapeHtml(txData?.filename || 'Unknown')})</div>
                  <div><strong>Phase:</strong> ${escapeHtml(specNodeRef.phase_name || 'Unknown')}</div>
            `;
            
            // Check if SSS node exists
            const sssNode = phaseData?.p2s_3_output?.specific_synchronic_structure.network_nodes.find(n => n.id === specNodeRef.sss_node_id);
            if (!sssNode) {
              html += `<div style="color: var(--app-accent-red);"><strong>❌ ORPHANED NODE:</strong> SSS node not found in P2S_3 network structure</div>`;
              
              // For orphaned nodes, try to show what we can from the P4S_1_A data
              html += `<div style="margin-left: 15px; padding: 8px; background: var(--app-subtle-bg); border: 1px solid var(--app-accent-red); border-radius: 4px;">`;
              html += `<div style="color: var(--app-text);"><strong>Available Information:</strong></div>`;
              html += `<div style="margin-left: 10px; color: var(--app-text);">`;
              html += `<div><strong>Referenced in P4S_1_A:</strong> Yes (this node was included in the TSV input)</div>`;
              
              // Try to find the ISU in P2S_2 data even if SSS node is missing
              if (phaseData?.p2s_2_output?.specific_synchronic_units_hierarchy) {
                // Try multiple strategies to match the ISU
                let matchingIsu = null;
                
                // Strategy 1: Direct match with "ISU_" prefix
                const potentialIsuName1 = specNodeRef.sss_node_id.replace(/^sss_node_/, 'ISU_');
                matchingIsu = phaseData.p2s_2_output.specific_synchronic_units_hierarchy.find(isu => isu.unit_name === potentialIsuName1);
                
                // Strategy 2: Direct match without prefix change
                if (!matchingIsu) {
                  const potentialIsuName2 = specNodeRef.sss_node_id.replace(/^sss_node_/, '');
                  matchingIsu = phaseData.p2s_2_output.specific_synchronic_units_hierarchy.find(isu => isu.unit_name === potentialIsuName2);
                }
                
                // Strategy 3: Substring matching (SSS node ID contains ISU name)
                if (!matchingIsu) {
                  matchingIsu = phaseData.p2s_2_output.specific_synchronic_units_hierarchy.find(isu => 
                    specNodeRef.sss_node_id.includes(isu.unit_name) || isu.unit_name.includes(specNodeRef.sss_node_id.replace(/^sss_node_/, ''))
                  );
                }
                
                console.log(`[Traceability] Orphaned node ${specNodeRef.sss_node_id} - trying to find ISU. Strategies: 1="${potentialIsuName1}", found=${!!matchingIsu}`);
                if (matchingIsu) {
                  console.log(`[Traceability] Found matching ISU: ${matchingIsu.unit_name}`);
                }
                
                if (matchingIsu) {
                  html += `<div><strong>Likely Source ISU:</strong> ${escapeHtml(matchingIsu.unit_name)}</div>`;
                  html += `<div><strong>ISU Definition:</strong> ${escapeHtml(matchingIsu.intensional_definition)}</div>`;
                  
                  // Try to get utterances from the ISU
                  const collectBaseUtterances = (isuName: string, hierarchy: typeof phaseData.p2s_2_output.specific_synchronic_units_hierarchy): Array<{original_line_num: string, utterance_text: string}> => {
                    const currentIsu = hierarchy.find(u => u.unit_name === isuName);
                    if (!currentIsu) return [];
                    if (currentIsu.utterances && currentIsu.utterances.length > 0) {
                      return currentIsu.utterances;
                    }
                    let collected: Array<{original_line_num: string, utterance_text: string}> = [];
                    if (currentIsu.constituent_lower_units) {
                      for (const lowerUnit of currentIsu.constituent_lower_units) {
                        collected = collected.concat(collectBaseUtterances(lowerUnit, hierarchy));
                      }
                    }
                    return collected;
                  };
                  
                  const utterances = collectBaseUtterances(matchingIsu.unit_name, phaseData.p2s_2_output.specific_synchronic_units_hierarchy);
                  if (utterances.length > 0) {
                    html += `<div><strong>Potential Grounded Utterances (${utterances.length}):</strong></div>`;
                    html += `<div style="margin-left: 10px;">`;
                    utterances.forEach(utt => {
                      html += `
                        <div style="margin: 3px 0; padding: 4px; background: var(--app-highlight-bg); border-left: 2px solid var(--app-accent-red); font-size: 0.8em; color: var(--app-text);">
                          <strong>Line ${escapeHtml(utt.original_line_num)}:</strong> ${escapeHtml(utt.utterance_text)}
                        </div>
                      `;
                    });
                    html += `</div>`;
                    
                    // Count utterances for orphaned nodes too
                    const txId = specNodeRef.transcript_id;
                    categoryTranscriptCounts.set(txId, (categoryTranscriptCounts.get(txId) || 0) + utterances.length);
                    categoryTotalUtterances += utterances.length;
                  } else {
                    html += `<div style="color: var(--app-accent-red);"><strong>⚠️ No utterances found for potential ISU</strong></div>`;
                  }
                } else {
                  html += `<div style="color: var(--app-accent-red);"><strong>⚠️ Cannot identify corresponding ISU</strong></div>`;
                }
              }
              
              html += `<div style="color: var(--app-accent-red); font-weight: bold; margin-top: 8px;"><strong>Issue:</strong> Node exists in P4S_1_A but missing from P2S_3 network_links (orphaned)</div>`;
              html += `</div></div>`;
            } else {
              html += `<div style="color: var(--app-text);"><strong>SSS Label:</strong> ${escapeHtml(sssNode.label)}</div>`;
              html += `<div style="color: var(--app-text);"><strong>Source ISU:</strong> ${escapeHtml(sssNode.source_isu_id)}</div>`;
              
              // Find and trace the ISU
              const sourceIsu = phaseData?.p2s_2_output?.specific_synchronic_units_hierarchy.find(isu => isu.unit_name === sssNode.source_isu_id);
              if (!sourceIsu) {
                html += `<div style="color: var(--app-accent-red);"><strong>❌ ERROR:</strong> Source ISU not found in P2S_2 data</div>`;
              } else {
                html += `
                  <div class="isu-details" style="margin: 8px 0; padding: 6px; background: var(--app-highlight-bg); border-radius: 3px; color: var(--app-text);">
                    <div style="font-weight: bold; color: var(--app-accent-red);">🔍 ISU: ${escapeHtml(sourceIsu.unit_name)}</div>
                    <div style="margin-left: 10px; font-size: 0.85em; color: var(--app-text);">
                      <div><strong>Level:</strong> ${sourceIsu.level}</div>
                      <div><strong>Definition:</strong> ${escapeHtml(sourceIsu.intensional_definition)}</div>
                `;
                
                // Collect utterances through ISU hierarchy traversal
                const collectBaseUtterances = (isuName: string, hierarchy: typeof phaseData.p2s_2_output.specific_synchronic_units_hierarchy): Array<{original_line_num: string, utterance_text: string}> => {
                  const currentIsu = hierarchy.find(u => u.unit_name === isuName);
                  if (!currentIsu) return [];
                  if (currentIsu.utterances && currentIsu.utterances.length > 0) {
                    return currentIsu.utterances;
                  }
                  let collected: Array<{original_line_num: string, utterance_text: string}> = [];
                  if (currentIsu.constituent_lower_units) {
                    for (const lowerUnit of currentIsu.constituent_lower_units) {
                      collected = collected.concat(collectBaseUtterances(lowerUnit, hierarchy));
                    }
                  }
                  return collected;
                };
                
                const utterances = collectBaseUtterances(sourceIsu.unit_name, phaseData.p2s_2_output.specific_synchronic_units_hierarchy);
                
                if (utterances.length === 0) {
                  html += `<div style="color: var(--app-accent-red);"><strong>⚠️ WARNING:</strong> No utterances found for this ISU</div>`;
                } else {
                  html += `<div style="color: var(--app-text);"><strong>Grounded Utterances (${utterances.length}):</strong></div>`;
                  html += `<div style="margin-left: 10px;">`;
                  
                  utterances.forEach(utt => {
                    html += `
                      <div style="margin: 3px 0; padding: 4px; background: var(--app-subtle-bg); border-left: 2px solid var(--app-accent-red); font-size: 0.8em; color: var(--app-text);">
                        <strong>Line ${escapeHtml(utt.original_line_num)}:</strong> ${escapeHtml(utt.utterance_text)}
                      </div>
                    `;
                  });
                  
                  html += `</div>`;
                  
                  // Count utterances for this transcript
                  const txId = specNodeRef.transcript_id;
                  categoryTranscriptCounts.set(txId, (categoryTranscriptCounts.get(txId) || 0) + utterances.length);
                  categoryTotalUtterances += utterances.length;
                }
                
                html += `</div></div>`;
              }
            }
            
            html += `</div></div>`;
          }
          
          html += `</div>`;
        }
        
        html += `</div>`;
      }
      
      // Summary for this category
      html += `
        <div style="margin-top: 15px; padding: 10px; background: var(--app-highlight-bg); border-radius: 4px; color: var(--app-text);">
          <strong>Category Summary:</strong>
          <div style="margin-left: 15px; color: var(--app-text);">
            <div><strong>Total Utterances:</strong> ${categoryTotalUtterances}</div>
            <div><strong>Transcript Distribution:</strong></div>
            <div style="margin-left: 15px;">
      `;
      
      for (const [txId, count] of categoryTranscriptCounts.entries()) {
        const filename = processedData.get(txId)?.filename || 'Unknown';
        html += `<div>• ${escapeHtml(txId)} (${escapeHtml(filename)}): ${count} utterances</div>`;
      }
      
      html += `</div></div></div></div></div>`;
    }
    
    html += `</div>`;
  }
  
  html += `</div>`;
  return html;
};
             
             // Generate GDU -> RDU -> DU -> Utterances traceability breakdown
             export const generateGduTraceabilityBreakdown = (
               processedData: Map<string, TranscriptProcessedData>,
               genericState: GenericAnalysisState | undefined
             ): string => {
               if (!genericState?.p3_2_output?.identified_gdus) {
                 return "<p>No GDU outputs available for diachronic traceability analysis.</p>";
               }
               
               let html = `
                 <div class="gdu-traceability-section" style="color: var(--app-text);">
                   <h3 style="color: var(--app-accent-red);">GDU → RDU → DU → Utterances Traceability</h3>
                   <p style="color: var(--app-text);"><em>This section provides a complete audit trail from Generic Diachronic Units down to specific utterances.</em></p>
               `;
               
               for (const gdu of genericState.p3_2_output.identified_gdus) {
                 html += `
                   <div class="gdu-section" style="color: var(--app-text);">
                     <h4 style="color: var(--app-accent-red);">GDU: ${escapeHtml(gdu.gdu_id)}</h4>
                     <div style="margin-left: 15px; color: var(--app-text);">
                       <div><strong>Definition:</strong> ${escapeHtml(gdu.definition)}</div>
                       <div><strong>Supporting Transcripts:</strong> ${gdu.supporting_transcripts_count}</div>
                       ${gdu.iv_variation_notes ? `<div><strong>IV Variation Notes:</strong> ${escapeHtml(gdu.iv_variation_notes)}</div>` : ''}
                     </div>
                 `;
                 
                 if (!gdu.contributing_refined_du_ids || gdu.contributing_refined_du_ids.length === 0) {
                   html += `<p style="color: var(--app-accent-red);"><em>No contributing RDU references found for this GDU</em></p>`;
                 } else {
                   html += `<div style="margin-left: 15px;"><strong>Contributing RDUs (${gdu.contributing_refined_du_ids.length}):</strong></div>`;
                   
                   let gduTotalUtterances = 0;
                   const gduTranscriptCounts = new Map<string, number>();
                   
                   for (const rduRef of gdu.contributing_refined_du_ids) {
                     const txData = processedData.get(rduRef.transcript_id);
                     const rdu = txData?.p1_3_output?.refined_diachronic_units.find(r => r.unit_id === rduRef.refined_du_id);
                     
                     html += `
                       <div class="rdu-node" style="margin: 10px 0; padding: 8px; background: var(--app-bg); border: 1px solid var(--app-border); border-radius: 4px; color: var(--app-text);">
                         <div style="font-weight: bold; color: var(--app-accent-red);">
                           📋 RDU: ${escapeHtml(rduRef.refined_du_id)}
                         </div>
                         <div style="margin-left: 15px; font-size: 0.9em; color: var(--app-text);">
                           <div><strong>Transcript:</strong> ${escapeHtml(rduRef.transcript_id)} (${escapeHtml(txData?.filename || 'Unknown')})</div>
                     `;
                     
                     if (!rdu) {
                       html += `<div style="color: var(--app-accent-red);"><strong>❌ MISSING RDU:</strong> RDU not found in P1_3 output</div>`;
                     } else {
                       html += `
                         <div><strong>Description:</strong> ${escapeHtml(rdu.description)}</div>
                         <div><strong>Confidence:</strong> ${rdu.confidence}</div>
                         <div><strong>Temporal Phase:</strong> ${escapeHtml(rdu.temporal_phase)}</div>
                       `;
                       
                       if (!rdu.source_p1_2_du_ids || rdu.source_p1_2_du_ids.length === 0) {
                         html += `<div style="color: var(--app-accent-red);"><strong>⚠️ WARNING:</strong> No source P1_2 DU IDs found</div>`;
                       } else {
                         html += `<div><strong>Source P1_2 DUs (${rdu.source_p1_2_du_ids.length}):</strong></div>`;
                         
                         for (const duId of rdu.source_p1_2_du_ids) {
                           const du = txData?.p1_2_output?.diachronic_units.find(d => d.unit_id === duId);
                           
                           html += `
                             <div class="du-details" style="margin: 8px 0; padding: 6px; background: var(--app-highlight-bg); border-radius: 3px; color: var(--app-text);">
                               <div style="font-weight: bold; color: var(--app-accent-red);">🔍 DU: ${escapeHtml(duId)}</div>
                               <div style="margin-left: 10px; font-size: 0.85em; color: var(--app-text);">
                           `;
                           
                           if (!du) {
                             html += `<div style="color: var(--app-accent-red);"><strong>❌ MISSING DU:</strong> DU not found in P1_2 output</div>`;
                           } else {
                             html += `
                               <div><strong>Description:</strong> ${escapeHtml(du.description)}</div>
                               <div><strong>Source Segments (${du.source_segment_ids.length}):</strong></div>
                             `;
                             
                             // Collect utterances from segments
                             const utterances: Array<{original_line_num: string, utterance_text: string}> = [];
                             
                             for (const segmentId of du.source_segment_ids) {
                               // Find the segment in P1_1 output
                               const segmentContainer = txData?.p1_1_output?.segmented_utterances.find(su => 
                                 su.segments.some(seg => seg.segment_id === segmentId)
                               );
                               
                               if (segmentContainer) {
                                 const segment = segmentContainer.segments.find(seg => seg.segment_id === segmentId);
                                 const originalUtterance = segmentContainer.original_utterance;
                                 
                                 if (segment && originalUtterance) {
                                   // Add the original utterance (deduplicated later)
                                   utterances.push({
                                     original_line_num: originalUtterance.original_line_num,
                                     utterance_text: originalUtterance.utterance_text
                                   });
                                 }
                               }
                             }
                             
                             // Deduplicate utterances by line_num|text key
                             const uniqueUtterances = Array.from(
                               new Map(utterances.map(utt => [`${utt.original_line_num}|${utt.utterance_text}`, utt])).values()
                             );
                             
                             if (uniqueUtterances.length === 0) {
                               html += `<div style="color: var(--app-accent-red);"><strong>⚠️ WARNING:</strong> No utterances found for this DU</div>`;
                             } else {
                               html += `<div style="color: var(--app-text);"><strong>Grounded Utterances (${uniqueUtterances.length}):</strong></div>`;
                               html += `<div style="margin-left: 10px;">`;
                               
                               uniqueUtterances.forEach(utt => {
                                 html += `
                                   <div style="margin: 3px 0; padding: 4px; background: var(--app-subtle-bg); border-left: 2px solid var(--app-accent-red); font-size: 0.8em; color: var(--app-text);">
                                     <strong>Line ${escapeHtml(utt.original_line_num)}:</strong> ${escapeHtml(utt.utterance_text)}
                                   </div>
                                 `;
                               });
                               
                               html += `</div>`;
                               
                               // Count utterances for this transcript
                               const txId = rduRef.transcript_id;
                               gduTranscriptCounts.set(txId, (gduTranscriptCounts.get(txId) || 0) + uniqueUtterances.length);
                               gduTotalUtterances += uniqueUtterances.length;
                             }
                           }
                           
                           html += `</div></div>`;
                         }
                       }
                     }
                     
                     html += `</div></div>`;
                   }
                   
                   // Summary for this GDU
                   html += `
                     <div style="margin-top: 15px; padding: 10px; background: var(--app-highlight-bg); border-radius: 4px; color: var(--app-text);">
                       <strong>GDU Summary:</strong>
                       <div style="margin-left: 15px; color: var(--app-text);">
                         <div><strong>Total Utterances:</strong> ${gduTotalUtterances}</div>
                         <div><strong>Transcript Distribution:</strong></div>
                         <div style="margin-left: 15px;">
                   `;
                   
                   for (const [txId, count] of gduTranscriptCounts.entries()) {
                     const filename = processedData.get(txId)?.filename || 'Unknown';
                     html += `<div>• ${escapeHtml(txId)} (${escapeHtml(filename)}): ${count} utterances</div>`;
                   }
                   
                   html += `</div></div></div>`;
                 }
                 
                 html += `</div>`;
               }
               
               html += `</div>`;
               return html;
             };
                          


export const calculateGssCategoryUtteranceCounts = ( // Make exportable
  processedData: Map<string, TranscriptProcessedData>,
  gssOutputsByGdu: Record<string, P4S_1_Output | undefined> | undefined
): Array<{ gssCategoryId: string; gssCategoryLabel: string; gduContextId: string; countsByTranscript: Array<{ transcriptId: string; filename: string; utteranceCount: number; }>; totalUtterances: number; }> => {
  if (!gssOutputsByGdu) return [];
  const allGssCatData = [];
  for (const [gduId,p4sOut] of Object.entries(gssOutputsByGdu)) {
    if (!p4sOut?.generic_synchronic_structure?.generic_nodes_categories) continue;
    for (const gssCat of p4sOut.generic_synchronic_structure.generic_nodes_categories) {
      const countsByTx: Array<{transcriptId:string;filename:string;utteranceCount:number;}> = [];
      const notesForCat = p4sOut.generic_synchronic_structure.instantiation_notes?.filter(n=>n.generic_category_id===gssCat.id&&n.example_specific_nodes)||[];
      const uniqueP0_3LinesByTx = new Map<string,Set<string>>();
      for (const note of notesForCat) {
        console.log(`[GSS Counting] Processing note for category ${gssCat.id}, found ${note.example_specific_nodes?.length || 0} example nodes`);
        for (const specNodeRef of note.example_specific_nodes!) {
          console.log(`[GSS Counting] Processing node: txId=${specNodeRef.transcript_id}, phase=${specNodeRef.phase_name}, nodeId=${specNodeRef.sss_node_id}`);
          const txId = specNodeRef.transcript_id; const txData = processedData.get(txId);
          // Original P4S.1 prompt uses example "Phase2_Context" for phase_name. 
          // Actual P1.4 phase names are like "Beginning", "Core Event".
          // SSS structure `analyzed_diachronic_unit` contains actual P1.4 phase name.
          // The SSSNodeReference.phase_name should match this actual phase name.
          const phaseNameForLookup = specNodeRef.phase_name; 
          const phaseDataForSSS = txData?.p2s_outputs_by_phase?.[phaseNameForLookup||''];

          if(!txData||!phaseDataForSSS?.p2s_2_output||!phaseDataForSSS?.p2s_3_output){
            console.log(`[GSS Counting] Missing data: txData=${!!txData}, phaseData=${!!phaseDataForSSS}, p2s_2=${!!phaseDataForSSS?.p2s_2_output}, p2s_3=${!!phaseDataForSSS?.p2s_3_output}`);
            continue;
          }
          const sssNode = phaseDataForSSS.p2s_3_output.specific_synchronic_structure.network_nodes.find(n=>n.id===specNodeRef.sss_node_id); 
          
          const collectBaseUtterances = (isuName: string, hierarchy: P2S_2_SynchronicUnit[]): SelectedUtterance[] => {
              const currentIsu = hierarchy.find(u => u.unit_name === isuName);
              if (!currentIsu) return [];
              if (currentIsu.utterances && currentIsu.utterances.length > 0) {
                  return currentIsu.utterances.map(u => ({ original_line_num: u.original_line_num, utterance_text: u.utterance_text, /* no selection_justification here */ }));
              }
              let collected: SelectedUtterance[] = [];
              if (currentIsu.constituent_lower_units) {
                  for (const lowerUnit of currentIsu.constituent_lower_units) {
                      collected = collected.concat(collectBaseUtterances(lowerUnit, hierarchy));
                  }
              }
              return collected;
          };

          let utterances: SelectedUtterance[] = [];
          
          if(!sssNode){
            // Handle orphaned node - try to recover from P2S_2 data using same strategy as traceability
            console.log(`[GSS Table Counting] Orphaned node detected: ${specNodeRef.sss_node_id}`);
            
            // Try multiple strategies to match the ISU (same as traceability)
            let matchingIsu = null;
            
            // Strategy 1: Direct match with "ISU_" prefix
            const potentialIsuName1 = specNodeRef.sss_node_id.replace(/^sss_node_/, 'ISU_');
            matchingIsu = phaseDataForSSS.p2s_2_output.specific_synchronic_units_hierarchy.find(isu => isu.unit_name === potentialIsuName1);
            
            // Strategy 2: Direct match without prefix change
            if (!matchingIsu) {
              const potentialIsuName2 = specNodeRef.sss_node_id.replace(/^sss_node_/, '');
              matchingIsu = phaseDataForSSS.p2s_2_output.specific_synchronic_units_hierarchy.find(isu => isu.unit_name === potentialIsuName2);
            }
            
            // Strategy 3: Substring matching
            if (!matchingIsu) {
              matchingIsu = phaseDataForSSS.p2s_2_output.specific_synchronic_units_hierarchy.find(isu => 
                specNodeRef.sss_node_id.includes(isu.unit_name) || isu.unit_name.includes(specNodeRef.sss_node_id.replace(/^sss_node_/, ''))
              );
            }
            
            if (matchingIsu) {
              console.log(`[GSS Table Counting] Recovered orphaned node via ISU: ${matchingIsu.unit_name}`);
              utterances = collectBaseUtterances(matchingIsu.unit_name, phaseDataForSSS.p2s_2_output.specific_synchronic_units_hierarchy);
            } else {
              console.log(`[GSS Table Counting] Could not recover orphaned node: ${specNodeRef.sss_node_id}`);
              const availableNodeIds = phaseDataForSSS.p2s_3_output.specific_synchronic_structure.network_nodes.map(n => n.id);
              console.log(`[GSS Table Counting] Available SSS nodes in this phase:`, availableNodeIds);
            }
          } else {
            // Valid SSS node - normal processing
            utterances = collectBaseUtterances(sssNode.source_isu_id, phaseDataForSSS.p2s_2_output.specific_synchronic_units_hierarchy);
          }

          if(!uniqueP0_3LinesByTx.has(txId))uniqueP0_3LinesByTx.set(txId,new Set<string>());
          utterances.forEach(utt=>uniqueP0_3LinesByTx.get(txId)!.add(`${utt.original_line_num}|${utt.utterance_text}`)); // Key by line_num & text to ensure uniqueness
        }
      }
      let totalUttsForCat=0;
      for(const[txId,linesSet]of uniqueP0_3LinesByTx.entries()){countsByTx.push({transcriptId:txId,filename:processedData.get(txId)?.filename||'Unknown',utteranceCount:linesSet.size});totalUttsForCat+=linesSet.size;}
      allGssCatData.push({gssCategoryId:gssCat.id,gssCategoryLabel:gssCat.label,gduContextId:gduId,countsByTranscript:countsByTx,totalUtterances:totalUttsForCat});
    }
  } return allGssCatData;
};


export const calculateGduTransitionCounts = ( // Make exportable
    processedDataMap: Map<string, TranscriptProcessedData>,
    gduOutput: P3_2_Output | undefined,
    gdsOutput: P3_3_Output | undefined
): Array<{ transition: string; countsByTranscript: Array<{ transcriptId: string; filename: string; transitionCount: number; }>; totalOccurrences: number; }> => {
    if (!gduOutput?.identified_gdus || !gdsOutput?.generic_diachronic_structure_definition) return [];
    const tallies: Record<string, { countsByTranscript: Array<{ transcriptId: string; filename: string; transitionCount: number; }>; totalOccurrences: number; }> = {};
    processedDataMap.forEach((tData, tId) => {
        if (!tData.p1_3_output?.refined_diachronic_units || !tData.p1_4_output?.specific_diachronic_structure?.phases) return;
        const expRefDuIds: string[] = []; tData.p1_4_output.specific_diachronic_structure.phases.forEach(p=>expRefDuIds.push(...p.units_involved));
        const expGduSeq: string[] = [];
        for(const rDuId of expRefDuIds){ let foundGdu:string|undefined=undefined; for(const gdu of gduOutput.identified_gdus){if(gdu.contributing_refined_du_ids.some(c=>c.transcript_id===tId&&c.refined_du_id===rDuId)){foundGdu=gdu.gdu_id;break;}} if(foundGdu){if(expGduSeq.length===0||expGduSeq[expGduSeq.length-1]!==foundGdu)expGduSeq.push(foundGdu);}}
        const txTransCounts: Record<string,number>={}; for(let i=0;i<expGduSeq.length-1;i++){const key=`${expGduSeq[i]} -> ${expGduSeq[i+1]}`;txTransCounts[key]=(txTransCounts[key]||0)+1;}
        for(const[key,count]of Object.entries(txTransCounts)){if(!tallies[key])tallies[key]={countsByTranscript:[],totalOccurrences:0}; tallies[key].countsByTranscript.push({transcriptId:tId,filename:tData.filename,transitionCount:count}); tallies[key].totalOccurrences+=count;}
    });
    return Object.entries(tallies).map(([t,d])=>({transition:t,...d})).sort((a,b)=>b.totalOccurrences-a.totalOccurrences);
};

function renderGduUtteranceCountsTableHTML(gduCounts:ReturnType<typeof calculateGduUtteranceCounts>, rawTx:RawTranscript[], processedDataMap:Map<string,TranscriptProcessedData>):string{
    if(gduCounts.length===0||rawTx.length===0)return"<p><em>No GDU utterance counts.</em></p>";
    let html=`<div class="table-container"><table><thead><tr><th>GDU ID</th><th>Def (Excerpt)</th>${rawTx.map(t=>`<th>${escapeHtml(t.filename.substring(0,15))}</th>`).join('')}<th>Total Utts</th></tr><tr class="iv-row"><th colspan="2">Independent Variable</th>${rawTx.map(t=>{const txData=processedDataMap.get(t.id);const iv=txData?.p_neg1_1_output?.independent_variable_details||'N/A';return`<th class="iv-cell">${escapeHtml(iv.substring(0,40)+(iv.length>40?'...':''))}</th>`;}).join('')}<th></th></tr></thead><tbody>`;
    gduCounts.forEach(d=>{html+=`<tr><td>${escapeHtml(d.gduId)}</td><td>${escapeHtml(d.gduDefinition.substring(0,50)+"...")}</td>`;rawTx.forEach(t=>{const c=d.countsByTranscript.find(ct=>ct.transcriptId===t.id);html+=`<td>${c?String(c.utteranceCount):'0'}</td>`;});html+=`<td>${String(d.totalUtterances)}</td></tr>`;});
    html+="</tbody></table></div>"; return html;
}
function renderGssCategoryUtteranceCountsTableHTML(gssCounts:ReturnType<typeof calculateGssCategoryUtteranceCounts>, rawTx:RawTranscript[], processedDataMap:Map<string,TranscriptProcessedData>):string{
    if(gssCounts.length===0||rawTx.length===0)return"<p><em>No GSS category utterance counts.</em></p>";
    let html=`<div class="table-container"><table><thead><tr><th>GSS Cat ID</th><th>Label (Excerpt)</th><th>GDU Context</th>${rawTx.map(t=>`<th>${escapeHtml(t.filename.substring(0,15))}</th>`).join('')}<th>Total Utts</th></tr><tr class="iv-row"><th colspan="3">Independent Variable</th>${rawTx.map(t=>{const txData=processedDataMap.get(t.id);const iv=txData?.p_neg1_1_output?.independent_variable_details||'N/A';return`<th class="iv-cell">${escapeHtml(iv.substring(0,40)+(iv.length>40?'...':''))}</th>`;}).join('')}<th></th></tr></thead><tbody>`;
    gssCounts.forEach(d=>{html+=`<tr><td>${escapeHtml(d.gssCategoryId)}</td><td>${escapeHtml(d.gssCategoryLabel.substring(0,40)+"...")}</td><td>${escapeHtml(d.gduContextId)}</td>`;rawTx.forEach(t=>{const c=d.countsByTranscript.find(ct=>ct.transcriptId===t.id);html+=`<td>${c?String(c.utteranceCount):'0'}</td>`;});html+=`<td>${String(d.totalUtterances)}</td></tr>`;});
    html+="</tbody></table></div>"; return html;
}
function renderGduTransitionCountsTableHTML(transCounts:ReturnType<typeof calculateGduTransitionCounts>, rawTx:RawTranscript[], processedDataMap:Map<string,TranscriptProcessedData>):string{
    if(transCounts.length===0||rawTx.length===0)return"<p><em>No GDU transition counts.</em></p>";
    let html=`<div class="table-container"><table><thead><tr><th>Transition</th>${rawTx.map(t=>`<th>${escapeHtml(t.filename.substring(0,15))}</th>`).join('')}<th>Total Occs</th></tr><tr class="iv-row"><th>Independent Variable</th>${rawTx.map(t=>{const txData=processedDataMap.get(t.id);const iv=txData?.p_neg1_1_output?.independent_variable_details||'N/A';return`<th class="iv-cell">${escapeHtml(iv.substring(0,40)+(iv.length>40?'...':''))}</th>`;}).join('')}<th></th></tr></thead><tbody>`;
    transCounts.forEach(d=>{html+=`<tr><td>${escapeHtml(d.transition)}</td>`;rawTx.forEach(t=>{const c=d.countsByTranscript.find(ct=>ct.transcriptId===t.id);html+=`<td>${c?String(c.transitionCount):'0'}</td>`;});html+=`<td>${String(d.totalOccurrences)}</td></tr>`;});
    html+="</tbody></table></div>"; return html;
}

// Helper function to trace SSS node to grounding utterances
function getGroundingUtterancesForSSSNode(
    sssNodeId: string,
    phaseName: string | undefined,
    transcriptId: string,
    processedDataMap: Map<string, TranscriptProcessedData>
): { sssNodeLabel?: string; isuName?: string; isuDefinition?: string; utterances: SelectedUtterance[] } {
    const transcript = processedDataMap.get(transcriptId);
    if (!transcript || !phaseName) return { utterances: [] };

    const phaseData = transcript.p2s_outputs_by_phase?.[phaseName];
    if (!phaseData?.p2s_2_output || !phaseData.p2s_3_output) return { utterances: [] };

    const sssNode = phaseData.p2s_3_output.specific_synchronic_structure.network_nodes.find(n => n.id === sssNodeId);
    if (!sssNode) return { utterances: [] };

    const isuHierarchy = phaseData.p2s_2_output.specific_synchronic_units_hierarchy;
    
    let finalIsuName: string | undefined;
    let finalIsuDefinition: string | undefined;

    const collectBaseUtterances = (currentIsuName: string): SelectedUtterance[] => {
        const currentIsu = isuHierarchy.find(u => u.unit_name === currentIsuName);
        if (!currentIsu) return [];
        
        finalIsuName = currentIsu.unit_name; // Capture the most direct ISU linked to SSS
        finalIsuDefinition = currentIsu.intensional_definition;

        if (currentIsu.utterances && currentIsu.utterances.length > 0) {
            return currentIsu.utterances.map(u => ({ 
                original_line_num: u.original_line_num, 
                utterance_text: u.utterance_text 
            }));
        }
        let collected: SelectedUtterance[] = [];
        if (currentIsu.constituent_lower_units) {
            for (const lowerUnit of currentIsu.constituent_lower_units) {
                // For deeper ISUs, we don't overwrite finalIsuName/Definition
                // as we want the one directly linked to the SSS node.
                collected = collected.concat(collectBaseUtterances(lowerUnit));
            }
        }
        return collected;
    };

    const utterances = collectBaseUtterances(sssNode.source_isu_id);
    const uniqueUtterances = new Map<string, SelectedUtterance>();
    utterances.forEach(utt => {
        const key = `${utt.original_line_num}|${utt.utterance_text}`;
        if (!uniqueUtterances.has(key)) {
            uniqueUtterances.set(key, utt);
        }
    });

    return { 
        sssNodeLabel: sssNode.label,
        isuName: finalIsuName,
        isuDefinition: finalIsuDefinition,
        utterances: Array.from(uniqueUtterances.values()) 
    };
}


export function generateHtmlAppendix(
    processedDataMap: Map<string, TranscriptProcessedData>,
    genericState: GenericAnalysisState,
    rawTranscripts: RawTranscript[],
    allMermaidSyntaxes: Record<string, {title: string, syntax: string}>,
    gduCountsForAppendix: ReturnType<typeof calculateGduUtteranceCounts>,
    gssCountsForAppendix: ReturnType<typeof calculateGssCategoryUtteranceCounts>,
    transitionCountsForAppendix: ReturnType<typeof calculateGduTransitionCounts>
): string {
    const themeClass = document.documentElement.classList.contains('dark') ? 'dark-theme' : 'light-theme';
    const isDarkTheme = themeClass === 'dark-theme';
    
    // Generate navigation items
    const transcriptNavItems = Array.from(processedDataMap.entries()).map(([tId, tData]) => {
        const filename = tData.filename || tId;
        return `<li><a href="#transcript-${tId}" class="nav-link">${escapeHtml(filename)}</a></li>`;
    }).join('');
    
    const gduIds = genericState.p3_3_output?.generic_diachronic_structure_definition?.core_gdus || [];
    const gssNavItems = gduIds.map(gduId => {
        return `<li><a href="#gss-${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}" class="nav-link">GSS: ${escapeHtml(gduId)}</a></li>`;
    }).join('');
    
    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>µ-PATH Appendix (HTML)</title><style>
body{font-family:'et-book',Palatino,serif;margin:0;line-height:1.6;display:flex;}.light-theme{background-color:#faf8f1;color:#111;--app-bg:#faf8f1;--app-text:#111;--app-accent-red:#a00000;--app-border:#dcd9d0;--app-subtle-bg:#f3f1ea;--app-highlight-bg:#e9e6de;--tooltip-bg:#fff;--tooltip-text:#111;--tooltip-border:#ccc;}.dark-theme{background-color:#1a1a1a;color:#e6e6e6;--app-bg:#1a1a1a;--app-text:#e6e6e6;--app-accent-red:#ff6b6b;--app-border:#444;--app-subtle-bg:#252525;--app-highlight-bg:#333;--tooltip-bg:#2b2b2b;--tooltip-text:#e6e6e6;--tooltip-border:#555;}
.nav-panel{width:280px;min-width:280px;background-color:var(--app-subtle-bg);border-right:1px solid var(--app-border);padding:20px;box-sizing:border-box;position:fixed;height:100vh;overflow-y:auto;z-index:100;}.nav-panel h3{color:var(--app-accent-red);margin:0 0 15px 0;font-size:1.1em;}.nav-panel ul{list-style:none;margin:0 0 25px 0;padding:0;}.nav-panel li{margin:5px 0;}.nav-link{color:var(--app-text);text-decoration:none;padding:5px 8px;display:block;border-radius:3px;font-size:0.9em;transition:background-color 0.2s;}.nav-link:hover{background-color:var(--app-highlight-bg);}.nav-link.active{background-color:var(--app-accent-red);color:white;}
.main-content{margin-left:280px;padding:20px;flex:1;min-width:0;}.toggle-nav{display:none;position:fixed;top:20px;left:20px;z-index:200;background:var(--app-accent-red);color:white;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;}@media (max-width:768px){.nav-panel{transform:translateX(-100%);transition:transform 0.3s;}.nav-panel.open{transform:translateX(0);}.main-content{margin-left:0;}.toggle-nav{display:block;}}
h1,h2,h3,h4{color:var(--app-accent-red);}.transcript-section,.quantitative-section,.generic-structures-section,.gss-grounding-trace-section{border:1px solid var(--app-border);background-color:var(--app-subtle-bg);padding:15px;margin-bottom:20px;border-radius:5px;}
h1{border-bottom:2px solid var(--app-border);padding-bottom:10px;margin-top:0;}h2{border-bottom:1px solid var(--app-border);padding-bottom:5px;margin-top:1.5em;}h3{margin-top:1.2em;}
.mermaid-diagram-section{margin:15px 0;padding:10px;border:1px dashed var(--app-border);border-radius:4px;background-color:var(--app-bg);}.mermaid{text-align:center;overflow:auto;}
.table-container{overflow-x:auto;margin-bottom:20px;border:1px solid var(--app-border);border-radius:4px;}table{border-collapse:collapse;width:100%;font-size:.9em;min-width:600px;}th,td{border:1px solid var(--app-border);padding:8px;text-align:left;white-space:nowrap;}th{background-color:var(--app-highlight-bg);position:sticky;top:0;z-index:1;}.iv-row{background-color:var(--app-subtle-bg);}.iv-row th{font-style:italic;font-size:0.8em;color:var(--app-accent-red);max-width:150px;white-space:normal;word-wrap:break-word;}.iv-cell{max-width:150px;white-space:normal;word-wrap:break-word;}
.annotated-transcript-container{margin-top:10px;padding:10px;border:1px solid var(--app-border);border-radius:4px;background-color:var(--app-bg);max-height:500px;overflow-y:auto;}
.transcript-line{padding:3px 5px;margin-bottom:2px;border-radius:3px;cursor:default;transition:background-color .2s;}.transcript-line:hover{background-color:var(--app-highlight-bg);}
.line-is-procedural{font-weight:500;border-left:3px solid ${isDarkTheme?'rgba(255,107,107,.6)':'rgba(160,0,0,.6)'};padding-left:8px;}
.phase-beginning{background-color:${isDarkTheme?'rgba(70,130,180,.25)':'rgba(173,216,230,.3)'};}.phase-early-middle{background-color:${isDarkTheme?'rgba(60,179,113,.2)':'rgba(144,238,144,.25)'};}.phase-core-event{background-color:${isDarkTheme?'rgba(32,178,170,.25)':'rgba(127,255,212,.3)'};}.phase-late-middle{background-color:${isDarkTheme?'rgba(218,165,32,.2)':'rgba(255,215,0,.25)'};}.phase-ending{background-color:${isDarkTheme?'rgba(205,133,63,.25)':'rgba(255,228,181,.3)'};}.phase-reflection{background-color:${isDarkTheme?'rgba(147,112,219,.2)':'rgba(221,160,221,.25)'};}.phase-transition{background-color:${isDarkTheme?'rgba(119,136,153,.2)':'rgba(176,196,222,.25)'};}.phase-default-procedural,.phase-unknown,.phase-other{background-color:${isDarkTheme?'rgba(100,100,100,.15)':'rgba(211,211,211,.2)'}}
.transcript-tooltip{position:fixed;display:none;background-color:var(--tooltip-bg);color:var(--tooltip-text);border:1px solid var(--tooltip-border);padding:12px;border-radius:6px;box-shadow:0 4px 8px rgba(0,0,0,.25);z-index:1000;max-width:450px;font-size:.85em;pointer-events:none;}
.tooltip-title{font-weight:bold;color:var(--app-accent-red);margin-bottom:8px;font-size:1.1em;}.tooltip-section{margin-top:10px;padding-top:8px;border-top:1px dashed var(--app-border);}.tooltip-section:first-child{border-top:none;margin-top:0;padding-top:0;}
.tooltip-label{font-weight:600;color:${isDarkTheme?'#bb86fc':'#6200ee'};}.tooltip-subsection-title{font-weight:500;margin:6px 0 3px;color:${isDarkTheme?'#03dac6':'#018786'};}.tooltip-p01-text{margin-bottom:8px;}
.tooltip-contribution-block{margin-bottom:10px;padding:8px;background-color:${isDarkTheme?'rgba(255,255,255,.05)':'rgba(0,0,0,.02)'};border-radius:4px;}
.tooltip-diachronic-details p,.tooltip-synchronic-details p{margin:2px 0 4px;}.tooltip-theme-group,.tooltip-isu{margin-bottom:5px;padding-left:10px;border-left:2px solid var(--app-highlight-bg);}
.tooltip-multiphase-note{font-weight:bold;padding:5px;margin-bottom:8px;border:1px solid var(--app-accent-red);background-color:${isDarkTheme?'rgba(255,107,107,.1)':'rgba(160,0,0,.05)'};border-radius:4px;}
.gss-grounding-block{margin-bottom:1em;padding:0.5em;border-left:3px solid var(--app-accent-red);background-color:var(--app-bg);}.gss-grounding-block h5{margin-top:0.5em;color:var(--app-text);}.gss-grounding-block ul{list-style-type:disc;margin-left:20px;}.gss-grounding-block ul ul{list-style-type:circle;}
.back-to-top{position:fixed;bottom:20px;right:20px;background:var(--app-accent-red);color:white;border:none;padding:10px 12px;border-radius:50%;cursor:pointer;display:none;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:100;}
</style></head><body class="${themeClass}">
<button class="toggle-nav" onclick="document.querySelector('.nav-panel').classList.toggle('open')">☰ Index</button>
<div class="nav-panel">
    <h3>📋 Navigation Index</h3>
    
    <h3>📄 Transcripts</h3>
    <ul>${transcriptNavItems}</ul>
    
    <h3>🔗 Generic Structures</h3>
    <ul>
        <li><a href="#generic-diachronic" class="nav-link">Generic Diachronic Structure</a></li>
        ${gssNavItems}
    </ul>
    
    <h3>📊 Traceability</h3>
    <ul>
        <li><a href="#gss-traceability" class="nav-link">GSS → SSS → ISU → Utterances</a></li>
        <li><a href="#gdu-traceability" class="nav-link">GDU → RDU → DU → Utterances</a></li>
    </ul>
    
    <h3>🔍 Causal Models</h3>
    <ul>
        <li><a href="#causal-model" class="nav-link">Proposed Causal Model</a></li>
    </ul>
    
    <h3>📈 Quantitative Analysis</h3>
    <ul>
        <li><a href="#gdu-counts" class="nav-link">GDU vs. Utterances/Transcripts</a></li>
        <li><a href="#gss-counts" class="nav-link">GSS Categories vs. Utterances/Transcripts</a></li>
        <li><a href="#transition-counts" class="nav-link">GDU Transitions</a></li>
    </ul>
</div>

<div class="main-content">
    <h1>µ-PATH Appendix (HTML)</h1>
    <p>Hover over annotated transcript lines for details. Use the navigation panel to jump between sections.</p>
    <div id="transcript-tooltip" class="transcript-tooltip"></div>
    
    <div id="appendix-content">`;

    // Generate transcript sections with anchors
    processedDataMap.forEach((tData, tId) => {
        const filename = tData.filename || tId;
        const iv = tData.p_neg1_1_output?.independent_variable_details || "N/A";
        
        html += `<section class="transcript-section" id="transcript-${tId}">
            <h2>📄 Transcript: ${escapeHtml(filename)}</h2>
            <p><strong>IV:</strong> ${escapeHtml(iv)}</p>
            ${renderAnnotatedTranscriptHTML(tData)}`;
        
        // SDS Diagram
        const sdsKey = `sds_${tId}`;
        if (allMermaidSyntaxes[sdsKey]) {
            html += renderMermaidDiagramHTML(allMermaidSyntaxes[sdsKey].title, allMermaidSyntaxes[sdsKey].syntax, `mermaid_${sdsKey}`);
        } else {
            html += `<p><em>SDS diagram not available for ${escapeHtml(filename)}.</em></p>`;
        }
        
        // SSS Diagrams (Per Phase)
        let sssExists = false;
        if (tData.p2s_outputs_by_phase && Object.keys(tData.p2s_outputs_by_phase).length > 0) {
            html += `<h3>SSS Diagrams (Per Phase)</h3>`;
            Object.entries(tData.p2s_outputs_by_phase).forEach(([phase, pData]) => {
                const sssKey = `sss_${tId}_${phase.replace(/[^a-zA-Z0-9_]/g, '_')}`;
                if (allMermaidSyntaxes[sssKey]) {
                    html += renderMermaidDiagramHTML(allMermaidSyntaxes[sssKey].title, allMermaidSyntaxes[sssKey].syntax, `mermaid_${sssKey}`);
                    sssExists = true;
                }
            });
            if (!sssExists) {
                html += `<p><em>No SSS diagrams for any phase of ${escapeHtml(filename)}.</em></p>`;
            }
        } else {
            html += `<p><em>No SSS data for any phase of ${escapeHtml(filename)}.</em></p>`;
        }
        
        html += `</section>`;
    });
    
    // Generic Structures Section
    html += `<section class="generic-structures-section" id="generic-diachronic">
        <h2>🔗 Generic Structures</h2>`;
    
    if (allMermaidSyntaxes['gds_main']) {
        html += renderMermaidDiagramHTML(allMermaidSyntaxes['gds_main'].title, allMermaidSyntaxes['gds_main'].syntax, 'mermaid_gds_main');
    } else {
        html += `<p><em>GDS diagram not available.</em></p>`;
    }
    
    // GSS Diagrams
    if (genericState.p3_3_output?.generic_diachronic_structure_definition.core_gdus) {
        genericState.p3_3_output.generic_diachronic_structure_definition.core_gdus.forEach(gduId => {
            const gssKey = `gss_${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            if (allMermaidSyntaxes[gssKey]) {
                html += `<div id="gss-${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}">`;
                html += renderMermaidDiagramHTML(allMermaidSyntaxes[gssKey].title, allMermaidSyntaxes[gssKey].syntax, `mermaid_${gssKey}`);
                html += `</div>`;
            }
        });
    }
    
    html += `</section>`;
    
    // Enhanced GSS Traceability Section
    html += `<section class="gss-grounding-trace-section" id="gss-traceability">`;
    html += generateGssTraceabilityBreakdown(processedDataMap, genericState.p4s_outputs_by_gdu);
    html += `</section>`;
    
    // Enhanced GDU Traceability Section  
    html += `<section class="gss-grounding-trace-section" id="gdu-traceability">`;
    html += generateGduTraceabilityBreakdown(processedDataMap, genericState);
    html += `</section>`;

    // Causal Model Section
    if (allMermaidSyntaxes['cleaned_causal_dag']) {
        html += `<section class="generic-structures-section" id="causal-model">
            <h3>🔍 Proposed Causal Model (Cleaned)</h3>
            ${renderMermaidDiagramHTML(allMermaidSyntaxes['cleaned_causal_dag'].title, allMermaidSyntaxes['cleaned_causal_dag'].syntax, 'mermaid_cleaned_causal_dag')}
        </section>`;
    } else if (allMermaidSyntaxes['causal_dag']) {
        html += `<section class="generic-structures-section" id="causal-model">
            <h3>🔍 Proposed Causal Model</h3>
            ${renderMermaidDiagramHTML(allMermaidSyntaxes['causal_dag'].title, allMermaidSyntaxes['causal_dag'].syntax, 'mermaid_causal_dag')}
        </section>`;
    }
    
    // Quantitative Section
    html += `<section class="quantitative-section" id="quantitative-analysis">
        <h2>📈 Quantitative Summaries</h2>
        
        <div id="gdu-counts">
            <h3>GDU vs. Utterances/Transcripts</h3>
            ${renderGduUtteranceCountsTableHTML(gduCountsForAppendix, rawTranscripts, processedDataMap)}
        </div>
        
        <div id="gss-counts">
            <h3>GSS Categories vs. Utterances/Transcripts</h3>
            ${renderGssCategoryUtteranceCountsTableHTML(gssCountsForAppendix, rawTranscripts, processedDataMap)}
        </div>
        
        <div id="transition-counts">
            <h3>GDU Transitions</h3>
            ${renderGduTransitionCountsTableHTML(transitionCountsForAppendix, rawTranscripts, processedDataMap)}
        </div>
    </section>`;
    
    html += `</div></div>`;
    
    // Back to top button
    html += `<button class="back-to-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Back to top">↑</button>`;
    
    // Scripts
    html += `<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script><script>
document.addEventListener('DOMContentLoaded',function(){
    // Mermaid initialization
    const t=document.body.classList.contains('dark-theme')?'dark':'base';
    const d=t==='dark';
    mermaid.initialize({
        startOnLoad:false,
        securityLevel:'loose',
        theme:t,
        fontFamily:"'et-book',Palatino,serif",
        themeVariables:{
            primaryColor:d?'#1a1a1a':'#faf8f1',
            primaryBorderColor:d?'#ff6b6b':'#a00000',
            primaryTextColor:d?'#e6e6e6':'#111',
            lineColor:d?'#e6e6e6':'#111',
            textColor:d?'#e6e6e6':'#111',
            clusterBkg:d?'#1a1a1a':'#faf8f1',
            clusterBorder:d?'#ff6b6b':'#a00000',
            ganttTaskDefaultFill:d?'#1a1a1a':'#faf8f1',
            ganttTaskDefaultBorderColor:d?'#ff6b6b':'#a00000'
        }
    });
    
    async function renderMermaid(){
        try{
            await mermaid.run({nodes:document.querySelectorAll('.mermaid')});
            console.log('Mermaid rendered in HTML appendix.');
        }catch(e){
            console.error("Error rendering Mermaid in HTML appendix:",(e instanceof Error?e.message:String(e)));
            document.querySelectorAll('.mermaid').forEach(el=>{
                if(!el.getAttribute('data-processed'))
                    el.innerHTML='<p style="color:red;">Error: '+(e instanceof Error?e.message:String(e))+'</p>';
            });
        }
    }
    renderMermaid();
    
    // Navigation functionality
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id], div[id]');
    
    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({behavior: 'smooth', block: 'start'});
                // Update active nav link
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                // Close mobile nav
                document.querySelector('.nav-panel').classList.remove('open');
            }
        });
    });
    
    // Highlight current section in navigation
    function updateActiveNavLink() {
        let current = '';
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= 100 && rect.bottom >= 100) {
                current = section.id;
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }
    
    // Back to top button visibility
    const backToTopBtn = document.querySelector('.back-to-top');
    function toggleBackToTop() {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.display = 'block';
        } else {
            backToTopBtn.style.display = 'none';
        }
    }
    
    window.addEventListener('scroll', function() {
        updateActiveNavLink();
        toggleBackToTop();
    });
    
    // Tooltip functionality (existing code)
    const tip=document.getElementById('transcript-tooltip');
    const lines=document.querySelectorAll('.transcript-line');
    lines.forEach(line=>{
        line.addEventListener('mousemove',function(ev){
            if(!tip)return;
            const n=line.getAttribute('data-line-num');
            const txt=line.getAttribute('data-line-text');
            const contribRaw=line.getAttribute('data-contributions');
            let contribs=[];
            try{
                contribs=contribRaw?JSON.parse(contribRaw):[];
            }catch(e){
                console.error('Failed to parse contribs for line '+n+':',(e instanceof Error?e.message:String(e)),contribRaw);
                tip.innerHTML='<div class="tooltip-title">Error</div><p>Could not parse data.</p>';
                tip.style.display='block';
                tip.style.left=(ev.clientX+15)+'px';
                tip.style.top=(ev.clientY+15)+'px';
                return;
            }
            
            let ttContent='<div class="tooltip-title">Line '+(n||'')+'</div><p class="tooltip-p01-text">'+(txt||'')+'</p>';
            const phases=new Set();
            if(contribs.length>0)contribs.forEach(c=>{if(c.p1_3_temporal_phase)phases.add(c.p1_3_temporal_phase);});
            if(phases.size>1)ttContent+='<p class="tooltip-multiphase-note"><strong>Note:</strong> Spans multiple phases: '+Array.from(phases).join(', ')+'.</p>';
            
            if(contribs.length>0){
                contribs.forEach((c,i)=>{
                    ttContent+='<div class="tooltip-contribution-block"><div class="tooltip-subsection-title">Contribution '+(i+1)+' (P0.3: '+(c.p0_3_original_line_num||'N/A')+')</div><p><span class="tooltip-label">P0.3 Utt:</span> '+(c.p0_3_utterance_text||'N/A')+'</p><div class="tooltip-diachronic-details">';
                    if(c.p1_1_segment_ids?.length>0)ttContent+='<p><span class="tooltip-label">P1.1 Segs:</span> '+c.p1_1_segment_ids.join(', ')+'</p>';
                    if(c.p1_2_du_id)ttContent+='<p><span class="tooltip-label">P1.2 DU:</span> '+c.p1_2_du_id+(c.p1_2_du_description?' ('+c.p1_2_du_description.substring(0,50)+'...)':'')+'</p>';
                    if(c.p1_3_refined_du_id){ttContent+='<p><span class="tooltip-label">P1.3 Ref. DU:</span> '+c.p1_3_refined_du_id+(c.p1_3_refined_du_description?' ('+c.p1_3_refined_du_description.substring(0,50)+'...)':'')+'</p><p><span class="tooltip-label">P1.3 Phase:</span> '+(c.p1_3_temporal_phase||'N/A')+'</p>';}
                    if(c.p1_4_phase_name)ttContent+='<p><span class="tooltip-label">P1.4 Phase:</span> '+c.p1_4_phase_name+'</p>';
                    ttContent+='</div>';
                    
                    if(c.p1_4_phase_name&&(c.synchronic_p2s1_groups?.length||c.synchronic_p2s2_isus?.length)){
                        ttContent+='<div class="tooltip-synchronic-details tooltip-section"><div class="tooltip-subsection-title">Synchronic (P1.4 Phase: '+c.p1_4_phase_name+')</div>';
                        if(c.synchronic_p2s1_groups?.length)c.synchronic_p2s1_groups.forEach(g=>{ttContent+='<div class="tooltip-theme-group"><span class="tooltip-label">P2S.1 Theme:</span> '+(g.group_label||'N/A')+'<br><span class="tooltip-label">Justif:</span> '+(g.justification?.substring(0,70)+'...'||'N/A')+'</div>';});
                        if(c.synchronic_p2s2_isus?.length)c.synchronic_p2s2_isus.forEach(s=>{ttContent+='<div class="tooltip-isu"><span class="tooltip-label">P2S.2 ISU:</span> '+(s.unit_name||'N/A')+'<br><span class="tooltip-label">Def:</span> '+(s.intensional_definition?.substring(0,70)+'...'||'N/A')+'</div>';});
                        ttContent+='</div>';
                    }
                    ttContent+='</div>';
                });
            }else if(line.classList.contains('line-is-procedural')){
                ttContent+='<p><em>Marked procedural (P0.3), detailed trace not in this view.</em></p>';
            }
            
            tip.innerHTML=ttContent;
            tip.style.display='block';
            let x=ev.clientX+15;
            let y=ev.clientY+15;
            if(x+tip.offsetWidth+15>window.innerWidth)x=ev.clientX-tip.offsetWidth-15;
            if(x<0)x=15;
            if(y+tip.offsetHeight+15>window.innerHeight)y=ev.clientY-tip.offsetHeight-15;
            if(y<0)y=15;
            tip.style.left=x+'px';
            tip.style.top=y+'px';
        });
        
        line.addEventListener('mouseout',function(){
            if(tip)tip.style.display='none';
        });
    });
});
</script></body></html>`;
    
    return html;
}

