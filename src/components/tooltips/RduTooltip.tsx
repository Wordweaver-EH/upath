import React from 'react';
import { TranscriptProcessedData } from '../../types';
import { NestedTooltip } from '../NestedTooltip';

interface RduTooltipProps {
  rduName: string;
  transcriptData: TranscriptProcessedData;
}

export const RduTooltip: React.FC<RduTooltipProps> = ({ rduName, transcriptData }) => {
  // Find the DU in P1.4 output (where DUs are defined)
  const du = transcriptData.p1_4_output?.diachronic_units.find(unit => unit.unit_id === rduName);
  
  if (!du) {
    return (
      <div className="p-6">
        <p className="text-sm text-light-sidenote dark:text-dark-sidenote">
          DU data not found for {rduName}
        </p>
      </div>
    );
  }

  // Get the segments from P1.3 output
  const segmentIds = du.source_segment_ids || [];
  const segments = segmentIds.map(segId => {
    return transcriptData.p1_3_output?.sorted_segments.find(
      seg => seg.segment_id === segId
    );
  }).filter(Boolean);

  return (
    <div className="p-6">
      <h3 className="font-semibold text-light-text dark:text-dark-text mb-2">
        {rduName}
      </h3>
      
      <div className="space-y-3 text-sm">
        {du.description && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Description:</span>
            <p className="mt-1">{du.description}</p>
          </div>
        )}

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Segments Included ({segments.length}):</span>
          <div className="mt-1 space-y-2 max-h-60 overflow-y-auto">
            {segments.map(segment => (
              <NestedTooltip
                key={segment!.segment_id}
                content={<SegmentTooltipContent segment={segment!} transcriptData={transcriptData} />}
                depth={1}
              >
                <div className="cursor-pointer hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt p-2 rounded transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-light-accent dark:text-dark-accent">
                      {segment!.segment_id}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {segment!.coarse_phase}
                    </span>
                  </div>
                  <div className="text-xs text-light-sidenote dark:text-dark-sidenote line-clamp-2">
                    {segment!.segment_text}
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

interface SegmentTooltipContentProps {
  segment: any;
  transcriptData: TranscriptProcessedData;
}

const SegmentTooltipContent: React.FC<SegmentTooltipContentProps> = ({ segment, transcriptData }) => {
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
          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
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
          <NestedTooltip
            content={<UtteranceTooltipContent utterance={segment.original_utterance} />}
            depth={2}
          >
            <div className="mt-1 p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-xs">
                <span className="font-medium">Line {segment.original_utterance.original_line_num}:</span>
                <p className="mt-1 italic line-clamp-2">"{segment.original_utterance.utterance_text}"</p>
              </div>
            </div>
          </NestedTooltip>
        </div>
      </div>
    </div>
  );
};

interface UtteranceTooltipContentProps {
  utterance: any;
}

const UtteranceTooltipContent: React.FC<UtteranceTooltipContentProps> = ({ utterance }) => {
  const lineNum = utterance.original_line_num || utterance.utterance_number;
  const speaker = utterance.speaker || 'Unknown';
  const text = utterance.utterance_text || utterance.text || '';
  
  return (
    <div className="p-6">
      <h3 className="font-semibold text-light-text dark:text-dark-text mb-2">
        Line {lineNum}
      </h3>
      
      <div className="space-y-3 text-sm">
        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Speaker:</span>
          <span className="ml-2 font-medium">{speaker}</span>
        </div>

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Full Text:</span>
          <p className="mt-1 italic">"{text}"</p>
        </div>

        {utterance.experiential_markers && utterance.experiential_markers.length > 0 && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Experiential Markers:</span>
            <ul className="mt-1 list-disc list-inside">
              {utterance.experiential_markers.map((marker: string, idx: number) => (
                <li key={idx} className="text-xs">{marker}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};