import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphExecutor } from '../graphExecutor';
import { GraphBuilder } from '../graphBuilder';
import { NodeRegistry } from '../nodeRegistry';
import { GraphState, ExecutionContext, StepId } from '../types';
import { createInitialGraphState } from '../types/state';

describe('GraphExecutor', () => {
  let executor: GraphExecutor;
  let builder: GraphBuilder;
  let registry: NodeRegistry;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    registry = new NodeRegistry();
    builder = new GraphBuilder(registry);
    executor = new GraphExecutor(builder.build());
    
    mockContext = {
      llmClient: {
        generateContent: vi.fn()
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      settings: {
        model: 'gemini-1.5-pro',
        temperature: 0.1
      }
    };

    // Don't set up generic mock here - let individual tests handle their own mocks
  });

  // Helper to set up default LLM mocks
  const setupDefaultMocks = () => {
    mockContext.llmClient.generateContent.mockImplementation(async (request) => {
      const prompt = request.contents[0].parts[0].text;
      
      if (prompt.includes('You are a data extraction assistant for micro-phenomenological research')) {
        return {
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              independent_variable_details: 'Test IV details',
              dependent_variable_focus: ['emotional_response', 'cognitive_load']
            })
          }
        };
      } else if (prompt.includes('TRANSCRIPTION ADHERENCE')) {
        return {
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              line_numbered_transcript: [
                '1: Interviewer: Tell me about your process.',
                '2: Participant: First, I gather materials.',
                '3: Participant: Then I organize them.'
              ],
              transcription_convention_notes: 'Clear speaker labels',
              initial_impressions_log: 'Process description'
            })
          }
        };
      } else if (prompt.includes('micro-phenomenological data preparation analyst')) {
        // P0_2 response
        return {
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              refined_data_transcript: [
                {
                  line_num: 1,
                  text: 'Interviewer: Tell me about your process.',
                  information_tags: ['procedural_information']
                },
                {
                  line_num: 2,
                  text: 'Participant: First, I gather materials.',
                  information_tags: ['experiential_content']
                },
                {
                  line_num: 3,
                  text: 'Participant: Then I organize them.',
                  information_tags: ['experiential_content']
                }
              ]
            })
          }
        };
      } else if (prompt.includes('micro-phenomenological analyst') && prompt.includes('select utterances crucial')) {
        // P0_3 response
        return {
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              selected_procedural_utterances: [
                {
                  original_line_num: '2',
                  utterance_text: 'Participant: First, I gather materials.',
                  selection_justification: 'Describes first action in process'
                },
                {
                  original_line_num: '3',
                  utterance_text: 'Participant: Then I organize them.',
                  selection_justification: 'Describes second action in process'
                }
              ],
              discarded_info_summary: 'Interviewer questions excluded',
              independent_variable_details: 'Test IV details',
              dependent_variable_focus: ['emotional_response', 'cognitive_load']
            })
          }
        };
      } else if (prompt.includes('fine-grained temporal segmentation')) {
        // P1_1 response
        return {
          response: {
            text: () => JSON.stringify({
              segmented_utterances: [
                {
                  original_line_num: '2',
                  original_utterance: 'Participant: First, I gather materials.',
                  segments: [{
                    segment_id: 'seg_2_1',
                    text: 'First, I gather materials.',
                    temporal_marker: 'First',
                    action_type: 'physical_action'
                  }]
                },
                {
                  original_line_num: '3',
                  original_utterance: 'Participant: Then I organize them.',
                  segments: [{
                    segment_id: 'seg_3_1',
                    text: 'Then I organize them.',
                    temporal_marker: 'Then',
                    action_type: 'physical_action'
                  }]
                }
              ],
              total_segments: 2,
              segmentation_summary: 'Fine-grained segmentation based on temporal markers'
            })
          }
        };
      } else if (prompt.includes('DIACHRONIC UNIT IDENTIFICATION')) {
        return {
          response: {
            text: () => JSON.stringify({
              diachronic_units: [{
                unit_id: 'du_1',
                description: 'Materials gathering phase',
                source_segment_ids: ['seg_2_1', 'seg_3_1']
              }],
              unit_metadata: {
                total_units: 1,
                grouping_criteria: 'Single segment forms one coherent unit'
              }
            })
          }
        };
      } else if (prompt.includes('refine the Diachronic Units')) {
        return {
          response: {
            text: () => JSON.stringify({
              refined_diachronic_units: [{
                unit_id: 'du_1',
                original_description: 'Materials gathering phase',
                refined_description: 'Refined materials gathering phase',
                micro_gestures: [],
                temporal_markers: [],
                source_segment_ids: ['seg_2_1', 'seg_3_1'],
                temporal_phase: 'Beginning',
                confidence: 0.9
              }],
              refinement_metadata: {
                total_micro_gestures: 0,
                refinement_approach: 'Test',
                temporal_flow: 'linear'
              }
            })
          }
        };
      } else if (prompt.includes('construct the Specific Diachronic Structure')) {
        // P1_4 response
        return {
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              specific_diachronic_structure: {
                summary: 'Material gathering experience flow',
                phases: [{
                  phase_name: 'Beginning',
                  description: 'Initial material gathering phase',
                  units_involved: ['du_1']
                }],
                visualization_hint: 'Linear progression',
                iv_preliminary_observation: 'No immediate IV connection apparent at this stage.'
              },
              independent_variable_details: 'Test IV details',
              dependent_variable_focus: ['emotional_response', 'cognitive_load'],
              mermaid_syntax_specific_diachronic: 'gantt\n    title Material Gathering'
            })
          }
        };
      }
      
      throw new Error('Unexpected LLM call: ' + prompt.substring(0, 100));
    });
  };

  describe('Session management', () => {
    it('should create a new session', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Test content'
        }],
        settings: {
          model: 'gemini-1.5-pro',
          temperature: 0.1
        }
      });
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-/);
      
      const session = await executor.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.state.sessionId).toBe(sessionId);
    });

    it('should list active sessions', async () => {
      const sessionId1 = await executor.createSession({
        transcripts: [],
        settings: {}
      });
      
      const sessionId2 = await executor.createSession({
        transcripts: [],
        settings: {}
      });
      
      const sessions = await executor.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(sessionId1);
      expect(sessions).toContain(sessionId2);
    });

    it('should delete a session', async () => {
      const sessionId = await executor.createSession({
        transcripts: [],
        settings: {}
      });
      
      expect(await executor.hasSession(sessionId)).toBe(true);
      
      await executor.deleteSession(sessionId);
      
      expect(await executor.hasSession(sessionId)).toBe(false);
      expect(await executor.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('Execution control', () => {
    it('should execute single step', async () => {
      setupDefaultMocks();
      
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {},
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        }
      });
      
      const result = await executor.executeStep(sessionId, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.completedStep).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      expect(result.nextStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      
      const session = await executor.getSession(sessionId);
      expect(session?.state.currentStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(session?.state.lastCompletedStep).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
    });

    it('should handle step execution failure', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {},
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        }
      });
      
      // Make LLM fail
      mockContext.llmClient.generateContent.mockRejectedValue(new Error('LLM error'));
      
      const result = await executor.executeStep(sessionId, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('LLM error');
      
      const session = await executor.getSession(sessionId);
      expect(session?.state.errors[StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]).toBeDefined();
    });

    it('should pause execution', async () => {
      const sessionId = await executor.createSession({
        transcripts: [],
        settings: {}
      });
      
      await executor.pauseSession(sessionId);
      
      const session = await executor.getSession(sessionId);
      expect(session?.state.status).toBe('paused');
      
      // Should not execute when paused
      const result = await executor.executeStep(sessionId, mockContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('paused');
    });

    it('should resume execution', async () => {
      setupDefaultMocks();
      
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'content'
        }],
        settings: {},
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        }
      });
      
      await executor.pauseSession(sessionId);
      await executor.resumeSession(sessionId);
      
      const session = await executor.getSession(sessionId);
      expect(session?.state.status).toBe('running');
      
      // Should execute after resume
      const result = await executor.executeStep(sessionId, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('Full execution', () => {
    it('should execute all steps until completion', async () => {
      // Reset mock for this test
      mockContext.llmClient.generateContent.mockReset();
      
      // Set up mocks in order: P_NEG1_1, P0_1, P0_2, P0_3, P1_1, P1_2, P1_3, P1_4
      mockContext.llmClient.generateContent
        .mockResolvedValueOnce({
          // P_NEG1_1 response
          response: {
            text: () => JSON.stringify({
              transcript_id: 'test.txt',
              independent_variable_details: 'Test IV details',
              dependent_variable_focus: ['emotional_response', 'cognitive_load']
            })
          }
        })
        .mockResolvedValueOnce({
          // P0_1 response
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              line_numbered_transcript: [
                '1: Interviewer: Tell me about your process.',
                '2: Participant: First, I gather materials.',
                '3: Participant: Then I organize them.'
              ],
              transcription_convention_notes: 'Clear speaker labels',
              initial_impressions_log: 'Process description'
            })
          }
        })
        .mockResolvedValueOnce({
          // P0_2 response
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              refined_data_transcript: [
                {
                  line_num: 1,
                  text: 'Interviewer: Tell me about your process.',
                  information_tags: ['procedural_information']
                },
                {
                  line_num: 2,
                  text: 'Participant: First, I gather materials.',
                  information_tags: ['experiential_content']
                },
                {
                  line_num: 3,
                  text: 'Participant: Then I organize them.',
                  information_tags: ['experiential_content']
                }
              ]
            })
          }
        })
        .mockResolvedValueOnce({
          // P0_3 response
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              selected_procedural_utterances: [
                {
                  original_line_num: '2',
                  utterance_text: 'Participant: First, I gather materials.',
                  selection_justification: 'Describes first action in process'
                },
                {
                  original_line_num: '3',
                  utterance_text: 'Participant: Then I organize them.',
                  selection_justification: 'Describes second action in process'
                }
              ],
              discarded_info_summary: 'Interviewer questions excluded',
              independent_variable_details: 'Test IV details',
              dependent_variable_focus: ['emotional_response', 'cognitive_load']
            })
          }
        })
        .mockResolvedValueOnce({
          // P1_1 response
          response: {
            text: () => JSON.stringify({
              segmented_utterances: [
                {
                  original_line_num: '2',
                  original_utterance: 'Participant: First, I gather materials.',
                  segments: [{
                    segment_id: 'seg_2_1',
                    text: 'First, I gather materials.',
                    temporal_marker: 'First',
                    action_type: 'physical_action'
                  }]
                },
                {
                  original_line_num: '3',
                  original_utterance: 'Participant: Then I organize them.',
                  segments: [{
                    segment_id: 'seg_3_1',
                    text: 'Then I organize them.',
                    temporal_marker: 'Then',
                    action_type: 'physical_action'
                  }]
                }
              ],
              total_segments: 2,
              segmentation_summary: 'Fine-grained segmentation based on temporal markers'
            })
          }
        })
        .mockResolvedValueOnce({
          // P1_2 response
          response: {
            text: () => JSON.stringify({
              diachronic_units: [{
                unit_id: 'du_1',
                description: 'Materials gathering phase',
                source_segment_ids: ['seg_2_1', 'seg_3_1']
              }],
              unit_metadata: {
                total_units: 1,
                grouping_criteria: 'Single segment forms one coherent unit'
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
                original_description: 'Materials gathering phase',
                refined_description: 'Refined materials gathering phase',
                micro_gestures: [],
                temporal_markers: [],
                source_segment_ids: ['seg_2_1', 'seg_3_1'],
                temporal_phase: 'Beginning',
                confidence: 0.9
              }],
              refinement_metadata: {
                total_micro_gestures: 0,
                refinement_approach: 'Test',
                temporal_flow: 'linear'
              }
            })
          }
        })
        .mockResolvedValueOnce({
          // P1_4 response
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              specific_diachronic_structure: {
                summary: 'Material gathering experience flow',
                phases: [{
                  phase_name: 'Beginning',
                  description: 'Initial material gathering phase',
                  units_involved: ['du_1']
                }],
                visualization_hint: 'Linear progression',
                iv_preliminary_observation: 'No immediate IV connection apparent at this stage.'
              },
              independent_variable_details: 'Test IV details',
              dependent_variable_focus: ['emotional_response', 'cognitive_load'],
              mermaid_syntax_specific_diachronic: 'gantt\n    title Material Gathering'
            })
          }
        });
      
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {},
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        }
      });
      
      const results = [];
      const maxSteps = 10; // Safety limit
      let stepCount = 0;
      
      while (stepCount < maxSteps) {
        const result = await executor.executeStep(sessionId, mockContext);
        results.push(result);
        
        if (!result.success || !result.hasMore) {
          break;
        }
        
        stepCount++;
      }
      
      expect(results).toHaveLength(8); // P_NEG1_1, P0_1, P0_2, P0_3, P1_1, P1_2, P1_3, P1_4
      expect(results[0].completedStep).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      expect(results[1].completedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(results[2].completedStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(results[3].completedStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(results[3].hasMore).toBe(true); // P0_3 should indicate there's P1_1 next
      
      // Verify the 5th result (P1_1)
      expect(results[4]).toBeDefined();
      expect(results[4].success).toBe(true);
      expect(results[4].completedStep).toBe(StepId.P1_1_INITIAL_SEGMENTATION);
      expect(results[4].hasMore).toBe(true); // P1_1 should indicate there's P1_2 next
      
      // Verify the 6th result (P1_2)
      expect(results[5]).toBeDefined();
      expect(results[5].success).toBe(true);
      expect(results[5].completedStep).toBe(StepId.P1_2_DIACHRONIC_UNIT_ID);
      expect(results[5].hasMore).toBe(true); // P1_2 should indicate there's P1_3 next
      
      // Verify the 7th result (P1_3)
      expect(results[6]).toBeDefined();
      expect(results[6].success).toBe(true);
      expect(results[6].completedStep).toBe(StepId.P1_3_REFINE_DIACHRONIC_UNITS);
      expect(results[6].hasMore).toBe(true); // P1_3 should indicate there's P1_4 next
      
      // Verify the 8th result (P1_4)
      expect(results[7]).toBeDefined();
      expect(results[7].success).toBe(true);
      expect(results[7].completedStep).toBe(StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE);
      expect(results[7].hasMore).toBe(false);
    });

    it('should execute until a specific step', async () => {
      setupDefaultMocks();
      
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {},
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        }
      });
      
      const results = await executor.executeUntil(
        sessionId, 
        mockContext, 
        StepId.P0_2_REFINE_DATA_TYPES
      );
      
      expect(results).toHaveLength(3);
      expect(results[0].completedStep).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      expect(results[1].completedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(results[2].completedStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      
      const session = await executor.getSession(sessionId);
      expect(session?.state.currentStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });
  });

  describe('State recovery', () => {
    it('should restore session from state', async () => {
      const existingState: GraphState = {
        sessionId: 'existing-session',
        currentStep: StepId.P0_2_REFINE_DATA_TYPES,
        lastCompletedStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'content'
        }],
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        },
        stepOutputs: {
          [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: {
            transcript_id: 'transcript-1',
            independent_variable_details: 'Test IV',
            dependent_variable_focus: ['emotional_response', 'cognitive_load']
          },
          [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: {
            transcript_id: 'transcript-1',
            line_numbered_transcript: ['1: Line 1'],
            transcription_convention_notes: 'notes',
            initial_impressions_log: 'log'
          }
        },
        errors: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          settings: {}
        },
        status: 'idle'
      };
      
      await executor.restoreSession(existingState);
      
      const session = await executor.getSession('existing-session');
      expect(session).toBeDefined();
      expect(session?.state.currentStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(session?.state.lastCompletedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    });
  });

  describe('Event handling', () => {
    it('should emit events during execution', async () => {
      setupDefaultMocks();
      
      const events: any[] = [];
      
      executor.on('stepStart', (event) => events.push({ type: 'stepStart', ...event }));
      executor.on('stepComplete', (event) => events.push({ type: 'stepComplete', ...event }));
      executor.on('stepError', (event) => events.push({ type: 'stepError', ...event }));
      
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'content'
        }],
        settings: {},
        userDvFocus: {
          dv_focus: ['emotional_response', 'cognitive_load']
        }
      });
      
      await executor.executeStep(sessionId, mockContext);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('stepStart');
      expect(events[0].sessionId).toBe(sessionId);
      expect(events[0].stepId).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
      
      expect(events[1].type).toBe('stepComplete');
      expect(events[1].sessionId).toBe(sessionId);
      expect(events[1].stepId).toBe(StepId.P_NEG1_1_VARIABLE_IDENTIFICATION);
    });
  });

  describe('Error scenarios', () => {
    it('should throw error for invalid session', async () => {
      await expect(
        executor.executeStep('invalid-session', mockContext)
      ).rejects.toThrow('Session invalid-session not found');
    });

    it('should handle completed sessions', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'content'
        }],
        settings: {}
      });
      
      // Manually set to completed state by restoring a completed state
      const completedState: GraphState = {
        sessionId,
        currentStep: StepId.COMPLETE,
        lastCompletedStep: StepId.P0_2_REFINE_DATA_TYPES,
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        stepOutputs: {},
        errors: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          settings: {}
        },
        status: 'completed'
      };
      await executor.restoreSession(completedState);
      
      const result = await executor.executeStep(sessionId, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already completed');
    });
  });
});