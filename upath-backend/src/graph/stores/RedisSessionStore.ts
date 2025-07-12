import Redis from 'ioredis';
import { ISessionStore } from '../types/sessionStore';
import { Session } from '../graphExecutor';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Redis-based implementation of ISessionStore
 * Provides persistent session storage across restarts
 */
export class RedisSessionStore implements ISessionStore {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redisClientOrConfig?: Redis | RedisConfig) {
    // Check if it's a Redis-like object (has the required methods)
    if (redisClientOrConfig && typeof (redisClientOrConfig as any).set === 'function') {
      this.redis = redisClientOrConfig as Redis;
    } else {
      const config: RedisConfig = redisClientOrConfig as RedisConfig || {};
      this.redis = new Redis({
        host: config.host || 'localhost',
        port: config.port || 6379,
        password: config.password,
        db: config.db || 0
      });
    }
    
    this.keyPrefix = 'session:';
  }

  private getKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    const key = this.getKey(sessionId);
    const value = JSON.stringify(session);
    // Set with 24-hour TTL (24 * 60 * 60 = 86400 seconds)
    await this.redis.setex(key, 86400, value);
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const key = this.getKey(sessionId);
    const value = await this.redis.get(key);
    
    if (!value) {
      return undefined;
    }
    
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error(`Failed to parse session data for ${sessionId}:`, error);
      // Treat corrupted data as not found
      return undefined;
    }
  }

  async has(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async delete(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redis.del(key);
  }

  async list(): Promise<string[]> {
    const pattern = `${this.keyPrefix}*`;
    const keys: string[] = [];
    let cursor = '0';
    
    // Use SCAN instead of KEYS to avoid blocking Redis
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    
    // Remove the prefix from keys
    return keys.map(key => key.substring(this.keyPrefix.length));
  }

  async clear(): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    const keys: string[] = [];
    let cursor = '0';
    
    // Use SCAN instead of KEYS to avoid blocking Redis
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}