import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StepId } from '../graph/types/enums';
import { P9_1_SemanticGduMapping } from '../graph/types/outputs';
import { P9_1_SemanticGduMappingNode, P9_1_Input } from '../graph/nodes/P9_1_SemanticGduMappingNode';
import { GraphState, ExecutionContext } from '../graph/types/state';
import { createInitialGraphState } from '../graph/types/state';

/**
 * Request interface for the /api/irr endpoint
 * Handles Inter-Rater Reliability semantic mapping between GDU sets
 */
interface IrrRequest {
  Body: {
    runAGdus: Array<{
      gdu_id: string;
      definition: string;
      contributing_refined_du_ids: string[];
    }>;
    runBGdus: Array<{
      gdu_id: string;
      definition: string;
      contributing_refined_du_ids: string[];
    }>;
    temperature?: number;        // Optional: Temperature for LLM generation
    seed?: number;              // Optional: Seed for deterministic outputs
    model?: string;             // Optional: Model to use for generation
  };
}

/**
 * Response interface for IRR semantic mapping
 */
interface IrrResponse {
  success: boolean;
  mapping?: P9_1_SemanticGduMapping;  // The semantic mapping result
  error?: string;                     // Error message if mapping failed
  message?: string;                   // Success message or additional info
}

/**
 * Registers the /api/irr route for Inter-Rater Reliability semantic mapping
 * 
 * This endpoint uses the P9_1_SemanticGduMappingNode to generate semantic mappings
 * between two sets of GDUs, maintaining consistency with the pipeline architecture.
 * This maintains the security architecture by keeping all LLM interactions on the backend.
 */
export default async function irrRoute(fastify: FastifyInstance) {
  fastify.post<IrrRequest>('/irr', async (request: FastifyRequest<IrrRequest>, reply: FastifyReply) => {
    const { 
      runAGdus, 
      runBGdus, 
      temperature = 0.7, 
      seed, 
      model 
    } = request.body;

    // VALIDATION: Ensure required parameters are provided
    if (!runAGdus || !Array.isArray(runAGdus)) {
      return reply.status(400).send({
        success: false,
        error: 'Missing or invalid runAGdus parameter - must be an array'
      });
    }

    if (!runBGdus || !Array.isArray(runBGdus)) {
      return reply.status(400).send({
        success: false,
        error: 'Missing or invalid runBGdus parameter - must be an array'
      });
    }

    // VALIDATION: Ensure GDU arrays are not empty
    if (runAGdus.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'runAGdus cannot be empty'
      });
    }

    if (runBGdus.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'runBGdus cannot be empty'
      });
    }

    // VALIDATION: Ensure GDU structure is valid
    const validateGduArray = (gdus: any[], runName: string): string | null => {
      for (let i = 0; i < gdus.length; i++) {
        const gdu = gdus[i];
        if (!gdu || typeof gdu !== 'object') {
          return `${runName}[${i}] must be an object`;
        }
        if (!gdu.gdu_id || typeof gdu.gdu_id !== 'string' || gdu.gdu_id.trim() === '') {
          return `${runName}[${i}].gdu_id must be a non-empty string`;
        }
        if (!gdu.definition || typeof gdu.definition !== 'string' || gdu.definition.trim() === '') {
          return `${runName}[${i}].definition must be a non-empty string`;
        }
        if (!Array.isArray(gdu.contributing_refined_du_ids)) {
          return `${runName}[${i}].contributing_refined_du_ids must be an array`;
        }
      }
      return null;
    };

    const runAValidation = validateGduArray(runAGdus, 'runAGdus');
    if (runAValidation) {
      return reply.status(400).send({
        success: false,
        error: runAValidation
      });
    }

    const runBValidation = validateGduArray(runBGdus, 'runBGdus');
    if (runBValidation) {
      return reply.status(400).send({
        success: false,
        error: runBValidation
      });
    }

    // VALIDATION: Ensure temperature is valid
    if (temperature !== undefined && (temperature < 0 || temperature > 1)) {
      return reply.status(400).send({
        success: false,
        error: 'temperature must be between 0 and 1'
      });
    }

    // SECURITY: Verify API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({
        success: false,
        error: 'API Key not configured on server'
      });
    }

    try {
      // SETUP LLM CLIENT: Initialize Gemini client with configurable model
      const modelName = model || 
                        process.env.DEFAULT_GEMINI_MODEL || 
                        'gemini-1.5-flash-latest';
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const llmClient = genAI.getGenerativeModel({ model: modelName });

      // CREATE P9_1 NODE INSTANCE
      const mappingNode = new P9_1_SemanticGduMappingNode();

      // PREPARE INPUTS: Convert route inputs to the format expected by the node
      const irrInputs: P9_1_Input = {
        run_a_gdus: runAGdus.map(gdu => ({
          gdu_id: gdu.gdu_id,
          definition: gdu.definition,
          supporting_transcripts_count: 1, // Not provided in route, default to 1
          contributing_refined_du_ids: gdu.contributing_refined_du_ids.map((id, idx) => ({
            transcript_id: 'unknown', // Not provided in route
            refined_du_id: id
          }))
        })),
        run_b_gdus: runBGdus.map(gdu => ({
          gdu_id: gdu.gdu_id,
          definition: gdu.definition,
          supporting_transcripts_count: 1, // Not provided in route, default to 1
          contributing_refined_du_ids: gdu.contributing_refined_du_ids.map((id, idx) => ({
            transcript_id: 'unknown', // Not provided in route
            refined_du_id: id
          }))
        })),
        temperature,
        ...(seed !== undefined && { seed })
      };

      // CREATE MINIMAL GRAPH STATE for the node
      const mockState: GraphState = {
        ...createInitialGraphState('irr-session', [], { 
          model: modelName, 
          temperature, 
          ...(seed !== undefined && { seed })
        }),
        irr_inputs: irrInputs
      };

      // CREATE EXECUTION CONTEXT
      const executionContext: ExecutionContext = {
        llmClient,
        logger: {
          info: (msg: string, data?: any) => fastify.log.info(data, msg),
          error: (msg: string, error?: any) => fastify.log.error(error, msg),
          debug: (msg: string, data?: any) => fastify.log.debug(data, msg)
        },
        settings: {
          model: modelName,
          temperature,
          ...(seed !== undefined && { seed })
        }
      };

      // EXECUTE NODE
      fastify.log.info('Executing P9_1 node for IRR semantic mapping', {
        runAGduCount: runAGdus.length,
        runBGduCount: runBGdus.length,
        temperature,
        model: modelName
      });

      const resultState = await mappingNode.execute(mockState, executionContext);
      
      // EXTRACT OUTPUT from the result state
      const output = resultState.stepOutputs?.[StepId.P9_1_SEMANTIC_GDU_MAPPING] as P9_1_SemanticGduMapping;
      
      if (!output || !output.gdu_mappings) {
        throw new Error('P9_1 node did not produce expected output');
      }

      // SUCCESS RESPONSE: Return the mapping
      const response: IrrResponse = {
        success: true,
        mapping: output,
        message: `IRR semantic mapping generated successfully with ${output.gdu_mappings.length} mappings`
      };

      fastify.log.info('IRR semantic mapping completed successfully', {
        totalMappings: output.gdu_mappings.length,
        mappedPairs: output.gdu_mappings.filter(m => m.run_b_gdu_id !== null).length,
        unmappedRunA: output.gdu_mappings.filter(m => m.run_b_gdu_id === null).length
      });

      return response;

    } catch (error) {
      // ERROR HANDLING: Log error securely and return safe error message
      const correlationId = request.id || 'unknown-request';
      fastify.log.error({ 
        error, 
        correlationId,
        runAGduCount: runAGdus.length,
        runBGduCount: runBGdus.length
      }, 'IRR semantic mapping failed');
      
      return reply.status(500).send({
        success: false,
        error: `Internal server error. Contact support with ID: ${correlationId}`
      });
    }
  });
}