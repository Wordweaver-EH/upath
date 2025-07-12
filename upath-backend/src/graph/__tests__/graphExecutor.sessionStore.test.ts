import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphExecutor } from '../graphExecutor';
import { GraphBuilder, Graph } from '../graphBuilder';
import { ISessionStore } from '../types/sessionStore';
import { Session } from '../graphExecutor';
import { createInitialGraphState } from '../types/state';
import { StepId } from '../types';
import { BaseNode } from '../nodes/BaseNode';

// Mock session store implementation
class MockSessionStore implements ISessionStore {
  private sessions = new Map<string, Session>();

  async set(sessionId: string, session: Session): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async get(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async has(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}

describe('GraphExecutor with SessionStore', () => {
  let executor: GraphExecutor;
  let sessionStore: ISessionStore;
  let mockGraph: Graph;

  beforeEach(() => {
    sessionStore = new MockSessionStore();
    
    // Create a mock graph
    const mockNode = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        state: { currentStep: StepId.COMPLETE }
      }),
      executeWithRetry: vi.fn().mockResolvedValue({
        success: true,
        state: { currentStep: StepId.COMPLETE }
      })
    } as any;
    
    mockGraph = {
      nodes: new Map([[StepId.P0_1_TRANSCRIPTION_ADHERENCE, mockNode]]),
      edges: new Map(),
      conditionalEdges: new Map(),
      entryPoint: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      hasCycles: false,
      metadata: {
        nodeCount: 1,
        edgeCount: 0,
        createdAt: Date.now()
      },
      topologicalSort: () => [StepId.P0_1_TRANSCRIPTION_ADHERENCE],
      findPaths: () => []
    };
    
    executor = new GraphExecutor(mockGraph, sessionStore);
  });

  describe('session management with store', () => {
    it('should create session in store', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{ text: 'test', metadata: {} }],
        settings: {}
      });

      const hasSession = await sessionStore.has(sessionId);
      expect(hasSession).toBe(true);
      
      const session = await sessionStore.get(sessionId);
      expect(session).toBeDefined();
      expect(session?.state.sessionId).toBe(sessionId);
    });

    it('should get session from store', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{ text: 'test', metadata: {} }],
        settings: {}
      });

      const session = await executor.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.state.sessionId).toBe(sessionId);
    });

    it('should check session existence in store', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{ text: 'test', metadata: {} }],
        settings: {}
      });

      const exists = await executor.hasSession(sessionId);
      expect(exists).toBe(true);
      
      const notExists = await executor.hasSession('non-existent');
      expect(notExists).toBe(false);
    });

    it('should list sessions from store', async () => {
      const id1 = await executor.createSession({
        transcripts: [{ text: 'test1', metadata: {} }],
        settings: {}
      });
      
      const id2 = await executor.createSession({
        transcripts: [{ text: 'test2', metadata: {} }],
        settings: {}
      });

      const sessions = await executor.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(id1);
      expect(sessions).toContain(id2);
    });

    it('should delete session from store', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{ text: 'test', metadata: {} }],
        settings: {}
      });

      await executor.deleteSession(sessionId);
      
      const exists = await executor.hasSession(sessionId);
      expect(exists).toBe(false);
    });

    it('should update session state in store after operations', async () => {
      const sessionId = await executor.createSession({
        transcripts: [{ text: 'test', metadata: {} }],
        settings: {}
      });

      await executor.pauseSession(sessionId);
      
      const session = await sessionStore.get(sessionId);
      expect(session?.state.status).toBe('paused');
    });

    it('should restore session to store', async () => {
      const state = createInitialGraphState(
        'restored-session',
        [{ text: 'restored', metadata: {} }],
        {}
      );

      await executor.restoreSession(state);
      
      const exists = await sessionStore.has('restored-session');
      expect(exists).toBe(true);
      
      const session = await sessionStore.get('restored-session');
      expect(session?.state).toEqual(state);
    });
  });

  describe('constructor options', () => {
    it('should create executor without session store (uses default InMemorySessionStore)', async () => {
      const defaultExecutor = new GraphExecutor(mockGraph);
      
      expect(defaultExecutor).toBeDefined();
      // Should still work normally
      const sessionId = await defaultExecutor.createSession({
        transcripts: [{ text: 'test', metadata: {} }],
        settings: {}
      });
      expect(sessionId).toBeDefined();
    });

    it('should accept custom session store in constructor', () => {
      const customStore = new MockSessionStore();
      const customExecutor = new GraphExecutor(mockGraph, customStore);
      
      expect(customExecutor).toBeDefined();
    });
  });
});