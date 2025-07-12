export { InMemorySessionStore } from './InMemorySessionStore';
export { RedisSessionStore } from './RedisSessionStore';
export type { RedisConfig } from './RedisSessionStore';
import { ISessionStore } from '../types/sessionStore';
import { RedisSessionStore } from './RedisSessionStore';

// Shared session store instance
let _sharedSessionStore: ISessionStore | null = null;

/**
 * Get the shared session store instance
 * Uses RedisSessionStore for production consistency
 */
export function getSessionStore(): ISessionStore {
  if (!_sharedSessionStore) {
    _sharedSessionStore = new RedisSessionStore();
  }
  return _sharedSessionStore;
}