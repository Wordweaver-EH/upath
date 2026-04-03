# Project Knowledge Base: CLAUDE.md

**Purpose:** This file serves as a persistent, shared knowledge base for this directory. All AI agents and human developers interacting with the code in this folder must consult and update this document.

**Guidelines for AI Agents:**
1.  **Consult First:** Before starting a task, read this file to understand the context, recent decisions, and known complexities related to this part of the codebase.
2.  **Update with Insights:** If you make a significant design decision, discover a non-obvious dependency, fix a complex bug, or gain any "hard-won" knowledge that isn't immediately clear from the code, you MUST document it here.
3.  **Be Concise:** Add clear, concise entries. Use headings, bullet points, and timestamps where appropriate. Focus on the "why" behind changes, not just the "what". Avoid trivial notes that can be inferred from reading the code itself.

This document is the collective memory of the project. Keep it accurate and up-to-date to ensure seamless collaboration and prevent repeated work.

## Backend Architecture Overview

The µ-PATH backend is a Node.js/Fastify API server that acts as a secure proxy between the frontend and the Gemini API.

### Technology Stack:
- **Framework**: Fastify (lightweight, fast web framework)
- **Language**: TypeScript
- **Testing**: Jest with Fastify testing utilities
- **Security**: CORS, environment-based configuration

### Directory Structure:
```
upath-backend/
├── src/
│   ├── index.ts        # Server entry point
│   ├── server.ts       # App builder (testable)
│   ├── routes/         # API endpoints
│   │   ├── analyze.ts  # Gemini proxy endpoint
│   │   └── models.ts   # Model listing endpoint
│   ├── utils/          # Utility functions
│   │   └── encrypt.ts  # Encryption utilities
│   └── __tests__/      # Test files
└── package.json        # Dependencies and scripts
```

### Key Design Principles:

1. **Security First**: 
   - API keys stored in environment variables only
   - Frontend never sees the actual Gemini API key
   - CORS configured for production deployment
   - Input validation on all endpoints

2. **Testable Architecture**:
   - `server.ts` exports `buildApp()` for testing
   - `index.ts` imports and starts the server
   - Tests can create isolated app instances
   - Dynamic port allocation for parallel testing

3. **Configuration**:
   - Environment variables for all settings
   - `.env.example` documents required variables
   - No hardcoded values in code

### API Endpoints:

#### GET /health
- Health check endpoint
- Returns: `{ status: "ok" }`
- Used for monitoring and uptime checks

#### POST /api/analyze
- Proxies requests to Gemini API
- Validates input parameters
- Adds API key from environment
- Returns Gemini response or error

#### GET /api/models
- Lists available Gemini models
- Cached response for performance
- Used by frontend model selector

### Environment Variables:
- `GEMINI_API_KEY`: Required - Gemini API key
- `PORT`: Optional - Server port (default: 3001)
- `CORS_ORIGINS`: Optional - Allowed origins (default: http://localhost:5173)

### Testing Standards:
- All endpoints must have tests
- Tests import from `server.ts`, not mocks
- Environment variables set in beforeAll
- Clean state between tests

### Error Handling:
- Structured error responses
- Never expose internal errors to client
- Log errors server-side for debugging
- Graceful degradation for API failures

### Performance:
- Fastify for high performance
- Minimal dependencies
- Stateless design for scalability
- Response caching where appropriate
