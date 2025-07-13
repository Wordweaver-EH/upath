import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUPathPipeline } from '../graph/langgraph/graphBuilder';
import { UPathMVPState } from '../graph/langgraph/annotations';
import { EventSourceParserStream } from 'eventsource-parser/stream';

// Create pipeline instance
const uPathPipeline = createUPathPipeline();

/**
 * Request interface for LangGraph processing
 */
interface LangGraphProcessRequest {
  Body: {
    transcripts: Array<{
      id: string;
      filename?: string;
      content: string;
    }>;
    settings?: {
      model?: string;
      temperature?: number;
      seed?: number;
      useGrounding?: boolean;
    };
    userDvFocus?: { dv_focus: string[] };
    irr_inputs?: any;
  };
}

/**
 * Session request interface
 */
interface SessionRequest {
  Params: {
    sessionId: string;
  };
}

/**
 * LangGraph route handler for µ-PATH pipeline
 * Provides streaming execution of the pipeline
 */
export default async function langgraphRoute(fastify: FastifyInstance) {
  
  /**
   * POST /api/langgraph/process - Process transcripts through LangGraph pipeline
   * Streams progress updates as SSE (Server-Sent Events)
   */
  fastify.post<LangGraphProcessRequest>('/langgraph/process', async (request: FastifyRequest<LangGraphProcessRequest>, reply: FastifyReply) => {
    const { transcripts, settings, userDvFocus, irr_inputs } = request.body;

    // Validate required fields
    if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
      return reply.status(400).send({
        error: 'Transcripts array is required and cannot be empty'
      });
    }

    // Validate transcript structure
    for (const transcript of transcripts) {
      if (!transcript.id || !transcript.content) {
        return reply.status(400).send({
          error: 'Each transcript must have id and content fields'
        });
      }
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      // Create initial state
      const initialState: Partial<UPathMVPState> = {
        pipelineId: crypto.randomUUID(),
        transcripts,
        currentTranscriptIndex: 0,
        currentPhaseIndex: 0,
        currentGDUIndex: 0,
        currentPhase: "",
        gdus: [],
        stepOutputs: {},
        errors: [],
        progress: 0,
        status: "idle",
        isMultiTranscript: transcripts.length > 1,
        ...(userDvFocus && { userDvFocus }),
        ...(irr_inputs && { irr_inputs }),
        ...(settings && { settings }),
      };

      // Stream the pipeline execution
      const stream = await uPathPipeline.stream(initialState, {
        streamMode: "values",
        recursionLimit: 100, // Prevent infinite loops
      });

      // Process stream and send updates
      for await (const state of stream) {
        // Send progress update
        const update = {
          type: 'progress',
          data: {
            sessionId: state.pipelineId,
            currentPhase: state.currentPhase,
            progress: state.progress,
            status: state.status,
            currentTranscriptIndex: state.currentTranscriptIndex,
            currentGDUIndex: state.currentGDUIndex,
            timestamp: new Date().toISOString(),
          }
        };

        reply.raw.write(`data: ${JSON.stringify(update)}\n\n`);

        // Send phase output if available
        if (state.currentPhase && state.stepOutputs[state.currentPhase]) {
          const phaseUpdate = {
            type: 'phase_complete',
            data: {
              phase: state.currentPhase,
              output: state.stepOutputs[state.currentPhase],
              timestamp: new Date().toISOString(),
            }
          };
          reply.raw.write(`data: ${JSON.stringify(phaseUpdate)}\n\n`);
        }

        // Check for errors
        if (state.errors && state.errors.length > 0) {
          const errorUpdate = {
            type: 'error',
            data: {
              phase: state.currentPhase,
              errors: state.errors,
              timestamp: new Date().toISOString(),
            }
          };
          reply.raw.write(`data: ${JSON.stringify(errorUpdate)}\n\n`);
        }
      }

      // Get final state
      const finalState = await uPathPipeline.getState({
        configurable: { thread_id: initialState.pipelineId }
      });

      // Send completion event
      const completeUpdate = {
        type: 'complete',
        data: {
          sessionId: finalState.values.pipelineId,
          status: 'completed',
          results: finalState.values.stepOutputs,
          timestamp: new Date().toISOString(),
        }
      };
      reply.raw.write(`data: ${JSON.stringify(completeUpdate)}\n\n`);
      
      // Close the stream
      reply.raw.end();

    } catch (error) {
      fastify.log.error('LangGraph execution error:', error);
      
      const errorUpdate = {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }
      };
      
      reply.raw.write(`data: ${JSON.stringify(errorUpdate)}\n\n`);
      reply.raw.end();
    }
  });

  /**
   * GET /api/langgraph/session/:sessionId - Get session state
   */
  fastify.get<SessionRequest>('/langgraph/session/:sessionId', async (request: FastifyRequest<SessionRequest>, reply: FastifyReply) => {
    const { sessionId } = request.params;

    try {
      const state = await uPathPipeline.getState({
        configurable: { thread_id: sessionId }
      });

      if (!state || !state.values) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      return reply.status(200).send({
        sessionId: state.values.pipelineId,
        currentPhase: state.values.currentPhase,
        progress: state.values.progress,
        status: state.values.status,
        stepOutputs: state.values.stepOutputs,
        errors: state.values.errors,
      });

    } catch (error) {
      fastify.log.error('Failed to get session state:', error);
      return reply.status(500).send({
        error: `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  /**
   * POST /api/langgraph/session/:sessionId/interrupt - Handle graph interrupts
   * For human-in-the-loop scenarios
   */
  fastify.post<SessionRequest>('/langgraph/session/:sessionId/interrupt', async (request: FastifyRequest<SessionRequest>, reply: FastifyReply) => {
    const { sessionId } = request.params;

    try {
      // Update state with interrupt data
      await uPathPipeline.updateState(
        { configurable: { thread_id: sessionId } },
        request.body as any,
        // Resume from the interrupt
        { as: "node" }
      );

      return reply.status(200).send({
        message: 'Interrupt handled, graph will resume',
        sessionId,
      });

    } catch (error) {
      fastify.log.error('Failed to handle interrupt:', error);
      return reply.status(500).send({
        error: `Failed to handle interrupt: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  /**
   * GET /api/langgraph/health - Health check for LangGraph service
   */
  fastify.get('/langgraph/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if pipeline is compiled
      if (!uPathPipeline) {
        return reply.status(503).send({
          status: 'unhealthy',
          error: 'Pipeline not initialized'
        });
      }

      return reply.status(200).send({
        status: 'healthy',
        service: 'langgraph',
        pipeline: 'upath-mvp',
        version: '1.0.0',
      });

    } catch (error) {
      return reply.status(503).send({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}