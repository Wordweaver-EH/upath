# LangGraph Backend Integration

This document describes the integration between the frontend React application and the LangGraph backend for pipeline execution.

## Overview

The LangGraph integration provides a secure, structured alternative to direct Gemini API calls from the frontend. Instead of making LLM calls directly in the browser, the frontend now communicates with a backend service that manages pipeline execution using LangGraph.js.

## Architecture

```
Frontend (React)  →  Backend (LangGraph)  →  Gemini API
      ↓                      ↓                    ↑
  No API Key          Secure API Key       Structured Execution
  UI Controls         Session Management    Graph-based Pipeline
  Store Updates       Atomic Operations     Node Orchestration
```

## Key Components

### 1. LangGraphService (`src/services/langGraphService.ts`)

Primary service for communicating with the LangGraph backend:

- **Session Management**: Create and manage pipeline execution sessions
- **Step Execution**: Execute pipeline steps via backend graph nodes
- **HIL Corrections**: Apply Human-in-the-Loop feedback corrections
- **IRR Analysis**: Perform Inter-Rater Reliability analysis

```typescript
// Create session with transcripts
const sessionId = await langGraphService.createSession(transcripts, settings);

// Execute next step in pipeline
const result = await langGraphService.executeNextStep();

// Apply HIL correction
const correction = await langGraphService.applyHilCorrection({
  sessionId,
  stepId: StepId.P1_1_INITIAL_SEGMENTATION,
  userGuidance: "Focus more on temporal patterns"
});
```

### 2. LangGraphPipelineService (`src/services/pipeline/LangGraphPipelineService.ts`)

Pipeline service implementation that integrates with the backend while maintaining compatibility with the existing frontend pipeline interface:

- **Compatible API**: Drop-in replacement for existing PipelineService
- **Store Integration**: Updates frontend Zustand stores with backend results
- **Session Coordination**: Manages session lifecycle and state synchronization
- **Error Handling**: Robust error handling and fallback mechanisms

### 3. Pipeline Backend Toggle (`src/services/pipeline/pipelineBackendToggle.ts`)

Runtime toggle system for switching between execution modes:

- **Environment-based**: Configurable via `REACT_APP_USE_LANGGRAPH_BACKEND`
- **LocalStorage**: User preferences persisted across sessions
- **Health Monitoring**: Automatic backend health checks
- **UI Controls**: Toggle component for user control

### 4. Backend Toggle Component (`src/components/BackendToggle.tsx`)

React component providing UI controls for backend switching:

- **Status Display**: Shows current backend mode and health
- **Toggle Controls**: Switch between traditional and LangGraph execution
- **Health Checks**: Manual backend health verification
- **Recommendations**: Suggests optimal backend based on health status

## Integration Flow

### 1. Session Initialization

```typescript
// LangGraph mode
const service = new LangGraphPipelineService(dependencies);
await service.initializeSession(); // Creates backend session

// Traditional mode
const service = new PipelineService(dependencies);
// No session needed - direct API calls
```

### 2. Step Execution

```typescript
// Both modes use the same interface
const result = await service.processSingleStep({
  stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
  settings: { temperature: 0.7, apiKey: 'key' },
  transcriptId: 'transcript-1'
});
```

### 3. Store Updates

The LangGraph service automatically updates frontend stores:

```typescript
// Backend execution results are mapped to frontend store structure
updateGenericState({
  'P0_1_TRANSCRIPTION_ADHERENCE_output': backendOutput,
  'P0_1_TRANSCRIPTION_ADHERENCE_completed': true
});

// Transcript-specific data updates
updateTranscriptData(transcriptId, {
  'P0_1_TRANSCRIPTION_ADHERENCE_output': backendOutput
});
```

## Configuration

### Environment Variables

```bash
# Enable LangGraph backend (defaults to false)
REACT_APP_USE_LANGGRAPH_BACKEND=true

# Backend URL (defaults to http://localhost:3001)
REACT_APP_BACKEND_URL=http://localhost:3001
```

### Runtime Configuration

```typescript
import { pipelineBackendToggle } from './services/pipeline/pipelineBackendToggle';

// Enable LangGraph backend
pipelineBackendToggle.enableLangGraphBackend();

// Check backend health
const isHealthy = await pipelineBackendToggle.checkBackendHealth();

// Get current status
const status = pipelineBackendToggle.getBackendStatus();
```

## Backend API Endpoints

The frontend integrates with these backend endpoints:

### Session Management
- **POST** `/api/graph/session` - Create new execution session
- **GET** `/api/graph/session/:sessionId` - Get session status

### Pipeline Execution
- **POST** `/api/graph/execute` - Execute next step in pipeline

### Human-in-the-Loop
- **POST** `/api/hil` - Apply HIL correction to specific step

### Inter-Rater Reliability
- **POST** `/api/irr` - Perform IRR semantic mapping analysis

## Security Benefits

### 1. API Key Security
- **Traditional**: API keys exposed in frontend environment
- **LangGraph**: API keys secured on backend server

### 2. Request Validation
- **Traditional**: Client-side validation only
- **LangGraph**: Server-side validation and sanitization

### 3. Rate Limiting
- **Traditional**: No built-in rate limiting
- **LangGraph**: Server-side rate limiting and request throttling

### 4. Error Handling
- **Traditional**: Raw API errors exposed to frontend
- **LangGraph**: Sanitized error messages, secure logging

## Performance Considerations

### 1. Session Overhead
- Backend sessions add initialization overhead
- Mitigated by session reuse across multiple steps

### 2. Network Latency
- Additional hop through backend adds latency
- Offset by reduced frontend-to-Gemini latency

### 3. State Synchronization
- Frontend stores updated after each backend operation
- Async updates prevent UI blocking

### 4. Memory Usage
- Backend maintains session state
- Frontend cache reduced (no local LLM state)

## Migration Strategy

### Phase 1: Parallel Implementation ✅
- Both backends implemented and working
- Feature flag controls which backend is used
- No breaking changes to existing frontend

### Phase 2: Gradual Rollout (Current)
- Users can toggle between backends
- Backend health monitoring
- Fallback to traditional mode if backend unavailable

### Phase 3: Default Migration (Future)
- LangGraph backend becomes default
- Traditional mode available as fallback
- Environment variable controls default

### Phase 4: Sunset Traditional (Future)
- Remove traditional pipeline service
- Backend-only execution
- Simplified frontend code

## Testing

### Unit Tests
- `src/services/__tests__/langGraphIntegration.test.ts`
- Comprehensive mocking of backend APIs
- Error handling and edge cases

### Integration Tests
- Backend health checks
- Session lifecycle management
- Cross-store state updates

### End-to-End Tests
- Full pipeline execution via backend
- HIL correction workflows
- IRR analysis functionality

## Troubleshooting

### Common Issues

1. **Backend Unavailable**
   - Check backend server is running on port 3001
   - Verify `REACT_APP_BACKEND_URL` configuration
   - Use health check endpoint: `GET /health`

2. **Session Not Found**
   - Session may have expired (24-hour TTL)
   - Create new session via `createSession()`
   - Check Redis connectivity if using RedisSessionStore

3. **API Key Errors**
   - Ensure `GEMINI_API_KEY` set in backend environment
   - Verify API key has correct permissions
   - Check backend logs for authentication errors

4. **Step Execution Failures**
   - Check backend node implementation
   - Verify input data format matches node expectations
   - Review backend execution logs

### Debug Mode

Enable detailed logging:

```typescript
// Frontend debug logging
localStorage.setItem('debug', 'langgraph:*');

// Backend debug logging
process.env.DEBUG = 'langgraph:*';
```

## Future Enhancements

### 1. Real-time Updates
- WebSocket connection for live step progress
- Real-time HIL collaboration
- Multi-user session support

### 2. Advanced Session Management
- Session branching and merging
- Version control for pipeline states
- Session templates and presets

### 3. Performance Optimization
- Response caching and compression
- Batch step execution
- Optimistic UI updates

### 4. Enhanced Security
- OAuth2 authentication
- Role-based access control
- Audit logging and compliance

## Resources

- [LangGraph.js Documentation](https://github.com/langchain-ai/langgraphjs)
- [Backend Migration Plan](./MIGRATION-PLAN.md)
- [Phase 2 Technical Specification](./PHASE-2-TECHNICAL-SPEC.md)
- [Backend API Reference](../upath-backend/docs/API.md)