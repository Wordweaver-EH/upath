import { Session } from '../graphExecutor';

/**
 * Interface for session storage implementations
 * Supports both synchronous and asynchronous operations
 */
export interface ISessionStore {
  /**
   * Store a session
   */
  set(sessionId: string, session: Session): Promise<void>;

  /**
   * Retrieve a session
   */
  get(sessionId: string): Promise<Session | undefined>;

  /**
   * Check if a session exists
   */
  has(sessionId: string): Promise<boolean>;

  /**
   * Delete a session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * List all session IDs
   */
  list(): Promise<string[]>;

  /**
   * Clear all sessions
   */
  clear(): Promise<void>;

  /**
   * Atomically update a session using optimistic locking
   * Prevents race conditions in concurrent session modifications
   */
  atomicUpdate(
    sessionId: string, 
    updateFunction: (session: Session | undefined) => Session | Promise<Session>
  ): Promise<Session>;
}