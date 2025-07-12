import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisSessionStore } from '../RedisSessionStore';
import { InMemorySessionStore } from '../InMemorySessionStore';
import { Session } from '../../graphExecutor';
import { createInitialGraphState } from '../../types/state';

// Mock ioredis to prevent real Redis connections
vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => ({
      on: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      status: 'ready'
    }))
  };
});

describe('Atomic Session Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RedisSessionStore atomic update', () => {
    it('should perform atomic updates using Redis transactions', async () => {
      // Mock Redis client with transaction support
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'), // Required for constructor check
        watch: vi.fn().mockResolvedValue('OK'),
        unwatch: vi.fn().mockResolvedValue('OK'),
        get: vi.fn().mockResolvedValue(JSON.stringify({
          state: createInitialGraphState('test-session', [], {}),
          lastExecutedAt: Date.now()
        })),
        multi: vi.fn().mockReturnValue({
          setex: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([['OK']])  // Successful transaction (non-null means success)
        }),
        on: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        status: 'ready'
      };

      const store = new RedisSessionStore(mockRedis as any);
      
      const result = await store.atomicUpdate('test-session', (session) => {
        expect(session).toBeDefined();
        return {
          ...session!,
          lastExecutedAt: Date.now()
        };
      });

      expect(result).toBeDefined();
      expect(mockRedis.watch).toHaveBeenCalledWith('session:test-session');
      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it('should retry on concurrent modification', async () => {
      let attemptCount = 0;
      
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'), // Required for constructor check
        watch: vi.fn().mockResolvedValue('OK'),
        unwatch: vi.fn().mockResolvedValue('OK'),
        get: vi.fn().mockResolvedValue(JSON.stringify({
          state: createInitialGraphState('test-session', [], {}),
          lastExecutedAt: Date.now()
        })),
        multi: vi.fn().mockReturnValue({
          setex: vi.fn().mockReturnThis(),
          exec: vi.fn().mockImplementation(() => {
            attemptCount++;
            // First attempt fails (concurrent modification), second succeeds
            return attemptCount === 1 
              ? Promise.resolve(null)  // Transaction failed - WATCH conflict
              : Promise.resolve([['OK']]);  // Transaction succeeded
          })
        }),
        on: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        status: 'ready'
      };

      const store = new RedisSessionStore(mockRedis as any);
      
      const result = await store.atomicUpdate('test-session', (session) => ({
        ...session!,
        lastExecutedAt: Date.now()
      }));

      expect(result).toBeDefined();
      expect(attemptCount).toBe(2);  // Should have retried once
    });

    it('should throw error after max retries', async () => {
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'), // Required for constructor check
        watch: vi.fn().mockResolvedValue('OK'),
        unwatch: vi.fn().mockResolvedValue('OK'),
        get: vi.fn().mockResolvedValue(JSON.stringify({
          state: createInitialGraphState('test-session', [], {}),
          lastExecutedAt: Date.now()
        })),
        multi: vi.fn().mockReturnValue({
          setex: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue(null)  // Always fail - WATCH conflict
        }),
        on: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        status: 'ready'
      };

      const store = new RedisSessionStore(mockRedis as any);
      
      await expect(
        store.atomicUpdate('test-session', (session) => session!)
      ).rejects.toThrow('Failed to atomically update session test-session after 5 attempts');
    });
  });

  describe('InMemorySessionStore atomic update', () => {
    it('should perform simple atomic updates', async () => {
      const store = new InMemorySessionStore();
      
      const initialSession: Session = {
        state: createInitialGraphState('test-session', [], {}),
        lastExecutedAt: Date.now()
      };
      
      await store.set('test-session', initialSession);
      
      const result = await store.atomicUpdate('test-session', (session) => {
        expect(session).toBeDefined();
        expect(session!.state.sessionId).toBe('test-session');
        
        return {
          ...session!,
          lastExecutedAt: Date.now() + 1000
        };
      });

      expect(result).toBeDefined();
      expect(result.lastExecutedAt).toBeGreaterThan(initialSession.lastExecutedAt);
    });

    it('should handle non-existent sessions', async () => {
      const store = new InMemorySessionStore();
      
      const result = await store.atomicUpdate('non-existent', (session) => {
        expect(session).toBeUndefined();
        
        return {
          state: createInitialGraphState('non-existent', [], {}),
          lastExecutedAt: Date.now()
        };
      });

      expect(result).toBeDefined();
      expect(result.state.sessionId).toBe('non-existent');
    });
  });
});