import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangGraphPipelineService } from '../pipeline/LangGraphPipelineService';
import { LangGraphService } from '../langGraphService';

// Mock the langGraphService module
vi.mock('../langGraphService', () => {
  return {
    langGraphService: {
      createSession: vi.fn(),
      getCurrentSessionId: vi.fn(),
      clearSession: vi.fn(),
    },
    LangGraphService: vi.fn()
  };
});

describe('LangGraphPipelineService Race Condition Tests', () => {
  let service: LangGraphPipelineService;
  let mockLangGraph: any;
  let mockDependencies: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock dependencies
    mockDependencies = {
      getTranscriptData: vi.fn(() => ({
        rawTranscripts: [{ id: 'test', filename: 'test.txt', content: 'test content' }],
        processedData: new Map()
      })),
      getSettings: vi.fn(() => ({ apiKey: 'test', temperature: 0.7, userDvFocus: { dv_focus: [] } })),
      updateGenericState: vi.fn(),
      addPromptEntry: vi.fn(),
      setCurrentStepInfo: vi.fn(),
      setAutorunning: vi.fn(),
      updateTranscriptData: vi.fn(),
      replaceProcessedData: vi.fn(),
      getCurrentStepInfo: vi.fn(),
      getActiveTranscriptIndex: vi.fn(() => 0),
      getGenericAnalysisState: vi.fn(() => ({})),
      getPromptHistory: vi.fn(() => []),
      resetTranscripts: vi.fn(),
      resetPromptHistory: vi.fn(),
      resetAnalysisState: vi.fn(),
      resetOrchestrationState: vi.fn()
    };

    // Mock the LangGraph service
    const { langGraphService } = await import('../langGraphService');
    mockLangGraph = langGraphService;
    mockLangGraph.createSession = vi.fn().mockResolvedValue('test-session-123');
    mockLangGraph.getCurrentSessionId = vi.fn().mockReturnValue('test-session-123');
    mockLangGraph.clearSession = vi.fn();

    service = new LangGraphPipelineService(mockDependencies);
  });

  describe('Session Initialization Race Condition Prevention', () => {
    it('should prevent multiple concurrent session creation calls', async () => {
      // Set up createSession to take some time to simulate real network call
      let resolveCreateSession: (value: string) => void;
      const createSessionPromise = new Promise<string>((resolve) => {
        resolveCreateSession = resolve;
      });
      
      mockLangGraph.createSession.mockReturnValue(createSessionPromise);

      // Start multiple concurrent initialization calls
      const initPromise1 = service.initializeSession();
      const initPromise2 = service.initializeSession();
      const initPromise3 = service.initializeSession();

      // Verify createSession is only called once, even though we made 3 calls
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);

      // Resolve the backend call
      resolveCreateSession!('test-session-123');

      // All promises should resolve to the same session ID
      const [sessionId1, sessionId2, sessionId3] = await Promise.all([
        initPromise1,
        initPromise2,
        initPromise3
      ]);

      expect(sessionId1).toBe('test-session-123');
      expect(sessionId2).toBe('test-session-123');
      expect(sessionId3).toBe('test-session-123');

      // CreateSession should still only have been called once
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);
    });

    it('should return existing session ID if already initialized', async () => {
      // First initialization
      await service.initializeSession();
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);

      // Subsequent calls should not create new sessions
      const sessionId2 = await service.initializeSession();
      const sessionId3 = await service.initializeSession();

      expect(sessionId2).toBe('test-session-123');
      expect(sessionId3).toBe('test-session-123');
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);
    });

    it('should allow retry after initialization failure', async () => {
      // First call fails
      mockLangGraph.createSession
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('test-session-456');

      // First attempt should fail
      await expect(service.initializeSession()).rejects.toThrow('Network error');
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);

      // Second attempt should succeed
      const sessionId = await service.initializeSession();
      expect(sessionId).toBe('test-session-456');
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(2);
    });

    it('should clear initialization state on reset', async () => {
      // Initialize session
      await service.initializeSession();
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);

      // Reset pipeline
      await service.resetPipeline();

      // Next initialization should create a new session
      mockLangGraph.createSession.mockResolvedValueOnce('test-session-789');
      const newSessionId = await service.initializeSession();
      
      expect(newSessionId).toBe('test-session-789');
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(2);
    });

    it('should properly clear initializationPromise after successful completion', async () => {
      // First initialization
      const sessionId1 = await service.initializeSession();
      expect(sessionId1).toBe('test-session-123');
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);

      // Reset pipeline to clear sessionInitialized flag
      await service.resetPipeline();
      expect(mockLangGraph.clearSession).toHaveBeenCalledTimes(1);

      // Set up new session for second initialization
      mockLangGraph.createSession.mockResolvedValueOnce('test-session-456');
      mockLangGraph.getCurrentSessionId.mockReturnValue('test-session-456');

      // Second initialization should create a NEW session (not return stale promise)
      const sessionId2 = await service.initializeSession();
      expect(sessionId2).toBe('test-session-456');
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(2);

      // Verify we didn't reuse the old promise
      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should handle concurrent processSingleStep calls safely', async () => {
      // Mock executeNextStep to simulate concurrent step execution
      mockLangGraph.executeNextStep = vi.fn().mockResolvedValue({
        success: true,
        state: {
          stepOutputs: { 'P0_1_TRANSCRIPTION_ADHERENCE': { score: 0.95 } },
          metadata: {
            progress: { percentage: 10, currentStepIndex: 1, totalSteps: 10 },
            currentStep: 'P0_1_TRANSCRIPTION_ADHERENCE',
            lastUpdateTime: Date.now()
          }
        },
        executionResult: {
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          status: 'completed' as const,
          output: { score: 0.95 },
          completedAt: Date.now()
        }
      });

      const stepParams = {
        stepId: 'P0_1_TRANSCRIPTION_ADHERENCE' as any,
        settings: { apiKey: 'test', temperature: 0.7, userDvFocus: { dv_focus: [] } }
      };

      // Start multiple concurrent processSingleStep calls
      const step1Promise = service.processSingleStep(stepParams);
      const step2Promise = service.processSingleStep(stepParams);
      const step3Promise = service.processSingleStep(stepParams);

      // Wait for all to complete
      const results = await Promise.all([step1Promise, step2Promise, step3Promise]);

      // Session should only be initialized once
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);

      // All steps should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling in Concurrent Scenarios', () => {
    it('should handle session creation failure during concurrent initialization', async () => {
      mockLangGraph.createSession.mockRejectedValue(new Error('Backend unavailable'));

      // Multiple concurrent calls that should all fail
      const initPromise1 = service.initializeSession().catch(e => e);
      const initPromise2 = service.initializeSession().catch(e => e);
      const initPromise3 = service.initializeSession().catch(e => e);

      const [error1, error2, error3] = await Promise.all([
        initPromise1,
        initPromise2,
        initPromise3
      ]);

      // All should receive the same error
      expect(error1.message).toBe('Backend unavailable');
      expect(error2.message).toBe('Backend unavailable');
      expect(error3.message).toBe('Backend unavailable');

      // CreateSession should only be called once
      expect(mockLangGraph.createSession).toHaveBeenCalledTimes(1);
    });
  });
});