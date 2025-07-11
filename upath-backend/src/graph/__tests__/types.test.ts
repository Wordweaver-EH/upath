import { describe, it, expect } from 'vitest';
import { 
  createInitialGraphState,
  isValidGraphState,
  GraphStateSchema,
  type GraphState, 
  type NodeExecutionResult, 
  type GraphMetadata, 
  type StepOutput 
} from '../types';

describe('GraphState Type System', () => {
  describe('createInitialGraphState', () => {
    it('should create a valid initial graph state', () => {
      const sessionId = 'test-session-123';
      const transcripts = [{
        id: 'transcript-1',
        filename: 'test.txt',
        content: 'test content'
      }];
      const settings = {
        model: 'gemini-1.5-pro',
        temperature: 0.3,
        autoRun: false
      };

      const state = createInitialGraphState(sessionId, transcripts, settings);

      expect(state.sessionId).toBe(sessionId);
      expect(state.currentStep).toBe('P0_1_TRANSCRIPTION_ADHERENCE');
      expect(state.transcripts).toEqual(transcripts);
      expect(state.stepOutputs).toEqual({});
      expect(state.errors).toEqual({});
      expect(state.metadata.settings).toEqual(settings);
      expect(state.metadata.startTime).toBeLessThanOrEqual(Date.now());
      expect(state.metadata.lastUpdateTime).toBe(state.metadata.startTime);
    });
  });

  describe('isValidGraphState', () => {
    it('should validate a correct graph state', () => {
      const validState = {
        sessionId: 'test-session',
        currentStep: 'P0_1_TRANSCRIPTION_ADHERENCE',
        transcripts: [],
        stepOutputs: {},
        errors: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          settings: {}
        }
      };

      expect(isValidGraphState(validState)).toBe(true);
    });

    it('should reject invalid graph state', () => {
      const invalidState = {
        sessionId: 'test-session',
        // missing currentStep
        transcripts: [],
        stepOutputs: {},
        errors: {},
        metadata: {}
      };

      expect(isValidGraphState(invalidState)).toBe(false);
    });
  });

  describe('GraphStateSchema', () => {
    it('should define the schema for LangGraph channels', () => {
      expect(GraphStateSchema).toBeDefined();
      expect(GraphStateSchema.sessionId).toBeDefined();
      expect(GraphStateSchema.currentStep).toBeDefined();
      expect(GraphStateSchema.transcripts).toBeDefined();
      expect(GraphStateSchema.stepOutputs).toBeDefined();
      expect(GraphStateSchema.errors).toBeDefined();
      expect(GraphStateSchema.metadata).toBeDefined();
    });
  });

  describe('GraphState', () => {
    it('should have required properties', () => {
      const state: GraphState = {
        sessionId: 'test-session-123',
        currentStep: 'P0_1_TRANSCRIPTION_ADHERENCE',
        transcripts: [],
        stepOutputs: {},
        errors: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          settings: {
            model: 'gemini-1.5-pro',
            temperature: 0.3,
            autoRun: false
          }
        }
      };

      expect(state.sessionId).toBeDefined();
      expect(state.currentStep).toBeDefined();
      expect(state.transcripts).toBeDefined();
      expect(state.stepOutputs).toBeDefined();
      expect(state.errors).toBeDefined();
      expect(state.metadata).toBeDefined();
    });

    it('should track step outputs by stepId', () => {
      const state: GraphState = {
        sessionId: 'test-session',
        currentStep: 'P0_2_REFINE_DATA_TYPES',
        transcripts: [{
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'test content'
        }],
        stepOutputs: {
          'P0_1_TRANSCRIPTION_ADHERENCE': {
            transcript_id: 'transcript-1',
            line_numbered_transcript: ['1: test'],
            transcription_convention_notes: 'notes',
            initial_impressions_log: 'impressions'
          }
        },
        errors: {},
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          settings: {}
        }
      };

      expect(state.stepOutputs['P0_1_TRANSCRIPTION_ADHERENCE']).toBeDefined();
      expect(state.stepOutputs['P0_1_TRANSCRIPTION_ADHERENCE'].transcript_id).toBe('transcript-1');
    });

    it('should track errors by stepId', () => {
      const state: GraphState = {
        sessionId: 'test-session',
        currentStep: 'P0_1_TRANSCRIPTION_ADHERENCE',
        transcripts: [],
        stepOutputs: {},
        errors: {
          'P0_1_TRANSCRIPTION_ADHERENCE': {
            message: 'Failed to process transcript',
            timestamp: Date.now(),
            recoverable: true
          }
        },
        metadata: {
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          settings: {}
        }
      };

      expect(state.errors['P0_1_TRANSCRIPTION_ADHERENCE']).toBeDefined();
      expect(state.errors['P0_1_TRANSCRIPTION_ADHERENCE'].message).toBe('Failed to process transcript');
      expect(state.errors['P0_1_TRANSCRIPTION_ADHERENCE'].recoverable).toBe(true);
    });
  });

  describe('NodeExecutionResult', () => {
    it('should support successful execution', () => {
      const result: NodeExecutionResult = {
        success: true,
        state: {
          currentStep: 'P0_2_REFINE_DATA_TYPES',
          stepOutputs: {
            'P0_1_TRANSCRIPTION_ADHERENCE': {
              transcript_id: 'test',
              line_numbered_transcript: [],
              transcription_convention_notes: '',
              initial_impressions_log: ''
            }
          }
        }
      };

      expect(result.success).toBe(true);
      expect(result.state).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should support error execution', () => {
      const result: NodeExecutionResult = {
        success: false,
        error: {
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          message: 'Network error',
          timestamp: Date.now(),
          recoverable: true
        }
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.state).toBeUndefined();
    });
  });

  describe('GraphMetadata', () => {
    it('should track execution metadata', () => {
      const metadata: GraphMetadata = {
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        settings: {
          model: 'gemini-1.5-pro',
          temperature: 0.3,
          autoRun: true,
          startFrom: 'P0_1_TRANSCRIPTION_ADHERENCE'
        },
        checkpointId: 'checkpoint-123',
        parentCheckpointId: 'checkpoint-122'
      };

      expect(metadata.startTime).toBeDefined();
      expect(metadata.lastUpdateTime).toBeDefined();
      expect(metadata.settings).toBeDefined();
      expect(metadata.checkpointId).toBeDefined();
      expect(metadata.parentCheckpointId).toBeDefined();
    });
  });

  describe('StepOutput', () => {
    it('should be a union of all possible step outputs', () => {
      // Test that StepOutput can hold P0_1_Output
      const p0_1_output: StepOutput = {
        transcript_id: 'test',
        line_numbered_transcript: ['1: line'],
        transcription_convention_notes: 'notes',
        initial_impressions_log: 'log'
      };

      // Test that StepOutput can hold P0_2_Output  
      const p0_2_output: StepOutput = {
        transcript_id: 'test',
        refined_data_transcript: [{
          line_num: 1,
          text: 'text',
          information_tags: ['tag']
        }]
      };

      // Test that StepOutput can hold P0_3_Output
      const p0_3_output: StepOutput = {
        transcript_id: 'test',
        selected_procedural_utterances: [{
          original_line_num: '1',
          utterance_text: 'text',
          selection_justification: 'justification'
        }],
        independent_variable_details: 'details',
        dependent_variable_focus: ['focus']
      };

      expect(p0_1_output).toBeDefined();
      expect(p0_2_output).toBeDefined();
      expect(p0_3_output).toBeDefined();
    });
  });
});