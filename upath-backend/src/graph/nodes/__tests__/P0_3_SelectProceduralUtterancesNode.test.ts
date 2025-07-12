import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0_3_SelectProceduralUtterancesNode } from '../P0_3_SelectProceduralUtterancesNode';
import { GraphState, ExecutionContext, StepId } from '../../types';
import { P0_2_Output, P0_3_Output } from '../../types/outputs';

describe('P0_3_SelectProceduralUtterancesNode', () => {
  let node: P0_3_SelectProceduralUtterancesNode;
  let mockContext: ExecutionContext;
  let testState: GraphState;

  beforeEach(() => {
    node = new P0_3_SelectProceduralUtterancesNode();
    
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

    // State with P0_2 output already completed
    testState = {
      sessionId: 'test-session',
      currentStep: StepId.P0_2_REFINE_DATA_TYPES,
      transcripts: [{
        id: 'transcript-1',
        filename: 'test-interview.txt',
        content: 'Interview content...'
      }],
      stepOutputs: {
        [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: {
          transcript_id: 'transcript-1',
          line_numbered_transcript: [
            '1: Interviewer: Tell me about your process.',
            '2: Participant: Well, first I gather all the materials.',
            '3: Participant: Then I organize them by type.',
            '4: Interviewer: What types are there?',
            '5: Participant: There are documents, images, and data files.',
            '6: Participant: After sorting, I scan each document.',
            '7: Interviewer: How long does that take?',
            '8: Participant: Usually about 30 minutes per batch.'
          ],
          transcription_convention_notes: 'Clear speaker labels',
          initial_impressions_log: 'Describes categorization and scanning process'
        },
        [StepId.P0_2_REFINE_DATA_TYPES]: {
          transcript_id: 'transcript-1',
          refined_data_transcript: [
            {
              line_num: 1,
              text: 'Interviewer: Tell me about your process.',
              information_tags: ['L-tag'],
              decision_notes: 'Leading question asking for procedural information'
            },
            {
              line_num: 2,
              text: 'Participant: Well, first I gather all the materials.',
              information_tags: ['P-tag'],
              decision_notes: 'First procedural step'
            },
            {
              line_num: 3,
              text: 'Participant: Then I organize them by type.',
              information_tags: ['P-tag'],
              decision_notes: 'Second procedural step'
            },
            {
              line_num: 4,
              text: 'Interviewer: What types are there?',
              information_tags: ['L-tag'],
              decision_notes: 'Clarification question'
            },
            {
              line_num: 5,
              text: 'Participant: There are documents, images, and data files.',
              information_tags: ['I-tag'],
              decision_notes: 'Information about categories'
            },
            {
              line_num: 6,
              text: 'Participant: After sorting, I scan each document.',
              information_tags: ['P-tag'],
              decision_notes: 'Third procedural step'
            },
            {
              line_num: 7,
              text: 'Interviewer: How long does that take?',
              information_tags: ['L-tag'],
              decision_notes: 'Time inquiry'
            },
            {
              line_num: 8,
              text: 'Participant: Usually about 30 minutes per batch.',
              information_tags: ['I-tag'],
              decision_notes: 'Time information'
            }
          ]
        } as P0_2_Output
      },
      errors: {},
      metadata: {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        settings: {
          model: 'gemini-1.5-pro',
          temperature: 0.1
        }
      }
    };
  });

  describe('Basic properties', () => {
    it('should have correct step ID', () => {
      expect(node.id).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
    });

    it('should have appropriate retry policy', () => {
      expect(node.retryPolicy.maxAttempts).toBe(3);
      expect(node.retryPolicy.backoff).toBe('exponential');
    });
  });

  describe('Input validation', () => {
    it('should fail if P0_2 output is missing', async () => {
      delete testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('P0_2 output not found');
      expect(result.error?.recoverable).toBe(false);
    });

    it('should fail if refined_data_transcript is missing', async () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      p0_2_output.refined_data_transcript = undefined as any;
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No refined transcript');
      expect(result.error?.recoverable).toBe(false);
    });

    it('should fail if refined_data_transcript is empty', async () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      p0_2_output.refined_data_transcript = [];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No refined transcript');
      expect(result.error?.recoverable).toBe(false);
    });
  });

  describe('Procedural filtering logic', () => {
    it('should filter utterances with P-tag', () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      const filtered = node.filterProceduralUtterances(p0_2_output);
      
      expect(filtered).toHaveLength(3);
      expect(filtered[0].line_num).toBe(2);
      expect(filtered[1].line_num).toBe(3);
      expect(filtered[2].line_num).toBe(6);
    });

    it('should handle utterances with multiple tags including P-tag', () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      // Add a line with multiple tags including P-tag
      p0_2_output.refined_data_transcript.push({
        line_num: 9,
        text: 'Participant: And then I file them, which helps track progress.',
        information_tags: ['P-tag', 'I-tag'],
        decision_notes: 'Both procedural and informational'
      });
      
      const filtered = node.filterProceduralUtterances(p0_2_output);
      
      expect(filtered).toHaveLength(4);
      expect(filtered[3].line_num).toBe(9);
    });

    it('should return empty array if no P-tag utterances exist', () => {
      const p0_2_output: P0_2_Output = {
        transcript_id: 'transcript-1',
        refined_data_transcript: [
          {
            line_num: 1,
            text: 'Interviewer: What do you think?',
            information_tags: ['L-tag']
          },
          {
            line_num: 2,
            text: 'Participant: It is good.',
            information_tags: ['I-tag']
          }
        ]
      };
      
      const filtered = node.filterProceduralUtterances(p0_2_output);
      
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Output generation', () => {
    it('should generate correct output structure', async () => {
      const result = await node.execute(testState, mockContext);
      
      expect(result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toBeDefined();
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      expect(output.transcript_id).toBe('transcript-1');
      expect(output.procedural_utterances).toHaveLength(3);
      expect(output.non_procedural_count).toBe(5);
      expect(output.total_utterance_count).toBe(8);
      expect(output.selection_summary).toContain('3 procedural utterances');
    });

    it('should preserve all fields from P-tag utterances', async () => {
      const result = await node.execute(testState, mockContext);
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      const firstUtterance = output.procedural_utterances[0];
      expect(firstUtterance.line_num).toBe(2);
      expect(firstUtterance.text).toBe('Participant: Well, first I gather all the materials.');
      expect(firstUtterance.information_tags).toContain('P-tag');
      expect(firstUtterance.decision_notes).toBe('First procedural step');
    });

    it('should generate appropriate summary', async () => {
      const result = await node.execute(testState, mockContext);
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      expect(output.selection_summary).toMatch(/Selected 3 procedural utterances out of 8 total/);
      expect(output.selection_summary).toMatch(/lines 2, 3, 6/);
    });

    it('should handle case with no procedural utterances', async () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      // Remove all P-tags
      p0_2_output.refined_data_transcript.forEach(line => {
        line.information_tags = line.information_tags.filter(tag => tag !== 'P-tag');
      });
      
      const result = await node.execute(testState, mockContext);
      const output = result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
      
      expect(output.procedural_utterances).toHaveLength(0);
      expect(output.selection_summary).toContain('No procedural utterances found');
    });
  });

  describe('State updates', () => {
    it('should update state correctly on success', async () => {
      // Add progress to context
      const contextWithProgress = {
        ...mockContext,
        progress: {
          percentage: 75,
          currentStepIndex: 2,
          totalSteps: 4
        }
      };
      
      const result = await node.execute(testState, contextWithProgress);
      
      expect(result.currentStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(result.lastCompletedStep).toBe(StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES);
      expect(result.metadata?.lastUpdateTime).toBeDefined();
      expect(result.progress).toBe(75);
    });

    it('should preserve previous step outputs', async () => {
      const result = await node.execute(testState, mockContext);
      
      // Should still have P0_1 and P0_2 outputs
      expect(result.stepOutputs?.[StepId.P0_1_TRANSCRIPTION_ADHERENCE]).toBeDefined();
      expect(result.stepOutputs?.[StepId.P0_2_REFINE_DATA_TYPES]).toBeDefined();
      // And new P0_3 output
      expect(result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toBeDefined();
    });
  });

  describe('Error recovery', () => {
    it('should mark input validation errors as non-recoverable', async () => {
      delete testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES];
      
      const result = await node.executeWithRetry(testState, mockContext);
      
      expect(result.error?.recoverable).toBe(false);
    });

    it('should not require LLM for this node', async () => {
      // This node doesn't use LLM, it's purely filtering logic
      const result = await node.execute(testState, mockContext);
      
      expect(mockContext.llmClient.generateContent).not.toHaveBeenCalled();
      expect(result.stepOutputs?.[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle utterances with empty information_tags', () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      p0_2_output.refined_data_transcript.push({
        line_num: 10,
        text: 'Some text',
        information_tags: []
      });
      
      const filtered = node.filterProceduralUtterances(p0_2_output);
      
      // Should not crash and should only return P-tag utterances
      expect(filtered).toHaveLength(3);
    });

    it('should handle utterances without decision_notes', async () => {
      const p0_2_output = testState.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
      p0_2_output.refined_data_transcript[1].decision_notes = undefined;
      
      const result = await node.execute(testState, mockContext);
      
      expect(result).toBeDefined();
    });
  });
});