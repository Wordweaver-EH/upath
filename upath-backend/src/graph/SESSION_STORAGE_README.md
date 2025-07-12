# Session Storage for GraphExecutor

This document describes the session storage implementation for GraphExecutor, which enables persistent session management across application restarts.

## Overview

Previously, GraphExecutor stored sessions in memory using a Map, causing all session data to be lost when the application restarted. The new implementation introduces a flexible session storage interface that supports multiple storage backends.

## Architecture

### ISessionStore Interface

The `ISessionStore` interface defines the contract for session storage implementations:

```typescript
export interface ISessionStore {
  set(sessionId: string, session: Session): Promise<void>;
  get(sessionId: string): Promise<Session | undefined>;
  has(sessionId: string): Promise<boolean>;
  delete(sessionId: string): Promise<void>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}
```

### Built-in Implementations

1. **InMemorySessionStore** - Default implementation that maintains current behavior
   - Fast, no external dependencies
   - Sessions lost on restart
   - Good for development and testing

2. **RedisSessionStore** - Persistent storage using Redis
   - Sessions persist across restarts
   - Supports distributed deployments
   - Requires Redis server

## Usage

### Using Default Storage (In-Memory)

```typescript
import { GraphExecutor } from './graph';

// Uses InMemorySessionStore by default
const executor = new GraphExecutor(graph);
```

### Using Redis Storage

```typescript
import { GraphExecutor, RedisSessionStore } from './graph';

const sessionStore = new RedisSessionStore({
  host: 'localhost',
  port: 6379,
  password: 'optional-password'
});

const executor = new GraphExecutor(graph, sessionStore);
```

### Using Custom Redis Client

```typescript
import Redis from 'ioredis';
import { GraphExecutor, RedisSessionStore } from './graph';

const redisClient = new Redis({
  // Custom Redis configuration
  host: 'redis.example.com',
  port: 6380,
  tls: true
});

const sessionStore = new RedisSessionStore(redisClient);
const executor = new GraphExecutor(graph, sessionStore);
```

## API Changes

All session management methods are now async:

```typescript
// Before
const session = executor.getSession(sessionId);
executor.deleteSession(sessionId);

// After
const session = await executor.getSession(sessionId);
await executor.deleteSession(sessionId);
```

Affected methods:
- `getSession()` → `async getSession()`
- `hasSession()` → `async hasSession()`
- `listSessions()` → `async listSessions()`
- `deleteSession()` → `async deleteSession()`
- `pauseSession()` → `async pauseSession()`
- `resumeSession()` → `async resumeSession()`
- `restoreSession()` → `async restoreSession()`

## Implementing Custom Storage

You can implement your own storage backend by implementing the `ISessionStore` interface:

```typescript
import { ISessionStore, Session } from './graph';
import { Database } from 'your-database';

export class DatabaseSessionStore implements ISessionStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    await this.db.sessions.upsert({
      id: sessionId,
      data: JSON.stringify(session)
    });
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const row = await this.db.sessions.findById(sessionId);
    return row ? JSON.parse(row.data) : undefined;
  }

  // ... implement other methods
}
```

## Migration Guide

1. Update all calls to session management methods to use async/await
2. Choose appropriate storage backend based on requirements
3. Configure storage connection (for Redis or custom stores)
4. Test session persistence across restarts

## Testing

The implementation includes comprehensive tests following TDD principles:

- `InMemorySessionStore.test.ts` - Tests for in-memory storage
- `RedisSessionStore.test.ts` - Tests for Redis storage with mocked Redis client
- `graphExecutor.sessionStore.test.ts` - Integration tests for GraphExecutor

Run tests:
```bash
npm run test:run -- src/graph/stores/__tests__/
npm run test:run -- src/graph/__tests__/graphExecutor.sessionStore.test.ts
```

## Performance Considerations

- **InMemorySessionStore**: Fastest, O(1) operations, limited by available memory
- **RedisSessionStore**: Network latency overhead, but supports horizontal scaling
- **Custom implementations**: Performance depends on underlying storage

## Error Handling

The session stores handle errors gracefully:
- Connection failures throw errors that can be caught
- Missing sessions return `undefined` instead of throwing
- Delete operations succeed even if session doesn't exist

## Future Enhancements

Potential improvements for future versions:
- Session expiration/TTL support
- Session compression for large states
- Batch operations for performance
- Transaction support for atomic updates