import React, { useState, useMemo, useCallback } from 'react';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P2S_3_Output, P2S_3_NetworkNode, P2S_3_NetworkLink } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';
import MermaidDiagram from '../../components/MermaidDiagram';
import { transformSynchronicToMermaid } from '../utils/visualizationHelper';

interface SpecificSynchronicStructureNetworkProps {
  networkData: P2S_3_Output;
  theme: 'light' | 'dark';
  onNetworkChange?: (updatedData: P2S_3_Output) => void;
  filename?: string;
  hideVariableInfo?: boolean;
  hideInstructions?: boolean;
  compactSummary?: boolean;
}

// Link type colors
const LINK_TYPE_COLORS = {
  hierarchical: { color: '#4a5568', label: 'Hierarchical' },
  associative: { color: '#3182ce', label: 'Associative' },
  causal: { color: '#e53e3e', label: 'Causal' },
  temporal: { color: '#38a169', label: 'Temporal' },
  default: { color: '#718096', label: 'Other' }
};

// Node editing modal
const NodeEditModal: React.FC<{
  node: P2S_3_NetworkNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: P2S_3_NetworkNode) => void;
  theme: 'light' | 'dark';
}> = ({ node, isOpen, onClose, onSave, theme }) => {
  const [editedNode, setEditedNode] = useState<P2S_3_NetworkNode | null>(node);

  React.useEffect(() => {
    setEditedNode(node);
  }, [node]);

  if (!isOpen || !editedNode) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className={`${theme === 'dark' ? 'bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'} rounded-lg p-6 max-w-md w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Edit Node</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Node ID</label>
            <input
              type="text"
              value={editedNode.id}
              onChange={(e) => setEditedNode({ ...editedNode, id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <input
              type="text"
              value={editedNode.label}
              onChange={(e) => setEditedNode({ ...editedNode, label: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Source ISU ID</label>
            <input
              type="text"
              value={editedNode.source_isu_id}
              onChange={(e) => setEditedNode({ ...editedNode, source_isu_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(editedNode);
              onClose();
            }}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Link editing modal
const LinkEditModal: React.FC<{
  link: P2S_3_NetworkLink | null;
  nodes: P2S_3_NetworkNode[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: P2S_3_NetworkLink) => void;
  onDelete: () => void;
  theme: 'light' | 'dark';
}> = ({ link, nodes, isOpen, onClose, onSave, onDelete, theme }) => {
  const [editedLink, setEditedLink] = useState<P2S_3_NetworkLink | null>(link);

  React.useEffect(() => {
    setEditedLink(link);
  }, [link]);

  if (!isOpen || !editedLink) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className={`${theme === 'dark' ? 'bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'} rounded-lg p-6 max-w-md w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Edit Link</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">From Node</label>
            <select
              value={editedLink.from}
              onChange={(e) => setEditedLink({ ...editedLink, from: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            >
              {nodes.map(node => (
                <option key={node.id} value={node.id}>{node.label} ({node.id})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">To Node</label>
            <select
              value={editedLink.to}
              onChange={(e) => setEditedLink({ ...editedLink, to: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            >
              {nodes.map(node => (
                <option key={node.id} value={node.id}>{node.label} ({node.id})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Link Type</label>
            <select
              value={editedLink.type}
              onChange={(e) => setEditedLink({ ...editedLink, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            >
              <option value="hierarchical">Hierarchical</option>
              <option value="associative">Associative</option>
              <option value="causal">Causal</option>
              <option value="temporal">Temporal</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-between mt-6">
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Link
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(editedLink);
                onClose();
              }}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SpecificSynchronicStructureNetwork: React.FC<SpecificSynchronicStructureNetworkProps> = ({
  networkData,
  theme,
  onNetworkChange,
  filename,
  hideVariableInfo = false,
  hideInstructions = false,
  compactSummary = false
}) => {
  const [showDiagram, setShowDiagram] = useState(true);
  const [showNodeList, setShowNodeList] = useState(false);
  const [showLinkList, setShowLinkList] = useState(false);
  const [editingNode, setEditingNode] = useState<P2S_3_NetworkNode | null>(null);
  const [editingLink, setEditingLink] = useState<P2S_3_NetworkLink | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState(networkData.specific_synchronic_structure.description);

  // Generate Mermaid diagram
  const mermaidChart = useMemo(() => {
    return transformSynchronicToMermaid(
      networkData.specific_synchronic_structure,
      `DU: ${networkData.analyzed_du_id}`
    );
  }, [networkData]);

  const handleDescriptionSave = useCallback(() => {
    if (!onNetworkChange) return;
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        description: tempDescription
      }
    };
    
    onNetworkChange(updatedData);
    setIsEditingDescription(false);
  }, [networkData, tempDescription, onNetworkChange]);

  const handleDescriptionCancel = useCallback(() => {
    setTempDescription(networkData.specific_synchronic_structure.description);
    setIsEditingDescription(false);
  }, [networkData]);

  const handleNodeSave = useCallback((updatedNode: P2S_3_NetworkNode) => {
    if (!onNetworkChange) return;
    
    const oldNodeId = editingNode?.id;
    const nodes = networkData.specific_synchronic_structure.network_nodes;
    const links = networkData.specific_synchronic_structure.network_links;
    
    // Update node
    const updatedNodes = nodes.map(node => 
      node.id === oldNodeId ? updatedNode : node
    );
    
    // Update links if node ID changed
    const updatedLinks = oldNodeId !== updatedNode.id ? 
      links.map(link => ({
        ...link,
        from: link.from === oldNodeId ? updatedNode.id : link.from,
        to: link.to === oldNodeId ? updatedNode.id : link.to
      })) : links;
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        network_nodes: updatedNodes,
        network_links: updatedLinks
      }
    };
    
    onNetworkChange(updatedData);
  }, [networkData, onNetworkChange, editingNode]);

  const handleLinkSave = useCallback((updatedLink: P2S_3_NetworkLink) => {
    if (!onNetworkChange) return;
    
    const links = networkData.specific_synchronic_structure.network_links;
    const linkIndex = links.findIndex(l => 
      l.from === editingLink?.from && l.to === editingLink?.to
    );
    
    const updatedLinks = [...links];
    if (linkIndex >= 0) {
      updatedLinks[linkIndex] = updatedLink;
    }
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        network_links: updatedLinks
      }
    };
    
    onNetworkChange(updatedData);
  }, [networkData, onNetworkChange, editingLink]);

  const handleLinkDelete = useCallback(() => {
    if (!onNetworkChange || !editingLink) return;
    
    const updatedLinks = networkData.specific_synchronic_structure.network_links.filter(
      link => !(link.from === editingLink.from && link.to === editingLink.to)
    );
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        network_links: updatedLinks
      }
    };
    
    onNetworkChange(updatedData);
  }, [networkData, onNetworkChange, editingLink]);

  const handleAddNode = useCallback(() => {
    if (!onNetworkChange) return;
    
    const newNode: P2S_3_NetworkNode = {
      id: `sss_node_${Date.now()}`,
      label: 'New Node',
      source_isu_id: ''
    };
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        network_nodes: [...networkData.specific_synchronic_structure.network_nodes, newNode]
      }
    };
    
    onNetworkChange(updatedData);
  }, [networkData, onNetworkChange]);

  const handleAddLink = useCallback(() => {
    if (!onNetworkChange) return;
    
    const nodes = networkData.specific_synchronic_structure.network_nodes;
    if (nodes.length < 2) {
      alert('Need at least 2 nodes to create a link');
      return;
    }
    
    const newLink: P2S_3_NetworkLink = {
      from: nodes[0].id,
      to: nodes[1].id,
      type: 'associative'
    };
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        network_links: [...networkData.specific_synchronic_structure.network_links, newLink]
      }
    };
    
    onNetworkChange(updatedData);
  }, [networkData, onNetworkChange]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!onNetworkChange) return;
    
    // Remove node and all its links
    const updatedNodes = networkData.specific_synchronic_structure.network_nodes.filter(
      node => node.id !== nodeId
    );
    const updatedLinks = networkData.specific_synchronic_structure.network_links.filter(
      link => link.from !== nodeId && link.to !== nodeId
    );
    
    const updatedData = {
      ...networkData,
      specific_synchronic_structure: {
        ...networkData.specific_synchronic_structure,
        network_nodes: updatedNodes,
        network_links: updatedLinks
      }
    };
    
    onNetworkChange(updatedData);
  }, [networkData, onNetworkChange]);

  const exportToCsv = useCallback(() => {
    const csvData: any[] = [];
    
    // Add nodes
    networkData.specific_synchronic_structure.network_nodes.forEach((node) => {
      csvData.push({
        'DU ID': networkData.analyzed_du_id,
        'Type': 'Node',
        'ID': node.id,
        'Label': node.label,
        'Source ISU': node.source_isu_id,
        'From': '',
        'To': '',
        'Link Type': ''
      });
    });
    
    // Add links
    networkData.specific_synchronic_structure.network_links.forEach((link) => {
      csvData.push({
        'DU ID': networkData.analyzed_du_id,
        'Type': 'Link',
        'ID': '',
        'Label': '',
        'Source ISU': '',
        'From': link.from,
        'To': link.to,
        'Link Type': link.type
      });
    });
    
    const columns = [
      { field: 'DU ID', headerName: 'DU ID' },
      { field: 'Type', headerName: 'Type' },
      { field: 'ID', headerName: 'ID' },
      { field: 'Label', headerName: 'Label' },
      { field: 'Source ISU', headerName: 'Source ISU' },
      { field: 'From', headerName: 'From' },
      { field: 'To', headerName: 'To' },
      { field: 'Link Type', headerName: 'Link Type' }
    ];
    
    const csv = convertToCSV(csvData, columns);
    const exportFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P2S.3_${networkData.analyzed_du_id}_synchronic_structure.csv` : 
      `P2S.3_${networkData.analyzed_du_id}_synchronic_structure.csv`;
    downloadCSV(csv, exportFilename);
  }, [networkData, filename]);

  // Calculate statistics
  const stats = useMemo(() => {
    const nodes = networkData.specific_synchronic_structure.network_nodes;
    const links = networkData.specific_synchronic_structure.network_links;
    const linkTypes = links.reduce((acc, link) => {
      acc[link.type] = (acc[link.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return { nodeCount: nodes.length, linkCount: links.length, linkTypes };
  }, [networkData]);

  return (
    <div className="space-y-4">
      {/* Summary and Actions */}
      {!compactSummary ? (
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold mb-2">Specific Synchronic Structure for DU: {networkData.analyzed_du_id}</h3>
            <div className="text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
              <div>Network Nodes: {stats.nodeCount}</div>
              <div>Network Links: {stats.linkCount}</div>
              <div>Link Types: {Object.entries(stats.linkTypes).map(([type, count]) => 
                `${type}: ${count}`).join(', ') || 'None'}</div>
            </div>
          </div>
          <button
            onClick={exportToCsv}
            className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
          >
            Download CSV
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
            {stats.nodeCount} nodes • {stats.linkCount} links
          </div>
          <button
            onClick={exportToCsv}
            className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
          >
            Download CSV
          </button>
        </div>
      )}

      {/* Variable Information */}
      {!hideVariableInfo && (
        <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-2">
          <div>
            <span className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Independent Variable: </span>
            <span className="text-sm">{networkData.independent_variable_details}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Dependent Variable Focus: </span>
            <div className="inline-flex flex-wrap gap-1 ml-2">
              {networkData.dependent_variable_focus.map((dv, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                >
                  {dv}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg">
        <div className="flex items-start justify-between mb-1">
          <h4 className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Structure Description</h4>
          {!isEditingDescription && (
            <button
              onClick={() => setIsEditingDescription(true)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              edit
            </button>
          )}
        </div>
        {isEditingDescription ? (
          <div className="space-y-2">
            <textarea
              value={tempDescription}
              onChange={(e) => setTempDescription(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleDescriptionSave}
                className="text-sm px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                onClick={handleDescriptionCancel}
                className="text-sm px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">{networkData.specific_synchronic_structure.description}</p>
        )}
      </div>

      {/* View Controls */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowDiagram(!showDiagram)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            showDiagram 
              ? 'bg-light-accent text-white dark:bg-dark-accent' 
              : 'bg-light-bg-alt dark:bg-dark-bg-alt text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border'
          }`}
        >
          {showDiagram ? 'Hide' : 'Show'} Network Diagram
        </button>
        <button
          onClick={() => setShowNodeList(!showNodeList)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            showNodeList 
              ? 'bg-light-accent text-white dark:bg-dark-accent' 
              : 'bg-light-bg-alt dark:bg-dark-bg-alt text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border'
          }`}
        >
          {showNodeList ? 'Hide' : 'Show'} Node List
        </button>
        <button
          onClick={() => setShowLinkList(!showLinkList)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            showLinkList 
              ? 'bg-light-accent text-white dark:bg-dark-accent' 
              : 'bg-light-bg-alt dark:bg-dark-bg-alt text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border'
          }`}
        >
          {showLinkList ? 'Hide' : 'Show'} Link List
        </button>
      </div>

      {/* Network Diagram */}
      {showDiagram && (
        <div className="border-2 border-light-border dark:border-dark-border rounded-lg p-4">
          <h4 className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote mb-2">
            Network Visualization
          </h4>
          <MermaidDiagram 
            chart={mermaidChart} 
            theme={theme}
            uniqueId={`p2s3-${networkData.analyzed_du_id}`}
          />
        </div>
      )}

      {/* Node List */}
      {showNodeList && (
        <div className="border-2 border-light-border dark:border-dark-border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">
              Network Nodes ({stats.nodeCount})
            </h4>
            <button
              onClick={handleAddNode}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add Node
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {networkData.specific_synchronic_structure.network_nodes.map((node) => (
              <div 
                key={node.id}
                className="flex items-center justify-between p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded"
              >
                <div className="flex-1">
                  <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{node.id}</div>
                  <div className="text-sm font-medium">{node.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">ISU: {node.source_isu_id}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingNode(node);
                      setIsNodeModalOpen(true);
                    }}
                    className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Edit node"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteNode(node.id)}
                    className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete node"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {networkData.specific_synchronic_structure.network_nodes.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
                No nodes in the network
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link List */}
      {showLinkList && (
        <div className="border-2 border-light-border dark:border-dark-border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">
              Network Links ({stats.linkCount})
            </h4>
            <button
              onClick={handleAddLink}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add Link
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {networkData.specific_synchronic_structure.network_links.map((link, index) => {
              const fromNode = networkData.specific_synchronic_structure.network_nodes.find(n => n.id === link.from);
              const toNode = networkData.specific_synchronic_structure.network_nodes.find(n => n.id === link.to);
              const typeInfo = LINK_TYPE_COLORS[link.type as keyof typeof LINK_TYPE_COLORS] || LINK_TYPE_COLORS.default;
              
              return (
                <div 
                  key={index}
                  className="flex items-center justify-between p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded cursor-pointer hover:bg-light-border dark:hover:bg-dark-border"
                  onClick={() => {
                    setEditingLink(link);
                    setIsLinkModalOpen(true);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm">
                      <span className="font-medium">{fromNode?.label || link.from}</span>
                      <span className="mx-2 text-gray-500">→</span>
                      <span className="font-medium">{toNode?.label || link.to}</span>
                    </div>
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: `${typeInfo.color}20`,
                        color: typeInfo.color
                      }}
                    >
                      {typeInfo.label}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );
            })}
            {networkData.specific_synchronic_structure.network_links.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
                No links in the network
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!hideInstructions && (
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1">
          <div>📊 View the network as a Mermaid diagram or explore nodes and links</div>
          <div>✏️ Click on description to edit it</div>
          <div>🔗 Click on links in the link list to edit or delete them</div>
          <div>📝 Add, edit, or delete nodes and links to modify the network structure</div>
          <div>💾 Download the network structure as CSV for external analysis</div>
        </div>
      )}

      {/* Modals */}
      <NodeEditModal
        node={editingNode}
        isOpen={isNodeModalOpen}
        onClose={() => {
          setIsNodeModalOpen(false);
          setEditingNode(null);
        }}
        onSave={handleNodeSave}
        theme={theme}
      />
      
      <LinkEditModal
        link={editingLink}
        nodes={networkData.specific_synchronic_structure.network_nodes}
        isOpen={isLinkModalOpen}
        onClose={() => {
          setIsLinkModalOpen(false);
          setEditingLink(null);
        }}
        onSave={handleLinkSave}
        onDelete={handleLinkDelete}
        theme={theme}
      />
    </div>
  );
};