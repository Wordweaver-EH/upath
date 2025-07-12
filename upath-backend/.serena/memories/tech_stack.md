# Technology Stack

## Backend (upath-backend)
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify (high-performance HTTP server)
- **LLM Integration**: Google Generative AI (@google/generative-ai)
- **Workflow Engine**: LangGraph (@langchain/langgraph)
- **Session Storage**: Redis (ioredis) + In-memory fallback
- **Testing**: Vitest with UI support
- **Development**: tsx for TypeScript execution, nodemon for hot reload

## Key Dependencies
- `@fastify/cors`: Cross-origin resource sharing
- `@langchain/core` & `@langchain/langgraph`: Workflow orchestration
- `ioredis`: Redis client for session persistence
- `uuid`: Session and node ID generation
- `ws`: WebSocket support for real-time updates
- `dotenv`: Environment configuration

## Development Tools
- TypeScript strict mode
- Vitest for testing (watch mode, UI, run-once)
- nodemon + tsx for development server
- Fastify's built-in logging and error handling