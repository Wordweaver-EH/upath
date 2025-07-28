# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Backend Source Code Overview

This directory contains the TypeScript source code for the µ-PATH backend API server.

### File Structure:

#### Core Files:
- **index.ts**: Application entry point
  - Imports the app builder from server.ts
  - Starts the server on configured port
  - Handles graceful shutdown
  - Keep this minimal for testability

- **server.ts**: Application builder
  - Exports `buildApp()` function for testing
  - Configures Fastify instance
  - Registers routes and plugins
  - Sets up CORS based on environment

### Subdirectories:

#### routes/
API endpoint implementations:
- **analyze.ts**: Main Gemini proxy endpoint
  - Validates request body (prompt, model, settings)
  - Adds API key from environment
  - Forwards to Gemini API
  - Handles errors gracefully
  
- **models.ts**: Model listing endpoint
  - Returns available Gemini models
  - Cached for performance
  - Used by frontend dropdown

#### utils/
Utility functions:
- **encrypt.ts**: Encryption helpers
  - Used for secure data handling
  - Compatible with frontend encryption

#### __tests__/
Test files for all endpoints:
- Tests use real server instances
- No mocking of production code
- Environment setup in beforeAll
- Clean teardown in afterAll

### Development Guidelines:

1. **Separation of Concerns**:
   - index.ts: Only starts server
   - server.ts: Only builds app
   - routes/: Only handle requests
   - utils/: Pure utility functions

2. **Error Handling**:
   - Always validate inputs
   - Return structured errors
   - Never expose stack traces
   - Log errors for debugging

3. **Testing**:
   - Every route needs tests
   - Test error cases too
   - Use dynamic ports
   - Clean up after tests

4. **Security**:
   - Validate all inputs
   - Use environment variables
   - Configure CORS properly
   - Never log sensitive data

### Common Patterns:
```typescript
// Route handler pattern
export default async function(fastify: FastifyInstance) {
  fastify.post('/path', async (request, reply) => {
    // Validate
    // Process
    // Respond
  });
}

// Test pattern
import { buildApp } from '../server';
let app;
beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 0 });
});
```

### Known Issues:
- CORS must be configured for production domains
- API key validation is critical - empty strings are truthy!
- Rate limiting should be added for production
- Error messages must not leak implementation details
