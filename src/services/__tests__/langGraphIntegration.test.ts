import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangGraphService } from '../langGraphService';
import { StepId } from '../../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LangGraphService Integration', () => {
  let service: LangGraphService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LangGraphService();
  });

  describe('Session Management', () => {
    it('should create a session with transcripts', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          sessionId: 'test-session-123',
          message: 'Session created successfully'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const transcripts = [
        {
          id: 'transcript-1',
          filename: 'test.txt',
          content: 'Test transcript content'
        }
      ];

      const settings = {
        apiKey: 'test-key',
        temperature: 0.7,
        userDvFocus: { dv_focus: ['focus1', 'focus2'] }
      };

      const sessionId = await service.createSession(transcripts, settings);

      expect(sessionId).toBe('test-session-123');
      expect(service.getCurrentSessionId()).toBe('test-session-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/graph/session',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcripts: [
              {
                id: 'transcript-1',
                filename: 'test.txt',
                content: 'Test transcript content'
              }
            ],
            settings: {
              userDvFocus: 'focus1, focus2',
              model: 'gemini-1.5-flash',
              temperature: 0.7,
              seed: undefined
            }
          })
        })
      );
    });

    it('should handle session creation errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: async () => ({ error: 'Invalid transcript format' })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const transcripts = [{ id: 'invalid', filename: '', content: '' }];
      const settings = { apiKey: 'test-key', temperature: 0.7, userDvFocus: { dv_focus: [] } };

      await expect(service.createSession(transcripts, settings)).rejects.toThrow('Invalid transcript format');
    });
  });

  describe('Step Execution', () => {
    beforeEach(() => {
      // Set up session ID for step execution tests
      service.setCurrentSessionId('test-session-123');
    });

    it('should execute next step successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          state: {
            stepOutputs: {
              [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: { adherence_score: 0.95 }
            },
            metadata: {
              progress: { percentage: 10, currentStepIndex: 1, totalSteps: 10 },
              currentStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
              lastCompletedStep: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
              lastUpdateTime: Date.now()
            }
          },
          executionResult: {
            stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
            status: 'completed' as const,
            output: { adherence_score: 0.95 },
            completedAt: Date.now()
          }
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await service.executeNextStep();

      expect(result.success).toBe(true);
      expect(result.executionResult?.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
      expect(result.executionResult?.status).toBe('completed');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/graph/execute',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'test-session-123',
            model: 'gemini-1.5-flash',
            temperature: 0.7,
            useGrounding: false,
            seed: undefined
          })
        })
      );
    });

    it('should handle step execution errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: async () => ({ error: 'Node execution failed' })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(service.executeNextStep()).rejects.toThrow('Node execution failed');
    });

    it('should throw error when no session exists', async () => {
      service.clearSession();
      
      await expect(service.executeNextStep()).rejects.toThrow('No active session. Call createSession() first.');
    });
  });

  describe('HIL Correction', () => {
    beforeEach(() => {
      service.setCurrentSessionId('test-session-123');
    });

    it('should apply HIL correction successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          correctedOutput: { corrected_analysis: 'Updated analysis' },
          updatedState: {
            stepOutputs: {
              [StepId.P1_1_INITIAL_SEGMENTATION]: { corrected_analysis: 'Updated analysis' }
            },
            metadata: { lastUpdateTime: Date.now() },
            currentStep: StepId.P1_1_INITIAL_SEGMENTATION
          },
          message: 'HIL correction applied successfully'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = {
        sessionId: 'test-session-123',
        stepId: StepId.P1_1_INITIAL_SEGMENTATION,
        userGuidance: 'Please focus more on temporal patterns',
        originalPrompt: 'Original analysis prompt',
        previousResponse: 'Previous analysis result'
      };

      const result = await service.applyHilCorrection(request);

      expect(result.success).toBe(true);
      expect(result.correctedOutput).toEqual({ corrected_analysis: 'Updated analysis' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/hil',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        })
      );
    });
  });

  describe('IRR Analysis', () => {
    beforeEach(() => {
      service.setCurrentSessionId('test-session-123');
    });

    it('should perform IRR analysis successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          gduMappings: [
            {
              run_a_gdu_id: 'gdu1',
              run_b_gdu_id: 'gdu2',
              semantic_similarity_score: 0.85,
              mapping_justification: 'High semantic overlap'
            }
          ],
          message: 'IRR analysis completed'
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request = {
        sessionId: 'test-session-123',
        runAOutputs: [{ gdu_id: 'gdu1', definition: 'First analysis' }],
        runBOutputs: [{ gdu_id: 'gdu2', definition: 'Second analysis' }]
      };

      const result = await service.performIrrAnalysis(request);

      expect(result.success).toBe(true);
      expect(result.gduMappings).toHaveLength(1);
      expect(result.gduMappings?.[0].semantic_similarity_score).toBe(0.85);
    });
  });

  describe('Session Status', () => {
    beforeEach(() => {
      service.setCurrentSessionId('test-session-123');
    });

    it('should get session status', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          sessionId: 'test-session-123',
          state: {
            metadata: { progress: { percentage: 50 } },
            stepOutputs: { step1: 'output1' }
          },
          lastExecutedAt: Date.now()
        })
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const status = await service.getSessionStatus();

      expect(status.sessionId).toBe('test-session-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/graph/session/test-session-123',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });
});