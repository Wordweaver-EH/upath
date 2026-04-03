import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  transformSynchronicToMermaid, 
  transformDiachronicToMermaid, 
  transformGenericDiachronicToMermaid, 
  transformDagToMermaid 
} from './visualizationHelper'
import type { 
  SynchronicStructureP2S, 
  SynchronicStructureP4S, 
  SpecificDiachronicStructureType, 
  GenericDiachronicStructureDefinition,
  P7_3_Output
} from '../types'

// Mock console.warn to test warning behavior
const mockConsoleWarn = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  global.console.warn = mockConsoleWarn
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('transformSynchronicToMermaid', () => {
  it('should return error message when no structure provided', () => {
    const result = transformSynchronicToMermaid()
    
    expect(result).toContain('graph TD;')
    expect(result).toContain('error_no_data')
    expect(result).toContain('Error: No synchronic structure data provided')
  })

  it('should return error message when undefined structure provided', () => {
    const result = transformSynchronicToMermaid(undefined)
    
    expect(result).toContain('graph TD;')
    expect(result).toContain('error_no_data')
  })

  describe('P2S Structure', () => {
    it('should transform valid P2S structure to Mermaid', () => {
      const structure: SynchronicStructureP2S = {
        description: 'Test P2S Structure',
        network_nodes: [
          { id: 'node1', label: 'First Node' },
          { id: 'node2', label: 'Second Node' }
        ],
        network_links: [
          { from: 'node1', to: 'node2', type: 'influences' }
        ]
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('graph TD;')
      expect(result).toContain('subgraph')
      expect(result).toContain('node1["First Node"]')
      expect(result).toContain('node2["Second Node"]')
      expect(result).toContain('node1 -->|"influences"| node2')
    })

    it('should handle P2S structure with missing nodes', () => {
      const structure: Partial<SynchronicStructureP2S> = {
        description: 'Malformed P2S',
        network_links: []
      } as SynchronicStructureP2S
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('error_unknown_type')
      expect(result).toContain('Unknown or incomplete synchronic structu')
    })

    it('should handle P2S structure with missing links', () => {
      const structure: Partial<SynchronicStructureP2S> = {
        description: 'Malformed P2S',
        network_nodes: []
      } as SynchronicStructureP2S
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('error_unknown_type')
    })

    it('should handle empty nodes array', () => {
      const structure: SynchronicStructureP2S = {
        description: 'Empty P2S',
        network_nodes: [],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('empty_state')
      expect(result).toContain('No nodes in this structure')
    })

    it('should skip invalid links and warn', () => {
      const structure: SynchronicStructureP2S = {
        description: 'Test P2S',
        network_nodes: [
          { id: 'node1', label: 'Valid Node' }
        ],
        network_links: [
          { from: 'node1', to: 'nonexistent', type: 'invalid link' }
        ]
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping link. Invalid/missing node')
      )
      expect(result).toContain('%%')
      expect(result).toContain('Skipping link')
    })
  })

  describe('P4S Structure', () => {
    it('should transform valid P4S structure to Mermaid', () => {
      const structure: SynchronicStructureP4S = {
        description: 'Test P4S Structure',
        generic_nodes_categories: [
          { id: 'category1', label: 'First Category' },
          { id: 'category2', label: 'Second Category' }
        ],
        generic_network_links: [
          { from: 'category1', to: 'category2', type: 'relates to' }
        ]
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('category1["First Category"]')
      expect(result).toContain('category2["Second Category"]')
      expect(result).toContain('category1 -->|"relates to"| category2')
    })

    it('should handle P4S structure with missing categories', () => {
      const structure: Partial<SynchronicStructureP4S> = {
        description: 'Malformed P4S',
        generic_network_links: []
      } as SynchronicStructureP4S
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('error_unknown_type')
      expect(result).toContain('Unknown or incomplete synchronic structu')
    })
  })

  describe('Dynamic title handling', () => {
    it('should use dynamic title hint when provided', () => {
      const structure: SynchronicStructureP2S = {
        description: 'Original Description',
        network_nodes: [{ id: 'node1', label: 'Node' }],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure, 'Custom Title')
      
      expect(result).toContain('Custom_Title')
    })

    it('should use structure description when no title hint', () => {
      const structure: SynchronicStructureP2S = {
        description: 'Structure Description',
        network_nodes: [{ id: 'node1', label: 'Node' }],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('Structure_Description')
    })

    it('should use default title when no description or hint', () => {
      const structure: SynchronicStructureP2S = {
        network_nodes: [{ id: 'node1', label: 'Node' }],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('Structure_Details')
    })
  })

  describe('ID and label sanitization', () => {
    it('should sanitize node IDs with special characters', () => {
      const structure: SynchronicStructureP2S = {
        network_nodes: [
          { id: 'node-with-hyphens!@#', label: 'Special Node' }
        ],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('node_with_hyphens___')
    })

    it('should handle empty or invalid node IDs', () => {
      const structure: SynchronicStructureP2S = {
        network_nodes: [
          { id: '', label: 'Empty ID Node' },
          { id: null as any, label: 'Null ID Node' }
        ],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('s_node_0')
    })

    it('should sanitize labels with quotes and special characters', () => {
      const structure: SynchronicStructureP2S = {
        network_nodes: [
          { id: 'node1', label: 'Label with "quotes" and special chars!@#' }
        ],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('#quot;')
      expect(result).not.toContain('"quotes"')
    })

    it('should handle very long labels', () => {
      const longLabel = 'x'.repeat(100)
      const structure: SynchronicStructureP2S = {
        network_nodes: [
          { id: 'node1', label: longLabel }
        ],
        network_links: []
      }
      
      const result = transformSynchronicToMermaid(structure)
      
      expect(result).toContain('...')
      expect(result).not.toContain(longLabel)
    })
  })

  it('should handle unknown structure type', () => {
    const structure = { unknown: 'property' } as any
    
    const result = transformSynchronicToMermaid(structure)
    
    expect(result).toContain('error_unknown_type')
    expect(result).toContain('Unknown or incomplete synchronic structu')
  })
})

// transformDiachronicToMermaid is intentionally stubbed to return ''
// (a comparison table is used instead of individual Gantt charts).
describe('transformDiachronicToMermaid', () => {
  it('should return empty string when no structure provided', () => {
    expect(transformDiachronicToMermaid()).toBe('')
  })

  it('should return empty string when no phases provided', () => {
    const structure: SpecificDiachronicStructureType = { summary: 'Test Structure', phases: [] }
    expect(transformDiachronicToMermaid(structure)).toBe('')
  })

  it('should return empty string for valid diachronic structure', () => {
    const structure: SpecificDiachronicStructureType = {
      summary: 'Test Experience Journey',
      phases: [
        { phase_name: 'Preparation Phase', units_involved: ['unit1', 'unit2'] },
        { phase_name: 'Action Phase', units_involved: ['unit3'] },
      ],
    }
    expect(transformDiachronicToMermaid(structure)).toBe('')
  })

  it('should return empty string for phases without names', () => {
    const structure: SpecificDiachronicStructureType = {
      summary: 'Unnamed Phases',
      phases: [{ units_involved: ['unit1'] }, { units_involved: ['unit2'] }] as any,
    }
    expect(transformDiachronicToMermaid(structure)).toBe('')
  })

  it('should return empty string regardless of unit count', () => {
    const structure: SpecificDiachronicStructureType = {
      summary: 'Duration Test',
      phases: [
        { phase_name: 'Short Phase', units_involved: [] },
        { phase_name: 'Long Phase', units_involved: ['u1', 'u2', 'u3', 'u4', 'u5'] },
      ],
    }
    expect(transformDiachronicToMermaid(structure)).toBe('')
  })

  it('should return empty string regardless of special characters in phase names', () => {
    const structure: SpecificDiachronicStructureType = {
      summary: 'Special Characters',
      phases: [{ phase_name: 'Phase: with, special chars', units_involved: ['unit1'] }],
    }
    expect(transformDiachronicToMermaid(structure)).toBe('')
  })

  it('should return empty string when no summary provided', () => {
    const structure: SpecificDiachronicStructureType = {
      phases: [{ phase_name: 'Test Phase', units_involved: ['unit1'] }],
    }
    expect(transformDiachronicToMermaid(structure)).toBe('')
  })
})

describe('transformGenericDiachronicToMermaid', () => {
  it('should return empty gantt when no definition provided', () => {
    const result = transformGenericDiachronicToMermaid()
    
    expect(result).toContain('gantt')
    expect(result).toContain('Generic Diachronic Structure (No Definition)')
    expect(result).toContain('No GDS Data')
  })

  it('should transform definition with typical sequence', () => {
    const definition: GenericDiachronicStructureDefinition = {
      name: 'Test GDS',
      description: 'Test generic structure',
      core_gdus: ['gdu1', 'gdu2'],
      typical_sequence: ['gdu1', 'gdu3', 'gdu2']
    }
    
    const result = transformGenericDiachronicToMermaid(definition)
    
    expect(result).toContain('GDS: Test GDS')
    expect(result).toContain('section Typical Sequence')
    expect(result).toContain('gdu1 :gdu1, 0, 1d')
    expect(result).toContain('gdu3 :gdu3, 1, 1d')
    expect(result).toContain('gdu2 :gdu2, 2, 1d')
  })

  it('should fall back to core_gdus when no typical sequence', () => {
    const definition: GenericDiachronicStructureDefinition = {
      name: 'Core Only GDS',
      description: 'Uses core GDUs',
      core_gdus: ['core1', 'core2']
    }
    
    const result = transformGenericDiachronicToMermaid(definition)
    
    expect(result).toContain('section Core GDUs')
    expect(result).toContain('core1')
    expect(result).toContain('core2')
  })

  it('should handle empty core_gdus and typical_sequence', () => {
    const definition: GenericDiachronicStructureDefinition = {
      name: 'Empty GDS',
      description: 'No GDUs',
      core_gdus: []
    }
    
    const result = transformGenericDiachronicToMermaid(definition)
    
    expect(result).toContain('No GDS Data')
  })

  it('should use default title when no name provided', () => {
    const definition: GenericDiachronicStructureDefinition = {
      description: 'Unnamed structure',
      core_gdus: ['gdu1']
    }
    
    const result = transformGenericDiachronicToMermaid(definition)
    
    expect(result).toContain('Generic Diachronic Structure')
  })

  it('should sanitize GDU IDs with special characters', () => {
    const definition: GenericDiachronicStructureDefinition = {
      name: 'Special Chars GDS',
      core_gdus: ['gdu-with-hyphens!@#', 'normal_gdu']
    }
    
    const result = transformGenericDiachronicToMermaid(definition)
    
    expect(result).toContain('gdu-with-hyphens!@#')
    expect(result).toContain('normal_gdu')
  })
})

describe('transformDagToMermaid', () => {
  it('should return error message when no DAG data provided', () => {
    const result = transformDagToMermaid()
    
    expect(result).toContain('graph TD;')
    expect(result).toContain('error_no_data')
    expect(result).toContain('Error: No DAG data provided')
  })

  it('should return error message when DAG data incomplete', () => {
    const dagData = { nodes: [] } as any
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('error_no_data')
  })

  it('should transform valid DAG to Mermaid', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { id: 'var1', label: 'Variable 1' },
        { id: 'var2', label: 'Variable 2' }
      ],
      edges: [
        { source: 'var1', target: 'var2', rationale: 'causes' }
      ]
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('graph TD;')
    expect(result).toContain('var1["Variable 1"]')
    expect(result).toContain('var2["Variable 2"]')
    expect(result).toContain('var1 -->|"causes"| var2')
  })

  it('should handle composite variables with special subgraph syntax', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { id: 'cluster1', label: 'Variable_Cluster_Complex' },
        { id: 'simple', label: 'Simple Variable' }
      ],
      edges: []
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('subgraph cluster1_group')
    expect(result).toContain('cluster1["Variable_Cluster_Complex"]')
    expect(result).not.toContain('subgraph simple_group')
  })

  it('should use different edge styles for time-indexed variables', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { id: 'var1_t1', label: 'Variable at T1' },
        { id: 'var2_t2', label: 'Variable at T2' },
        { id: 'normal', label: 'Normal Variable' }
      ],
      edges: [
        { source: 'var1_t1', target: 'var2_t2', rationale: 'temporal causation' },
        { source: 'normal', target: 'var1_t1', rationale: 'normal causation' }
      ]
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('var1_t1 ==>|"temporal causation"| var2_t2')
    expect(result).toContain('normal ==>|"normal causation"| var1_t1')
  })

  it('should skip invalid edges and warn', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { id: 'valid', label: 'Valid Node' }
      ],
      edges: [
        { source: 'valid', target: 'nonexistent', rationale: 'invalid edge' }
      ]
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping edge. Invalid/missing node')
    )
    expect(result).toContain('%%')
    expect(result).toContain('Skipping edge')
  })

  it('should handle nodes without labels', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { id: 'node1' },
        { id: 'node2', label: '' }
      ],
      edges: []
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('node1["Variable 1"]')
    expect(result).toContain('node2["Variable 2"]')
  })

  it('should handle edges without rationale', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { id: 'var1', label: 'Variable 1' },
        { id: 'var2', label: 'Variable 2' }
      ],
      edges: [
        { source: 'var1', target: 'var2' }
      ]
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('var1 -->|| var2')
  })

  it('should sanitize node IDs and handle missing IDs', () => {
    const dagData: P7_3_Output['final_dag'] = {
      nodes: [
        { label: 'Node Without ID' },
        { id: 'node-with-special!@#chars', label: 'Special Node' }
      ],
      edges: []
    }
    
    const result = transformDagToMermaid(dagData)
    
    expect(result).toContain('node_0')
    expect(result).toContain('node_with_special___chars')
  })
})