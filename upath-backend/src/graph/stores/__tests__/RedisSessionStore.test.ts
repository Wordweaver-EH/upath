import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisSessionStore } from '../RedisSessionStore';
import { Session } from '../../graphExecutor';
import { createInitialGraphState } from '../../types/state';

// Create a factory for mock Redis instances
const createMockRedis = () => ({
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  exists: vi.fn().mockResolvedValue(0),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  flushdb: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  status: 'ready'
});

// Mock the ioredis module
vi.mock('ioredis');

describe('RedisSessionStore', () => {
  let store: RedisSessionStore;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let testSession: Session;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup the mock to return our mocked instance
    const { default: Redis } = await import('ioredis');
    vi.mocked(Redis).mockImplementation(() => createMockRedis() as any);
    
    // Create a mock instance to pass to the store
    mockRedis = createMockRedis();
    store = new RedisSessionStore(mockRedis as any);
    
    testSession = {
      state: createInitialGraphState(
        'test-session-123',
        [{ text: 'test transcript', metadata: {} }],
        {}
      ),
      createdAt: Date.now()
    };
  });

  afterEach(async () => {
    if (store) {
      await store.disconnect();
    }
  });

  describe('set', () => {
    it('should store a session as JSON', async () => {
      await store.set('session-1', testSession);
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        'session:session-1',
        JSON.stringify(testSession)
      );
    });

    it('should handle serialization errors', async () => {
      const circularSession = {
        ...testSession,
        circular: {} as any
      };
      circularSession.circular.ref = circularSession;
      
      await expect(store.set('session-1', circularSession as any))
        .rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve and parse stored session', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(testSession));
      
      const retrieved = await store.get('session-1');
      
      expect(mockRedis.get).toHaveBeenCalledWith('session:session-1');
      expect(retrieved).toEqual(testSession);
    });

    it('should return undefined for non-existent session', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      
      const retrieved = await store.get('non-existent');
      
      expect(retrieved).toBeUndefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockRedis.get.mockResolvedValueOnce('invalid json');
      
      await expect(store.get('session-1')).rejects.toThrow();
    });
  });

  describe('has', () => {
    it('should return true for existing session', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);
      
      const exists = await store.has('session-1');
      
      expect(mockRedis.exists).toHaveBeenCalledWith('session:session-1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      
      const exists = await store.has('non-existent');
      
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a session', async () => {
      await store.delete('session-1');
      
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-1');
    });
  });

  describe('list', () => {
    it('should return session IDs without prefix', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'session:session-1',
        'session:session-2',
        'session:session-3'
      ]);
      
      const ids = await store.list();
      
      expect(mockRedis.keys).toHaveBeenCalledWith('session:*');
      expect(ids).toEqual(['session-1', 'session-2', 'session-3']);
    });

    it('should return empty array when no sessions', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);
      
      const ids = await store.list();
      
      expect(ids).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should delete all session keys', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'session:session-1',
        'session:session-2'
      ]);
      
      await store.clear();
      
      expect(mockRedis.keys).toHaveBeenCalledWith('session:*');
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-1', 'session:session-2');
    });

    it('should handle empty sessions gracefully', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);
      
      await store.clear();
      
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('connection management', () => {
    it('should handle Redis connection errors', async () => {
      const errorRedis = createMockRedis();
      errorRedis.set = vi.fn().mockRejectedValue(new Error('Connection failed'));
      errorRedis.status = 'disconnected';
      
      const errorStore = new RedisSessionStore(errorRedis as any);
      
      await expect(errorStore.set('session-1', testSession))
        .rejects.toThrow('Connection failed');
    });

    it('should disconnect cleanly', async () => {
      await store.disconnect();
      
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });

  describe('with real Redis client', () => {
    it('should create store with connection config', async () => {
      const { default: Redis } = await import('ioredis');
      vi.mocked(Redis).mockClear();
      
      new RedisSessionStore({
        host: 'localhost',
        port: 6379,
        password: 'test-password'
      });
      
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0
      });
    });

    it('should create store with default config', async () => {
      const { default: Redis } = await import('ioredis');
      vi.mocked(Redis).mockClear();
      
      new RedisSessionStore();
      
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0
      });
    });
  });
});