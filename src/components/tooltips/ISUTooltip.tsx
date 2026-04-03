import React from 'react';
import { NestedTooltip } from '../NestedTooltip';
import { P2S4ISUTheme, P2S4Utterance } from '../../types/p2s4Types';

interface ISUTooltipProps {
  isu: P2S4ISUTheme;
  duName: string;
  duDescription: string;
}

export const ISUTooltip: React.FC<ISUTooltipProps> = ({ isu, duName, duDescription }) => {
  return (
    <div className="isu-tooltip-content p-6">
      <div className="font-bold text-light-accent dark:text-dark-accent mb-2">
        ISU: {isu.unitName}
      </div>
      
      <div className="text-sm text-light-text dark:text-dark-text mb-3">
        <div className="font-semibold">Level {isu.level}</div>
        <div className="text-light-sidenote dark:text-dark-sidenote text-xs mb-2">
          From DU: {duName}
        </div>
      </div>

      <div className="border-t border-light-border dark:border-dark-border pt-2 mb-2">
        <div className="text-sm space-y-1">
          <div>
            <span className="font-semibold">Abstraction:</span> {isu.abstractionOp}
          </div>
          <div>
            <span className="font-semibold">Definition:</span> {isu.intensionalDefinition}
          </div>
        </div>
      </div>

      <div className="border-t border-light-border dark:border-dark-border pt-2">
        <div className="font-semibold text-sm mb-2">Utterances ({isu.utterances.length}):</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isu.utterances.map((utterance, idx) => (
            <div key={utterance.id} className="p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded">
              <div className="flex items-start gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                  utterance.speaker === 'P' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                  {utterance.speaker}
                </span>
                <div className="flex-1">
                  <div className="text-sm text-light-text dark:text-dark-text">
                    {utterance.text}
                  </div>
                  <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
                    ID: {utterance.segmentId}
                    {utterance.timestamp && <span> • {utterance.timestamp}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

