import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GraphExecutor } from '../graph/graphExecutor';
import { GraphBuilder } from '../graph/graphBuilder';
import { getSessionStore } from '../graph/stores';
import { StepId } from '../graph/types/enums';
import { GraphState, ExecutionContext } from '../graph/types/state';
import { NodeRegistry } from '../graph/nodeRegistry';

/**
 * Request interface for the /api/hil endpoint
 * Handles Human-in-the-Loop feedback for correcting specific pipeline steps
 */
interface HilRequest {
  Body: {
    sessionId: string;           // Required: Session ID containing the current graph state
    stepId: string;              // Required: Step ID that needs correction
    userGuidance: string;        // Required: User's feedback/guidance for correction
    originalPrompt?: string;     // Optional: Original prompt that produced problematic results
    previousResponse?: string;   // Optional: Previous response that was problematic
    transcriptId?: string;       // Optional: Specific transcript ID if step is transcript-specific
    temperature?: number;        // Optional: Temperature for LLM re-generation
    seed?: number;              // Optional: Seed for deterministic outputs
  };
}

/**
 * Response interface for HIL corrections
 */
interface HilResponse {
  success: boolean;
  correctedOutput?: any;        // The corrected step output
  updatedState?: Partial<GraphState>; // Updated graph state after correction
  error?: string;              // Error message if correction failed
  message?: string;            // Success message or additional info
}

/**
 * Valid step IDs that support HIL correction
 * Only steps that generate content via LLM calls can be corrected
 */
const HIL_SUPPORTED_STEPS = [
  StepId.P0_1_TRANSCRIPTION_ADHERENCE,
  StepId.P0_2_REFINE_DATA_TYPES, 
  StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
  StepId.P1_1_INITIAL_SEGMENTATION,
  StepId.P1_2_DIACHRONIC_UNIT_ID,
  StepId.P1_3_REFINE_DIACHRONIC_UNITS,
  StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
  StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
  StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  StepId.P3_1_ALIGN_STRUCTURES,
  StepId.P3_2_IDENTIFY_GDUS,
  StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
  StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
  StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
  StepId.P5_2_HOLISTIC_REFINEMENT,
  StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
  StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
  StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
  StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
  StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
  StepId.P9_1_SEMANTIC_GDU_MAPPING
];

/**
 * Registers the /api/hil route for Human-in-the-Loop feedback processing
 * 
 * This endpoint allows users to provide corrective feedback on pipeline step outputs
 * and automatically re-runs the specific step with the guidance integrated into the prompt.
 * This maintains the security architecture by keeping all LLM interactions on the backend.
 */
export default async function hilRoute(fastify: FastifyInstance) {
  // Initialize required services using shared session store for consistency
  const sessionStore = getSessionStore();
  const nodeRegistry = new NodeRegistry();

  fastify.post<HilRequest>('/hil', async (request: FastifyRequest<HilRequest>, reply: FastifyReply) => {
    const { sessionId, stepId, userGuidance, originalPrompt, previousResponse, transcriptId, temperature = 0.7, seed } = request.body;

    // VALIDATION: Ensure required parameters are provided
    if (!sessionId || typeof sessionId !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'Missing or invalid sessionId parameter'
      });
    }

    if (!stepId || typeof stepId !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'Missing or invalid stepId parameter'
      });
    }

    if (!userGuidance || typeof userGuidance !== 'string' || !userGuidance.trim()) {
      return reply.status(400).send({
        success: false,
        error: 'Missing or invalid userGuidance parameter'
      });
    }

    // VALIDATION: Ensure stepId supports HIL correction
    if (!HIL_SUPPORTED_STEPS.includes(stepId as StepId)) {
      return reply.status(400).send({
        success: false,
        error: `Step ${stepId} does not support HIL correction. Please refer to the documentation for supported steps.`
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
      // VALIDATE SESSION EXISTS: Check session before processing
      let currentSession: any;
      try {
        currentSession = await sessionStore.get(sessionId);
        if (!currentSession) {
          return reply.status(404).send({
            success: false,
            error: `Session ${sessionId} not found`
          });
        }
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve session'
        });
      }

      const currentState = currentSession.state;

      // VALIDATION: Ensure the step has been executed before
      const existingOutput = currentState.stepOutputs?.[stepId as StepId];
      if (!existingOutput) {
        return reply.status(400).send({
          success: false,
          error: `Step ${stepId} has not been executed yet. HIL correction requires existing step output.`
        });
      }

      // SETUP LLM CLIENT: Initialize Gemini client with configurable model
      const modelName = currentState.metadata?.settings?.model || 
                        process.env.DEFAULT_GEMINI_MODEL || 
                        'gemini-1.5-flash-latest';
      const genAI = new GoogleGenerativeAI(apiKey);
      const llmClient = genAI.getGenerativeModel({ model: modelName });

      // CREATE EXECUTION CONTEXT: Setup context for step re-execution
      const executionContext: ExecutionContext = {
        llmClient,
        settings: {
          temperature,
          ...(seed !== undefined ? { seed } : {}),
          hilMetaPrompt: userGuidance // Pass HIL guidance as meta prompt
        },
        logger: {
          info: (message: string, data?: any) => fastify.log.info(message, data),
          error: (message: string, error?: any) => fastify.log.error(message, error),
          debug: (message: string, data?: any) => fastify.log.debug(message, data)
        },
        progress: {
          percentage: 100, // HIL correction doesn't affect overall progress
          currentStepIndex: 0,
          totalSteps: 1
        }
      };

      // GET NODE: Retrieve the specific node for re-execution
      const node = nodeRegistry.getNode(stepId as StepId);
      if (!node) {
        return reply.status(500).send({
          success: false,
          error: `Node for step ${stepId} not found in registry`
        });
      }

      // SPECIAL HANDLING: For transcript-specific steps, validate transcript exists
      if (transcriptId && currentState.transcripts) {
        const transcript = currentState.transcripts.find(t => t.id === transcriptId);
        if (!transcript) {
          return reply.status(400).send({
            success: false,
            error: `Transcript ${transcriptId} not found in session`
          });
        }
        
        // Note: Transcript-specific state modification will be handled inside the atomic block
        // using the current session state to prevent race conditions
      }

      // ATOMIC EXECUTION AND UPDATE: Execute HIL correction and update session atomically
      // This prevents race conditions where session state changes during LLM processing
      fastify.log.info(`Starting atomic HIL correction for step ${stepId} in session ${sessionId}`);
      
      let executionResult: any = null;
      let correlationId: string = request.id || 'unknown-request';

      const finalSession = await sessionStore.atomicUpdate(sessionId, async (session) => {
        if (!session) {
          throw new Error(`Session ${sessionId} was deleted during processing`);
        }

        // PREPARE STATE: Create modified state based on CURRENT session state (not stale state)
        const currentSessionState = session.state;
        const modifiedStateForExecution: GraphState = {
          ...currentSessionState,
          metadata: {
            ...currentSessionState.metadata,
            hilCorrection: {
              stepId,
              userGuidance,
              originalPrompt,
              previousResponse,
              timestamp: Date.now()
            }
          }
        };

        // EXECUTE WITH HIL: Re-run the step with HIL guidance integrated on current state
        // The node will receive the HIL guidance through executionContext.settings.hilMetaPrompt
        // Individual nodes are responsible for integrating this guidance into their prompts
        try {
          executionResult = await node.executeWithRetry(modifiedStateForExecution, executionContext);
          
          if (!executionResult.success) {
            fastify.log.error({ 
              error: executionResult.error, 
              correlationId, 
              stepId, 
              sessionId 
            }, 'HIL correction node execution failed');
            // Throw error to abort the atomic transaction
            throw new Error(`HIL correction failed: ${executionResult.error?.message || 'Unknown error'}`);
          }

          // APPLY RESULTS: Merge execution results with current session state
          const correctedState: GraphState = {
            ...modifiedStateForExecution,
            ...executionResult.state,
            metadata: {
              ...modifiedStateForExecution.metadata,
              ...executionResult.state?.metadata,
              lastUpdateTime: Date.now(),
              hilCorrectionApplied: {
                stepId,
                timestamp: Date.now(),
                userGuidance: userGuidance.substring(0, 200) // Store truncated guidance for audit
              }
            }
          };

          return {
            ...session,
            state: correctedState,
            lastExecutedAt: Date.now()
          };

        } catch (error) {
          // Log the error and re-throw to abort the atomic transaction
          fastify.log.error({ 
            error, 
            correlationId, 
            stepId, 
            sessionId 
          }, 'HIL correction execution failed during atomic update');
          throw error;
        }
      });

      // Check if execution failed (this should not happen due to error throwing above, but safety check)
      if (!executionResult || !executionResult.success) {
        return reply.status(500).send({
          success: false,
          error: `HIL correction failed. Contact support with ID: ${correlationId}`
        });
      }

      // SUCCESS RESPONSE: Return corrected results
      const correctedOutput = finalSession.state.stepOutputs?.[stepId as StepId];
      
      const response: HilResponse = {
        success: true,
        correctedOutput,
        updatedState: {
          stepOutputs: finalSession.state.stepOutputs,
          metadata: finalSession.state.metadata,
          currentStep: finalSession.state.currentStep,
          lastCompletedStep: finalSession.state.lastCompletedStep || undefined
        },
        message: `HIL correction applied successfully to step ${stepId}`
      };

      fastify.log.info(`HIL correction completed for step ${stepId} in session ${sessionId}`);
      return response;

    } catch (error) {
      // ERROR HANDLING: Log error securely and return safe error message
      const correlationId = request.id || 'unknown-request';
      fastify.log.error({ 
        error, 
        correlationId, 
        stepId, 
        sessionId 
      }, 'HIL correction failed');
      return reply.status(500).send({
        success: false,
        error: `Internal server error. Contact support with ID: ${correlationId}`
      });
    }
  });
}