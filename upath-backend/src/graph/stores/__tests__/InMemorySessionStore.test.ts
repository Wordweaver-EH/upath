import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionStore } from '../InMemorySessionStore';
import { Session } from '../../graphExecutor';
import { createInitialGraphState } from '../../types/state';
import { StepId } from '../../types';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;
  let testSession: Session;

  beforeEach(() => {
    store = new InMemorySessionStore();
    testSession = {
      state: createInitialGraphState(
        'test-session-123',
        [{ text: 'test transcript', metadata: {} }],
        {}
      ),
      createdAt: Date.now()
    };
  });

  describe('set', () => {
    it('should store a session', async () => {
      await store.set('session-1', testSession);
      const retrieved = await store.get('session-1');
      expect(retrieved).toEqual(testSession);
    });

    it('should overwrite existing session', async () => {
      await store.set('session-1', testSession);
      
      const updatedSession = {
        ...testSession,
        lastExecutedAt: Date.now()
      };
      
      await store.set('session-1', updatedSession);
      const retrieved = await store.get('session-1');
      expect(retrieved).toEqual(updatedSession);
    });
  });

  describe('get', () => {
    it('should retrieve stored session', async () => {
      await store.set('session-1', testSession);
      const retrieved = await store.get('session-1');
      expect(retrieved).toEqual(testSession);
    });

    it('should return undefined for non-existent session', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing session', async () => {
      await store.set('session-1', testSession);
      const exists = await store.has('session-1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const exists = await store.has('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a session', async () => {
      await store.set('session-1', testSession);
      await store.delete('session-1');
      
      const exists = await store.has('session-1');
      expect(exists).toBe(false);
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(store.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('should return empty array when no sessions', async () => {
      const ids = await store.list();
      expect(ids).toEqual([]);
    });

    it('should return all session IDs', async () => {
      await store.set('session-1', testSession);
      await store.set('session-2', testSession);
      await store.set('session-3', testSession);
      
      const ids = await store.list();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('session-1');
      expect(ids).toContain('session-2');
      expect(ids).toContain('session-3');
    });
  });

  describe('clear', () => {
    it('should remove all sessions', async () => {
      await store.set('session-1', testSession);
      await store.set('session-2', testSession);
      await store.set('session-3', testSession);
      
      await store.clear();
      
      const ids = await store.list();
      expect(ids).toEqual([]);
    });
  });

  describe('isolation', () => {
    it('should not share state between instances', async () => {
      const store1 = new InMemorySessionStore();
      const store2 = new InMemorySessionStore();
      
      await store1.set('session-1', testSession);
      
      const exists1 = await store1.has('session-1');
      const exists2 = await store2.has('session-1');
      
      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });
  });
});