import React, { useState, useEffect } from 'react';
import { GduMappingDisplayItem } from '../../types';
import { useIRRStore } from '../stores/irrStore';
import { Button, Select } from './ui';

interface GduMappingModalProps {
  onConfirmMapping: (confirmedMapping: Record<string, string | null>) => void;
}

const GduMappingModal: React.FC<GduMappingModalProps> = ({
  onConfirmMapping
}) => {
  const [userMappings, setUserMappings] = useState<Record<string, string | null>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Get state from store
  const irrWorkflowState = useIRRStore(state => state.irrWorkflowState);
  const closeMappingModal = useIRRStore(state => state.closeMappingModal);
  
  const isGduMappingModalOpen = irrWorkflowState.isMappingModalOpen;
  const mappingProposal = irrWorkflowState.mappingProposal;
  const { runA, runB } = irrWorkflowState;

  // Initialize user mappings with LLM proposals
  useEffect(() => {
    if (mappingProposal) {
      const initialMappings: Record<string, string | null> = {};
      mappingProposal.gdu_mappings.forEach((mapping: any) => {
        initialMappings[mapping.run_a_gdu_id] = mapping.run_b_gdu_id;
      });
      setUserMappings(initialMappings);
    }
  }, [mappingProposal]);

  if (!isGduMappingModalOpen || !mappingProposal || !runA || !runB) return null;

  // Helper function to build enhanced display items
  const buildDisplayItems = (): GduMappingDisplayItem[] => {
    const runBGdus = runB.genericAnalysisState.p3_2_output?.identified_gdus || [];
    
    return mappingProposal.gdu_mappings.map((mapping: any) => {
      const availableRunBOptions = runBGdus.map(gdu => ({
        gduId: gdu.gdu_id,
        definition: gdu.definition,
        contributingRduCount: gdu.contributing_refined_du_ids.length,
        transcriptCount: new Set(gdu.contributing_refined_du_ids.map(c => c.transcript_id)).size
      }));

      const proposedGdu = runBGdus.find(g => g.gdu_id === mapping.run_b_gdu_id);

      return {
        runAGduId: mapping.run_a_gdu_id,
        runADefinition: mapping.run_a_definition,
        runAContributingRduCount: mapping.run_a_contributing_rdu_count,
        runATranscriptCount: new Set(
          runA.genericAnalysisState.p3_2_output?.identified_gdus
            ?.find(g => g.gdu_id === mapping.run_a_gdu_id)
            ?.contributing_refined_du_ids.map(c => c.transcript_id) || []
        ).size,
        proposedRunBGduId: mapping.run_b_gdu_id,
        proposedRunBDefinition: mapping.run_b_definition,
        proposedRunBContributingRduCount: mapping.run_b_contributing_rdu_count,
        proposedRunBTranscriptCount: proposedGdu ? new Set(proposedGdu.contributing_refined_du_ids.map(c => c.transcript_id)).size : 0,
        semanticSimilarityScore: mapping.semantic_similarity_score,
        mappingJustification: mapping.mapping_justification,
        availableRunBOptions
      };
    });
  };

  const displayItems = buildDisplayItems();

  const handleMappingChange = (runAGduId: string, selectedRunBGduId: string | null) => {
    setUserMappings(prev => ({
      ...prev,
      [runAGduId]: selectedRunBGduId === '' ? null : selectedRunBGduId
    }));
  };

  const toggleRowExpansion = (runAGduId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(runAGduId)) {
        newSet.delete(runAGduId);
      } else {
        newSet.add(runAGduId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    onConfirmMapping(userMappings);
  };

  const getSelectedGduDetails = (runAGduId: string) => {
    const selectedId = userMappings[runAGduId];
    if (!selectedId) return null;
    
    const item = displayItems.find(d => d.runAGduId === runAGduId);
    return item?.availableRunBOptions.find(opt => opt.gduId === selectedId);
  };

  const renderDefinitionCell = (definition: string | null | undefined, maxLength: number = 80) => {
    if (!definition) return <div className="text-sm text-light-sidenote dark:text-dark-sidenote">No definition</div>;
    const truncated = definition.length > maxLength ? definition.substring(0, maxLength) + '...' : definition;
    
    return (
      <div title={definition} className="text-sm">
        {truncated}
      </div>
    );
  };

  const renderExpandedDetails = (item: GduMappingDisplayItem) => {
    const selectedDetails = getSelectedGduDetails(item.runAGduId);
    
    return (
      <tr className="bg-light-bg-alt dark:bg-dark-bg-alt">
        <td colSpan={6} className="px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Run A Details */}
            <div>
              <h4 className="font-medium text-light-text dark:text-dark-text mb-2">Run A - {item.runAGduId}</h4>
              <div className="text-sm text-light-text dark:text-dark-text space-y-1">
                <div><strong>Definition:</strong> {item.runADefinition}</div>
                <div><strong>Contributing RDUs:</strong> {item.runAContributingRduCount}</div>
                <div><strong>Transcripts:</strong> {item.runATranscriptCount}</div>
              </div>
            </div>
            
            {/* Run B Details */}
            <div>
              <h4 className="font-medium text-light-text dark:text-dark-text mb-2">
                Selected from Run B - {userMappings[item.runAGduId] || '[Unmatched]'}
              </h4>
              {selectedDetails ? (
                <div className="text-sm text-light-text dark:text-dark-text space-y-1">
                  <div><strong>Definition:</strong> {selectedDetails.definition}</div>
                  <div><strong>Contributing RDUs:</strong> {selectedDetails.contributingRduCount}</div>
                  <div><strong>Transcripts:</strong> {selectedDetails.transcriptCount}</div>
                </div>
              ) : (
                <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">No mapping selected</div>
              )}
            </div>
          </div>
          
          {/* LLM Justification */}
          <div className="mt-4">
            <h4 className="font-medium text-light-text dark:text-dark-text mb-2">LLM Mapping Justification</h4>
            <div className="text-sm text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg p-3 rounded border border-light-border dark:border-dark-border">
              {item.mappingJustification}
            </div>
            <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
              Similarity Score: {(item.semanticSimilarityScore * 100).toFixed(1)}%
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-light-bg dark:bg-dark-bg rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-light-border dark:border-dark-border">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">
              Validate GDU Mappings
            </h2>
            <Button
              onClick={closeMappingModal}
              className="text-light-sidenote dark:text-dark-sidenote hover:text-light-text dark:hover:text-dark-text text-2xl p-1"
              variant="secondary"
              aria-label="Close modal"
            >
              ×
            </Button>
          </div>
          <p className="text-light-sidenote dark:text-dark-sidenote text-sm mt-2">
            Review and adjust the LLM-proposed mappings between Run A and Run B GDUs. 
            Click the expand button (↓) for full details and justification.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-light-bg-alt dark:bg-dark-bg-alt sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                  
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                  Run A GDU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                  Definition (Run A)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                  Context
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                  Mapped to Run B
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody className="bg-light-bg dark:bg-dark-bg divide-y divide-light-border dark:divide-dark-border">
              {displayItems.map((item) => (
                <React.Fragment key={item.runAGduId}>
                  <tr className="hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Button
                        onClick={() => toggleRowExpansion(item.runAGduId)}
                        className="text-light-sidenote dark:text-dark-sidenote hover:text-light-text dark:hover:text-dark-text text-lg p-1 min-w-0"
                        variant="secondary"
                        aria-label={expandedRows.has(item.runAGduId) ? 'Collapse row' : 'Expand row'}
                      >
                        {expandedRows.has(item.runAGduId) ? '↑' : '↓'}
                      </Button>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-light-text dark:text-dark-text">
                        {item.runAGduId}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      {renderDefinitionCell(item.runADefinition)}
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-light-sidenote dark:text-dark-sidenote">
                      <div>{item.runAContributingRduCount} RDUs</div>
                      <div>{item.runATranscriptCount} transcripts</div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <Select
                        value={userMappings[item.runAGduId] || ''}
                        onChange={(e) => handleMappingChange(item.runAGduId, e.target.value || null)}
                        className="w-full text-sm"
                        options={[
                          { value: '', label: '-- Unmatched --' },
                          ...item.availableRunBOptions.map(option => ({
                            value: option.gduId,
                            label: `${option.gduId} (${option.contributingRduCount} RDUs, ${option.transcriptCount} transcripts)`
                          }))
                        ]}
                      />
                      {userMappings[item.runAGduId] && (
                        <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
                          {getSelectedGduDetails(item.runAGduId)?.definition.substring(0, 60)}...
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className={`font-medium ${
                        item.semanticSimilarityScore >= 0.8 ? 'text-light-accent-subtle dark:text-dark-accent-subtle' :
                        item.semanticSimilarityScore >= 0.6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-light-accent dark:text-dark-accent'
                      }`}>
                        {(item.semanticSimilarityScore * 100).toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                  
                  {expandedRows.has(item.runAGduId) && renderExpandedDetails(item)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-light-border dark:border-dark-border p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
              {Object.values(userMappings).filter(v => v !== null).length} of {displayItems.length} GDUs mapped
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={closeMappingModal}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                variant="primary"
                className="px-6"
              >
                Confirm Mapping
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GduMappingModal;