import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphExecutor } from '../graphExecutor';
import { GraphBuilder } from '../graphBuilder';
import { NodeRegistry } from '../nodeRegistry';
import { StepId, ExecutionContext } from '../types';
import { BaseNode } from '../nodes/BaseNode';

describe('GraphExecutor Terminal Node Handling', () => {
  let executor: GraphExecutor;
  let builder: GraphBuilder;
  let registry: NodeRegistry;
  let mockContext: ExecutionContext;

  // Create a test node that's a terminal (no outgoing edges)
  class TerminalNode extends BaseNode {
    id = 'TERMINAL_NODE';
    
    async execute(state: any, context: any) {
      return {
        currentStep: this.id,
        lastCompletedStep: this.id,
        stepOutputs: {
          ...state.stepOutputs,
          [this.id]: { completed: true }
        }
      };
    }
  }

  beforeEach(() => {
    registry = new NodeRegistry();
    registry.registerNode('TERMINAL_NODE', TerminalNode);
    
    builder = new GraphBuilder(registry);
    // Create a simple graph: P_NEG1_1 -> TERMINAL_NODE (no edge from TERMINAL_NODE)
    builder.removeEdge(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    builder.addEdge(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, 'TERMINAL_NODE');
    
    executor = new GraphExecutor(builder.build());
    
    mockContext = {
      llmClient: {
        generateContent: vi.fn().mockImplementation(async (request) => {
          const prompt = request.contents[0].parts[0].text;
          
          if (prompt.includes('You are a data extraction assistant for micro-phenomenological research')) {
            return {
              response: {
                text: () => JSON.stringify({
                  transcript_id: 'test.txt',
                  independent_variable_details: 'Test IV',
                  dependent_variable_focus: ['emotional_response', 'cognitive_load']
                })
              }
            };
          }
          
          // Default for other nodes
          return {
            response: {
              text: () => JSON.stringify({
                transcript_id: 'test-1',
                line_numbered_transcript: ['1: Test'],
                transcription_convention_notes: 'Test',
                initial_impressions_log: 'Test'
              })
            }
          };
        })
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      settings: {}
    };
  });

  it('should transition terminal nodes to COMPLETE state', async () => {
    const sessionId = await executor.createSession({
      transcripts: [{
        id: 'test-1',
        filename: 'test.txt',
        content: 'test'
      }],
      settings: {},
      userDvFocus: {
        dv_focus: ['emotional_response', 'cognitive_load']
      }
    });

    // Execute P_NEG1_1
    const result1 = await executor.executeStep(sessionId, mockContext);
    expect(result1.success).toBe(true);
    expect(result1.hasMore).toBe(true);
    
    const session1 = await executor.getSession(sessionId);
    expect(session1?.state.currentStep).toBe('TERMINAL_NODE');

    // Execute TERMINAL_NODE
    const result2 = await executor.executeStep(sessionId, mockContext);
    expect(result2.success).toBe(true);
    expect(result2.hasMore).toBe(false); // No more steps
    
    const session2 = await executor.getSession(sessionId);
    // CRITICAL: After executing a terminal node, we should transition to COMPLETE
    expect(session2?.state.currentStep).toBe(StepId.COMPLETE);
    expect(session2?.state.status).toBe('completed');
    expect(session2?.state.progress).toBe(100);
  });

  it('should correctly handle P1_4 as terminal node in default graph', async () => {
    // Use the default graph where P1_4 is terminal
    const defaultRegistry = new NodeRegistry();
    const defaultBuilder = new GraphBuilder(defaultRegistry);
    const defaultExecutor = new GraphExecutor(defaultBuilder.build());
    
    const sessionId = await defaultExecutor.createSession({
      transcripts: [{
        id: 'test-1',
        filename: 'test.txt',
        content: 'test'
      }],
      settings: {},
      userDvFocus: {
        dv_focus: ['emotional_response', 'cognitive_load']
      }
    });

    // Mock responses for all steps
    mockContext.llmClient.generateContent
      .mockResolvedValueOnce({
        // P_NEG1_1 response
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test.txt',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          })
        }
      })
      .mockResolvedValueOnce({
        // P0_1 response
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-1',
            line_numbered_transcript: ['1: Test'],
            transcription_convention_notes: 'Test',
            initial_impressions_log: 'Test'
          })
        }
      })
      .mockResolvedValueOnce({
        // P0_2 response
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-1',
            refined_data_transcript: [{
              line_num: 1,
              text: 'Test',
              information_tags: ['experiential_content']
            }]
          })
        }
      })
      .mockResolvedValueOnce({
        // P0_3 response
        response: {
          text: () => JSON.stringify({
            transcript_id: 'test-1',
            selected_procedural_utterances: [{
              original_line_num: '1',
              utterance_text: 'Test',
              selection_justification: 'Test utterance'
            }],
            discarded_info_summary: 'None',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          })
        }
      })
      .mockResolvedValueOnce({
        // P1_1 response
        response: {
          text: () => JSON.stringify({
            segmented_utterances: [{
              original_line_num: '1',
              original_utterance: 'Test',
              segments: [{
                segment_id: 'seg_1_1',
                text: 'Test',
                temporal_marker: null,
                action_type: 'physical_action'
              }]
            }],
            total_segments: 1,
            segmentation_summary: 'Test segmentation'
          })
        }
      })
      .mockResolvedValueOnce({
        // P1_2 response
        response: {
          text: () => JSON.stringify({
            diachronic_units: [{
              unit_id: 'du_1',
              description: 'Test phase',
              source_segment_ids: ['seg_1_1']
            }],
            unit_metadata: {
              total_units: 1,
              grouping_criteria: 'Test grouping'
            }
          })
        }
      })
      .mockResolvedValueOnce({
        // P1_3 response
        response: {
          text: () => JSON.stringify({
            refined_diachronic_units: [{
              unit_id: 'du_1',
              original_description: 'Test phase',
              refined_description: 'Refined test phase',
              micro_gestures: [],
              temporal_markers: ['test'],
              source_segment_ids: ['seg_1_1']
            }],
            refinement_metadata: {
              total_micro_gestures: 0,
              refinement_approach: 'Test',
              temporal_flow: 'linear'
            }
          })
        }
      });

    // Execute all steps
    await defaultExecutor.executeStep(sessionId, mockContext); // P_NEG1_1
    await defaultExecutor.executeStep(sessionId, mockContext); // P0_1
    await defaultExecutor.executeStep(sessionId, mockContext); // P0_2
    await defaultExecutor.executeStep(sessionId, mockContext); // P0_3
    await defaultExecutor.executeStep(sessionId, mockContext); // P1_1
    await defaultExecutor.executeStep(sessionId, mockContext); // P1_2
    const p1_3Result = await defaultExecutor.executeStep(sessionId, mockContext); // P1_3
    
    expect(p1_3Result.success).toBe(true);
    expect(p1_3Result.hasMore).toBe(true); // P1_4 is next
    
    // Mock P1_4 response
    mockContext.llmClient.generateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({
          transcript_id: 'test-1',
          specific_diachronic_structure: {
            title: 'Test Experience',
            phases: [{
              phase_id: 'phase_1',
              phase_name: 'Beginning',
              units: [{
                unit_id: 'du_1',
                description: 'Refined test phase',
                temporal_phase: 'Beginning',
                start_time_ms: 0,
                end_time_ms: 100
              }]
            }]
          },
          mermaid_syntax_specific_diachronic: 'gantt\n    title Test'
        })
      }
    });
    
    const finalResult = await defaultExecutor.executeStep(sessionId, mockContext); // P1_4
    
    expect(finalResult.success).toBe(true);
    expect(finalResult.hasMore).toBe(false);
    
    const finalSession = await defaultExecutor.getSession(sessionId);
    expect(finalSession?.state.currentStep).toBe(StepId.COMPLETE);
    expect(finalSession?.state.status).toBe('completed');
    expect(finalSession?.state.lastCompletedStep).toBe(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE);
  });

  it('should not get stuck in infinite loop on terminal nodes', async () => {
    const sessionId = await executor.createSession({
      transcripts: [{
        id: 'test-1',
        filename: 'test.txt',
        content: 'test'
      }],
      settings: {},
      userDvFocus: {
        dv_focus: ['emotional_response', 'cognitive_load']
      }
    });

    // Execute until completion
    let stepCount = 0;
    const maxSteps = 10; // Safety limit
    
    while (stepCount < maxSteps) {
      const result = await executor.executeStep(sessionId, mockContext);
      if (!result.success || !result.hasMore) {
        break;
      }
      stepCount++;
    }
    
    // Should complete in 2 steps (P_NEG1_1 -> TERMINAL_NODE)
    expect(stepCount).toBe(1); // Only one more step after initial
    
    const finalSession = await executor.getSession(sessionId);
    expect(finalSession?.state.currentStep).toBe(StepId.COMPLETE);
    expect(finalSession?.state.status).toBe('completed');
  });
});