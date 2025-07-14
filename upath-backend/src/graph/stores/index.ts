export { InMemorySessionStore } from './InMemorySessionStore';
export { RedisSessionStore } from './RedisSessionStore';
export type { RedisConfig } from './RedisSessionStore';
import { ISessionStore } from '../types/sessionStore';
import { RedisSessionStore } from './RedisSessionStore';
import { InMemorySessionStore } from './InMemorySessionStore';

// Shared session store instance
let _sharedSessionStore: ISessionStore | null = null;

/**
 * Get the shared session store instance
 * Uses SESSION_STORE env var to determine which store to use
 */
export function getSessionStore(): ISessionStore {
  if (!_sharedSessionStore) {
    const storeType = process.env.SESSION_STORE || 'redis';
    
    if (storeType === 'memory') {
      _sharedSessionStore = new InMemorySessionStore();
      console.log('📦 [SessionStore] Using InMemorySessionStore (SESSION_STORE=memory)');
    } else {
      _sharedSessionStore = new RedisSessionStore();
      console.log(`📦 [SessionStore] Using RedisSessionStore (SESSION_STORE=${storeType})`);
    }
  }
  return _sharedSessionStore;
}