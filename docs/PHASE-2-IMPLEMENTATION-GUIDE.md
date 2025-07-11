# Phase 2 Implementation Guide: LangGraph Migration

## Overview

This guide provides a step-by-step approach to migrating the UPath pipeline system from its current service-based architecture to a LangGraph-based implementation. The migration will be done incrementally, allowing both systems to run in parallel during the transition.

## Prerequisites

Before starting Phase 2, ensure the following are in place:

1. **Phase 1 Complete**: All critical fixes and stabilization from Phase 1 are merged
2. **Test Coverage**: Existing pipeline tests are passing with >90% coverage
3. **Environment Setup**:
   - Node.js 18+ and Python 3.11+ installed
   - Backend service running and tested
   - All environment variables configured
4. **Dependencies Ready**:
   - Latest LangChain/LangGraph packages available
   - WebSocket support configured in backend
5. **Documentation**: Current pipeline flow documented and understood

## Step-by-Step Implementation Plan

### Step 2.1: Backend Setup and Dependencies (2-3 days)

**Objective**: Set up LangGraph infrastructure in the backend

**Tasks**:
1. Install LangGraph dependencies in backend:
   ```bash
   cd upath-backend
   npm install @langchain/core @langchain/langgraph langchain
   ```

2. Create new directory structure:
   ```
   upath-backend/src/
   ├── graph/
   │   ├── nodes/           # Individual step implementations
   │   ├── edges/           # Conditional routing logic
   │   ├── state/           # Graph state management
   │   ├── builder.ts       # Graph construction
   │   └── types.ts         # TypeScript interfaces
   ```

3. Set up base types:
   ```typescript
   // upath-backend/src/graph/types.ts
   export interface GraphState {
     currentStep: string
     transcriptId?: string
     stepOutputs: Record<string, any>
     errors: Record<string, string>
     metadata: {
       startTime: number
       lastUpdateTime: number
       settings: SettingsData
     }
   }
   ```

**Success Criteria**:
- Dependencies installed without conflicts
- Base directory structure created
- TypeScript compiles without errors

### Step 2.2: Create Base Graph Infrastructure (3-4 days)

**Objective**: Build the core graph structure and state management

**Tasks**:
1. Create state manager:
   ```typescript
   // upath-backend/src/graph/state/StateManager.ts
   export class GraphStateManager {
     private state: Map<string, GraphState> = new Map()
     
     initializeSession(sessionId: string, initialState: Partial<GraphState>) {
       this.state.set(sessionId, {
         currentStep: 'IDLE',
         stepOutputs: {},
         errors: {},
         metadata: {
           startTime: Date.now(),
           lastUpdateTime: Date.now(),
           settings: initialState.metadata?.settings || {}
         },
         ...initialState
       })
     }
     
     updateState(sessionId: string, updates: Partial<GraphState>) {
       const current = this.state.get(sessionId)
       if (!current) throw new Error(`Session ${sessionId} not found`)
       
       this.state.set(sessionId, {
         ...current,
         ...updates,
         metadata: {
           ...current.metadata,
           lastUpdateTime: Date.now()
         }
       })
     }
   }
   ```

2. Create base node interface:
   ```typescript
   // upath-backend/src/graph/nodes/BaseNode.ts
   export abstract class BaseNode {
     abstract id: string
     abstract async execute(state: GraphState): Promise<Partial<GraphState>>
     
     protected validateInput(state: GraphState): boolean {
       // Common validation logic
       return true
     }
   }
   ```

3. Create graph builder:
   ```typescript
   // upath-backend/src/graph/builder.ts
   import { StateGraph } from '@langchain/langgraph'
   
   export function buildPipelineGraph() {
     const workflow = new StateGraph({
       channels: {
         currentStep: null,
         transcriptId: null,
         stepOutputs: null,
         errors: null,
         metadata: null
       }
     })
     
     // Add nodes (to be implemented)
     // Add edges (to be implemented)
     
     return workflow.compile()
   }
   ```

**Success Criteria**:
- State manager can track multiple sessions
- Base node structure defined and extensible
- Graph builder compiles without errors

### Step 2.3: Implement Individual Nodes (5-7 days)

**Objective**: Convert each pipeline step to a LangGraph node

**Tasks**:
1. Create node for each pipeline step:
   ```typescript
   // upath-backend/src/graph/nodes/TranscriptionAdherenceNode.ts
   export class TranscriptionAdherenceNode extends BaseNode {
     id = 'P0_1_TRANSCRIPTION_ADHERENCE'
     
     async execute(state: GraphState): Promise<Partial<GraphState>> {
       try {
         // Validate prerequisites
         if (!this.validateInput(state)) {
           return {
             errors: {
               ...state.errors,
               [this.id]: 'Invalid input state'
             }
           }
         }
         
         // Execute step logic (reuse existing service)
         const result = await this.processTranscriptionAdherence(
           state.transcriptId!,
           state.stepOutputs
         )
         
         return {
           currentStep: this.id,
           stepOutputs: {
             ...state.stepOutputs,
             [this.id]: result
           }
         }
       } catch (error) {
         return {
           errors: {
             ...state.errors,
             [this.id]: error.message
           }
         }
       }
     }
   }
   ```

2. Create node registry:
   ```typescript
   // upath-backend/src/graph/nodes/registry.ts
   export const nodeRegistry = new Map([
     ['P0_1_TRANSCRIPTION_ADHERENCE', new TranscriptionAdherenceNode()],
     ['P0_2_REFINE_DATA_TYPES', new RefineDataTypesNode()],
     // ... all other nodes
   ])
   ```

3. Implement node execution wrapper:
   ```typescript
   // upath-backend/src/graph/nodes/NodeExecutor.ts
   export class NodeExecutor {
     async executeNode(
       nodeId: string, 
       state: GraphState,
       context: ExecutionContext
     ): Promise<GraphState> {
       const node = nodeRegistry.get(nodeId)
       if (!node) throw new Error(`Node ${nodeId} not found`)
       
       console.log(`[Graph] Executing node: ${nodeId}`)
       const startTime = Date.now()
       
       const updates = await node.execute(state)
       
       console.log(`[Graph] Node ${nodeId} completed in ${Date.now() - startTime}ms`)
       
       return { ...state, ...updates }
     }
   }
   ```

**Success Criteria**:
- All pipeline steps have corresponding nodes
- Nodes can execute independently
- Error handling is consistent across nodes

### Step 2.4: Build the Graph Structure (3-4 days)

**Objective**: Connect nodes with edges and conditional routing

**Tasks**:
1. Define edge conditions:
   ```typescript
   // upath-backend/src/graph/edges/conditions.ts
   export const shouldProceedToNextStep = (state: GraphState): boolean => {
     const currentStepError = state.errors[state.currentStep]
     return !currentStepError
   }
   
   export const getNextStep = (state: GraphState): string => {
     // Logic to determine next step based on current state
     const stepOrder = [
       'P0_1_TRANSCRIPTION_ADHERENCE',
       'P0_2_REFINE_DATA_TYPES',
       // ... etc
     ]
     
     const currentIndex = stepOrder.indexOf(state.currentStep)
     if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
       return 'END'
     }
     
     return stepOrder[currentIndex + 1]
   }
   ```

2. Build complete graph:
   ```typescript
   // upath-backend/src/graph/builder.ts
   export function buildPipelineGraph() {
     const workflow = new StateGraph({
       channels: graphStateChannels
     })
     
     // Add all nodes
     nodeRegistry.forEach((node, id) => {
       workflow.addNode(id, async (state) => {
         const executor = new NodeExecutor()
         return executor.executeNode(id, state, getExecutionContext())
       })
     })
     
     // Add conditional edges
     workflow.addConditionalEdges(
       'START',
       (state) => state.currentStep || 'P0_1_TRANSCRIPTION_ADHERENCE'
     )
     
     // Add edges between steps
     const stepOrder = Object.values(StepId)
     stepOrder.forEach((step, index) => {
       if (index < stepOrder.length - 1) {
         workflow.addConditionalEdges(
           step,
           (state) => shouldProceedToNextStep(state) ? stepOrder[index + 1] : 'ERROR'
         )
       }
     })
     
     // Add error handling
     workflow.addNode('ERROR', async (state) => ({
       ...state,
       currentStep: 'ERROR'
     }))
     
     return workflow.compile()
   }
   ```

3. Create graph runner:
   ```typescript
   // upath-backend/src/graph/GraphRunner.ts
   export class GraphRunner {
     private graph: CompiledGraph
     private stateManager: GraphStateManager
     
     constructor() {
       this.graph = buildPipelineGraph()
       this.stateManager = new GraphStateManager()
     }
     
     async runStep(sessionId: string, stepId: string, params: any) {
       const state = this.stateManager.getState(sessionId)
       
       const result = await this.graph.invoke({
         ...state,
         currentStep: stepId,
         ...params
       })
       
       this.stateManager.updateState(sessionId, result)
       return result
     }
   }
   ```

**Success Criteria**:
- Graph connects all nodes correctly
- Conditional routing works as expected
- Error states are handled gracefully

### Step 2.5: Add Streaming API (3-4 days)

**Objective**: Implement real-time streaming updates via WebSocket

**Tasks**:
1. Set up WebSocket server:
   ```typescript
   // upath-backend/src/websocket/server.ts
   import { WebSocketServer } from 'ws'
   
   export class PipelineWebSocketServer {
     private wss: WebSocketServer
     private sessions: Map<string, WebSocket> = new Map()
     
     initialize(server: FastifyInstance) {
       this.wss = new WebSocketServer({ server: server.server })
       
       this.wss.on('connection', (ws, req) => {
         const sessionId = this.extractSessionId(req)
         this.sessions.set(sessionId, ws)
         
         ws.on('message', async (data) => {
           const message = JSON.parse(data.toString())
           await this.handleMessage(sessionId, message)
         })
         
         ws.on('close', () => {
           this.sessions.delete(sessionId)
         })
       })
     }
     
     sendUpdate(sessionId: string, update: any) {
       const ws = this.sessions.get(sessionId)
       if (ws && ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify(update))
       }
     }
   }
   ```

2. Create streaming graph executor:
   ```typescript
   // upath-backend/src/graph/StreamingExecutor.ts
   export class StreamingGraphExecutor {
     constructor(
       private graphRunner: GraphRunner,
       private wsServer: PipelineWebSocketServer
     ) {}
     
     async executeWithStreaming(
       sessionId: string, 
       stepId: string, 
       params: any
     ) {
       // Set up event stream
       const eventStream = this.graphRunner.streamExecution(
         sessionId, 
         stepId, 
         params
       )
       
       // Stream events to client
       for await (const event of eventStream) {
         this.wsServer.sendUpdate(sessionId, {
           type: 'step_update',
           stepId: event.node,
           status: event.status,
           data: event.data,
           timestamp: Date.now()
         })
       }
     }
   }
   ```

3. Add streaming endpoints:
   ```typescript
   // upath-backend/src/routes/pipeline.ts
   export const pipelineStreamRoute = async (fastify: FastifyInstance) => {
     const executor = new StreamingGraphExecutor(
       graphRunner,
       wsServer
     )
     
     fastify.post('/api/pipeline/stream', async (request, reply) => {
       const { sessionId, stepId, params } = request.body
       
       // Start streaming execution
       executor.executeWithStreaming(sessionId, stepId, params)
         .catch(error => {
           wsServer.sendUpdate(sessionId, {
             type: 'error',
             error: error.message
           })
         })
       
       return { sessionId, status: 'streaming' }
     })
   }
   ```

**Success Criteria**:
- WebSocket connection established and maintained
- Real-time updates streamed during execution
- Client can receive and process updates

### Step 2.6: Frontend Integration (4-5 days)

**Objective**: Adapt frontend stores to work with LangGraph backend

**Tasks**:
1. Create WebSocket client service:
   ```typescript
   // src/services/pipeline/WebSocketService.ts
   export class PipelineWebSocketService {
     private ws: WebSocket | null = null
     private reconnectAttempts = 0
     
     connect(sessionId: string): Promise<void> {
       return new Promise((resolve, reject) => {
         const wsUrl = `${process.env.REACT_APP_WS_URL}/pipeline?session=${sessionId}`
         this.ws = new WebSocket(wsUrl)
         
         this.ws.onopen = () => {
           this.reconnectAttempts = 0
           resolve()
         }
         
         this.ws.onmessage = (event) => {
           const update = JSON.parse(event.data)
           this.handleUpdate(update)
         }
         
         this.ws.onerror = reject
       })
     }
     
     private handleUpdate(update: any) {
       // Dispatch to appropriate store
       switch (update.type) {
         case 'step_update':
           usePipelineOrchestrationStore.getState().updateStepStatus(
             update.stepId,
             update.status,
             update.data
           )
           break
         case 'error':
           usePipelineOrchestrationStore.getState().setError(update.error)
           break
       }
     }
   }
   ```

2. Create LangGraph pipeline service:
   ```typescript
   // src/services/pipeline/LangGraphPipelineService.ts
   export class LangGraphPipelineService implements IPipelineService {
     private wsService: PipelineWebSocketService
     private sessionId: string
     
     async initialize() {
       this.sessionId = generateSessionId()
       this.wsService = new PipelineWebSocketService()
       await this.wsService.connect(this.sessionId)
     }
     
     async executeStep(params: StepExecutionParams): Promise<void> {
       // Send execution request via HTTP
       const response = await fetch('/api/pipeline/stream', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           sessionId: this.sessionId,
           stepId: params.stepId,
           params
         })
       })
       
       if (!response.ok) {
         throw new Error(`Failed to start execution: ${response.statusText}`)
       }
       
       // Updates will come via WebSocket
     }
   }
   ```

3. Add feature flag for gradual rollout:
   ```typescript
   // src/services/pipeline/pipelineServiceFactory.ts
   export function createPipelineService(): IPipelineService {
     const useLangGraph = process.env.REACT_APP_USE_LANGGRAPH === 'true'
     
     if (useLangGraph) {
       return new LangGraphPipelineService()
     }
     
     // Fall back to existing implementation
     return new PipelineService({
       orchestrator: new PipelineOrchestrator(/* ... */),
       // ... other dependencies
     })
   }
   ```

**Success Criteria**:
- Frontend can connect to WebSocket server
- Real-time updates reflected in UI
- Feature flag allows switching between implementations

### Step 2.7: Testing and Validation (3-4 days)

**Objective**: Ensure LangGraph implementation matches existing behavior

**Tasks**:
1. Create integration tests:
   ```typescript
   // upath-backend/src/__tests__/graph/integration.test.ts
   describe('LangGraph Pipeline Integration', () => {
     let graphRunner: GraphRunner
     
     beforeEach(() => {
       graphRunner = new GraphRunner()
     })
     
     it('should execute full pipeline for transcript', async () => {
       const sessionId = 'test-session'
       const transcriptId = 'test-transcript'
       
       // Initialize session
       await graphRunner.initialize(sessionId, {
         transcriptId,
         metadata: { settings: defaultSettings }
       })
       
       // Execute first step
       const result1 = await graphRunner.runStep(
         sessionId,
         'P0_1_TRANSCRIPTION_ADHERENCE',
         { transcriptId }
       )
       
       expect(result1.currentStep).toBe('P0_1_TRANSCRIPTION_ADHERENCE')
       expect(result1.stepOutputs['P0_1_TRANSCRIPTION_ADHERENCE']).toBeDefined()
       
       // Continue through pipeline
       // ... more assertions
     })
   })
   ```

2. Create comparison tests:
   ```typescript
   // src/__tests__/pipeline/comparison.test.ts
   describe('Pipeline Implementation Comparison', () => {
     it('should produce identical results', async () => {
       const params = { /* test params */ }
       
       // Run with existing implementation
       const existingResult = await runWithExistingPipeline(params)
       
       // Run with LangGraph implementation
       const langGraphResult = await runWithLangGraphPipeline(params)
       
       // Compare results
       expect(langGraphResult.output).toEqual(existingResult.output)
       expect(langGraphResult.groundingSources).toEqual(
         existingResult.groundingSources
       )
     })
   })
   ```

3. Performance benchmarks:
   ```typescript
   // upath-backend/src/__tests__/graph/performance.test.ts
   describe('LangGraph Performance', () => {
     it('should complete pipeline within acceptable time', async () => {
       const startTime = Date.now()
       
       await graphRunner.runFullPipeline(testTranscript)
       
       const duration = Date.now() - startTime
       expect(duration).toBeLessThan(30000) // 30 seconds
     })
   })
   ```

**Success Criteria**:
- All integration tests pass
- Output parity with existing implementation
- Performance within acceptable limits

### Step 2.8: Migration and Rollout (2-3 days)

**Objective**: Safely migrate to LangGraph implementation

**Tasks**:
1. Create migration plan:
   ```markdown
   ## Migration Phases
   
   ### Phase 1: Internal Testing (1 day)
   - Enable LangGraph for development environment
   - Run full test suite
   - Monitor for issues
   
   ### Phase 2: Canary Deployment (2 days)
   - Enable for 10% of users via feature flag
   - Monitor error rates and performance
   - Collect user feedback
   
   ### Phase 3: Gradual Rollout (3 days)
   - Increase to 50% of users
   - Continue monitoring
   - Address any issues
   
   ### Phase 4: Full Migration (1 day)
   - Enable for all users
   - Keep legacy code for 1 week as fallback
   - Remove legacy code after stability confirmed
   ```

2. Implement monitoring:
   ```typescript
   // upath-backend/src/monitoring/metrics.ts
   export class PipelineMetrics {
     recordExecution(
       implementation: 'legacy' | 'langgraph',
       stepId: string,
       duration: number,
       success: boolean
     ) {
       // Send to monitoring service
       console.log(`[Metrics] ${implementation} - ${stepId}:`, {
         duration,
         success,
         timestamp: Date.now()
       })
     }
   }
   ```

3. Create rollback procedure:
   ```typescript
   // src/services/pipeline/pipelineServiceFactory.ts
   export function createPipelineService(): IPipelineService {
     // Check for emergency rollback flag
     if (process.env.REACT_APP_FORCE_LEGACY_PIPELINE === 'true') {
       console.warn('Using legacy pipeline due to rollback flag')
       return new LegacyPipelineService()
     }
     
     // Normal feature flag check
     const useLangGraph = shouldUseLangGraph()
     return useLangGraph 
       ? new LangGraphPipelineService()
       : new LegacyPipelineService()
   }
   ```

**Success Criteria**:
- Migration completed without data loss
- Performance metrics acceptable
- Rollback procedure tested and working

## Code Examples

### Example 1: Converting a Service to a Node

```typescript
// Before: Service-based approach
export class StepExecutionService {
  async executeStep(
    stepId: string,
    input: StepInput,
    context: ExecutionContext,
    settings: SettingsData
  ): Promise<ServiceResult<StepOutput>> {
    // Complex logic here
  }
}

// After: LangGraph node
export class StepExecutionNode extends BaseNode {
  id = 'STEP_EXECUTION'
  
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    const { stepId, input, context, settings } = state
    
    try {
      // Reuse existing service logic
      const service = new StepExecutionService()
      const result = await service.executeStep(
        stepId, 
        input, 
        context, 
        settings
      )
      
      return {
        stepOutputs: {
          ...state.stepOutputs,
          [stepId]: result.data
        }
      }
    } catch (error) {
      return {
        errors: {
          ...state.errors,
          [stepId]: error.message
        }
      }
    }
  }
}
```

### Example 2: Streaming Updates

```typescript
// Backend: Send streaming updates
class StreamingNode extends BaseNode {
  async execute(state: GraphState): Promise<Partial<GraphState>> {
    const steps = ['parsing', 'analyzing', 'generating']
    
    for (const step of steps) {
      // Send intermediate update
      await this.sendUpdate({
        type: 'progress',
        step,
        progress: steps.indexOf(step) / steps.length
      })
      
      // Do actual work
      await this.processStep(step)
    }
    
    return { /* final state */ }
  }
}

// Frontend: Receive updates
wsService.on('update', (update) => {
  if (update.type === 'progress') {
    setProgress(update.progress * 100)
    setCurrentStep(update.step)
  }
})
```

## Migration Strategy

### Running Old and New in Parallel

1. **Dual Execution Mode**:
   ```typescript
   export async function executePipeline(params: any) {
     if (isDualModeEnabled()) {
       // Run both implementations
       const [legacyResult, langGraphResult] = await Promise.all([
         legacyPipeline.execute(params),
         langGraphPipeline.execute(params)
       ])
       
       // Compare and log differences
       if (!deepEqual(legacyResult, langGraphResult)) {
         logDifference(legacyResult, langGraphResult)
       }
       
       // Return legacy result during transition
       return legacyResult
     }
     
     // Normal execution
     return getCurrentImplementation().execute(params)
   }
   ```

2. **A/B Testing**:
   ```typescript
   export function shouldUseLangGraph(userId: string): boolean {
     // Consistent assignment based on user ID
     const hash = hashUserId(userId)
     const percentage = parseInt(
       process.env.LANGGRAPH_ROLLOUT_PERCENTAGE || '0'
     )
     
     return (hash % 100) < percentage
   }
   ```

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback** (< 5 minutes):
   ```bash
   # Set environment variable
   export REACT_APP_FORCE_LEGACY_PIPELINE=true
   
   # Restart services
   npm run restart:all
   ```

2. **Data Recovery**:
   ```typescript
   // Backup graph state before major operations
   export class GraphStateBackup {
     async backup(sessionId: string, state: GraphState) {
       await redis.set(
         `backup:${sessionId}:${Date.now()}`,
         JSON.stringify(state),
         'EX',
         86400 // 24 hour expiry
       )
     }
     
     async restore(sessionId: string, timestamp: number) {
       const key = `backup:${sessionId}:${timestamp}`
       const data = await redis.get(key)
       return JSON.parse(data)
     }
   }
   ```

3. **Communication Plan**:
   - Alert team via Slack
   - Update status page
   - Notify affected users
   - Document issue for postmortem

## Success Criteria

Phase 2 is complete when:

1. **Functional Requirements**:
   - [ ] All pipeline steps converted to LangGraph nodes
   - [ ] WebSocket streaming operational
   - [ ] Frontend fully integrated
   - [ ] Feature parity with existing implementation

2. **Performance Requirements**:
   - [ ] Pipeline execution time ≤ current implementation
   - [ ] Memory usage stable under load
   - [ ] WebSocket connections scale to 1000+ concurrent users

3. **Quality Requirements**:
   - [ ] Test coverage ≥ 90%
   - [ ] No increase in error rates
   - [ ] Monitoring and alerting configured

4. **Operational Requirements**:
   - [ ] Rollback procedure tested
   - [ ] Documentation updated
   - [ ] Team trained on new architecture

## Timeline Estimates

| Step | Duration | Dependencies |
|------|----------|--------------|
| 2.1 Backend Setup | 2-3 days | Prerequisites complete |
| 2.2 Base Infrastructure | 3-4 days | 2.1 complete |
| 2.3 Implement Nodes | 5-7 days | 2.2 complete |
| 2.4 Build Graph | 3-4 days | 2.3 complete |
| 2.5 Streaming API | 3-4 days | 2.4 complete |
| 2.6 Frontend Integration | 4-5 days | 2.5 complete |
| 2.7 Testing | 3-4 days | 2.6 complete |
| 2.8 Migration | 2-3 days | 2.7 complete |
| **Total** | **25-34 days** | ~5-7 weeks |

### Risk Factors

- **Technical Debt**: Legacy code complexity may slow node conversion
- **Testing**: Ensuring output parity may require extensive validation
- **Performance**: Streaming overhead may impact response times
- **Dependencies**: LangGraph API changes could affect implementation

### Mitigation Strategies

1. **Incremental Development**: Complete and test each step before moving on
2. **Parallel Work**: Frontend and backend teams can work simultaneously
3. **Early Testing**: Set up comparison tests from day 1
4. **Feature Flags**: Allow quick rollback at any stage

## Next Steps

1. Review and approve this implementation guide
2. Set up project tracking with defined milestones
3. Assign team members to each step
4. Schedule daily standups during implementation
5. Begin with Step 2.1: Backend Setup

---

This guide provides a practical, step-by-step approach to migrating the UPath pipeline to LangGraph. The emphasis is on incremental progress, thorough testing, and the ability to rollback if needed. Each step builds on the previous one, ensuring a stable foundation throughout the migration process.