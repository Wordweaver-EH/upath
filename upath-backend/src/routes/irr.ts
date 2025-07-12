import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StepId } from '../graph/types/enums';
import { P9_1_Input, P9_1_SemanticGduMapping } from '../graph/types/outputs';

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
 * This endpoint replaces the frontend callGeminiAPI functionality for IRR analysis.
 * It takes two sets of GDUs and generates semantic mappings between them using LLM analysis.
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
      const llmClient = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          ...(seed !== undefined ? { seed } : {})
        }
      });

      // BUILD SEMANTIC MAPPING PROMPT: Create the prompt for LLM analysis
      const prompt = `You are tasked with creating a semantic mapping between Generic Diachronic Units (GDUs) from two different analysis runs of micro-phenomenological data.

## Run A GDUs:
${runAGdus.map((gdu, idx) => `${idx + 1}. ${gdu.gdu_id}: ${gdu.definition}`).join('\n')}

## Run B GDUs:
${runBGdus.map((gdu, idx) => `${idx + 1}. ${gdu.gdu_id}: ${gdu.definition}`).join('\n')}

## Task:
Create a mapping between semantically similar GDUs across the two runs. Some GDUs may have no match in the other run.

Provide your response as a JSON object with this structure:
{
  "gdu_mappings": [
    {
      "run_a_gdu_id": "GDU ID from Run A",
      "run_a_definition": "Definition from Run A",
      "run_a_contributing_rdu_count": number,
      "run_b_gdu_id": "GDU ID from Run B or null",
      "run_b_definition": "Definition from Run B or null",
      "run_b_contributing_rdu_count": number,
      "semantic_similarity_score": number between 0 and 1,
      "mapping_justification": "Brief explanation"
    }
  ]
}

## Guidelines:
- Include ALL GDUs from Run A in the mapping
- Use null for run_b_gdu_id and run_b_definition when no match exists
- semantic_similarity_score: 1.0 = identical, 0.0 = completely different
- Consider conceptual similarity, not just word matching
- Prioritize definitional similarity over statistical similarity
- mapping_justification: Brief explanation of why these GDUs are semantically similar or why no match exists
- Ensure each Run A GDU appears exactly once in the mapping
- Multiple Run A GDUs can map to the same Run B GDU if they are semantically similar`;

      // CALL LLM: Generate the semantic mapping
      fastify.log.info('Generating IRR semantic mapping', {
        runAGduCount: runAGdus.length,
        runBGduCount: runBGdus.length,
        temperature,
        model: modelName
      });

      const result = await llmClient.generateContent(prompt);
      const responseText = result.response.text();

      // PARSE AND VALIDATE RESPONSE: Process the LLM response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        fastify.log.error('Failed to parse LLM response', { 
          responseText: responseText.substring(0, 500),
          error: parseError 
        });
        return reply.status(500).send({
          success: false,
          error: 'Failed to parse LLM response as JSON'
        });
      }

      // VALIDATE LLM RESPONSE STRUCTURE
      if (!parsedResponse.gdu_mappings || !Array.isArray(parsedResponse.gdu_mappings)) {
        return reply.status(500).send({
          success: false,
          error: 'Invalid LLM response: missing or invalid gdu_mappings array'
        });
      }

      // TRANSFORM TO EXPECTED STRUCTURE: Convert LLM response to P9_1_SemanticGduMapping
      const mappingProposal: P9_1_SemanticGduMapping = {
        gdu_mappings: parsedResponse.gdu_mappings.map((mapping: any) => {
          // Find the actual GDU objects to get accurate counts
          const gduA = runAGdus.find(g => g.gdu_id === mapping.run_a_gdu_id);
          const gduB = mapping.run_b_gdu_id ? runBGdus.find(g => g.gdu_id === mapping.run_b_gdu_id) : null;
          
          return {
            run_a_gdu_id: mapping.run_a_gdu_id || '',
            run_a_definition: mapping.run_a_definition || (gduA?.definition || ''),
            run_a_contributing_rdu_count: gduA?.contributing_refined_du_ids.length || 0,
            run_b_gdu_id: mapping.run_b_gdu_id || null,
            run_b_definition: mapping.run_b_definition || null,
            run_b_contributing_rdu_count: gduB?.contributing_refined_du_ids.length || 0,
            semantic_similarity_score: mapping.semantic_similarity_score || 0,
            mapping_justification: mapping.mapping_justification || ''
          };
        })
      };

      // VALIDATE MAPPING COMPLETENESS: Ensure all Run A GDUs are mapped
      const mappedRunAGdus = new Set(mappingProposal.gdu_mappings.map(m => m.run_a_gdu_id));
      const expectedRunAGdus = new Set(runAGdus.map(g => g.gdu_id));
      
      // Add any missing Run A GDUs as unmapped entries
      for (const gduId of expectedRunAGdus) {
        if (!mappedRunAGdus.has(gduId)) {
          const gdu = runAGdus.find(g => g.gdu_id === gduId)!;
          mappingProposal.gdu_mappings.push({
            run_a_gdu_id: gdu.gdu_id,
            run_a_definition: gdu.definition,
            run_a_contributing_rdu_count: gdu.contributing_refined_du_ids.length,
            run_b_gdu_id: null,
            run_b_definition: null,
            run_b_contributing_rdu_count: 0,
            semantic_similarity_score: 0,
            mapping_justification: 'No semantic match found in Run B'
          });
        }
      }

      // SUCCESS RESPONSE: Return the mapping
      const response: IrrResponse = {
        success: true,
        mapping: mappingProposal,
        message: `IRR semantic mapping generated successfully with ${mappingProposal.gdu_mappings.length} mappings`
      };

      fastify.log.info('IRR semantic mapping completed successfully', {
        totalMappings: mappingProposal.gdu_mappings.length,
        mappedPairs: mappingProposal.gdu_mappings.filter(m => m.run_b_gdu_id !== null).length,
        unmappedRunA: mappingProposal.gdu_mappings.filter(m => m.run_b_gdu_id === null).length
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