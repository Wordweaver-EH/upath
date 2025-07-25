import { 
  P2SDuData, 
  P2S_1_Output, 
  P2S_2_Output, 
  P2S_3_Output,
  P1_4_Output,
  SegmentedUtteranceSegment
} from '../../types';
import { 
  P2S4SummaryData, 
  P2S4DURecord, 
  P2S4ISUTheme, 
  P2S4Utterance,
  P2S4TableRow
} from '../types/p2s4Types';

// Helper function to get DU description from P1.4
function getDUDescription(duId: string, p1_4_output?: P1_4_Output): string | undefined {
  if (!p1_4_output) return undefined;
  
  const du = p1_4_output.diachronic_units.find(unit => unit.unit_id === duId);
  return du?.description;
}

export function transformP2SDataToSummary(
  transcriptId: string,
  p2sOutputsByDU: Map<string, P2SDuData>,
  p1_4_output?: P1_4_Output
): P2S4SummaryData {
  const duRecords: P2S4DURecord[] = [];
  let totalISUs = 0;
  let totalUtterances = 0;

  // Sort DUs by their order in P1.4
  const sortedDUEntries = Array.from(p2sOutputsByDU.entries())
    .sort(([idA], [idB]) => {
      // Extract numeric part if exists (e.g., "du_1" -> 1)
      const numA = parseInt(idA.match(/\d+/)?.[0] || '0');
      const numB = parseInt(idB.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  for (const [duId, duData] of sortedDUEntries) {
    const duRecord = transformSingleDU(duId, duData, p1_4_output);
    duRecords.push(duRecord);
    totalISUs += duRecord.isuThemes.size;
    totalUtterances += Array.from(duRecord.isuThemes.values())
      .reduce((sum, isu) => sum + isu.utterances.length, 0);
  }

  return {
    transcriptId,
    duRecords,
    totalDUs: duRecords.length,
    totalISUs,
    totalUtterances
  };
}

function transformSingleDU(duId: string, duData: P2SDuData, p1_4_output?: P1_4_Output): P2S4DURecord {
  const p2s1 = duData.p2s_1_output;
  const p2s2 = duData.p2s_2_output;
  const p2s3 = duData.p2s_3_output;

  // Extract DU metadata
  const duName = p2s1?.analyzed_du_id || duId;
  const segmentCount = p2s1?.synchronic_thematic_groups
    .reduce((sum, group) => sum + group.segments.length, 0) || 0;
  
  // Get DU description from P1.4
  const duDescription = getDUDescription(duId, p1_4_output) || 'No description available';

  // Build ISU themes map
  const isuThemes = buildISUThemesMap(p2s1, p2s2);

  // Extract network diagram info
  const networkDiagram = {
    mermaidSyntax: duData.p2s_3_mermaid_syntax || '',
    nodeCount: p2s3?.specific_synchronic_structure.network_nodes.length || 0,
    linkCount: p2s3?.specific_synchronic_structure.network_links.length || 0
  };

  return {
    id: duId,
    name: duName,
    segmentCount,
    description: duDescription,
    isuThemes,
    networkDiagram
  };
}

function buildISUThemesMap(
  p2s1?: P2S_1_Output,
  p2s2?: P2S_2_Output
): Map<string, P2S4ISUTheme> {
  const isuMap = new Map<string, P2S4ISUTheme>();

  if (!p2s2) return isuMap;

  // First pass: Create all ISUs
  p2s2.specific_synchronic_units_hierarchy.forEach((unit, index) => {
    const isuId = `isu_${index}`;
    const utterances = extractUtterancesForISU(unit, p2s1);

    isuMap.set(isuId, {
      id: isuId,
      unitName: unit.unit_name,
      level: unit.level,
      hierarchyPath: [], // Will be filled in second pass
      abstractionOp: unit.abstraction_op,
      intensionalDefinition: unit.intensional_definition,
      utterances,
      childUnits: []
    });
  });

  // Second pass: Build hierarchy relationships
  p2s2.specific_synchronic_units_hierarchy.forEach((unit, index) => {
    const currentId = `isu_${index}`;
    const current = isuMap.get(currentId)!;

    // Find parent ISUs (those that list this unit in constituent_lower_units)
    p2s2.specific_synchronic_units_hierarchy.forEach((potentialParent, parentIndex) => {
      if (potentialParent.constituent_lower_units?.includes(unit.unit_name)) {
        const parentId = `isu_${parentIndex}`;
        const parent = isuMap.get(parentId)!;
        
        parent.childUnits.push(currentId);
        current.hierarchyPath = [...parent.hierarchyPath, parent.unitName];
      }
    });

    // If no parent found, it's a top-level unit
    if (current.hierarchyPath.length === 0) {
      current.hierarchyPath = [current.unitName];
    }
  });

  return isuMap;
}

function extractUtterancesForISU(
  unit: any,
  p2s1?: P2S_1_Output
): P2S4Utterance[] {
  const utterances: P2S4Utterance[] = [];

  // Get segments from the ISU
  unit.segments?.forEach((segment: SegmentedUtteranceSegment, index: number) => {
    utterances.push({
      id: `${unit.unit_name}_utt_${index}`,
      segmentId: segment.segment_id,
      text: segment.segment_text,
      speaker: determineSegmentSpeaker(segment),
      timestamp: segment.original_utterance?.timestamp,
      temporalCues: segment.temporal_cues
    });
  });

  return utterances;
}


function determineSegmentSpeaker(segment: SegmentedUtteranceSegment): 'P' | 'I' {
  // Logic to determine speaker from segment data
  return segment.original_utterance?.speaker || 'P';
}

// Row generation for table rendering
export function generateTableRows(summaryData: P2S4SummaryData): P2S4TableRow[] {
  const rows: P2S4TableRow[] = [];
  
  summaryData.duRecords.forEach(du => {
    let isFirstDURow = true;
    let duRowCount = 0;
    
    // First, calculate total rows for this DU
    const duTotalRows = Array.from(du.isuThemes.values())
      .reduce((sum, isu) => sum + Math.max(isu.utterances.length, 1), 0);
    
    // Sort ISUs by level and hierarchy
    const sortedISUs = Array.from(du.isuThemes.values())
      .sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.unitName.localeCompare(b.unitName);
      });
    
    sortedISUs.forEach(isu => {
      let isFirstISURow = true;
      const isuRowCount = Math.max(isu.utterances.length, 1);
      
      if (isu.utterances.length === 0) {
        // ISU with no utterances still gets a row
        rows.push({
          id: `${du.id}_${isu.id}_empty`,
          duId: du.id,
          duDisplay: isFirstDURow ? {
            name: du.name,
            segmentCount: du.segmentCount,
            description: du.description,
            rowSpan: duTotalRows
          } : undefined,
          isuId: isu.id,
          isuDisplay: {
            unitName: isu.unitName,
            level: isu.level,
            isChild: isu.level > 1,
            abstractionOp: isu.abstractionOp,
            intensionalDefinition: isu.intensionalDefinition,
            utteranceCount: 0,
            rowSpan: 1
          },
          utterance: { 
            id: 'empty', 
            text: 'No utterances', 
            speaker: 'P',
            segmentId: ''
          },
          networkDiagram: isFirstDURow ? {
            mermaidSyntax: du.networkDiagram.mermaidSyntax,
            nodeCount: du.networkDiagram.nodeCount,
            linkCount: du.networkDiagram.linkCount,
            rowSpan: duTotalRows
          } : undefined
        });
        isFirstDURow = false;
        duRowCount++;
      } else {
        // One row per utterance
        isu.utterances.forEach((utterance, uttIndex) => {
          rows.push({
            id: `${du.id}_${isu.id}_${utterance.id}`,
            duId: du.id,
            duDisplay: isFirstDURow ? {
              name: du.name,
              segmentCount: du.segmentCount,
              description: du.description,
              rowSpan: duTotalRows
            } : undefined,
            isuId: isu.id,
            isuDisplay: isFirstISURow ? {
              unitName: isu.unitName,
              level: isu.level,
              isChild: isu.level > 1,
              abstractionOp: isu.abstractionOp,
              intensionalDefinition: isu.intensionalDefinition,
              utteranceCount: isu.utterances.length,
              rowSpan: isuRowCount
            } : undefined,
            utterance,
            networkDiagram: isFirstDURow ? {
              mermaidSyntax: du.networkDiagram.mermaidSyntax,
              nodeCount: du.networkDiagram.nodeCount,
              linkCount: du.networkDiagram.linkCount,
              rowSpan: duTotalRows
            } : undefined
          });
          isFirstDURow = false;
          isFirstISURow = false;
          duRowCount++;
        });
      }
    });
  });
  
  return rows;
}

// Alternative row generation for ag-grid (without rowSpan)
export function generateAgGridRows(summaryData: P2S4SummaryData): any[] {
  const rows: any[] = [];
  
  summaryData.duRecords.forEach((du, duIndex) => {
    const duRows: any[] = [];
    let isFirstDURow = true;
    
    // Sort ISUs by level and hierarchy
    const sortedISUs = Array.from(du.isuThemes.values())
      .sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.unitName.localeCompare(b.unitName);
      });
    
    sortedISUs.forEach(isu => {
      let isFirstISURow = true;
      
      if (isu.utterances.length === 0) {
        duRows.push({
          id: `${du.id}_${isu.id}_empty`,
          duName: isFirstDURow ? du.name : '',
          duDescription: isFirstDURow ? du.description : '',
          duSegmentCount: isFirstDURow ? du.segmentCount : '',
          isuName: isu.unitName,
          isuLevel: isu.level,
          isuIsChild: isu.level > 1,
          isuAbstractionOp: isu.abstractionOp,
          isuDefinition: isu.intensionalDefinition,
          utteranceText: 'No utterances',
          utteranceSpeaker: '',
          utteranceSegmentId: '',
          utteranceTimestamp: '',
          networkMermaid: isFirstDURow ? du.networkDiagram.mermaidSyntax : '',
          networkNodeCount: isFirstDURow ? du.networkDiagram.nodeCount : '',
          networkLinkCount: isFirstDURow ? du.networkDiagram.linkCount : '',
          _isFirstDURow: isFirstDURow,
          _duData: du
        });
        isFirstDURow = false;
      } else {
        isu.utterances.forEach((utterance, uttIndex) => {
          duRows.push({
            id: `${du.id}_${isu.id}_${utterance.id}`,
            duName: isFirstDURow ? du.name : '',
            duDescription: isFirstDURow ? du.description : '',
            duSegmentCount: isFirstDURow ? du.segmentCount : '',
            isuName: isFirstISURow ? isu.unitName : '',
            isuLevel: isFirstISURow ? isu.level : '',
            isuIsChild: isFirstISURow && isu.level > 1,
            isuAbstractionOp: isFirstISURow ? isu.abstractionOp : '',
            isuDefinition: isFirstISURow ? isu.intensionalDefinition : '',
            utteranceText: utterance.text,
            utteranceSpeaker: utterance.speaker,
            utteranceSegmentId: utterance.segmentId,
            utteranceTimestamp: utterance.timestamp || '',
            networkMermaid: isFirstDURow ? du.networkDiagram.mermaidSyntax : '',
            networkNodeCount: isFirstDURow ? du.networkDiagram.nodeCount : '',
            networkLinkCount: isFirstDURow ? du.networkDiagram.linkCount : '',
            _isFirstDURow: isFirstDURow,
            _isFirstISURow: isFirstISURow,
            _duData: du,
            _isuData: isu
          });
          isFirstDURow = false;
          isFirstISURow = false;
        });
      }
    });
    
    // Mark the last row of this DU
    if (duRows.length > 0) {
      duRows[duRows.length - 1]._isLastDURow = true;
    }
    
    rows.push(...duRows);
  });
  
  return rows;
}