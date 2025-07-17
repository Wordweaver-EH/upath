import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface TranscriptLinesTableProps {
  lines: string[];
  theme: 'light' | 'dark';
}

interface ParsedLine {
  lineNumber: string;
  speaker: string;
  text: string;
}

const parseTranscriptLine = (line: string): ParsedLine => {
  // Extract line number (format: "1: ...")
  const lineMatch = line.match(/^(\d+):\s*(.*)$/);
  if (!lineMatch) {
    return { lineNumber: '', speaker: '', text: line };
  }
  
  const [, lineNumber, rest] = lineMatch;
  
  // Check for speaker (format: "Speaker Name: ..." or "P1: ...")
  const speakerMatch = rest.match(/^([^:]+):\s*(.*)$/);
  if (speakerMatch) {
    const [, speaker, text] = speakerMatch;
    // Check if this is actually a speaker and not just a colon in the text
    // Common speaker patterns: single letters/numbers (P1, I1), full names, or roles
    if (speaker.match(/^[A-Z]\d+$/) || speaker.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/) || speaker.length < 30) {
      return { lineNumber, speaker: speaker.trim(), text: text.trim() };
    }
  }
  
  // No speaker found, treat as regular text
  return { lineNumber, speaker: '', text: rest };
};

export const TranscriptLinesTable: React.FC<TranscriptLinesTableProps> = ({ 
  lines, 
  theme 
}) => {
  const { rowData, columnDefs } = useMemo(() => {
    const parsedLines = lines.map(parseTranscriptLine);
    
    const cols: ColDef[] = [
      { 
        field: 'lineNumber', 
        headerName: 'Line',
        width: 80,
        sortable: false,
        resizable: false,
        pinned: 'left',
        cellClass: 'text-right pr-2 font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
      },
      { 
        field: 'speaker', 
        headerName: 'Speaker',
        width: 150,
        sortable: true,
        resizable: true,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return '';
          return (
            <span className="font-medium text-light-accent dark:text-dark-accent">
              {params.value}
            </span>
          );
        }
      },
      { 
        field: 'text', 
        headerName: 'Text',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        cellClass: 'py-2'
      }
    ];
    
    return { rowData: parsedLines, columnDefs: cols };
  }, [lines]);

  // Enable text selection in cells
  const enableTextSelection = `
    .ag-cell {
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }
  `;

  // Define custom styles based on theme
  const gridStyles = theme === 'dark' ? {
    '--ag-background-color': '#1a1a1a',
    '--ag-header-background-color': '#252525',
    '--ag-odd-row-background-color': '#252525',
    '--ag-foreground-color': '#e6e6e6',
    '--ag-header-foreground-color': '#e6e6e6',
    '--ag-border-color': '#444444',
    '--ag-row-hover-color': '#333333',
    '--ag-header-column-resize-handle-color': '#ff6b6b',
    '--ag-font-family': '"EB Garamond", "et-book", serif',
    '--ag-font-size': '16px',
    '--ag-row-border-style': 'solid',
    '--ag-row-border-width': '1px',
    '--ag-row-border-color': '#333333',
  } : {
    '--ag-background-color': '#faf8f1',
    '--ag-header-background-color': '#f3f1ea',
    '--ag-odd-row-background-color': '#f3f1ea',
    '--ag-foreground-color': '#222222',
    '--ag-header-foreground-color': '#222222',
    '--ag-border-color': '#dcd9d0',
    '--ag-row-hover-color': '#e9e6de',
    '--ag-header-column-resize-handle-color': '#a00000',
    '--ag-font-family': '"EB Garamond", "et-book", serif',
    '--ag-font-size': '16px',
    '--ag-row-border-style': 'solid',
    '--ag-row-border-width': '1px',
    '--ag-row-border-color': '#e0ddd4',
  };

  const handleDownloadCSV = () => {
    const columns = [
      { field: 'lineNumber', headerName: 'Line' },
      { field: 'speaker', headerName: 'Speaker' },
      { field: 'text', headerName: 'Text' }
    ];
    const csvContent = convertToCSV(rowData, columns);
    downloadCSV(csvContent, 'transcript_lines.csv');
  };

  return (
    <>
      <style>{enableTextSelection}</style>
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
          Line-Numbered Transcript (Read-only)
        </div>
        <button
          onClick={handleDownloadCSV}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>
      <div 
      className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
      style={{ 
        height: '600px', 
        width: '100%',
        ...gridStyles as React.CSSProperties
      }}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={{
          resizable: true,
          sortable: false
        }}
        animateRows={true}
        domLayout='normal'
        theme='legacy'
        rowHeight={undefined}
        getRowHeight={(params) => {
          // Dynamic row height based on content
          const textLength = params.data.text?.length || 0;
          const baseHeight = 42;
          const extraHeight = Math.floor(textLength / 100) * 20;
          return Math.min(baseHeight + extraHeight, 200);
        }}
      />
    </div>
    </>
  );
};