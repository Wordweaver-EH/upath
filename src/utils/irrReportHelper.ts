import { IrrResults, IrrWorkflowState, TranscriptProcessedData, GenericAnalysisState } from '../types';
import { buildCompleteUtteranceToGduMapping } from './traceabilityHelper';
import { buildReliabilityMatrix } from './statisticsHelper';

/**
 * Normalizes Run B data to match Run A's transcript IDs based on filename.
 * This ensures that the same transcripts are compared even if their internal IDs differ.
 * @param runAData Map of transcript data for Run A
 * @param runBData Map of transcript data for Run B
 * @param runBGenericState Generic analysis state for Run B
 * @returns Normalized data for Run B with matching transcript IDs
 */
export function normalizeRunBData(
    runAData: Map<string, TranscriptProcessedData>,
    runBData: Map<string, TranscriptProcessedData>,
    runBGenericState: GenericAnalysisState
): { 
    normalizedProcessedData: Map<string, TranscriptProcessedData>,
    normalizedGenericState: GenericAnalysisState 
} {
    // Build filename to Run A ID mapping
    const filenameToRunAId = new Map<string, string>();
    runAData.forEach((data, id) => {
        filenameToRunAId.set(data.filename, id);
    });

    // Build Run B ID to Run A ID mapping
    const runBtoRunAIdMap = new Map<string, string>();
    runBData.forEach((dataB, runBId) => {
        const runAId = filenameToRunAId.get(dataB.filename);
        if (runAId) {
            runBtoRunAIdMap.set(runBId, runAId);
        }
    });

    // Deep clone and normalize processed data
    const normalizedProcessedData = new Map<string, TranscriptProcessedData>();
    runBData.forEach((dataB) => {
        const runAId = filenameToRunAId.get(dataB.filename);
        if (runAId) {
            const normalizedData = { ...dataB, id: runAId };
            normalizedProcessedData.set(runAId, normalizedData);
        }
    });

    // Deep clone and normalize generic state (especially P3.2 output)
    const normalizedGenericState = JSON.parse(JSON.stringify(runBGenericState));
    if (normalizedGenericState.p3_2_output?.identified_gdus) {
        normalizedGenericState.p3_2_output.identified_gdus.forEach(gdu => {
            gdu.contributing_refined_du_ids = gdu.contributing_refined_du_ids.map(contrib => ({
                ...contrib,
                transcript_id: runBtoRunAIdMap.get(contrib.transcript_id) || contrib.transcript_id
            }));
        });
    }

    return { normalizedProcessedData, normalizedGenericState };
}

export interface CodingMatrixItem {
  utteranceId: string;
  transcriptId: string;
  lineNumber: string;
  utteranceText: string;
  runAGdus: string[];
  runBGdus: string[];
  mappedRunAGdus: (string | null)[];
  isDisagreement: boolean;
  disagreementType: 'assignment_count' | 'partial_overlap' | 'no_overlap';
}

export interface DisagreementReport {
  summary: {
    totalUtterances: number;
    disagreements: number;
    agreementRate: number;
    krippendorffsAlpha: number;
    observedDisagreement: number;
    expectedDisagreement: number;
    cohensKappa: number;
    kappaObservedAgreement: number;
    kappaExpectedAgreement: number;
  };
  disagreementsByType: {
    assignment_count: number;
    partial_overlap: number;
    no_overlap: number;
  };
  detailedCodingMatrix: CodingMatrixItem[];
  gduMappingUsed: Record<string, string | null>;
  contingencyTable?: {
    categories: string[];
    matrix: Map<string, Map<string, number>>;
  };
}

/**
 * Generates a comprehensive disagreement report for IRR analysis
 */
export function generateDisagreementReport(
  irrState: IrrWorkflowState,
  irrResults: IrrResults
): DisagreementReport {
  if (!irrState.runA || !irrState.runB || !irrState.confirmedMapping) {
    throw new Error('Cannot generate disagreement report: missing required data');
  }

  // Build utterance-to-GDU mappings
  const runAProcessedDataMap = new Map(irrState.runA.processedDataArray);
  const runBProcessedDataMapOriginal = new Map(irrState.runB.processedDataArray);
  
  // Normalize Run B data to match Run A's transcript IDs
  const { normalizedProcessedData: runBProcessedDataMap, normalizedGenericState } = normalizeRunBData(
    runAProcessedDataMap,
    runBProcessedDataMapOriginal,
    irrState.runB.genericAnalysisState
  );

  const runAMappings = buildCompleteUtteranceToGduMapping(
    runAProcessedDataMap, 
    irrState.runA.genericAnalysisState.p3_2_output
  );
  
  const runBMappings = buildCompleteUtteranceToGduMapping(
    runBProcessedDataMap, 
    normalizedGenericState.p3_2_output
  );

  // Build GDU mapping for transformations
  const gduMapping = new Map<string, string | null>();
  Object.entries(irrState.confirmedMapping).forEach(([runAGdu, runBGdu]) => {
    gduMapping.set(runAGdu, runBGdu);
  });

  // Get all unique utterance IDs
  const allUtteranceIds = new Set<string>();
  runAMappings.forEach((_, id) => allUtteranceIds.add(id));
  runBMappings.forEach((_, id) => allUtteranceIds.add(id));

  const detailedCodingMatrix: CodingMatrixItem[] = [];
  const disagreementsByType = {
    assignment_count: 0,
    partial_overlap: 0,
    no_overlap: 0
  };

  // Analyze each utterance for disagreements
  for (const utteranceId of allUtteranceIds) {
    const [transcriptId, lineNumber] = utteranceId.split('|');
    const runAGdus = runAMappings.get(utteranceId) || [];
    const runBGdus = runBMappings.get(utteranceId) || [];

    // Apply GDU mapping to Run A assignments
    const mappedRunAGdus = runAGdus.map(gdu => gduMapping.get(gdu) || null);
    const validMappedRunAGdus = mappedRunAGdus.filter(gdu => gdu !== null) as string[];

    // Get utterance text from one of the runs
    const utteranceText = getUtteranceText(transcriptId, lineNumber, runAProcessedDataMap) ||
                         getUtteranceText(transcriptId, lineNumber, runBProcessedDataMap) ||
                         `Line ${lineNumber}`;

    // Determine disagreement type
    let isDisagreement = false;
    let disagreementType: CodingMatrixItem['disagreementType'] = 'no_overlap';

    if (runAGdus.length !== runBGdus.length) {
      isDisagreement = true;
      disagreementType = 'assignment_count';
    } else if (validMappedRunAGdus.length === 0 && runBGdus.length === 0) {
      // Both have no assignments - agreement
      isDisagreement = false;
    } else if (validMappedRunAGdus.length === 0 || runBGdus.length === 0) {
      // One has assignments, other doesn't
      isDisagreement = true;
      disagreementType = 'no_overlap';
    } else {
      // Compare actual assignments
      const setA = new Set(validMappedRunAGdus);
      const setB = new Set(runBGdus);
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      
      if (intersection.size === 0) {
        isDisagreement = true;
        disagreementType = 'no_overlap';
      } else if (intersection.size < setA.size || intersection.size < setB.size) {
        isDisagreement = true;
        disagreementType = 'partial_overlap';
      } else {
        // Perfect overlap
        isDisagreement = false;
      }
    }

    if (isDisagreement) {
      disagreementsByType[disagreementType]++;
    }

    // Add to detailed coding matrix (all utterances, not just disagreements)
    detailedCodingMatrix.push({
        utteranceId,
        transcriptId,
        lineNumber,
        utteranceText,
        runAGdus,
        runBGdus,
        mappedRunAGdus,
        isDisagreement,
        disagreementType
      });
  }

  const totalUtterances = allUtteranceIds.size;
  const totalDisagreements = detailedCodingMatrix.filter(item => item.isDisagreement).length;
  const agreementRate = totalUtterances > 0 ? (totalUtterances - totalDisagreements) / totalUtterances : 0;

  // Extract contingency table if available
  let contingencyTable = undefined;
  if (irrState.kappaResults?.contingencyTable) {
    const categories = Array.from(irrState.kappaResults.contingencyTable.keys()).sort();
    contingencyTable = {
      categories,
      matrix: irrState.kappaResults.contingencyTable
    };
  }

  return {
    summary: {
      totalUtterances,
      disagreements: totalDisagreements,
      agreementRate,
      krippendorffsAlpha: irrResults.alpha_score,
      observedDisagreement: irrResults.observed_disagreement,
      expectedDisagreement: irrResults.expected_disagreement,
      cohensKappa: irrResults.cohens_kappa,
      kappaObservedAgreement: irrResults.kappa_observed_agreement,
      kappaExpectedAgreement: irrResults.kappa_expected_agreement
    },
    disagreementsByType,
    detailedCodingMatrix,
    gduMappingUsed: irrState.confirmedMapping,
    contingencyTable
  };
}

/**
 * Helper function to get utterance text from processed data
 */
function getUtteranceText(
  transcriptId: string, 
  lineNumber: string, 
  processedDataMap: Map<string, any>
): string | null {
  const transcriptData = processedDataMap.get(transcriptId);
  if (!transcriptData?.p0_3_output?.selected_procedural_utterances) {
    return null;
  }

  const utterance = transcriptData.p0_3_output.selected_procedural_utterances
    .find((utt: any) => utt.original_line_num === lineNumber);
  
  return utterance?.utterance_text || null;
}

/**
 * Converts disagreement report to CSV format for download
 */
export function disagreementReportToCsv(report: DisagreementReport): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Inter-Rater Reliability Full Coding Matrix Report');
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push(`Total Utterances,${report.summary.totalUtterances}`);
  lines.push(`Disagreements,${report.summary.disagreements}`);
  lines.push(`Agreement Rate,${(report.summary.agreementRate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push(`## Reliability Metrics`);
  lines.push(`Krippendorff's Alpha,${report.summary.krippendorffsAlpha.toFixed(3)}`);
  lines.push(`Alpha Observed Disagreement,${report.summary.observedDisagreement.toFixed(3)}`);
  lines.push(`Alpha Expected Disagreement,${report.summary.expectedDisagreement.toFixed(3)}`);
  lines.push(`Cohen's Kappa,${report.summary.cohensKappa.toFixed(3)}`);
  lines.push(`Kappa Observed Agreement,${report.summary.kappaObservedAgreement.toFixed(3)}`);
  lines.push(`Kappa Expected Agreement,${report.summary.kappaExpectedAgreement.toFixed(3)}`);
  lines.push('');
  
  // Disagreement types
  lines.push('## Disagreement Types');
  lines.push('Type,Count');
  lines.push(`Assignment Count Mismatch,${report.disagreementsByType.assignment_count}`);
  lines.push(`Partial Overlap,${report.disagreementsByType.partial_overlap}`);
  lines.push(`No Overlap,${report.disagreementsByType.no_overlap}`);
  lines.push('');
  
  // Full coding matrix
  lines.push('## Full Coding Matrix');
  lines.push('Transcript ID,Line Number,Utterance Text,Run A GDUs,Run B GDUs,Mapped Run A GDUs,Agreement Status,Disagreement Type');
  
  report.detailedCodingMatrix.forEach(item => {
    const row = [
      item.transcriptId,
      item.lineNumber,
      `"${item.utteranceText.replace(/"/g, '""')}"`, // Escape quotes in CSV
      `"${item.runAGdus.join('; ')}"`,
      `"${item.runBGdus.join('; ')}"`,
      `"${item.mappedRunAGdus.filter(g => g !== null).join('; ')}"`,
      item.isDisagreement ? 'Disagreement' : 'Agreement',
      item.isDisagreement ? item.disagreementType : 'N/A'
    ];
    lines.push(row.join(','));
  });
  
  // Add contingency table if available
  if (report.contingencyTable) {
    lines.push('');
    lines.push('## Contingency Table (Cohen\'s Kappa)');
    
    // Header row with Run B categories
    const headerRow = ['Run A \\ Run B', ...report.contingencyTable.categories];
    lines.push(headerRow.join(','));
    
    // Data rows
    report.contingencyTable.categories.forEach(runACategory => {
      const row = [runACategory];
      report.contingencyTable.categories.forEach(runBCategory => {
        const count = report.contingencyTable!.matrix.get(runACategory)?.get(runBCategory) || 0;
        row.push(count.toString());
      });
      lines.push(row.join(','));
    });
  }
  
  return lines.join('\n');
}

/**
 * Converts disagreement report to Markdown format for download
 */
export function disagreementReportToMarkdown(report: DisagreementReport): string {
  const lines: string[] = [];
  
  lines.push('# Inter-Rater Reliability Full Coding Matrix Report');
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Utterances | ${report.summary.totalUtterances} |`);
  lines.push(`| Disagreements | ${report.summary.disagreements} |`);
  lines.push(`| Agreement Rate | ${(report.summary.agreementRate * 100).toFixed(1)}% |`);
  lines.push('');
  lines.push('## Reliability Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Krippendorff's Alpha (α) | ${report.summary.krippendorffsAlpha.toFixed(3)} |`);
  lines.push(`| α Observed Disagreement | ${report.summary.observedDisagreement.toFixed(3)} |`);
  lines.push(`| α Expected Disagreement | ${report.summary.expectedDisagreement.toFixed(3)} |`);
  lines.push(`| Cohen's Kappa (κ) | ${report.summary.cohensKappa.toFixed(3)} |`);
  lines.push(`| κ Observed Agreement | ${report.summary.kappaObservedAgreement.toFixed(3)} |`);
  lines.push(`| κ Expected Agreement | ${report.summary.kappaExpectedAgreement.toFixed(3)} |`);
  lines.push('');
  
  // Disagreement types
  lines.push('## Disagreement Types');
  lines.push('');
  lines.push('| Type | Count | Description |');
  lines.push('|------|-------|-------------|');
  lines.push(`| Assignment Count Mismatch | ${report.disagreementsByType.assignment_count} | Different numbers of GDU assignments |`);
  lines.push(`| Partial Overlap | ${report.disagreementsByType.partial_overlap} | Some matching categories, some different |`);
  lines.push(`| No Overlap | ${report.disagreementsByType.no_overlap} | Completely different categories |`);
  lines.push('');
  
  // GDU Mapping
  lines.push('## GDU Mapping Used');
  lines.push('');
  lines.push('| Run A GDU | Run B GDU |');
  lines.push('|-----------|-----------|');
  if (report.gduMappingUsed && typeof report.gduMappingUsed === 'object') {
    Object.entries(report.gduMappingUsed).forEach(([runA, runB]) => {
      lines.push(`| ${runA} | ${runB || 'No match'} |`);
    });
  }
  lines.push('');
  
  // Full coding matrix
  if (report.detailedCodingMatrix.length > 0) {
    lines.push('## Full Coding Matrix');
    lines.push('');
    lines.push('| Transcript | Line | Utterance | Run A GDUs | Run B GDUs | Mapped Run A | Agreement | Type |');
    lines.push('|------------|------|-----------|------------|------------|--------------|-----------|------|');
    
    report.detailedCodingMatrix.slice(0, 200).forEach(item => { // Increased limit for full matrix
      const utterancePreview = item.utteranceText.length > 50 
        ? item.utteranceText.substring(0, 50) + '...' 
        : item.utteranceText;
      
      lines.push(`| ${item.transcriptId} | ${item.lineNumber} | ${utterancePreview} | ${item.runAGdus.join(', ')} | ${item.runBGdus.join(', ')} | ${item.mappedRunAGdus.filter(g => g !== null).join(', ')} | ${item.isDisagreement ? 'Disagree' : 'Agree'} | ${item.isDisagreement ? item.disagreementType : 'N/A'} |`);
    });
    
    if (report.detailedCodingMatrix.length > 200) {
      lines.push('');
      lines.push(`*Note: Showing first 200 utterances out of ${report.detailedCodingMatrix.length} total.*`);
    }
    
    // Add disagreements-only section for convenience
    const disagreements = report.detailedCodingMatrix.filter(item => item.isDisagreement);
    if (disagreements.length > 0) {
      lines.push('');
      lines.push('## Disagreements Only');
      lines.push('');
      lines.push(`Total disagreements: ${disagreements.length}`);
      lines.push('');
      lines.push('| Transcript | Line | Utterance | Run A GDUs | Run B GDUs | Type |');
      lines.push('|------------|------|-----------|------------|------------|------|');
      
      disagreements.slice(0, 50).forEach(item => {
        const utterancePreview = item.utteranceText.length > 50 
          ? item.utteranceText.substring(0, 50) + '...' 
          : item.utteranceText;
        
        lines.push(`| ${item.transcriptId} | ${item.lineNumber} | ${utterancePreview} | ${item.runAGdus.join(', ')} | ${item.runBGdus.join(', ')} | ${item.disagreementType} |`);
      });
      
      if (disagreements.length > 50) {
        lines.push('');
        lines.push(`*Note: Showing first 50 disagreements out of ${disagreements.length} total.*`);
      }
    }
  }
  
  // Add contingency table if available
  if (report.contingencyTable && report.contingencyTable.categories.length > 0) {
    lines.push('');
    lines.push('## Contingency Table (Cohen\'s Kappa)');
    lines.push('');
    
    // Create header row
    const headers = ['Run A \\ Run B', ...report.contingencyTable.categories];
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('|' + headers.map(() => '---').join('|') + '|');
    
    // Create data rows
    report.contingencyTable.categories.forEach(runACategory => {
      const cells = [runACategory];
      report.contingencyTable.categories.forEach(runBCategory => {
        const count = report.contingencyTable!.matrix.get(runACategory)?.get(runBCategory) || 0;
        cells.push(count.toString());
      });
      lines.push('| ' + cells.join(' | ') + ' |');
    });
    
    lines.push('');
    
    // Add row and column totals for context
    lines.push('### Marginal Totals');
    lines.push('');
    lines.push('| Category | Run A Total | Run B Total |');
    lines.push('|----------|-------------|-------------|');
    
    let grandTotal = 0;
    report.contingencyTable.categories.forEach(category => {
      let runATotal = 0;
      let runBTotal = 0;
      
      // Run A total (sum of row)
      report.contingencyTable.categories.forEach(runBCat => {
        runATotal += report.contingencyTable!.matrix.get(category)?.get(runBCat) || 0;
      });
      
      // Run B total (sum of column) 
      report.contingencyTable.categories.forEach(runACat => {
        runBTotal += report.contingencyTable!.matrix.get(runACat)?.get(category) || 0;
      });
      
      grandTotal += runATotal;
      lines.push(`| ${category} | ${runATotal} | ${runBTotal} |`);
    });
    
    lines.push(`| **Total** | ${grandTotal} | ${grandTotal} |`);
    lines.push('');
  }
  
  return lines.join('\n');
}