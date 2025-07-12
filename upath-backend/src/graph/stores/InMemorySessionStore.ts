import { ISessionStore } from '../types/sessionStore';
import { Session } from '../graphExecutor';

/**
 * In-memory implementation of ISessionStore
 * This is the current behavior - sessions are lost on restart
 */
export class InMemorySessionStore implements ISessionStore {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map();
  }

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

  async atomicUpdate(
    sessionId: string, 
    updateFunction: (session: Session | undefined) => Session | Promise<Session>
  ): Promise<Session> {
    // In-memory store doesn't need complex locking - simple synchronous update
    const currentSession = this.sessions.get(sessionId);
    const updatedSession = await Promise.resolve(updateFunction(currentSession));
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }
}