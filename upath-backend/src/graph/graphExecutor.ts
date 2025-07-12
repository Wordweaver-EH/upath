import { EventEmitter } from 'events';
import { Graph } from './graphBuilder';
import { GraphState, ExecutionContext, StepId } from './types';
import { createInitialGraphState } from './types/state';
import { v4 as uuidv4 } from 'uuid';
import { ISessionStore } from './types/sessionStore';
import { InMemorySessionStore } from './stores/InMemorySessionStore';
import { ProgressCalculator } from './services/ProgressCalculator';

export interface SessionInit {
  transcripts: GraphState['transcripts'];
  settings: Partial<GraphState['metadata']['settings']>;
  userDvFocus?: GraphState['userDvFocus'];
}

export interface ExecutionResult {
  success: boolean;
  completedStep?: string;
  nextStep?: string;
  hasMore: boolean;
  error?: {
    message: string;
    stepId?: string;
  };
}

export interface Session {
  state: GraphState;
  createdAt: number;
  lastExecutedAt?: number;
}

/**
 * GraphExecutor manages the execution of a processing graph
 * 
 * KNOWN ISSUE: Race Condition in Concurrent Updates
 * --------------------------------------------------
 * The current implementation has a race condition when multiple requests
 * try to update the same session concurrently. The pattern is:
 * 1. Read session
 * 2. Execute node
 * 3. Update session
 * 
 * If two requests execute concurrently, one will overwrite the other's changes.
 * 
 * FUTURE FIX: Implement optimistic locking with version numbers:
 * - Add version field to Session
 * - Use compare-and-swap operations (Redis WATCH/MULTI/EXEC)
 * - Retry on version conflicts
 * 
 * CURRENT MITIGATION: In production, ensure only one request per session
 * is processed at a time using external coordination (e.g., message queue).
 */
export class GraphExecutor extends EventEmitter {
  private graph: Graph;
  private sessionStore: ISessionStore;
  private progressCalculator: ProgressCalculator;

  constructor(graph: Graph, sessionStore?: ISessionStore) {
    super();
    this.graph = graph;
    this.sessionStore = sessionStore || new InMemorySessionStore();
    this.progressCalculator = new ProgressCalculator(graph);
  }

  async createSession(init: SessionInit): Promise<string> {
    const sessionId = `session-${uuidv4()}`;
    const state = createInitialGraphState(
      sessionId,
      init.transcripts,
      init.settings as any
    );
    
    // Set userDvFocus if provided
    if (init.userDvFocus) {
      state.userDvFocus = init.userDvFocus;
    }
    
    // Set initial progress
    state.progress = this.progressCalculator.calculateProgress(state.currentStep);

    await this.sessionStore.set(sessionId, {
      state,
      createdAt: Date.now()
    });

    return sessionId;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    return await this.sessionStore.get(sessionId);
  }

  async hasSession(sessionId: string): Promise<boolean> {
    return await this.sessionStore.has(sessionId);
  }

  async listSessions(): Promise<string[]> {
    return await this.sessionStore.list();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionStore.delete(sessionId);
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.state.status = 'paused';
      await this.sessionStore.set(sessionId, session);
    }
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.state.status = 'running';
      await this.sessionStore.set(sessionId, session);
    }
  }

  async restoreSession(state: GraphState): Promise<void> {
    await this.sessionStore.set(state.sessionId, {
      state,
      createdAt: Date.now()
    });
  }

  async executeStep(
    sessionId: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const { state } = session;

    // Check if session is paused
    if (state.status === 'paused') {
      return {
        success: false,
        hasMore: false,
        error: { message: 'Session is paused' }
      };
    }

    // Check if already completed
    if (state.status === 'completed') {
      return {
        success: false,
        hasMore: false,
        error: { message: 'Session already completed' }
      };
    }

    // Set status to running
    state.status = 'running';

    // Get the current node
    const currentNode = this.graph.nodes.get(state.currentStep);
    if (!currentNode) {
      return {
        success: false,
        hasMore: false,
        error: { 
          message: `Node ${state.currentStep} not found`,
          stepId: state.currentStep
        }
      };
    }

    // Emit step start event
    this.emit('stepStart', {
      sessionId,
      stepId: state.currentStep,
      timestamp: Date.now()
    });

    try {
      // Calculate progress for current step
      const progressInfo = this.progressCalculator.getProgressInfo(state.currentStep);
      
      // Create enhanced context with progress
      const enhancedContext: ExecutionContext = {
        ...context,
        progress: {
          percentage: progressInfo.percentage,
          currentStepIndex: progressInfo.currentStepIndex,
          totalSteps: progressInfo.totalSteps
        }
      };
      
      // Execute the node
      const result = await currentNode.executeWithRetry(state, enhancedContext);

      if (result.success && result.state) {
        const completedStepId = state.currentStep;

        // Update state with node results
        Object.assign(state, result.state);
        // Explicitly set lastCompletedStep for clarity
        state.lastCompletedStep = completedStepId;
        
        // Determine the next step
        let nextStepId: string | undefined;

        // 1. Check for a conditional edge match
        const conditionalEdges = this.graph.conditionalEdges.get(completedStepId) || [];
        for (const edge of conditionalEdges) {
          if (edge.condition(state)) {
            nextStepId = edge.target;
            break;
          }
        }
        
        // 2. If no conditional edge, find a regular edge
        if (!nextStepId) {
          const edges = this.graph.edges.get(completedStepId) || [];
          nextStepId = edges[0]; // Assumes single outgoing path
        }

        // 3. Update currentStep or transition to COMPLETE
        if (nextStepId) {
          state.currentStep = nextStepId;
        } else {
          // No next step found, this was a terminal node.
          state.currentStep = StepId.COMPLETE;
          state.status = 'completed';
        }

        // Update progress based on the new current step
        state.progress = this.progressCalculator.calculateProgress(state.currentStep);
        
        // Update session
        session.lastExecutedAt = Date.now();

        // Emit step complete event
        this.emit('stepComplete', {
          sessionId,
          stepId: result.state.lastCompletedStep,
          nextStep: state.currentStep,
          timestamp: Date.now()
        });

        // Check if we have more steps to execute
        // hasMore is true if currentStep is a valid node that hasn't been completed yet
        const hasMore = state.currentStep !== StepId.COMPLETE && 
                       this.graph.nodes.has(state.currentStep) &&
                       state.currentStep !== result.state.lastCompletedStep;

        // Mark as completed only after COMPLETE step has been executed
        if (result.state.lastCompletedStep === StepId.COMPLETE) {
          state.status = 'completed';
        }

        // Persist the updated session
        await this.sessionStore.set(sessionId, session);

        return {
          success: true,
          completedStep: completedStepId,
          nextStep: state.currentStep !== completedStepId ? state.currentStep : undefined,
          hasMore
        };
      } else {
        // Handle error
        if (result.error) {
          state.errors[state.currentStep] = result.error;
        }

        // Emit step error event
        this.emit('stepError', {
          sessionId,
          stepId: state.currentStep,
          error: result.error,
          timestamp: Date.now()
        });

        state.status = 'failed';

        // Persist the updated session
        await this.sessionStore.set(sessionId, session);

        return {
          success: false,
          hasMore: false,
          error: {
            message: result.error?.message || 'Unknown error',
            stepId: state.currentStep
          }
        };
      }
    } catch (error: any) {
      // Handle unexpected errors
      state.status = 'failed';
      
      // Persist the updated session
      await this.sessionStore.set(sessionId, session);
      
      this.emit('stepError', {
        sessionId,
        stepId: state.currentStep,
        error: { message: error.message },
        timestamp: Date.now()
      });

      return {
        success: false,
        hasMore: false,
        error: {
          message: error.message,
          stepId: state.currentStep
        }
      };
    }
  }

  async executeUntil(
    sessionId: string,
    context: ExecutionContext,
    targetStep: string
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    while (true) {
      const result = await this.executeStep(sessionId, context);
      results.push(result);
      
      if (!result.success || !result.hasMore) {
        break;
      }
      
      if (result.completedStep === targetStep) {
        break;
      }
    }
    
    return results;
  }
}