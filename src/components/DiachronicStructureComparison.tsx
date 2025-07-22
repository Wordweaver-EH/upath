import React, { useMemo } from 'react';
import { TranscriptProcessedData, P1_5_Output, DiachronicUnit, P1_3_Output, P1_2_Output } from '../../types';
import { NestedTooltip } from './NestedTooltip';
import { convertToCSV, downloadCSV } from '../utils/csvExport';

interface DiachronicStructureComparisonProps {
  processedData: Map<string, TranscriptProcessedData>;
  theme: 'light' | 'dark';
}

// Phase colors from P1.2
const PHASE_COLORS = {
  'Initial State': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  'Core Experience': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  'Final Action': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' },
  'Post-Hoc Reflection': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' }
};

const PHASE_ORDER = ['Initial State', 'Core Experience', 'Final Action', 'Post-Hoc Reflection'] as const;

type PhaseType = typeof PHASE_ORDER[number];

interface DUWithPhase {
  du: DiachronicUnit;
  dominantPhase: PhaseType;
  phaseDistribution: Record<PhaseType, number>;
  p15Phase?: string; // The P1.5 phase this DU belongs to
}

interface TranscriptWithDUs {
  transcriptId: string;
  filename: string;
  p15Output: P1_5_Output;
  dusByPhase: Record<PhaseType, DUWithPhase[]>;
}

// Component for DU tooltip content
const DUTooltipContent: React.FC<{ 
  du: DiachronicUnit, 
  transcriptData: TranscriptProcessedData,
  phaseDistribution: Record<PhaseType, number>
}> = ({ du, transcriptData, phaseDistribution }) => {
  // Get segments for this DU
  const p13Output = transcriptData.p1_3_output;
  const segments = p13Output?.sorted_segments.filter(seg => 
    du.source_segment_ids.includes(seg.segment_id)
  ) || [];

  return (
    <div className="p-6 max-w-md">
      <h3 className="font-semibold text-light-text dark:text-dark-text mb-2">
        {du.unit_id}
      </h3>
      
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Description:</span>
          <p className="mt-1">{du.description}</p>
        </div>

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Phase Distribution:</span>
          <div className="mt-1 space-y-1">
            {Object.entries(phaseDistribution).map(([phase, count]) => (
              count > 0 && (
                <div key={phase} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${PHASE_COLORS[phase as PhaseType].bg} ${PHASE_COLORS[phase as PhaseType].text}`}>
                    {phase}
                  </span>
                  <span className="text-xs text-light-sidenote dark:text-dark-sidenote">
                    {count} segment{count > 1 ? 's' : ''}
                  </span>
                </div>
              )
            ))}
          </div>
        </div>

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Segments ({segments.length}):</span>
          <div className="mt-1 space-y-2 max-h-60 overflow-y-auto">
            {segments.map(seg => (
              <NestedTooltip
                key={seg.segment_id}
                content={<SegmentTooltipContent segment={seg} />}
                depth={1}
              >
                <div className="cursor-pointer hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt p-2 rounded transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-light-accent dark:text-dark-accent">
                      {seg.segment_id}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${PHASE_COLORS[seg.coarse_phase as PhaseType].bg} ${PHASE_COLORS[seg.coarse_phase as PhaseType].text}`}>
                      {seg.coarse_phase}
                    </span>
                  </div>
                  <div className="text-xs text-light-sidenote dark:text-dark-sidenote line-clamp-2 mt-1">
                    {seg.segment_text}
                  </div>
                </div>
              </NestedTooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component for segment tooltip content
const SegmentTooltipContent: React.FC<{ segment: any }> = ({ segment }) => {
  return (
    <div className="p-6 max-w-md">
      <h3 className="font-semibold text-light-text dark:text-dark-text mb-2">
        {segment.segment_id}
      </h3>
      
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Full Text:</span>
          <p className="mt-1">{segment.segment_text}</p>
        </div>

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Phase:</span>
          <span className={`ml-2 px-2 py-0.5 rounded text-xs ${PHASE_COLORS[segment.coarse_phase as PhaseType].bg} ${PHASE_COLORS[segment.coarse_phase as PhaseType].text}`}>
            {segment.coarse_phase}
          </span>
        </div>

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Chronological Index:</span>
          <span className="ml-2">{segment.chronological_index}</span>
        </div>

        {segment.placement_justification && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Justification:</span>
            <p className="mt-1 italic text-xs">{segment.placement_justification}</p>
          </div>
        )}

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Original Utterance:</span>
          <div className="mt-1 p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded">
            <div className="text-xs">
              <span className="font-medium">Line {segment.original_utterance.original_line_num}:</span>
              <p className="mt-1 italic">"{segment.original_utterance.utterance_text}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// DU Card Component
const DUCard: React.FC<{
  du: DUWithPhase;
  transcriptData: TranscriptProcessedData;
  p15PhaseName?: string;
  theme: 'light' | 'dark';
}> = ({ du, transcriptData, p15PhaseName, theme }) => {
  const colors = PHASE_COLORS[du.dominantPhase];
  const isPure = du.phaseDistribution[du.dominantPhase] === du.du.source_segment_ids.length;

  return (
    <NestedTooltip
      content={<DUTooltipContent du={du.du} transcriptData={transcriptData} phaseDistribution={du.phaseDistribution} />}
    >
      <div className={`p-3 rounded-lg border ${colors.border} ${colors.bg} ${colors.bg.includes('100') ? 'bg-opacity-50' : 'bg-opacity-20'} cursor-pointer hover:shadow-md transition-all`}>
        <div className="flex items-start justify-between mb-1">
          <span className="font-mono text-xs font-semibold">{du.du.unit_id}</span>
          {!isPure && (
            <span className="text-xs text-light-sidenote dark:text-dark-sidenote" title="Mixed phase content">
              ⚡
            </span>
          )}
        </div>
        <p className="text-xs line-clamp-2 mb-2">{du.du.description}</p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-light-sidenote dark:text-dark-sidenote">
            {du.du.source_segment_ids.length} segments
          </span>
          {p15PhaseName && (
            <span className="text-xs italic text-light-sidenote dark:text-dark-sidenote">
              P1.5: {p15PhaseName}
            </span>
          )}
        </div>
      </div>
    </NestedTooltip>
  );
};

export const DiachronicStructureComparison: React.FC<DiachronicStructureComparisonProps> = ({
  processedData,
  theme
}) => {
  // Process all transcripts with P1.5 output
  const processedTranscripts = useMemo(() => {
    const transcripts: TranscriptWithDUs[] = [];

    processedData.forEach((transcript, transcriptId) => {
      if (!transcript.p1_5_output || !transcript.p1_4_output || !transcript.p1_3_output) return;

      const p15Output = transcript.p1_5_output;
      const p14Output = transcript.p1_4_output;
      const p13Output = transcript.p1_3_output;

      // Create a map of DU ID to P1.5 phase
      const duToP15Phase = new Map<string, string>();
      p15Output.specific_diachronic_structure.phases.forEach(phase => {
        phase.units_involved.forEach(duId => {
          duToP15Phase.set(duId, phase.phase_name);
        });
      });

      // Process each DU to determine its dominant P1.2 phase
      const dusByPhase: Record<PhaseType, DUWithPhase[]> = {
        'Initial State': [],
        'Core Experience': [],
        'Final Action': [],
        'Post-Hoc Reflection': []
      };

      p14Output.diachronic_units.forEach(du => {
        // Count segments by phase
        const phaseDistribution: Record<PhaseType, number> = {
          'Initial State': 0,
          'Core Experience': 0,
          'Final Action': 0,
          'Post-Hoc Reflection': 0
        };

        du.source_segment_ids.forEach(segId => {
          const segment = p13Output.sorted_segments.find(s => s.segment_id === segId);
          if (segment && segment.coarse_phase in phaseDistribution) {
            phaseDistribution[segment.coarse_phase as PhaseType]++;
          }
        });

        // Determine dominant phase
        let dominantPhase: PhaseType = 'Initial State';
        let maxCount = 0;
        Object.entries(phaseDistribution).forEach(([phase, count]) => {
          if (count > maxCount) {
            maxCount = count;
            dominantPhase = phase as PhaseType;
          }
        });

        const duWithPhase: DUWithPhase = {
          du,
          dominantPhase,
          phaseDistribution,
          p15Phase: duToP15Phase.get(du.unit_id)
        };

        dusByPhase[dominantPhase].push(duWithPhase);
      });

      transcripts.push({
        transcriptId,
        filename: transcript.filename,
        p15Output,
        dusByPhase
      });
    });

    return transcripts;
  }, [processedData]);

  const handleExportCSV = () => {
    const csvData: any[] = [];
    
    processedTranscripts.forEach(transcript => {
      PHASE_ORDER.forEach(phase => {
        transcript.dusByPhase[phase].forEach(duWithPhase => {
          csvData.push({
            'Transcript': transcript.filename,
            'P1.2 Phase': phase,
            'DU ID': duWithPhase.du.unit_id,
            'DU Description': duWithPhase.du.description,
            'P1.5 Phase': duWithPhase.p15Phase || 'N/A',
            'Segment Count': duWithPhase.du.source_segment_ids.length,
            'Phase Purity': `${Math.round(duWithPhase.phaseDistribution[phase] / duWithPhase.du.source_segment_ids.length * 100)}%`
          });
        });
      });
    });

    const csv = convertToCSV(csvData);
    downloadCSV(csv, `P1.5_diachronic_structure_comparison_${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (processedTranscripts.length === 0) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No transcripts with P1.5 output available for comparison
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Cross-Transcript Diachronic Structure Comparison</h3>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>

      {/* Comparison Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Transcript headers */}
          <div className="grid" style={{ gridTemplateColumns: `200px repeat(${processedTranscripts.length}, 1fr)` }}>
            <div className="p-2 font-semibold text-sm text-light-sidenote dark:text-dark-sidenote">
              Phase / Transcript
            </div>
            {processedTranscripts.map(transcript => (
              <div key={transcript.transcriptId} className="p-2 border-l border-light-border dark:border-dark-border">
                <div className="font-semibold text-sm text-center mb-1">
                  {transcript.filename}
                </div>
                <div className="text-xs text-center text-light-sidenote dark:text-dark-sidenote italic">
                  IV: {transcript.p15Output.independent_variable_details}
                </div>
              </div>
            ))}
          </div>

          {/* Phase rows */}
          {PHASE_ORDER.map((phase, phaseIdx) => {
            const colors = PHASE_COLORS[phase];
            return (
              <div key={phase} className={`grid ${phaseIdx > 0 ? 'border-t' : ''} border-light-border dark:border-dark-border`} 
                   style={{ gridTemplateColumns: `200px repeat(${processedTranscripts.length}, 1fr)` }}>
                {/* Phase label */}
                <div className={`p-3 ${colors.bg} ${colors.bg.includes('100') ? 'bg-opacity-30' : 'bg-opacity-10'}`}>
                  <div className={`font-semibold text-sm ${colors.text}`}>
                    {phase}
                  </div>
                </div>
                
                {/* DUs for each transcript in this phase */}
                {processedTranscripts.map(transcript => {
                  const dus = transcript.dusByPhase[phase];
                  const transcriptData = processedData.get(transcript.transcriptId);
                  
                  return (
                    <div key={transcript.transcriptId} className="p-3 border-l border-light-border dark:border-dark-border">
                      {dus.length > 0 ? (
                        <div className="space-y-2">
                          {dus.map(duWithPhase => (
                            <DUCard
                              key={duWithPhase.du.unit_id}
                              du={duWithPhase}
                              transcriptData={transcriptData!}
                              p15PhaseName={duWithPhase.p15Phase}
                              theme={theme}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-sm text-light-sidenote dark:text-dark-sidenote italic">
                          No DUs
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
        <div className="font-semibold">Legend:</div>
        <div>⚡ = Mixed phase content (DU contains segments from multiple phases)</div>
        <div>Click any DU card to explore its contents through nested tooltips</div>
        <div>P1.5 phase names shown in italics on each card</div>
      </div>
    </div>
  );
};