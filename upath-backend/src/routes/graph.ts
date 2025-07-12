import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphBuilder } from '../graph/graphBuilder';
import { GraphExecutor, SessionInit } from '../graph/graphExecutor';
import { NodeRegistry } from '../graph/nodeRegistry';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSessionStore } from '../graph/stores';

/**
 * Request interface for creating a new graph execution session
 */
interface CreateSessionRequest {
  Body: {
    transcripts: Array<{
      id: string;
      filename: string;
      content: string;
    }>;
    settings: {
      userDvFocus?: string;
      [key: string]: any;
    };
  };
}

/**
 * Request interface for executing a graph step
 */
interface ExecuteRequest {
  Body: {
    sessionId: string;
    model?: string;
    temperature?: number;
    useGrounding?: boolean;
    seed?: number;
  };
}

/**
 * Session ID parameter interface
 */
interface SessionParams {
  Params: {
    sessionId: string;
  };
}

// Create shared graph components with unified session store
const nodeRegistry = new NodeRegistry();
const graphBuilder = new GraphBuilder(nodeRegistry);
const graph = graphBuilder.build();
const sharedSessionStore = getSessionStore();
const graphExecutor = new GraphExecutor(graph, sharedSessionStore);

/**
 * Default Gemini model for graph execution
 */
const DEFAULT_MODEL = 'gemini-1.5-flash';

/**
 * Valid Gemini model names for graph execution
 */
const VALID_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-pro-vision'
];

/**
 * Registers graph execution API routes
 */
export default async function graphRoute(fastify: FastifyInstance) {
  
  // POST /api/graph/session - Create new session
  fastify.post<CreateSessionRequest>('/graph/session', async (request: FastifyRequest<CreateSessionRequest>, reply: FastifyReply) => {
    const { transcripts, settings } = request.body;

    // Validate required fields
    if (!transcripts) {
      return reply.status(400).send({
        error: 'Missing required field: transcripts'
      });
    }

    if (!Array.isArray(transcripts)) {
      return reply.status(400).send({
        error: 'Field transcripts must be an array'
      });
    }

    if (transcripts.length === 0) {
      return reply.status(400).send({
        error: 'Transcripts array cannot be empty'
      });
    }

    // Validate transcript structure
    for (const transcript of transcripts) {
      if (!transcript.id || !transcript.filename || !transcript.content) {
        return reply.status(400).send({
          error: 'Each transcript must have id, filename, and content fields'
        });
      }
    }

    try {
      // Create session init object
      const sessionInit: SessionInit = {
        transcripts,
        settings: settings || {},
        userDvFocus: settings?.userDvFocus
      };

      // Create the session
      const sessionId = await graphExecutor.createSession(sessionInit);
      const session = await graphExecutor.getSession(sessionId);

      if (!session) {
        return reply.status(500).send({
          error: 'Failed to create session'
        });
      }

      return reply.status(201).send({
        sessionId,
        currentStep: session.state.currentStep,
        status: 'initialized',
        progress: session.state.progress,
        createdAt: session.createdAt
      });

    } catch (error) {
      fastify.log.error('Failed to create graph session:', error);
      return reply.status(500).send({
        error: `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // GET /api/graph/session/:sessionId - Get session status
  fastify.get<SessionParams>('/graph/session/:sessionId', async (request: FastifyRequest<SessionParams>, reply: FastifyReply) => {
    const { sessionId } = request.params;

    try {
      const session = await graphExecutor.getSession(sessionId);

      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      return reply.status(200).send({
        sessionId,
        currentStep: session.state.currentStep,
        status: session.state.status,
        progress: session.state.progress,
        lastCompletedStep: session.state.lastCompletedStep,
        createdAt: session.createdAt,
        lastExecutedAt: session.lastExecutedAt,
        errors: session.state.errors
      });

    } catch (error) {
      fastify.log.error('Failed to get session:', error);
      return reply.status(500).send({
        error: `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // POST /api/graph/execute - Execute next step
  fastify.post<ExecuteRequest>('/graph/execute', async (request: FastifyRequest<ExecuteRequest>, reply: FastifyReply) => {
    const { sessionId, model = DEFAULT_MODEL, temperature = 0.0, useGrounding = false, seed } = request.body;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return reply.status(400).send({
        error: 'Missing or invalid sessionId parameter'
      });
    }

    // Validate model if provided
    if (model && !VALID_MODELS.includes(model)) {
      return reply.status(400).send({
        error: `Invalid model: ${model}. Valid models are: ${VALID_MODELS.join(', ')}`
      });
    }

    // Verify API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({
        error: 'API Key not configured on server'
      });
    }

    try {
      // Check if session exists
      const session = await graphExecutor.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      // Create execution context
      const genAI = new GoogleGenerativeAI(apiKey);
      const executionContext = {
        llmClient: genAI.getGenerativeModel({ model }),
        model,
        temperature,
        useGrounding,
        seed
      };

      // Execute the next step
      const result = await graphExecutor.executeStep(sessionId, executionContext);

      return reply.status(200).send(result);

    } catch (error) {
      fastify.log.error('Failed to execute graph step:', error);
      return reply.status(500).send({
        error: `Failed to execute step: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // DELETE /api/graph/session/:sessionId - Delete session
  fastify.delete<SessionParams>('/graph/session/:sessionId', async (request: FastifyRequest<SessionParams>, reply: FastifyReply) => {
    const { sessionId } = request.params;

    try {
      // Check if session exists
      const session = await graphExecutor.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      // Delete the session
      await graphExecutor.deleteSession(sessionId);

      return reply.status(204).send();

    } catch (error) {
      fastify.log.error('Failed to delete session:', error);
      return reply.status(500).send({
        error: `Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}