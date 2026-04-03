import React from 'react';
import { NestedTooltip } from '../NestedTooltip';
import { PhaseTraceData } from '../../utils/phaseTracingHelper';

interface PhaseTooltipProps {
  phaseTrace: PhaseTraceData;
  transcriptId: string;
}

export const PhaseTooltip: React.FC<PhaseTooltipProps> = ({ phaseTrace, transcriptId }) => {
  const utteranceCount = phaseTrace.rdus.reduce((total, rdu) => 
    total + rdu.dus.reduce((duTotal, du) => duTotal + du.utterances.length, 0), 0
  );

  return (
    <div className="phase-tooltip-content p-6">
      <div className="font-bold text-light-accent dark:text-dark-accent mb-2">
        Phase: {phaseTrace.phaseName}
      </div>
      
      <div className="text-sm mb-3 text-light-text dark:text-dark-text">
        {phaseTrace.phaseDescription}
      </div>

      <div className="border-t border-light-border dark:border-dark-border pt-2 mb-2">
        <div className="text-xs text-light-sidenote dark:text-dark-sidenote">
          {phaseTrace.rdus.length} Refined Diachronic Units • {utteranceCount} Utterances
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {phaseTrace.rdus.map((rdu, idx) => (
          <div key={rdu.rduId} className="rdu-item">
            <NestedTooltip
              depth={1}
              content={<RDUTooltipContent rdu={rdu} transcriptId={transcriptId} />}
            >
              <div className="p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded cursor-pointer hover:bg-light-border dark:hover:bg-dark-border transition-colors">
                <div className="font-semibold text-sm">
                  {rdu.rduId}
                </div>
                <div className="text-xs text-light-sidenote dark:text-dark-sidenote line-clamp-2">
                  {rdu.rduDescription}
                </div>
                <div className="text-xs text-light-accent dark:text-dark-accent mt-1">
                  {rdu.dus.length} DUs • {rdu.temporalPhase}
                </div>
              </div>
            </NestedTooltip>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RDUTooltipContentProps {
  rdu: import('../../utils/phaseTracingHelper').RDUTraceData;
  transcriptId: string;
}

const RDUTooltipContent: React.FC<RDUTooltipContentProps> = ({ rdu, transcriptId }) => {
  return (
    <div className="rdu-tooltip-content p-6">
      <div className="font-bold text-light-accent dark:text-dark-accent mb-2">
        RDU: {rdu.rduId}
      </div>
      
      <div className="text-sm mb-3 text-light-text dark:text-dark-text">
        {rdu.rduDescription}
      </div>

      <div className="text-xs text-light-sidenote dark:text-dark-sidenote mb-3">
        Temporal Phase: {rdu.temporalPhase}
      </div>

      <div className="border-t border-light-border dark:border-dark-border pt-2">
        <div className="font-semibold text-sm mb-2">Diachronic Units:</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {rdu.dus.map((du) => (
            <div key={du.duId} className="du-item">
              <NestedTooltip
                depth={2}
                content={<DUTooltipContent du={du} transcriptId={transcriptId} />}
              >
                <div className="p-2 bg-light-subtle dark:bg-dark-subtle rounded cursor-pointer hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt transition-colors">
                  <div className="font-semibold text-sm">
                    {du.duId}
                  </div>
                  <div className="text-xs text-light-sidenote dark:text-dark-sidenote">
                    {du.utterances.length} utterances
                  </div>
                </div>
              </NestedTooltip>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface DUTooltipContentProps {
  du: import('../../utils/phaseTracingHelper').DUTraceData;
  transcriptId: string;
}

const DUTooltipContent: React.FC<DUTooltipContentProps> = ({ du, transcriptId }) => {
  return (
    <div className="du-tooltip-content p-6">
      <div className="font-bold text-light-accent dark:text-dark-accent mb-2">
        DU: {du.duId}
      </div>
      
      <div className="text-sm mb-3 text-light-text dark:text-dark-text">
        {du.duDescription}
      </div>

      <div className="border-t border-light-border dark:border-dark-border pt-2">
        <div className="font-semibold text-sm mb-2">Source Utterances:</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {du.utterances.map((utt, idx) => (
            <div 
              key={`${utt.lineNumber}-${idx}`}
              className="p-2 bg-light-subtle dark:bg-dark-subtle rounded border-l-2 border-light-accent dark:border-dark-accent"
            >
              <div className="text-xs font-semibold text-light-accent dark:text-dark-accent mb-1">
                Line {utt.lineNumber}
              </div>
              <div className="text-sm text-light-text dark:text-dark-text">
                {utt.text}
              </div>
              {utt.segments && utt.segments.length > 0 && (
                <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
                  Segments: {utt.segments.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};