/**
 * Pipeline API Routes
 * Simple backend endpoints that replace complex LangGraph routing
 * Mimics the working prototype's processSingleStep pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StepId } from '../types';
import { StepExecutionRequest, StepExecutionResponse } from '../pipeline/core/interfaces';
import { pipelineExecutor } from '../pipeline/core/executor';
import { geminiService } from '../services/geminiService';
import { stepValidator } from '../services/stepValidation';
import { stepRegistry } from '../pipeline/core/registry';
import { getErrorMessage } from '../types/errors';

/**
 * Request interface for step execution
 * Matches the working prototype's processSingleStep parameters
 */
interface ExecuteStepRequest {
  Body: StepExecutionRequest;
}

/**
 * Request interface for step validation
 */
interface ValidateStepRequest {
  Params: {
    stepId: StepId;
  };
  Body?: {
    testData?: any;
  };
}

/**
 * Request interface for step registry queries
 */
interface StepRegistryRequest {
  Params?: {
    stepId?: StepId;
  };
}

/**
 * Pipeline route registration
 * Replaces complex /api/graph/* and /api/langgraph/* routes with simple pattern
 */
export default async function pipelineRoute(fastify: FastifyInstance) {
  
  // Lazy inject Gemini service into pipeline executor (after dotenv is loaded)
  // This ensures environment variables are available when GeminiService is instantiated
  pipelineExecutor.setGeminiService(geminiService.instance);

  /**
   * POST /api/pipeline/execute-step
   * Main endpoint that replaces the working prototype's processSingleStep
   * 
   * This is the core endpoint that mimics the exact behavior of:
   * const result = await processSingleStep(stepId, transcriptIdToProcess, overrideSeed, hilMetaPrompt)
   */
  fastify.post<ExecuteStepRequest>('/pipeline/execute-step', async (request: FastifyRequest<ExecuteStepRequest>, reply: FastifyReply) => {
    const startTime = Date.now();
    
    try {
      console.log(`[PipelineAPI] Received execute-step request for ${request.body.stepId}`);
      
      // Validate request body
      const validationError = validateExecuteStepRequest(request.body);
      if (validationError) {
        return reply.status(400).send({
          success: false,
          error: validationError,
          stepId: request.body.stepId,
          timestamp: new Date().toISOString(),
        });
      }

      // Check if step is registered
      if (!stepRegistry.isRegistered(request.body.stepId)) {
        return reply.status(404).send({
          success: false,
          error: `Step ${request.body.stepId} is not registered. Available steps: ${stepRegistry.getRegisteredStepIds().join(', ')}`,
          stepId: request.body.stepId,
          timestamp: new Date().toISOString(),
        });
      }

      // Validate step dependencies (basic check)
      const processedDataMap = new Map(Object.entries(request.body.processedData));
      const depValidation = await pipelineExecutor.validateDependencies(request.body.stepId, processedDataMap);
      
      if (!depValidation.valid) {
        console.warn(`[PipelineAPI] Dependencies not met for ${request.body.stepId}: ${depValidation.missingDependencies.join(', ')}`);
        // Note: This is just a warning, not blocking execution for now
      }

      // Execute the step using pipeline executor
      const result: StepExecutionResponse = await pipelineExecutor.executeStep(request.body);

      // Log execution result
      const executionTime = Date.now() - startTime;
      console.log(`[PipelineAPI] Step ${request.body.stepId} ${result.success ? 'completed' : 'failed'} in ${executionTime}ms`);
      
      if (result.success) {
        fastify.log.info(`Step execution successful: ${request.body.stepId}`);
      } else {
        fastify.log.error(`Step execution failed: ${request.body.stepId} - ${result.error}`);
      }

      // Return result (same format as working prototype)
      return reply.status(result.success ? 200 : 500).send(result);

    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      console.error(`[PipelineAPI] Unexpected error executing ${request.body.stepId}:`, error);
      
      return reply.status(500).send({
        success: false,
        stepId: request.body.stepId,
        error: `Unexpected server error: ${getErrorMessage(error)}`,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/pipeline/steps
   * Get list of all registered steps
   */
  fastify.get<StepRegistryRequest>('/pipeline/steps', async (request: FastifyRequest<StepRegistryRequest>, reply: FastifyReply) => {
    try {
      const steps = stepRegistry.getAllSteps().map(step => ({
        id: step.config.id,
        title: step.config.title,
        part: step.config.part,
        isJsonOutput: step.config.isJsonOutput,
        dependencies: step.config.dependencies || [],
        hasParseOutput: !!step.parseOutput,
        hasValidateAndClean: !!step.validateAndClean,
      }));

      const stats = stepRegistry.getStats();

      return reply.send({
        success: true,
        steps,
        stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/pipeline/steps/:stepId
   * Get details for specific step
   */
  fastify.get<StepRegistryRequest>('/pipeline/steps/:stepId', async (request: FastifyRequest<StepRegistryRequest>, reply: FastifyReply) => {
    try {
      const stepId = request.params?.stepId as StepId;
      
      if (!stepRegistry.isRegistered(stepId)) {
        return reply.status(404).send({
          success: false,
          error: `Step ${stepId} is not registered`,
          timestamp: new Date().toISOString(),
        });
      }

      const step = stepRegistry.get(stepId);
      const dependencyChain = stepRegistry.getDependencyChain(stepId);

      return reply.send({
        success: true,
        step: {
          id: step.config.id,
          title: step.config.title,
          part: step.config.part,
          isJsonOutput: step.config.isJsonOutput,
          dependencies: step.config.dependencies || [],
          dependencyChain,
          hasParseOutput: !!step.parseOutput,
          hasValidateAndClean: !!step.validateAndClean,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/pipeline/validate/:stepId/pre
   * Validate step before implementation (query prototype)
   */
  fastify.post<ValidateStepRequest>('/pipeline/validate/:stepId/pre', async (request: FastifyRequest<ValidateStepRequest>, reply: FastifyReply) => {
    try {
      const stepId = request.params.stepId as StepId;
      console.log(`[PipelineAPI] Starting pre-implementation validation for ${stepId}`);

      const result = await stepValidator.validateStepPreImplementation(stepId);

      return reply.send({
        success: true,
        validation: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/pipeline/validate/:stepId/post
   * Validate step after implementation (compare with prototype)
   */
  fastify.post<ValidateStepRequest>('/pipeline/validate/:stepId/post', async (request: FastifyRequest<ValidateStepRequest>, reply: FastifyReply) => {
    try {
      const stepId = request.params.stepId as StepId;
      const testData = request.body?.testData;
      
      console.log(`[PipelineAPI] Starting post-implementation validation for ${stepId}`);

      const result = await stepValidator.validateStepPostImplementation(stepId, testData);

      return reply.send({
        success: true,
        validation: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/pipeline/health
   * Health check for pipeline system
   */
  fastify.get('/pipeline/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const executorHealth = await pipelineExecutor.healthCheck();
      const geminiHealth = await geminiService.healthCheck();
      const registryStats = stepRegistry.getStats();

      const overallHealthy = executorHealth.healthy && geminiHealth.healthy;

      return reply.status(overallHealthy ? 200 : 503).send({
        healthy: overallHealthy,
        services: {
          executor: executorHealth,
          gemini: geminiHealth,
          registry: {
            healthy: registryStats.totalSteps > 0,
            details: registryStats,
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      return reply.status(503).send({
        healthy: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/pipeline/stats
   * Get pipeline execution statistics
   */
  fastify.get('/pipeline/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const executorStats = pipelineExecutor.getStats();
      const geminiStats = geminiService.getStats();
      const registryStats = stepRegistry.getStats();

      return reply.send({
        success: true,
        stats: {
          executor: executorStats,
          gemini: geminiStats,
          registry: registryStats,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Validate execute step request
 */
function validateExecuteStepRequest(body: StepExecutionRequest): string | null {
  if (!body.stepId) {
    return 'Missing required field: stepId';
  }

  if (!body.currentTranscript) {
    return 'Missing required field: currentTranscript';
  }

  if (!body.currentTranscript.id || !body.currentTranscript.content) {
    return 'currentTranscript must have id and content';
  }

  if (!body.userDvFocus || !Array.isArray(body.userDvFocus.dv_focus)) {
    return 'Missing or invalid userDvFocus.dv_focus array';
  }

  if (!body.processedData) {
    return 'Missing required field: processedData';
  }

  if (!body.genericAnalysisState) {
    return 'Missing required field: genericAnalysisState';
  }

  if (!Array.isArray(body.allRawTranscripts)) {
    return 'allRawTranscripts must be an array';
  }

  return null; // Valid
}