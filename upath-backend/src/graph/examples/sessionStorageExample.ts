/**
 * Example demonstrating how to use different session storage implementations
 * with GraphExecutor
 */

import { GraphBuilder, NodeRegistry, GraphExecutor } from '../index';
import { InMemorySessionStore, RedisSessionStore } from '../stores';
import { ExecutionContext } from '../types';

async function main() {
  // 1. Setup the graph
  const registry = new NodeRegistry();
  const builder = new GraphBuilder(registry);
  const graph = builder.build();

  // 2a. Using default InMemorySessionStore (sessions lost on restart)
  console.log('=== Using InMemorySessionStore ===');
  const inMemoryExecutor = new GraphExecutor(graph);
  
  const sessionId1 = await inMemoryExecutor.createSession({
    transcripts: [{ text: 'Sample transcript', metadata: {} }],
    settings: {}
  });
  
  console.log('Created session:', sessionId1);
  console.log('Sessions in memory:', await inMemoryExecutor.listSessions());
  
  // 2b. Using RedisSessionStore (sessions persist across restarts)
  console.log('\n=== Using RedisSessionStore ===');
  
  try {
    const redisStore = new RedisSessionStore({
      host: 'localhost',
      port: 6379,
      // password: 'your-redis-password', // if needed
    });
    
    const redisExecutor = new GraphExecutor(graph, redisStore);
    
    const sessionId2 = await redisExecutor.createSession({
      transcripts: [{ text: 'Persistent transcript', metadata: {} }],
      settings: {}
    });
    
    console.log('Created persistent session:', sessionId2);
    console.log('Sessions in Redis:', await redisExecutor.listSessions());
    
    // Simulate restart by creating new executor with same store
    console.log('\n--- Simulating restart ---');
    const newRedisExecutor = new GraphExecutor(graph, redisStore);
    console.log('Sessions after restart:', await newRedisExecutor.listSessions());
    
    // Cleanup
    await redisStore.disconnect();
  } catch (error) {
    console.error('Redis connection failed:', error);
    console.log('Make sure Redis is running locally or update connection config');
  }

  // 3. Using custom session store
  console.log('\n=== Using Custom SessionStore ===');
  
  // You can implement your own ISessionStore for other databases
  // Example: MongoDB, PostgreSQL, DynamoDB, etc.
  class CustomSessionStore {
    // Implement ISessionStore interface
    async set(sessionId: string, session: any) {
      console.log(`Custom store: saving session ${sessionId}`);
    }
    
    async get(sessionId: string) {
      console.log(`Custom store: retrieving session ${sessionId}`);
      return undefined;
    }
    
    async has(sessionId: string) {
      return false;
    }
    
    async delete(sessionId: string) {
      console.log(`Custom store: deleting session ${sessionId}`);
    }
    
    async list() {
      return [];
    }
    
    async clear() {
      console.log('Custom store: clearing all sessions');
    }
  }
  
  const customExecutor = new GraphExecutor(graph, new CustomSessionStore() as any);
  await customExecutor.createSession({
    transcripts: [{ text: 'Custom storage', metadata: {} }],
    settings: {}
  });
}

// Run example if called directly
if (require.main === module) {
  main().catch(console.error);
}