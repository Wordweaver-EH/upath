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

    // Mock successful LLM responses for all nodes
    mockContext.llmClient.generateContent.mockImplementation(async (request) => {
      const prompt = request.contents[0].parts[0].text;
      
      if (prompt.includes('TRANSCRIPTION ADHERENCE')) {
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
      } else if (prompt.includes('DATA TYPE REFINEMENT')) {
        return {
          response: {
            text: () => JSON.stringify({
              transcript_id: 'transcript-1',
              refined_data_transcript: [
                {
                  line_num: 1,
                  text: 'Interviewer: Tell me about your process.',
                  information_tags: ['L-tag']
                },
                {
                  line_num: 2,
                  text: 'Participant: First, I gather materials.',
                  information_tags: ['P-tag']
                },
                {
                  line_num: 3,
                  text: 'Participant: Then I organize them.',
                  information_tags: ['P-tag']
                }
              ]
            })
          }
        };
      }
      
      throw new Error('Unexpected LLM call');
    });
  });

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
      
      const session = executor.getSession(sessionId);
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
      
      const sessions = executor.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(sessionId1);
      expect(sessions).toContain(sessionId2);
    });

    it('should delete a session', async () => {
      const sessionId = await executor.createSession({
        transcripts: [],
        settings: {}
      });
      
      expect(executor.hasSession(sessionId)).toBe(true);
      
      executor.deleteSession(sessionId);
      
      expect(executor.hasSession(sessionId)).toBe(false);
      expect(executor.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('Execution control', () => {
    it('should execute single step', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {}
      });
      
      const result = await executor.executeStep(sessionId, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.completedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(result.nextStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      
      const session = executor.getSession(sessionId);
      expect(session?.state.currentStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(session?.state.lastCompletedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    });

    it('should handle step execution failure', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {}
      });
      
      // Make LLM fail
      mockContext.llmClient.generateContent.mockRejectedValue(new Error('LLM error'));
      
      const result = await executor.executeStep(sessionId, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('LLM error');
      
      const session = executor.getSession(sessionId);
      expect(session?.state.errors[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toBeDefined();
    });

    it('should pause execution', async () => {
      const sessionId = await executor.createSession({
        transcripts: [],
        settings: {}
      });
      
      executor.pauseSession(sessionId);
      
      const session = executor.getSession(sessionId);
      expect(session?.state.status).toBe('paused');
      
      // Should not execute when paused
      const result = await executor.executeStep(sessionId, mockContext);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('paused');
    });

    it('should resume execution', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'content'
        }],
        settings: {}
      });
      
      executor.pauseSession(sessionId);
      executor.resumeSession(sessionId);
      
      const session = executor.getSession(sessionId);
      expect(session?.state.status).toBe('running');
      
      // Should execute after resume
      const result = await executor.executeStep(sessionId, mockContext);
      expect(result.success).toBe(true);
    });
  });

  describe('Full execution', () => {
    it('should execute all steps until completion', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {}
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
      
      expect(results).toHaveLength(3); // P0_1, P0_2, P0_3
      expect(results[0].completedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(results[1].completedStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(results[2].completedStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(results[2].hasMore).toBe(false);
    });

    it('should execute until a specific step', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Interview content'
        }],
        settings: {}
      });
      
      const results = await executor.executeUntil(
        sessionId, 
        mockContext, 
        StepId.P0_2_REFINE_DATA_TYPES
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].completedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(results[1].completedStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      
      const session = executor.getSession(sessionId);
      expect(session?.state.currentStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });
  });

  describe('State recovery', () => {
    it('should restore session from state', () => {
      const existingState: GraphState = {
        sessionId: 'existing-session',
        currentStep: StepId.P0_2_REFINE_DATA_TYPES,
        lastCompletedStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'content'
        }],
        stepOutputs: {
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
      
      executor.restoreSession(existingState);
      
      const session = executor.getSession('existing-session');
      expect(session).toBeDefined();
      expect(session?.state.currentStep).toBe(StepId.P0_2_REFINE_DATA_TYPES);
      expect(session?.state.lastCompletedStep).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
    });
  });

  describe('Event handling', () => {
    it('should emit events during execution', async () => {
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
        settings: {}
      });
      
      await executor.executeStep(sessionId, mockContext);
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('stepStart');
      expect(events[0].sessionId).toBe(sessionId);
      expect(events[0].stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      
      expect(events[1].type).toBe('stepComplete');
      expect(events[1].sessionId).toBe(sessionId);
      expect(events[1].stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
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
      
      // Manually set to completed state
      const session = executor.getSession(sessionId);
      if (session) {
        session.state.status = 'completed';
        session.state.currentStep = StepId.COMPLETE;
      }
      
      const result = await executor.executeStep(sessionId, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already completed');
    });
  });
});