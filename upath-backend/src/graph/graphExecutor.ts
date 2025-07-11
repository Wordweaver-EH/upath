import { EventEmitter } from 'events';
import { Graph } from './graphBuilder';
import { GraphState, ExecutionContext, StepId } from './types';
import { createInitialGraphState } from './types/state';
import { v4 as uuidv4 } from 'uuid';

export interface SessionInit {
  transcripts: GraphState['transcripts'];
  settings: Partial<GraphState['metadata']['settings']>;
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

export class GraphExecutor extends EventEmitter {
  private graph: Graph;
  private sessions: Map<string, Session>;

  constructor(graph: Graph) {
    super();
    this.graph = graph;
    this.sessions = new Map();
  }

  async createSession(init: SessionInit): Promise<string> {
    const sessionId = `session-${uuidv4()}`;
    const state = createInitialGraphState(
      sessionId,
      init.transcripts,
      init.settings as any
    );

    this.sessions.set(sessionId, {
      state,
      createdAt: Date.now()
    });

    return sessionId;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  pauseSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.state.status = 'paused';
    }
  }

  resumeSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.state.status = 'running';
    }
  }

  restoreSession(state: GraphState): void {
    this.sessions.set(state.sessionId, {
      state,
      createdAt: Date.now()
    });
  }

  async executeStep(
    sessionId: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId);
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
    if (state.status === 'completed' || state.currentStep === StepId.COMPLETE) {
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
      // Execute the node
      const result = await currentNode.executeWithRetry(state, context);

      if (result.success && result.state) {
        // Update state with node results
        Object.assign(state, result.state);
        
        // Find next step
        const edges = this.graph.edges.get(state.currentStep) || [];
        const nextStep = edges[0]; // For now, just take the first edge
        
        // Check conditional edges
        const conditionalEdges = this.graph.conditionalEdges.get(state.currentStep) || [];
        for (const edge of conditionalEdges) {
          if (edge.condition(state)) {
            state.currentStep = edge.target;
            break;
          }
        }
        
        // If no conditional edge matched, use regular edge
        if (state.currentStep === result.state.currentStep && nextStep) {
          state.currentStep = nextStep;
        }

        // Update session
        session.lastExecutedAt = Date.now();

        // Emit step complete event
        this.emit('stepComplete', {
          sessionId,
          stepId: result.state.lastCompletedStep,
          nextStep: state.currentStep,
          timestamp: Date.now()
        });

        const hasMore = state.currentStep !== StepId.COMPLETE && 
                       edges.length > 0;

        if (!hasMore) {
          state.status = 'completed';
        }

        return {
          success: true,
          completedStep: result.state.lastCompletedStep,
          nextStep: hasMore ? state.currentStep : undefined,
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