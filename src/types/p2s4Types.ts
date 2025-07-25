// P2S.4 Summary Table Types

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
  description: string; // From P1.4 DU description
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
    description: string; // From P1.4
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