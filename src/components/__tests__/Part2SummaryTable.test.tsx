import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Part2SummaryTable } from '../Part2SummaryTable';
import { P2S4SummaryData } from '../../types/p2s4Types';

// Mock the MermaidDiagram component
jest.mock('../../../components/MermaidDiagram', () => {
  return function MockMermaidDiagram({ content }: { content: string }) {
    return <div data-testid="mermaid-diagram">{content}</div>;
  };
});

describe('Part2SummaryTable', () => {
  const createMockSummaryData = (): P2S4SummaryData => ({
    transcriptId: 'transcript1',
    duRecords: [
      {
        id: 'du_1',
        name: 'DU-1: Initial State',
        segmentCount: 5,
        description: 'Initial awareness and orientation to the experience',
        isuThemes: new Map([
          ['isu_1', {
            id: 'isu_1',
            unitName: 'ISU-1',
            level: 1,
            hierarchyPath: ['ISU-1'],
            abstractionOp: 'generalization',
            intensionalDefinition: 'Test definition',
            utterances: [
              {
                id: 'utt_1',
                segmentId: 'seg_1',
                text: 'Test utterance',
                speaker: 'P',
                timestamp: 'T+00:00:01'
              }
            ],
            childUnits: []
          }]
        ]),
        networkDiagram: {
          mermaidSyntax: 'graph TD; A-->B;',
          nodeCount: 2,
          linkCount: 1
        }
      }
    ],
    totalDUs: 1,
    totalISUs: 1,
    totalUtterances: 1
  });

  it('should render empty state when no data', () => {
    const emptyData: P2S4SummaryData = {
      transcriptId: 'transcript1',
      duRecords: [],
      totalDUs: 0,
      totalISUs: 0,
      totalUtterances: 0
    };

    render(<Part2SummaryTable data={emptyData} theme="light" />);
    
    expect(screen.getByText(/No synchronic analysis data available/)).toBeInTheDocument();
  });

  it('should render summary statistics', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByText('Total DUs:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Total ISUs:')).toBeInTheDocument();
    expect(screen.getByText('Total Utterances:')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByText('Diachronic Unit')).toBeInTheDocument();
    expect(screen.getByText('ISU Themes')).toBeInTheDocument();
    expect(screen.getByText('Utterances')).toBeInTheDocument();
    expect(screen.getByText('Network Diagram')).toBeInTheDocument();
  });

  it('should render DU information', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByText('DU-1: Initial State')).toBeInTheDocument();
    expect(screen.getByText('Segments: 5')).toBeInTheDocument();
    expect(screen.getByText('Initial awareness and orientation to the experience')).toBeInTheDocument();
  });

  it('should render ISU information', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByText('ISU-1')).toBeInTheDocument();
    expect(screen.getByText('(Level 1)')).toBeInTheDocument();
    expect(screen.getByText('Abstraction: generalization')).toBeInTheDocument();
    expect(screen.getByText('Definition: Test definition')).toBeInTheDocument();
  });

  it('should render utterances', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByText('Test utterance')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('ID: seg_1')).toBeInTheDocument();
    expect(screen.getByText('Time: T+00:00:01')).toBeInTheDocument();
  });

  it('should render network diagram section', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
    expect(screen.getByText('Nodes: 2')).toBeInTheDocument();
    expect(screen.getByText('Links: 1')).toBeInTheDocument();
    expect(screen.getByText('Copy Mermaid Code')).toBeInTheDocument();
  });

  it('should handle copy mermaid code button click', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    // Mock clipboard API
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });
    
    const copyButton = screen.getByText('Copy Mermaid Code');
    fireEvent.click(copyButton);
    
    expect(writeTextMock).toHaveBeenCalledWith('graph TD; A-->B;');
  });

  it('should have export to PDF button', () => {
    const data = createMockSummaryData();
    render(<Part2SummaryTable data={data} theme="light" />);
    
    expect(screen.getByText('Export to PDF')).toBeInTheDocument();
  });
});