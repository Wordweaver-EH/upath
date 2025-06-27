import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateMarkdownReportProgrammatically, type ReportData } from './reportHelper'
import type { 
  P5_2_RefinementOutput,
  P3_2_Output,
  P3_3_Output,
  P4S_1_Output,
  P7_1_Output,
  P7_3b_Output,
  P7_5_Output,
  RawTranscript
} from '../types'

// Mock calculateGduUtteranceCounts and other helpers since they're from htmlHelper
vi.mock('./htmlHelper', () => ({
  calculateGduUtteranceCounts: vi.fn().mockReturnValue([]),
  calculateGssCategoryUtteranceCounts: vi.fn().mockReturnValue([]),
  calculateGduTransitionCounts: vi.fn().mockReturnValue([])
}))

describe('generateMarkdownReportProgrammatically', () => {
  let baseReportData: ReportData

  beforeEach(() => {
    // Create minimal valid ReportData for testing
    baseReportData = {
      p5_output: {
        final_refined_generic_diachronic_structure_summary: 'Test refined summary',
        final_refined_generic_synchronic_structures_summary: {
          'gdu1': 'GSS summary for GDU1'
        },
        refinement_log: [
          {
            observation: 'Test observation',
            adjustment_made: 'Test adjustment',
            justification: 'Test justification'
          }
        ],
        emergent_insights: ['Test insight 1', 'Test insight 2'],
        hypotheses_generated: ['Initial hypothesis 1']
      } as P5_2_RefinementOutput,
      p3_2_output: {
        identified_gdus: [
          {
            gdu_id: 'gdu1',
            definition: 'Test GDU definition',
            supporting_transcripts_count: 2,
            contributing_refined_du_ids: [
              { transcript_id: 'tx1', refined_du_id: 'rdu1' }
            ]
          }
        ]
      } as P3_2_Output,
      p3_3_output: {
        generic_diachronic_structure_definition: {
          name: 'Test GDS',
          description: 'Test GDS description',
          core_gdus: ['gdu1'],
          optional_gdus: ['gdu2'],
          typical_sequence: ['gdu1', 'gdu2']
        }
      } as P3_3_Output,
      p4s_outputs_by_gdu: {
        'gdu1': {
          generic_synchronic_structure: {
            description: 'Test GSS description',
            generic_nodes_categories: [
              { id: 'cat1', label: 'Test Category' }
            ],
            instantiation_notes: [
              {
                generic_category_id: 'cat1',
                textual_description: 'Test instantiation',
                example_specific_nodes: []
              }
            ]
          }
        } as P4S_1_Output
      },
      p7_1_output: {
        candidate_variables: [
          {
            variable_id: 'var1',
            variable_name: 'Test Variable',
            phenomenological_grounding: 'Test grounding description that is quite long to test truncation',
            measurement_type: 'ordinal',
            grounding_references: [
              { type: 'gdu', id: 'gdu1' }
            ]
          }
        ]
      } as P7_1_Output,
      p7_3b_output: {
        resolution_log: [
          {
            action_type: 'remove_edge',
            reason: 'circular dependency',
            details: 'Removed edge var1->var2',
            affected_variables: ['var1', 'var2']
          }
        ]
      } as P7_3b_Output,
      p7_5_output: {
        formal_causal_hypotheses: [
          {
            hypothesis_id: 'h1',
            causal_claim: 'Variable A causes Variable B',
            causal_concept: 'Direct causation',
            formal_query: 'A -> B',
            testable_prediction: 'When A increases, B should increase',
            related_primitive_ids: ['prim1'],
            related_path_analysis_ids: ['path1']
          }
        ]
      } as P7_5_Output,
      p7_3_or_3b_dag_output_for_stats: {},
      all_mermaid_syntaxes: {
        'gds_main': 'gantt\n  title Test GDS',
        'gss_gdu1': 'graph TD\n  A[Category] --> B[Node]',
        'cleaned_causal_dag': 'graph TD\n  A --> B'
      },
      transcripts_analyzed_summary: [
        {
          filename: 'transcript1.txt',
          iv_details: 'Test IV details',
          num_diachronic_phases: 3,
          num_core_gdus_related: 2
        },
        {
          filename: 'transcript2.txt',
          iv_details: 'Another IV',
          num_diachronic_phases: 2,
          num_core_gdus_related: 1
        }
      ],
      num_gss_inputs: 2,
      gds_name: 'Test GDS',
      gds_definition: {
        name: 'Test GDS',
        description: 'Test GDS description',
        core_gdus: ['gdu1'],
        optional_gdus: ['gdu2'],
        typical_sequence: ['gdu1', 'gdu2']
      },
      user_dv_focus: ['dependent_var1', 'dependent_var2'],
      gdu_utterance_counts: [],
      gss_category_utterance_counts: [],
      gdu_transition_counts: [],
      raw_transcripts: [
        { id: 'tx1', filename: 'transcript1.txt', content: 'content1' },
        { id: 'tx2', filename: 'transcript2.txt', content: 'content2' }
      ] as RawTranscript[]
    }
  })

  it('should generate basic markdown report structure', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('# µ-PATH Analysis Report')
    expect(result).toContain('## 1. Introduction')
    expect(result).toContain('## 2. Transcripts Analyzed')
    expect(result).toContain('## 3. Generic Diachronic Structure (GDS)')
    expect(result).toContain('## 4. Generic Synchronic Structures (GSS)')
    expect(result).toContain('## 6. Holistic Refinement Summary (P5.2)')
    expect(result).toContain('## 7. Proposed Causal Model')
    expect(result).toContain('## 8. Conclusion')
    expect(result).toContain('## 9. Appendix')
  })

  it('should include current date', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    const currentDate = new Date().toISOString().slice(0, 10)
    
    expect(result).toContain(`**Date:** ${currentDate}`)
  })

  it('should include dependent variable focus', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('`dependent\\_var1`')
    expect(result).toContain('`dependent\\_var2`')
  })

  it('should generate transcripts table correctly', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('| Filename | Independent Variable \\(IV\\) Details | \\# Diachronic Phases \\(P1\\.4\\) | \\# Core GDUs Involved |')
    expect(result).toContain('| transcript1\\.txt | Test IV details | 3 | 2 |')
    expect(result).toContain('| transcript2\\.txt | Another IV | 2 | 1 |')
  })

  it('should include GDS information', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('### 3.1. GDS Definition: Test GDS')
    expect(result).toContain('- **Description:** Test GDS description')
    expect(result).toContain('- **Core GDUs:** `gdu1`')
    expect(result).toContain('- **Optional GDUs:** `gdu2`')
    expect(result).toContain('- **Typical Sequence:** `gdu1` -> `gdu2`')
  })

  it('should include Mermaid diagrams', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('```mermaid')
    expect(result).toContain('gantt')
    expect(result).toContain('title Test GDS')
    expect(result).toContain('graph TD')
    expect(result).toContain('A --> B')
  })

  it('should handle missing optional GDUs', () => {
    const dataWithoutOptionalGDUs = {
      ...baseReportData,
      p3_3_output: {
        generic_diachronic_structure_definition: {
          name: 'Test GDS',
          description: 'Test description',
          core_gdus: ['gdu1']
          // No optional_gdus
        }
      } as P3_3_Output,
      gds_definition: {
        name: 'Test GDS',
        description: 'Test description',
        core_gdus: ['gdu1']
        // No optional_gdus
      }
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutOptionalGDUs)
    
    expect(result).toContain('- **Core GDUs:** `gdu1`')
    expect(result).not.toContain('- **Optional GDUs:**')
  })

  it('should handle missing typical sequence', () => {
    const dataWithoutSequence = {
      ...baseReportData,
      p3_3_output: {
        generic_diachronic_structure_definition: {
          name: 'Test GDS',
          description: 'Test description',
          core_gdus: ['gdu1']
          // No typical_sequence
        }
      } as P3_3_Output,
      gds_definition: {
        name: 'Test GDS',
        description: 'Test description',
        core_gdus: ['gdu1']
        // No typical_sequence
      }
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutSequence)
    
    expect(result).toContain('- **Core GDUs:** `gdu1`')
    expect(result).not.toContain('- **Typical Sequence:**')
  })

  it('should include GSS information for each core GDU', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('### 4.1. GSS for GDU: `gdu1`')
    expect(result).toContain('- **GDU Definition:** Test GDU definition')
    expect(result).toContain('- **GSS Description:** Test GSS description')
    expect(result).toContain('- **Key Categories/Nodes:** `Test Category`')
  })

  it('should include P5 holistic refinement information', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('Test refined summary')
    expect(result).toContain('**GDU `gdu1`:** GSS summary for GDU1')
    expect(result).toContain('- **Observation:** Test observation')
    expect(result).toContain('- **Adjustment:** Test adjustment')
    expect(result).toContain('- **Justification:** Test justification')
    expect(result).toContain('- Test insight 1')
    expect(result).toContain('- Test insight 2')
    expect(result).toContain('- Initial hypothesis 1')
  })

  it('should include causal model information', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    // P7.1 Variables table
    expect(result).toContain('| ID | Name | Phenomenological Grounding \\(Excerpt\\) | Measurement Type | Grounding Refs \\(Type:ID\\) |')
    expect(result).toContain('| var1 | Test Variable | Test grounding description that is quite long to t\\.\\.\\. | ordinal | gdu:gdu1 |')
    
    // P7.3b Resolution log
    expect(result).toContain('- **Action:** remove\\_edge')
    expect(result).toContain('- **Reason:** circular dependency')
    expect(result).toContain('- **Details:** Removed edge var1->var2')
    expect(result).toContain('- *Affected: var1, var2*')
    
    // P7.5 Hypotheses
    expect(result).toContain('#### Hypothesis: `h1`')
    expect(result).toContain('- **Claim:** Variable A causes Variable B')
    expect(result).toContain('- **Concept:** Direct causation')
    expect(result).toContain('- **Formal Query:** `A -> B`')
    expect(result).toContain('- **Testable Prediction:** When A increases, B should increase')
    expect(result).toContain('- *Related P7.3 Primitives: prim1*')
    expect(result).toContain('- *Related P7.4 Analyses: path1*')
  })

  it('should prefer cleaned causal DAG over initial DAG', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('Cleaned Causal DAG')
    expect(result).not.toContain('Initial Proposed Causal DAG')
  })

  it('should use initial DAG when cleaned DAG is not available', () => {
    const dataWithInitialDag = {
      ...baseReportData,
      all_mermaid_syntaxes: {
        'gds_main': 'gantt\n  title Test GDS',
        'initial_causal_dag': 'graph TD\n  Initial --> Graph'
        // No cleaned_causal_dag
      }
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithInitialDag)
    
    expect(result).toContain('Initial Proposed Causal DAG')
    expect(result).not.toContain('Cleaned Causal DAG')
  })

  it('should include appendix with Mermaid syntaxes', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('### Syntax for: GDS: Test GDS')
    expect(result).toContain('### Syntax for: GSS for GDU: gdu1')
    expect(result).toContain('### Syntax for: Cleaned Causal DAG')
  })

  it('should handle missing P5 data gracefully', () => {
    const dataWithoutP5 = {
      ...baseReportData,
      p5_output: undefined as any
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutP5)
    
    expect(result).toContain('*Holistic refinement data (P5.2) not available.*')
  })

  it('should handle missing causal model data gracefully', () => {
    const dataWithoutCausal = {
      ...baseReportData,
      p7_1_output: undefined as any,
      p7_3b_output: undefined as any,
      p7_5_output: undefined as any
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutCausal)
    
    expect(result).toContain('*Causal modeling data (P7.1, P7.3b/P7.3, P7.5) not fully available.*')
  })

  it('should handle missing GDS data gracefully', () => {
    const dataWithoutGDS = {
      ...baseReportData,
      p3_3_output: undefined as any,
      gds_definition: undefined as any
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutGDS)
    
    expect(result).toContain('*Generic Diachronic Structure data not available.*')
  })

  it('should handle missing GSS data gracefully', () => {
    const dataWithoutGSS = {
      ...baseReportData,
      p4s_outputs_by_gdu: undefined as any
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutGSS)
    
    expect(result).toContain('*No core GDUs identified for GSS analysis or GSS data missing.*')
  })

  it('should handle empty refinement log', () => {
    const dataWithEmptyLog = {
      ...baseReportData,
      p5_output: {
        ...baseReportData.p5_output,
        refinement_log: []
      } as P5_2_RefinementOutput
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithEmptyLog)
    
    expect(result).toContain('*No refinement log entries.*')
  })

  it('should handle empty emergent insights', () => {
    const dataWithEmptyInsights = {
      ...baseReportData,
      p5_output: {
        ...baseReportData.p5_output,
        emergent_insights: []
      } as P5_2_RefinementOutput
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithEmptyInsights)
    
    expect(result).toContain('*No emergent insights recorded.*')
  })

  it('should handle empty hypotheses', () => {
    const dataWithEmptyHypotheses = {
      ...baseReportData,
      p5_output: {
        ...baseReportData.p5_output,
        hypotheses_generated: []
      } as P5_2_RefinementOutput
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithEmptyHypotheses)
    
    expect(result).toContain('*No initial hypotheses generated in P5.*')
  })

  it('should handle empty formal causal hypotheses', () => {
    const dataWithEmptyFormalHyp = {
      ...baseReportData,
      p7_5_output: {
        formal_causal_hypotheses: []
      } as P7_5_Output
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithEmptyFormalHyp)
    
    expect(result).toContain('*No formal causal hypotheses generated (P7.5).*')
  })

  it('should escape markdown special characters', () => {
    const dataWithSpecialChars = {
      ...baseReportData,
      p3_3_output: {
        generic_diachronic_structure_definition: {
          name: 'Test*GDS*with_special#chars',
          description: 'Description with [brackets] and `backticks`',
          core_gdus: ['gdu1']
        }
      } as P3_3_Output,
      gds_definition: {
        name: 'Test*GDS*with_special#chars',
        description: 'Description with [brackets] and `backticks`',
        core_gdus: ['gdu1']
      }
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithSpecialChars)
    
    expect(result).toContain('Test\\*GDS\\*with\\_special\\#chars')
    expect(result).toContain('Description with \\[brackets\\] and \\`backticks\\`')
  })

  it('should truncate long phenomenological grounding in variables table', () => {
    const result = generateMarkdownReportProgrammatically(baseReportData)
    
    expect(result).toContain('Test grounding description that is quite long to t\\.\\.\\.')
    expect(result).not.toContain('Test grounding description that is quite long to test truncation')
  })

  it('should handle missing Mermaid syntaxes gracefully', () => {
    const dataWithoutMermaid = {
      ...baseReportData,
      all_mermaid_syntaxes: {}
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutMermaid)
    
    expect(result).toContain('*Mermaid diagram for "Generic Diachronic Structure: Test GDS" not available or empty.*')
  })

  it('should handle GSS without instantiation notes', () => {
    const dataWithoutInstantiation = {
      ...baseReportData,
      p4s_outputs_by_gdu: {
        'gdu1': {
          generic_synchronic_structure: {
            description: 'Test GSS description',
            generic_nodes_categories: [
              { id: 'cat1', label: 'Test Category' }
            ]
            // No instantiation_notes
          }
        } as P4S_1_Output
      }
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutInstantiation)
    
    expect(result).toContain('*No detailed instantiation notes available for this GSS.*')
  })

  it('should handle variables without grounding references', () => {
    const dataWithoutRefs = {
      ...baseReportData,
      p7_1_output: {
        candidate_variables: [
          {
            variable_id: 'var1',
            variable_name: 'Test Variable',
            phenomenological_grounding: 'Test grounding',
            measurement_type: 'ordinal'
            // No grounding_references
          }
        ]
      } as P7_1_Output
    }
    
    const result = generateMarkdownReportProgrammatically(dataWithoutRefs)
    
    expect(result).toContain('| var1 | Test Variable | Test grounding\\.\\.\\. | ordinal | N/A |')
  })
})