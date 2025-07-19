import React from 'react';
import { TranscriptProcessedData } from '../../types';
import { NestedTooltip } from '../NestedTooltip';

interface RduTooltipProps {
  rduName: string;
  transcriptData: TranscriptProcessedData;
}

export const RduTooltip: React.FC<RduTooltipProps> = ({ rduName, transcriptData }) => {
  // Find the RDU in P1.4 output (where RDUs are defined)
  const rdu = transcriptData.p1_4_output?.refined_diachronic_units.find(unit => unit.unit_id === rduName);
  
  if (!rdu) {
    return (
      <div className="p-6">
        <p className="text-sm text-light-sidenote dark:text-dark-sidenote">
          RDU data not found for {rduName}
        </p>
      </div>
    );
  }

  // Get the DUs from P1.2 output using the correct source field
  const duIds = rdu.source_du_ids || [];
  const dus = duIds.map(duId => {
    return transcriptData.p1_2_output?.diachronic_units.find(
      du => du.unit_id === duId || du.du_id === duId
    );
  }).filter(Boolean);

  return (
    <div className="p-6">
      <h3 className="font-semibold text-light-text dark:text-dark-text mb-2">
        {rduName}
      </h3>
      
      <div className="space-y-3 text-sm">
        {rdu.description && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Description:</span>
            <p className="mt-1">{rdu.description}</p>
          </div>
        )}

        {rdu.phase?.phase_type && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Temporal Phase:</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {rdu.phase.phase_type}
            </span>
          </div>
        )}


        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">DUs Included:</span>
          <div className="mt-1 space-y-2">
            {dus.map(du => (
              <NestedTooltip
                key={du!.unit_id || du!.du_id}
                content={<DuTooltipContent du={du!} transcriptData={transcriptData} />}
                depth={1}
              >
                <div className="cursor-pointer hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt p-2 rounded transition-colors">
                  <div className="font-medium text-light-accent dark:text-dark-accent">
                    {du!.unit_id || du!.du_id}
                  </div>
                  <div className="text-xs text-light-sidenote dark:text-dark-sidenote line-clamp-2">
                    {du!.description || du!.summary || 'No description available'}
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

interface DuTooltipContentProps {
  du: any;
  transcriptData: TranscriptProcessedData;
}

const DuTooltipContent: React.FC<DuTooltipContentProps> = ({ du, transcriptData }) => {
  // Get segments from P1.1 output, then trace to utterances
  const segmentIds = du.source_segment_ids || du.segment_ids || [];
  const utteranceMap = new Map<string, any>();
  
  if (transcriptData.p1_1_output?.segmented_utterances) {
    for (const segId of segmentIds) {
      // Find which utterance contains this segment
      for (const segUtt of transcriptData.p1_1_output.segmented_utterances) {
        const segment = segUtt.segments?.find(s => s.segment_id === segId);
        if (segment && segUtt.original_utterance) {
          const lineNum = segUtt.original_utterance.original_line_num || segUtt.original_utterance.utterance_number?.toString();
          if (lineNum && !utteranceMap.has(lineNum)) {
            utteranceMap.set(lineNum, segUtt.original_utterance);
          }
        }
      }
    }
  }
  
  const utterances = Array.from(utteranceMap.values());

  return (
    <div className="p-6">
      <h3 className="font-semibold text-light-text dark:text-dark-text mb-2">
        {du.unit_id || du.du_id}
      </h3>
      
      <div className="space-y-3 text-sm">
        {du.description && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Description:</span>
            <p className="mt-1">{du.description}</p>
          </div>
        )}
        
        {du.summary && (
          <div>
            <span className="text-light-sidenote dark:text-dark-sidenote">Summary:</span>
            <p className="mt-1">{du.summary}</p>
          </div>
        )}

        <div>
          <span className="text-light-sidenote dark:text-dark-sidenote">Utterances:</span>
          <div className="mt-1 space-y-2">
            {utterances.map(utt => (
              <NestedTooltip
                key={utt.original_line_num || utt.utterance_number}
                content={<UtteranceTooltipContent utterance={utt} />}
                depth={2}
              >
                <div className="cursor-pointer hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt p-2 rounded transition-colors">
                  <div className="font-medium text-light-accent dark:text-dark-accent">
                    Line {utt.original_line_num || utt.utterance_number}
                  </div>
                  <div className="text-xs text-light-sidenote dark:text-dark-sidenote line-clamp-2">
                    {utt.utterance_text}
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