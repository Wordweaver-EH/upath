# Comprehensive TDD Plan for P2S.4 - Part 2 Summary Table

## Executive Summary

P2S.4 is a table component that consolidates all synchronic analysis outputs (P2S.1, P2S.2, P2S.3) across all Diachronic Units (DUs) into a unified 4-column view with merged cells. All data is fully visible without any user interaction required - no expandable rows or collapsible sections. This plan follows strict TDD principles with a focus on static rendering, proper HTML table structure with rowSpan attributes, and performance optimization through virtual scrolling.

## Table of Contents

1. [Critical Design Decisions](#critical-design-decisions)
2. [Implementation Phases](#implementation-phases)
3. [Phase 1: Data Structure & Transformation Layer](#phase-1-data-structure--transformation-layer)
4. [Phase 2: Component Architecture](#phase-2-component-architecture)
5. [Phase 3: Network Diagram Integration](#phase-3-network-diagram-integration)
6. [Phase 4: Export Functionality](#phase-4-export-functionality)
7. [Phase 5: Integration & Performance](#phase-5-integration--performance)
8. [Error Handling & Edge Cases](#error-handling--edge-cases)
9. [Accessibility & UX Tests](#accessibility--ux-tests)
10. [Implementation Order & Timeline](#implementation-order--timeline)
11. [Key Success Metrics](#key-success-metrics)
12. [Risk Mitigation Strategies](#risk-mitigation-strategies)

## Critical Design Decisions

### 1. Performance-First Architecture
- **Virtualization**: Use `react-window` for efficient rendering of large datasets
- **Lazy Loading**: Mermaid diagrams render only when visible (IntersectionObserver)
- **Static Rendering**: No expansion state, all data visible at once
- **Data Transformation Layer**: Pure functions to generate flattened rows with rowSpan metadata

### 2. Export Strategy
- **CSV/Excel**: Use existing utilities with hierarchical flattening
- **PDF**: Use `react-to-pdf` library for simplicity
- **Markdown**: Custom serialization with Mermaid code blocks

### 3. State Management
- **No Expansion State**: All data visible, no state needed for expand/collapse
- **Memoization**: Heavy use of `useMemo` for row generation
- **Performance**: Virtual scrolling with calculated row heights

## Implementation Phases

### Phase 1: Data Structure & Transformation Layer

#### Step 1.1: Define TypeScript Interfaces

```typescript
// File: src/types/p2s4Types.ts

export interface P2S4Utterance {
  id: string;
  segmentId: string;
  text: string;
  speaker: 'P' | 'I';
  timestamp?: string;
  temporalCues?: string[];
}

export interface P2S4ISUTheme {
  id: string;
  unitName: string;
  level: number;
  hierarchyPath: string[]; // ["parent", "child", "grandchild"]
  abstractionOp: string;
  intensionalDefinition: string;
  utterances: P2S4Utterance[];
  childUnits: string[]; // IDs of child ISUs
}

export interface P2S4DURecord {
  id: string;
  name: string;
  segmentCount: number;
  temporalSpan: string;
  phase: string;
  phaseColor: {
    bg: string;
    text: string;
    border: string;
  };
  isuThemes: Map<string, P2S4ISUTheme>; // keyed by ISU ID for fast lookup
  networkDiagram: {
    mermaidSyntax: string;
    nodeCount: number;
    linkCount: number;
  };
}

export interface P2S4SummaryData {
  transcriptId: string;
  duRecords: P2S4DURecord[];
  totalDUs: number;
  totalISUs: number;
  totalUtterances: number;
}

// Row structure for table rendering
export interface P2S4TableRow {
  id: string;
  duId: string;
  duDisplay?: {  // Only populated on first row of DU
    name: string;
    segmentCount: number;
    temporalSpan: string;
    phase: string;
    phaseColor: PhaseColor;
    rowSpan: number;  // Number of rows this DU spans
  };
  isuId: string;
  isuDisplay?: {  // Only populated on first row of ISU
    unitName: string;
    level: number;
    isChild: boolean;
    abstractionOp: string;
    intensionalDefinition: string;
    utteranceCount: number;
    rowSpan: number;  // Number of rows this ISU spans
  };
  utterance: {
    id: string;
    text: string;
    speaker: 'P' | 'I';
    segmentId: string;
    timestamp?: string;
  };
  networkDiagram?: {  // Only populated on first row of DU
    mermaidSyntax: string;
    nodeCount: number;
    linkCount: number;
    rowSpan: number;  // Same as duDisplay.rowSpan
  };
}
```

#### Step 1.2: Data Transformer Tests (RED Phase)

```typescript
// File: src/utils/__tests__/p2s4DataTransformer.test.ts

import { transformP2SDataToSummary } from '../p2s4DataTransformer';
import { P2SDuData } from '../../../types';

describe('p2s4DataTransformer', () => {
  // Test 1: Empty data
  it('should return empty structure when no DU outputs exist', () => {
    const result = transformP2SDataToSummary('transcript1', new Map());
    expect(result).toEqual({
      transcriptId: 'transcript1',
      duRecords: [],
      totalDUs: 0,
      totalISUs: 0,
      totalUtterances: 0
    });
  });

  // Test 2: Single DU with complete data
  it('should transform a single DU with all P2S outputs', () => {
    const mockP2SOutputs = createMockP2SOutputsForDU('du_1');
    const result = transformP2SDataToSummary('transcript1', mockP2SOutputs);
    
    expect(result.duRecords).toHaveLength(1);
    expect(result.duRecords[0].id).toBe('du_1');
    expect(result.duRecords[0].isuThemes.size).toBeGreaterThan(0);
    expect(result.totalDUs).toBe(1);
  });

  // Test 3: Missing data handling
  it('should handle DU with missing P2S.2 output gracefully', () => {
    const mockOutputs = createMockP2SOutputsWithMissingData('du_1');
    const result = transformP2SDataToSummary('transcript1', mockOutputs);
    
    expect(result.duRecords[0].isuThemes.size).toBe(0);
    expect(result.duRecords[0].networkDiagram.mermaidSyntax).toBe('');
  });

  // Test 4: ISU hierarchy building
  it('should correctly build ISU parent-child relationships', () => {
    const mockOutputs = createMockP2SOutputsWithHierarchy('du_1');
    const result = transformP2SDataToSummary('transcript1', mockOutputs);
    
    const parentISU = result.duRecords[0].isuThemes.get('isu_parent');
    expect(parentISU?.childUnits).toContain('isu_child');
    expect(parentISU?.level).toBe(1);
    
    const childISU = result.duRecords[0].isuThemes.get('isu_child');
    expect(childISU?.level).toBe(2);
    expect(childISU?.hierarchyPath).toEqual(['isu_parent', 'isu_child']);
  });

  // Test 5: Performance with large dataset
  it('should transform 100 DUs within acceptable time', () => {
    const largeMockOutputs = createLargeMockDataset(100);
    const startTime = performance.now();
    
    const result = transformP2SDataToSummary('transcript1', largeMockOutputs);
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100); // 100ms max
    expect(result.totalDUs).toBe(100);
  });

  // Test 6: Correct utterance aggregation
  it('should aggregate utterances from P2S.1 segments correctly', () => {
    const mockOutputs = createMockP2SOutputsWithUtterances('du_1');
    const result = transformP2SDataToSummary('transcript1', mockOutputs);
    
    const firstISU = Array.from(result.duRecords[0].isuThemes.values())[0];
    expect(firstISU.utterances).toHaveLength(3);
    expect(firstISU.utterances[0].speaker).toBe('P');
    expect(firstISU.utterances[0].text).toContain('test utterance');
  });

  // Test 7: Phase color mapping
  it('should map DU phases to correct color schemes', () => {
    const mockOutputs = createMockP2SOutputsWithPhases();
    const result = transformP2SDataToSummary('transcript1', mockOutputs);
    
    const initialStateDU = result.duRecords.find(du => du.phase === 'Initial State');
    expect(initialStateDU?.phaseColor.bg).toContain('blue');
    
    const coreExpDU = result.duRecords.find(du => du.phase === 'Core Experience');
    expect(coreExpDU?.phaseColor.bg).toContain('green');
  });
});

// Additional tests for row generation
describe('p2s4RowGenerator', () => {
  // Test 1: Generate correct row structure
  it('should generate table rows with proper rowSpan values', () => {
    const summaryData = createMockP2S4SummaryData();
    const rows = generateTableRows(summaryData);
    
    // First row should have DU display data
    expect(rows[0].duDisplay).toBeDefined();
    expect(rows[0].duDisplay?.rowSpan).toBeGreaterThan(0);
    expect(rows[0].networkDiagram).toBeDefined();
    expect(rows[0].networkDiagram?.rowSpan).toBe(rows[0].duDisplay?.rowSpan);
  });

  // Test 2: ISU rowSpan calculation
  it('should calculate ISU rowSpan based on utterance count', () => {
    const summaryData = createMockP2S4SummaryData();
    const rows = generateTableRows(summaryData);
    
    const isuRows = rows.filter(r => r.isuDisplay);
    isuRows.forEach(row => {
      expect(row.isuDisplay?.rowSpan).toBe(row.isuDisplay?.utteranceCount || 1);
    });
  });

  // Test 3: Empty ISU handling
  it('should create placeholder row for ISUs with no utterances', () => {
    const summaryData = createMockDataWithEmptyISU();
    const rows = generateTableRows(summaryData);
    
    const emptyISURow = rows.find(r => r.utterance.text === 'No utterances');
    expect(emptyISURow).toBeDefined();
    expect(emptyISURow?.isuDisplay?.rowSpan).toBe(1);
  });

  // Test 4: Hierarchical ISU ordering
  it('should maintain ISU hierarchy in row order', () => {
    const summaryData = createMockDataWithHierarchy();
    const rows = generateTableRows(summaryData);
    
    const isuRows = rows.filter(r => r.isuDisplay);
    const level1Index = isuRows.findIndex(r => r.isuDisplay?.level === 1);
    const level2Index = isuRows.findIndex(r => r.isuDisplay?.level === 2);
    
    expect(level1Index).toBeLessThan(level2Index);
  });
});
```

#### Step 1.3: Data Transformer Implementation (GREEN Phase)

```typescript
// File: src/utils/p2s4DataTransformer.ts

import { 
  P2SDuData, 
  P2S_1_Output, 
  P2S_2_Output, 
  P2S_3_Output 
} from '../../types';
import { 
  P2S4SummaryData, 
  P2S4DURecord, 
  P2S4ISUTheme, 
  P2S4Utterance 
} from '../types/p2s4Types';
import { PHASE_COLORS } from '../constants';

export function transformP2SDataToSummary(
  transcriptId: string,
  p2sOutputsByDU: Map<string, P2SDuData>
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
    const duRecord = transformSingleDU(duId, duData);
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

function transformSingleDU(duId: string, duData: P2SDuData): P2S4DURecord {
  const p2s1 = duData.p2s_1_output;
  const p2s2 = duData.p2s_2_output;
  const p2s3 = duData.p2s_3_output;

  // Extract DU metadata
  const duName = p2s1?.analyzed_du_id || duId;
  const segmentCount = p2s1?.synchronic_thematic_groups
    .reduce((sum, group) => sum + group.segments.length, 0) || 0;

  // Determine phase and colors
  const phase = determinePhase(duName);
  const phaseColor = PHASE_COLORS[phase] || PHASE_COLORS['Core Experience'];

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
    temporalSpan: extractTemporalSpan(p2s1),
    phase,
    phaseColor,
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

  unit.segments?.forEach((segment: any, index: number) => {
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

function determinePhase(duName: string): string {
  if (duName.toLowerCase().includes('initial')) return 'Initial State';
  if (duName.toLowerCase().includes('core')) return 'Core Experience';
  if (duName.toLowerCase().includes('final')) return 'Final Action';
  if (duName.toLowerCase().includes('reflection')) return 'Post-Hoc Reflection';
  return 'Core Experience';
}

function extractTemporalSpan(p2s1?: P2S_1_Output): string {
  if (!p2s1) return 'N/A';
  
  // Extract timestamps from segments
  const timestamps: number[] = [];
  p2s1.synchronic_thematic_groups.forEach(group => {
    group.segments.forEach(segment => {
      if (segment.original_utterance?.timestamp) {
        timestamps.push(parseInt(segment.original_utterance.timestamp));
      }
    });
  });

  if (timestamps.length === 0) return 'N/A';

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return `${min}ms - ${max}ms`;
}

function determineSegmentSpeaker(segment: any): 'P' | 'I' {
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
            temporalSpan: du.temporalSpan,
            phase: du.phase,
            phaseColor: du.phaseColor,
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
              temporalSpan: du.temporalSpan,
              phase: du.phase,
              phaseColor: du.phaseColor,
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
```

### Phase 2: Component Architecture

#### Step 2.1: Table Row Rendering Tests (RED Phase)

```typescript
// File: src/components/p2s4/__tests__/Part2SummaryTableRow.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Part2SummaryTableRow } from '../Part2SummaryTableRow';
import { createMockTableRow } from '../../../test-utils/mockData';

describe('Part2SummaryTableRow', () => {
  it('renders DU cell with rowSpan when duDisplay is present', () => {
    const mockRow = createMockTableRow({ includeduDisplay: true });
    const { container } = render(
      <table>
        <tbody>
          <Part2SummaryTableRow row={mockRow} />
        </tbody>
      </table>
    );
    
    const duCell = container.querySelector('td[data-testid="du-cell"]');
    expect(duCell).toHaveAttribute('rowSpan', mockRow.duDisplay.rowSpan.toString());
    expect(screen.getByText(mockRow.duDisplay.name)).toBeInTheDocument();
  });

  it('does not render DU cell when duDisplay is absent', () => {
    const mockRow = createMockTableRow({ includeduDisplay: false });
    const { container } = render(
      <table>
        <tbody>
          <Part2SummaryTableRow row={mockRow} />
        </tbody>
      </table>
    );
    
    const duCell = container.querySelector('td[data-testid="du-cell"]');
    expect(duCell).not.toBeInTheDocument();
  });

  it('renders ISU cell with rowSpan when isuDisplay is present', () => {
    const mockRow = createMockTableRow({ includeisuDisplay: true });
    const { container } = render(
      <table>
        <tbody>
          <Part2SummaryTableRow row={mockRow} />
        </tbody>
      </table>
    );
    
    const isuCell = container.querySelector('td[data-testid="isu-cell"]');
    expect(isuCell).toHaveAttribute('rowSpan', mockRow.isuDisplay.rowSpan.toString());
    expect(screen.getByText(mockRow.isuDisplay.unitName)).toBeInTheDocument();
  });

  it('applies phase-based color styling to DU cell', () => {
    const mockRow = createMockTableRow({ includeduDisplay: true });
    const { container } = render(
      <table>
        <tbody>
          <Part2SummaryTableRow row={mockRow} />
        </tbody>
      </table>
    );
    
    const duCell = container.querySelector('td[data-testid="du-cell"]');
    expect(duCell).toHaveClass(mockRow.duDisplay.phaseColor.bg);
  });

  it('shows indentation for child ISUs', () => {
    const mockRow = createMockTableRow({ 
      includeisuDisplay: true,
      isuLevel: 2 
    });
    const { container } = render(
      <table>
        <tbody>
          <Part2SummaryTableRow row={mockRow} />
        </tbody>
      </table>
    );
    
    expect(screen.getByText('└─')).toBeInTheDocument();
  });
});
```


#### Step 2.2: Main Table Component Tests (RED Phase)

```typescript
// File: src/components/p2s4/__tests__/Part2SummaryTable.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Part2SummaryTable } from '../Part2SummaryTable';
import { createMockP2S4SummaryData, createLargeMockSummaryData } from '../../../test-utils/mockData';

describe('Part2SummaryTable', () => {
  const mockSummaryData = createMockP2S4SummaryData();

  it('renders table headers correctly', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    expect(screen.getByText('Diachronic Unit')).toBeInTheDocument();
    expect(screen.getByText('ISU Themes')).toBeInTheDocument();
    expect(screen.getByText('Utterances')).toBeInTheDocument();
    expect(screen.getByText('Network Diagram')).toBeInTheDocument();
  });

  it('renders all data visible without any interaction', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // All DUs should be visible
    mockSummaryData.duRecords.forEach(du => {
      expect(screen.getByText(du.name)).toBeInTheDocument();
    });
    
    // All ISU themes should be visible
    mockSummaryData.duRecords.forEach(du => {
      Array.from(du.isuThemes.values()).forEach(isu => {
        expect(screen.getByText(isu.unitName)).toBeInTheDocument();
      });
    });
    
    // All utterances should be visible
    mockSummaryData.duRecords.forEach(du => {
      Array.from(du.isuThemes.values()).forEach(isu => {
        isu.utterances.forEach(utterance => {
          expect(screen.getByText(utterance.text)).toBeInTheDocument();
        });
      });
    });
  });

  it('generates correct number of table rows', () => {
    const rows = generateTableRows(mockSummaryData);
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    const tableRows = screen.getAllByRole('row');
    // +1 for header row
    expect(tableRows).toHaveLength(rows.length + 1);
  });

  it('applies rowSpan attributes correctly', () => {
    const { container } = render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // Check DU cells have correct rowSpan
    const duCells = container.querySelectorAll('td[data-testid="du-cell"]');
    duCells.forEach(cell => {
      expect(cell).toHaveAttribute('rowSpan');
      expect(parseInt(cell.getAttribute('rowSpan')!)).toBeGreaterThan(0);
    });
    
    // Check ISU cells have correct rowSpan
    const isuCells = container.querySelectorAll('td[data-testid="isu-cell"]');
    isuCells.forEach(cell => {
      expect(cell).toHaveAttribute('rowSpan');
      expect(parseInt(cell.getAttribute('rowSpan')!)).toBeGreaterThan(0);
    });
  });

  it('maintains proper cell alignment across rows', () => {
    const { container } = render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      // Each row should have between 1 and 4 cells depending on rowSpans
      expect(cells.length).toBeGreaterThanOrEqual(1);
      expect(cells.length).toBeLessThanOrEqual(4);
    });
  });

  it('virtualizes rows for performance', () => {
    const largeData = createLargeMockSummaryData(100); // 100 DUs
    render(<Part2SummaryTable data={largeData} theme="light" />);
    
    // Should not render all rows in DOM
    const visibleRows = screen.getAllByTestId(/^du-row-/);
    expect(visibleRows.length).toBeLessThan(100);
  });

  it('displays summary statistics', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    expect(screen.getByText(`Total DUs: ${mockSummaryData.totalDUs}`)).toBeInTheDocument();
    expect(screen.getByText(`Total ISUs: ${mockSummaryData.totalISUs}`)).toBeInTheDocument();
    expect(screen.getByText(`Total Utterances: ${mockSummaryData.totalUtterances}`)).toBeInTheDocument();
  });

  it('provides filtering by hierarchy level', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // Select "Show only Level 1 ISUs"
    fireEvent.change(screen.getByLabelText('Filter by ISU Level'), { target: { value: '1' } });
    
    // Should only see Level 1 ISUs
    const level1ISUs = Array.from(mockSummaryData.duRecords[0].isuThemes.values())
      .filter(isu => isu.level === 1);
    
    level1ISUs.forEach(isu => {
      expect(screen.getByText(isu.unitName)).toBeInTheDocument();
    });
    
    const level2ISUs = Array.from(mockSummaryData.duRecords[0].isuThemes.values())
      .filter(isu => isu.level === 2);
    
    level2ISUs.forEach(isu => {
      expect(screen.queryByText(isu.unitName)).not.toBeInTheDocument();
    });
  });

  it('provides search functionality for utterances', async () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search utterances...');
    await userEvent.type(searchInput, 'specific keyword');
    
    // Should highlight matching utterances
    await waitFor(() => {
      const highlights = screen.getAllByMark('specific keyword');
      expect(highlights.length).toBeGreaterThan(0);
    });
  });
});
```

### Phase 3: Network Diagram Integration

#### Step 3.1: Lazy Mermaid Component Tests

```typescript
// File: src/components/p2s4/__tests__/P2S4NetworkDiagram.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { P2S4NetworkDiagram } from '../P2S4NetworkDiagram';
import { mockIntersectionObserver, triggerIntersection } from '../../../test-utils/mockIntersectionObserver';

describe('P2S4NetworkDiagram', () => {
  beforeEach(() => {
    mockIntersectionObserver();
  });

  it('does not render diagram initially', () => {
    render(<P2S4NetworkDiagram mermaidSyntax="graph TD; A-->B;" duId="du_1" />);
    
    expect(screen.queryByTestId('mermaid-diagram')).not.toBeInTheDocument();
    expect(screen.getByText('Loading diagram...')).toBeInTheDocument();
  });

  it('renders diagram when in viewport', async () => {
    render(<P2S4NetworkDiagram mermaidSyntax="graph TD; A-->B;" duId="du_1" />);
    
    // Trigger intersection observer
    triggerIntersection(true);
    
    await waitFor(() => {
      expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
    });
  });

  it('shows placeholder for empty mermaid syntax', () => {
    render(<P2S4NetworkDiagram mermaidSyntax="" duId="du_1" />);
    
    expect(screen.getByText('No network diagram available')).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    render(<P2S4NetworkDiagram mermaidSyntax="graph TD; A-->B;" duId="du_1" />);
    
    triggerIntersection(true);
    await waitFor(() => screen.getByTestId('mermaid-diagram'));
    
    fireEvent.click(screen.getByTestId('mermaid-diagram'));
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Network Diagram - du_1')).toBeInTheDocument();
  });

  it('provides zoom controls in modal', async () => {
    render(<P2S4NetworkDiagram mermaidSyntax="graph TD; A-->B;" duId="du_1" />);
    
    triggerIntersection(true);
    await waitFor(() => screen.getByTestId('mermaid-diagram'));
    
    fireEvent.click(screen.getByTestId('mermaid-diagram'));
    
    expect(screen.getByLabelText('Zoom In')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom Out')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset Zoom')).toBeInTheDocument();
  });

  it('allows export as PNG', async () => {
    render(<P2S4NetworkDiagram mermaidSyntax="graph TD; A-->B;" duId="du_1" />);
    
    triggerIntersection(true);
    await waitFor(() => screen.getByTestId('mermaid-diagram'));
    
    fireEvent.click(screen.getByTestId('mermaid-diagram'));
    
    const exportButton = screen.getByText('Export as PNG');
    fireEvent.click(exportButton);
    
    // Mock implementation would trigger download
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles mermaid rendering errors gracefully', async () => {
    render(<P2S4NetworkDiagram mermaidSyntax="invalid syntax!!!" duId="du_1" />);
    
    triggerIntersection(true);
    
    await waitFor(() => {
      expect(screen.getByText('Diagram unavailable')).toBeInTheDocument();
    });
  });
});
```

### Phase 4: Export Functionality

#### Step 4.1: Export Tests

```typescript
// File: src/utils/__tests__/p2s4Exporter.test.ts

import { 
  exportP2S4ToCSV, 
  exportP2S4ToMarkdown, 
  exportP2S4ToPDF 
} from '../p2s4Exporter';
import { createMockP2S4SummaryData } from '../../../test-utils/mockData';

describe('P2S4 Export Functions', () => {
  const mockSummaryData = createMockP2S4SummaryData();

  describe('CSV Export', () => {
    it('generates correct CSV headers', () => {
      const csv = exportP2S4ToCSV(mockSummaryData);
      const headers = csv.split('\n')[0];
      
      expect(headers).toBe('DU ID,DU Name,ISU Level,ISU Name,ISU Definition,Utterance ID,Utterance Text,Speaker');
    });

    it('flattens hierarchical data correctly', () => {
      const csv = exportP2S4ToCSV(mockSummaryData);
      const lines = csv.split('\n').slice(1); // Skip header
      
      // Each utterance should have its own row with full context
      expect(lines.length).toBe(mockSummaryData.totalUtterances);
    });

    it('handles empty ISUs correctly', () => {
      const dataWithEmptyISU = {
        ...mockSummaryData,
        duRecords: [{
          ...mockSummaryData.duRecords[0],
          isuThemes: new Map([
            ['empty_isu', {
              id: 'empty_isu',
              unitName: 'Empty ISU',
              level: 1,
              hierarchyPath: ['Empty ISU'],
              abstractionOp: 'none',
              intensionalDefinition: 'No utterances',
              utterances: [],
              childUnits: []
            }]
          ])
        }]
      };
      
      const csv = exportP2S4ToCSV(dataWithEmptyISU);
      expect(csv).toContain('Empty ISU');
      expect(csv).toContain('No utterances,,'); // Empty utterance fields
    });

    it('escapes special characters properly', () => {
      const dataWithSpecialChars = createMockDataWithSpecialCharacters();
      const csv = exportP2S4ToCSV(dataWithSpecialChars);
      
      expect(csv).toContain('"Text with, comma"');
      expect(csv).toContain('"Text with ""quotes"""');
      expect(csv).toContain('"Text with\nnewline"');
    });

    it('preserves ISU hierarchy in output', () => {
      const csv = exportP2S4ToCSV(mockSummaryData);
      const lines = csv.split('\n').slice(1);
      
      // Parent ISUs should appear before children
      const parentIndex = lines.findIndex(line => line.includes('Parent ISU'));
      const childIndex = lines.findIndex(line => line.includes('Child ISU'));
      
      expect(parentIndex).toBeLessThan(childIndex);
    });
  });

  describe('Markdown Export', () => {
    it('generates hierarchical markdown structure', () => {
      const markdown = exportP2S4ToMarkdown(mockSummaryData);
      
      expect(markdown).toContain('# Part 2 Summary Table');
      expect(markdown).toContain('## Summary Statistics');
      expect(markdown).toContain('## DU:');
      expect(markdown).toContain('### ISU Themes');
      expect(markdown).toContain('#### Utterances');
    });

    it('includes summary statistics', () => {
      const markdown = exportP2S4ToMarkdown(mockSummaryData);
      
      expect(markdown).toContain(`- Total DUs: ${mockSummaryData.totalDUs}`);
      expect(markdown).toContain(`- Total ISUs: ${mockSummaryData.totalISUs}`);
      expect(markdown).toContain(`- Total Utterances: ${mockSummaryData.totalUtterances}`);
    });

    it('formats ISU metadata correctly', () => {
      const markdown = exportP2S4ToMarkdown(mockSummaryData);
      const firstISU = Array.from(mockSummaryData.duRecords[0].isuThemes.values())[0];
      
      expect(markdown).toContain(`**${firstISU.unitName}**`);
      expect(markdown).toContain(`- Level: ${firstISU.level}`);
      expect(markdown).toContain(`- Abstraction: ${firstISU.abstractionOp}`);
      expect(markdown).toContain(`- Definition: ${firstISU.intensionalDefinition}`);
    });

    it('includes Mermaid diagrams as code blocks', () => {
      const markdown = exportP2S4ToMarkdown(mockSummaryData);
      
      expect(markdown).toContain('```mermaid');
      expect(markdown).toContain('graph TD');
      expect(markdown).toContain('```');
    });

    it('formats utterances with speaker indicators', () => {
      const markdown = exportP2S4ToMarkdown(mockSummaryData);
      
      expect(markdown).toMatch(/- \[P\]/);
      expect(markdown).toMatch(/- \[I\]/);
    });

    it('handles nested ISU hierarchies', () => {
      const markdown = exportP2S4ToMarkdown(mockSummaryData);
      
      // Level 1 ISUs should have ###
      expect(markdown).toMatch(/### .+ \(Level 1\)/);
      
      // Level 2 ISUs should be indented
      expect(markdown).toMatch(/  - .+ \(Level 2\)/);
    });
  });

  describe('PDF Export', () => {
    beforeEach(() => {
      // Mock react-to-pdf
      jest.mock('react-to-pdf', () => ({
        usePDF: () => ({
          toPDF: jest.fn().mockResolvedValue(new Blob(['pdf content'], { type: 'application/pdf' })),
          targetRef: { current: null }
        })
      }));
    });

    it('generates PDF blob', async () => {
      const pdfBlob = await exportP2S4ToPDF(mockSummaryData);
      
      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.type).toBe('application/pdf');
      expect(pdfBlob.size).toBeGreaterThan(0);
    });

    it('uses appropriate page settings', async () => {
      const mockUsePDF = jest.fn().mockReturnValue({
        toPDF: jest.fn().mockResolvedValue(new Blob([])),
        targetRef: { current: null }
      });
      
      jest.spyOn(require('react-to-pdf'), 'usePDF').mockImplementation(mockUsePDF);
      
      await exportP2S4ToPDF(mockSummaryData);
      
      expect(mockUsePDF).toHaveBeenCalledWith(expect.objectContaining({
        filename: expect.stringContaining('P2S4_Summary'),
        page: expect.objectContaining({
          format: 'a4',
          orientation: 'landscape'
        })
      }));
    });

    it('handles large datasets by paginating', async () => {
      const largeData = createLargeMockSummaryData(100);
      const pdfBlob = await exportP2S4ToPDF(largeData);
      
      expect(pdfBlob).toBeInstanceOf(Blob);
      // Would need to parse PDF to verify pagination
    });
  });

  describe('Excel Export', () => {
    it('creates workbook with multiple sheets', () => {
      const workbook = exportP2S4ToExcel(mockSummaryData);
      
      expect(workbook.SheetNames).toContain('Summary');
      expect(workbook.SheetNames).toContain('DU Details');
      expect(workbook.SheetNames).toContain('ISU Hierarchy');
      expect(workbook.SheetNames).toContain('Utterances');
    });

    it('applies formatting to headers', () => {
      const workbook = exportP2S4ToExcel(mockSummaryData);
      const summarySheet = workbook.Sheets['Summary'];
      
      // Check header cell has bold formatting
      expect(summarySheet['A1'].s).toMatchObject({
        font: { bold: true },
        fill: { fgColor: { rgb: "4472C4" } }
      });
    });

    it('includes hyperlinks between sheets', () => {
      const workbook = exportP2S4ToExcel(mockSummaryData);
      const summarySheet = workbook.Sheets['Summary'];
      
      // DU IDs should link to details sheet
      expect(summarySheet['A2'].l).toMatchObject({
        Target: "#'DU Details'!A1"
      });
    });
  });
});
```

### Phase 5: Integration & Performance

#### Step 5.1: Integration Tests

```typescript
// File: src/components/p2s4/__tests__/P2S4Integration.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PipelineStepGrid } from '../../PipelineStepGrid';
import { StepId } from '../../../constants';
import { createMockProcessedData } from '../../../test-utils/mockData';

describe('P2S4 Pipeline Integration', () => {
  it('renders P2S4 when selected in PipelineStepGrid', () => {
    const processedData = createMockProcessedData();
    
    render(
      <PipelineStepGrid
        processedData={processedData}
        currentStepInfo={{
          stepId: StepId.P2S_4_SUMMARY_TABLE,
          transcriptId: 'transcript1',
          outputData: null
        }}
        theme="light"
      />
    );
    
    expect(screen.getByText('Part 2 Summary Table')).toBeInTheDocument();
  });

  it('aggregates data from all DUs correctly', () => {
    const processedData = createMockProcessedData();
    const transcriptData = processedData.get('transcript1')!;
    
    // Add multiple DUs with P2S outputs
    transcriptData.p2s_outputs_by_du = new Map([
      ['du_1', createMockP2SDuData('du_1')],
      ['du_2', createMockP2SDuData('du_2')],
      ['du_3', createMockP2SDuData('du_3')]
    ]);
    
    render(
      <PipelineStepGrid
        processedData={processedData}
        currentStepInfo={{
          stepId: StepId.P2S_4_SUMMARY_TABLE,
          transcriptId: 'transcript1',
          outputData: null
        }}
        theme="light"
      />
    );
    
    expect(screen.getByText('Total DUs: 3')).toBeInTheDocument();
  });

  it('updates when processedData changes', () => {
    const processedData = createMockProcessedData();
    const { rerender } = render(
      <PipelineStepGrid
        processedData={processedData}
        currentStepInfo={{
          stepId: StepId.P2S_4_SUMMARY_TABLE,
          transcriptId: 'transcript1',
          outputData: null
        }}
        theme="light"
      />
    );
    
    // Add new DU data
    const updatedData = new Map(processedData);
    updatedData.get('transcript1')!.p2s_outputs_by_du.set('du_4', createMockP2SDuData('du_4'));
    
    rerender(
      <PipelineStepGrid
        processedData={updatedData}
        currentStepInfo={{
          stepId: StepId.P2S_4_SUMMARY_TABLE,
          transcriptId: 'transcript1',
          outputData: null
        }}
        theme="light"
      />
    );
    
    expect(screen.getByText('Total DUs: 4')).toBeInTheDocument();
  });
});
```

#### Step 5.2: Performance Tests

```typescript
// File: src/components/p2s4/__tests__/Part2SummaryTable.performance.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Part2SummaryTable } from '../Part2SummaryTable';
import { createVeryLargeMockData } from '../../../test-utils/mockData';

describe('Part2SummaryTable Performance', () => {
  beforeEach(() => {
    jest.spyOn(performance, 'now');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders 1000 rows within 200ms', () => {
    const largeData = createVeryLargeMockData(1000);
    const startTime = performance.now();
    
    render(<Part2SummaryTable data={largeData} theme="light" />);
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(200);
  });

  it('row generation completes quickly', () => {
    const data = createMockP2S4SummaryData();
    
    const startTime = performance.now();
    const rows = generateTableRows(data);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(20); // Row generation should be fast
    expect(rows.length).toBeGreaterThan(0);
  });

  it('maintains 60fps during scroll', async () => {
    const largeData = createVeryLargeMockData(500);
    const { container } = render(<Part2SummaryTable data={largeData} theme="light" />);
    
    const scrollContainer = container.querySelector('.virtual-scroll-container');
    
    let frameCount = 0;
    const startTime = performance.now();
    
    // Simulate scrolling
    const scroll = () => {
      if (performance.now() - startTime < 1000) { // 1 second of scrolling
        scrollContainer!.scrollTop += 100;
        frameCount++;
        requestAnimationFrame(scroll);
      }
    };
    
    requestAnimationFrame(scroll);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should maintain at least 60fps
    expect(frameCount).toBeGreaterThanOrEqual(60);
  });

  it('handles filtering efficiently', () => {
    const data = createVeryLargeMockData(100);
    render(<Part2SummaryTable data={data} theme="light" />);
    
    const startTime = performance.now();
    
    // Apply ISU level filter
    fireEvent.change(screen.getByLabelText('Filter by ISU Level'), { 
      target: { value: '1' } 
    });
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(100); // Filtering should be responsive
  });

  it('memoizes expensive computations', () => {
    const data = createVeryLargeMockData(100);
    const computeSpy = jest.fn();
    
    // Mock the flattening function to track calls
    jest.spyOn(require('../utils/flattenData'), 'flattenP2S4Data')
      .mockImplementation((...args) => {
        computeSpy();
        return jest.requireActual('../utils/flattenData').flattenP2S4Data(...args);
      });
    
    const { rerender } = render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(computeSpy).toHaveBeenCalledTimes(1);
    
    // Re-render with same data
    rerender(<Part2SummaryTable data={data} theme="dark" />);
    
    // Should not recompute
    expect(computeSpy).toHaveBeenCalledTimes(1);
  });
});
```

## Error Handling & Edge Cases

### Tests for Error Scenarios

```typescript
// File: src/components/p2s4/__tests__/P2S4ErrorHandling.test.tsx

describe('P2S4 Error Handling', () => {
  it('displays error message when P2S data is incomplete', () => {
    const incompleteData = { ...mockSummaryData, duRecords: [] };
    render(<Part2SummaryTable data={incompleteData} theme="light" />);
    
    expect(screen.getByText('No synchronic analysis data available')).toBeInTheDocument();
  });

  it('handles malformed Mermaid syntax gracefully', () => {
    const badData = createMockDataWithBadMermaid();
    render(<Part2SummaryTable data={badData} theme="light" />);
    
    expect(screen.getByText('Diagram unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument(); // No error to user
  });

  it('recovers from export failures', async () => {
    const data = createMockP2S4SummaryData();
    const { getByText } = render(<Part2SummaryTable data={data} theme="light" />);
    
    // Mock export failure
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(window, 'Blob').mockImplementationOnce(() => {
      throw new Error('Export failed');
    });
    
    fireEvent.click(getByText('Export to PDF'));
    
    await waitFor(() => {
      expect(screen.getByText('Export failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('handles circular ISU references', () => {
    const circularData = createMockDataWithCircularISUs();
    
    expect(() => {
      render(<Part2SummaryTable data={circularData} theme="light" />);
    }).not.toThrow();
    
    // Should still render with broken hierarchy
    expect(screen.getByText('Total ISUs:')).toBeInTheDocument();
  });

  it('handles missing utterance data gracefully', () => {
    const dataWithMissingUtterances = createMockDataWithMissingUtterances();
    render(<Part2SummaryTable data={dataWithMissingUtterances} theme="light" />);
    
    // Should show "No utterances" in the utterance cell
    expect(screen.getByText('No utterances')).toBeInTheDocument();
  });
});
```

## Accessibility & UX Tests

```typescript
// File: src/components/p2s4/__tests__/P2S4Accessibility.test.tsx

import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

describe('P2S4 Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // Tab to search input
    userEvent.tab();
    expect(screen.getByPlaceholderText('Search utterances...')).toHaveFocus();
    
    // Tab to filter dropdown
    userEvent.tab();
    expect(screen.getByLabelText('Filter by ISU Level')).toHaveFocus();
    
    // Tab to export buttons
    userEvent.tab();
    expect(screen.getByText('Export to CSV')).toHaveFocus();
  });

  it('announces table structure to screen readers', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-label', 'Part 2 Synchronic Analysis Summary');
    
    // Check that cells have proper rowspan attributes
    const duCells = screen.getAllByTestId(/^du-cell-/);
    duCells.forEach(cell => {
      expect(cell).toHaveAttribute('rowspan');
      expect(cell).toHaveAttribute('aria-rowspan');
    });
  });

  it('provides meaningful aria-labels', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Part 2 Synchronic Analysis Summary');
    expect(screen.getByRole('region', { name: 'Summary Statistics' })).toBeInTheDocument();
  });

  it('supports high contrast mode', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // Check color contrast ratios
    const duRow = screen.getByTestId(`du-row-${mockSummaryData.duRecords[0].id}`);
    const styles = window.getComputedStyle(duRow);
    
    // Would need color contrast calculation library
    // expect(calculateContrast(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('provides skip links for navigation', () => {
    render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    expect(screen.getByText('Skip to summary statistics')).toBeInTheDocument();
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('maintains focus when content updates', async () => {
    const { rerender } = render(<Part2SummaryTable data={mockSummaryData} theme="light" />);
    
    // Focus on search input
    const searchInput = screen.getByPlaceholderText('Search utterances...');
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);
    
    // Update data
    const updatedData = { ...mockSummaryData, totalDUs: mockSummaryData.totalDUs + 1 };
    rerender(<Part2SummaryTable data={updatedData} theme="light" />);
    
    // Focus should remain
    expect(document.activeElement).toBe(searchInput);
  });
});
```

## Implementation Order & Timeline

### Week 1: Data Layer (Days 1-5)
- **Day 1-2**: TypeScript interfaces and data transformer tests
  - Define all interfaces in `p2s4Types.ts`
  - Write comprehensive tests for data transformation
  - Focus on edge cases and error handling

- **Day 3-4**: Data transformer implementation
  - Implement `transformP2SDataToSummary`
  - Build ISU hierarchy construction
  - Add performance optimizations

- **Day 5**: Integration tests with real P2S data
  - Test with actual pipeline outputs
  - Verify data integrity
  - Performance benchmarking

### Week 2: Core Components (Days 6-10)
- **Day 6-7**: Table row generation logic
  - Implement row generation with rowSpan calculations
  - Build table row component with merged cells
  - Add phase-based styling

- **Day 8-9**: Main table with virtualization
  - Integrate react-window
  - Implement static table rendering
  - Add memoization for performance

- **Day 10**: Filtering and search
  - Implement ISU level filtering
  - Add utterance search functionality
  - Test performance with large datasets

### Week 3: Advanced Features (Days 11-15)
- **Day 11-12**: Mermaid diagram integration
  - Implement lazy loading with IntersectionObserver
  - Add modal viewer with zoom
  - Handle rendering errors

- **Day 13-14**: Export functionality (CSV, Markdown)
  - Build export utilities
  - Test with various data sizes
  - Ensure data fidelity

- **Day 15**: PDF export with react-to-pdf
  - Implement PDF generation
  - Handle pagination for large data
  - Test cross-browser compatibility

### Week 4: Polish & Performance (Days 16-20)
- **Day 16-17**: Performance optimization
  - Profile and optimize render cycles
  - Add more aggressive memoization
  - Implement virtual scrolling tweaks

- **Day 18**: Accessibility improvements
  - Run axe-core tests
  - Add ARIA labels
  - Improve keyboard navigation

- **Day 19**: Error handling edge cases
  - Test with malformed data
  - Add user-friendly error messages
  - Implement recovery strategies

- **Day 20**: Integration with pipeline
  - Update PipelineStepGrid
  - Add to App.tsx gridSteps
  - Full end-to-end testing

## Key Success Metrics

1. **Test Coverage**: 100% coverage for critical paths
2. **Performance**: Initial render < 200ms for 100 DUs
3. **Row Generation**: < 50ms for 5000 rows (50 DUs × 100 utterances)
4. **Filtering**: Search/filter operations < 100ms
5. **Export**: Functions complete < 1s for typical data
6. **Accessibility**: Zero violations (axe-core)
7. **Memory**: Stable usage during extended use
8. **Browser Support**: Chrome, Firefox, Safari compatibility

## Risk Mitigation Strategies

### 1. Performance Risk
- **Mitigation**: Implement virtualization from day 1
- **Fallback**: Add pagination option for extremely large datasets
- **Monitoring**: Performance tests in CI pipeline

### 2. Memory Leaks
- **Mitigation**: Use WeakMap for diagram cache
- **Fallback**: Implement cache size limits
- **Monitoring**: Memory profiling in tests

### 3. Browser Compatibility
- **Mitigation**: Test in all major browsers early
- **Fallback**: Polyfills for missing features
- **Monitoring**: Cross-browser test suite

### 4. Large Dataset Handling
- **Mitigation**: Virtual scrolling and lazy loading
- **Fallback**: Server-side pagination API
- **Monitoring**: Load test with 10,000+ rows

### 5. Export Failures
- **Mitigation**: Chunked export for huge datasets
- **Fallback**: Server-side export generation
- **Monitoring**: Export size limits and warnings

## Additional Considerations

### Security
- Sanitize Mermaid syntax before rendering
- Validate export filenames
- Prevent XSS in utterance content

### Internationalization
- Prepare for i18n from the start
- Use translation keys for all UI text
- Support RTL languages in layout

### Maintenance
- Comprehensive documentation
- Unit tests for all utilities
- Integration tests for workflows
- Performance benchmarks in CI

This comprehensive TDD plan ensures robust implementation of P2S.4 with performance, accessibility, and maintainability as core priorities. Each phase builds on the previous one, with tests driving the implementation at every step.