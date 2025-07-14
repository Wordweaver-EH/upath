import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StateManagementService } from '../graph/services/StateManagementService';
import { PromptHistoryLogger } from '../graph/services/PromptHistoryLogger';
import { SavedPipelineState, StateExportOptions, PromptHistoryExportOptions } from '../graph/types/stateManagement';
import { GraphBuilder } from '../graph/graphBuilder';
import { GraphExecutor } from '../graph/graphExecutor';
import { NodeRegistry } from '../graph/nodeRegistry';
import { getSessionStore } from '../graph/stores';

/**
 * Request interfaces for state management endpoints
 */
interface SaveStateRequest {
  Body: {
    sessionId: string;
    filename?: string;
  };
}

interface LoadStateRequest {
  Body: {
    stateData: SavedPipelineState;
  };
}

interface ExportStateRequest {
  Body: {
    sessionId: string;
    options: StateExportOptions;
  };
}

interface ExportPromptHistoryRequest {
  Body: {
    sessionId: string;
    options: PromptHistoryExportOptions;
  };
}

interface SessionParams {
  Params: {
    sessionId: string;
  };
}

// Global prompt history logger (in production, this would be per-session)
const globalPromptLogger = new PromptHistoryLogger();

// Create shared graph components
const nodeRegistry = new NodeRegistry();
const graphBuilder = new GraphBuilder(nodeRegistry);
const graph = graphBuilder.build();

// Lazy initialization to match graph route pattern
let graphExecutor: GraphExecutor | null = null;
function getExecutor() {
  if (!graphExecutor) {
    const sharedSessionStore = getSessionStore();
    graphExecutor = new GraphExecutor(graph, sharedSessionStore);
  }
  return graphExecutor;
}

/**
 * Registers state management API routes
 */
export default async function stateManagementRoute(fastify: FastifyInstance) {
  
  // POST /api/state/save - Save current session state
  fastify.post<SaveStateRequest>('/state/save', async (request: FastifyRequest<SaveStateRequest>, reply: FastifyReply) => {
    const { sessionId, filename } = request.body;

    if (!sessionId) {
      return reply.status(400).send({
        error: 'Missing required field: sessionId'
      });
    }

    try {
      // Get current session
      const session = await getExecutor().getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      // Convert legacy GraphState to UPathMVPState format for StateManagementService
      const mvpState = {
        pipelineId: session.state.sessionId,
        transcripts: session.state.transcripts,
        stepOutputs: session.state.stepOutputs,
        currentPhase: session.state.currentStep,
        status: session.state.status,
        progress: session.state.progress || 0,
        userDvFocus: session.state.userDvFocus,
        settings: session.state.metadata?.settings || {},
        currentTranscriptIndex: 0,
        currentPhaseIndex: 0,
        currentGDUIndex: 0,
        isMultiTranscript: session.state.transcripts.length > 1,
        gdus: [],
        errors: [],
        phasesForP2SProcessing: [],
        currentPhaseForP2S: undefined,
        processedPhasesForP2S: []
      };

      // Get prompt history for this session
      const promptHistory = globalPromptLogger.getHistory().filter(
        entry => entry.transcriptId && session.state.transcripts.some(t => t.id === entry.transcriptId)
      );

      // Save state
      const savedState = StateManagementService.saveState(mvpState, promptHistory);

      // Generate filename if not provided
      const exportFilename = filename || StateManagementService.generateFilename(
        savedState, 
        'json',
        'upath-session'
      );

      return reply.status(200).send({
        success: true,
        savedState,
        filename: exportFilename,
        metadata: {
          sessionId,
          timestamp: savedState.metadata.timestamp,
          totalSteps: savedState.metadata.totalSteps,
          completedSteps: savedState.metadata.completedSteps,
          transcriptCount: savedState.transcripts.length
        }
      });

    } catch (error) {
      fastify.log.error('Failed to save state:', error);
      return reply.status(500).send({
        error: `Failed to save state: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // POST /api/state/load - Load saved state into new session
  fastify.post<LoadStateRequest>('/state/load', async (request: FastifyRequest<LoadStateRequest>, reply: FastifyReply) => {
    const { stateData } = request.body;

    if (!stateData) {
      return reply.status(400).send({
        error: 'Missing required field: stateData'
      });
    }

    try {
      // Validate saved state
      StateManagementService.validateSavedState(stateData);

      // Convert to UPathMVPState
      const mvpState = StateManagementService.loadState(stateData);

      // Convert back to legacy GraphState format for GraphExecutor
      const legacyState = {
        sessionId: mvpState.pipelineId,
        transcripts: mvpState.transcripts,
        stepOutputs: mvpState.stepOutputs,
        currentStep: mvpState.currentPhase,
        lastCompletedStep: '', // Will be calculated
        status: mvpState.status,
        progress: mvpState.progress,
        userDvFocus: mvpState.userDvFocus || { dv_focus: [] },
        metadata: {
          settings: mvpState.settings,
          startTime: Date.now(),
          lastUpdateTime: Date.now()
        },
        errors: {}
      };

      // Restore session in executor
      await getExecutor().restoreSession(legacyState);

      // Load prompt history if available
      if (stateData.promptHistory && stateData.promptHistory.length > 0) {
        globalPromptLogger.clearHistory();
        for (const entry of stateData.promptHistory) {
          globalPromptLogger.logInteraction(
            entry.stepId,
            entry.prompt,
            entry.response,
            entry.estimatedInputTokens,
            entry.estimatedOutputTokens,
            entry.transcriptId,
            entry.actualInputTokens,
            entry.actualOutputTokens
          );
        }
      }

      return reply.status(201).send({
        success: true,
        sessionId: mvpState.pipelineId,
        currentPhase: mvpState.currentPhase,
        status: mvpState.status,
        progress: mvpState.progress,
        transcriptCount: mvpState.transcripts.length,
        completedSteps: Object.keys(mvpState.stepOutputs).length,
        promptHistoryCount: stateData.promptHistory?.length || 0
      });

    } catch (error) {
      fastify.log.error('Failed to load state:', error);
      return reply.status(500).send({
        error: `Failed to load state: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // POST /api/state/export - Export session state in specified format
  fastify.post<ExportStateRequest>('/state/export', async (request: FastifyRequest<ExportStateRequest>, reply: FastifyReply) => {
    const { sessionId, options } = request.body;

    if (!sessionId || !options) {
      return reply.status(400).send({
        error: 'Missing required fields: sessionId, options'
      });
    }

    try {
      // Get current session
      const session = await getExecutor().getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      // Convert to MVP state
      const mvpState = {
        pipelineId: session.state.sessionId,
        transcripts: session.state.transcripts,
        stepOutputs: session.state.stepOutputs,
        currentPhase: session.state.currentStep,
        status: session.state.status,
        progress: session.state.progress || 0,
        userDvFocus: session.state.userDvFocus,
        settings: session.state.metadata?.settings || {},
        currentTranscriptIndex: 0,
        currentPhaseIndex: 0,
        currentGDUIndex: 0,
        isMultiTranscript: session.state.transcripts.length > 1,
        gdus: [],
        errors: [],
        phasesForP2SProcessing: [],
        currentPhaseForP2S: undefined,
        processedPhasesForP2S: []
      };

      const promptHistory = globalPromptLogger.getHistory().filter(
        entry => entry.transcriptId && session.state.transcripts.some(t => t.id === entry.transcriptId)
      );

      const savedState = StateManagementService.saveState(mvpState, promptHistory);
      const exportData = StateManagementService.exportState(savedState, options);

      // Generate filename
      const filename = StateManagementService.generateFilename(
        savedState,
        options.format,
        'upath-export'
      );

      // Set appropriate content type
      const contentType = options.format === 'json' 
        ? 'application/json' 
        : 'text/tab-separated-values';

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .status(200)
        .send(exportData);

    } catch (error) {
      fastify.log.error('Failed to export state:', error);
      return reply.status(500).send({
        error: `Failed to export state: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // POST /api/state/export-prompt-history - Export prompt history
  fastify.post<ExportPromptHistoryRequest>('/state/export-prompt-history', async (request: FastifyRequest<ExportPromptHistoryRequest>, reply: FastifyReply) => {
    const { sessionId, options } = request.body;

    if (!sessionId || !options) {
      return reply.status(400).send({
        error: 'Missing required fields: sessionId, options'
      });
    }

    try {
      // Get session for transcript filtering
      const session = await getExecutor().getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      // Get all prompt history and filter
      let history = globalPromptLogger.getHistory();

      // Filter by session transcripts
      history = history.filter(entry => 
        entry.transcriptId && session.state.transcripts.some(t => t.id === entry.transcriptId)
      );

      // Apply additional filters
      if (options.stepFilter) {
        history = history.filter(entry => options.stepFilter!.includes(entry.stepId));
      }

      if (options.transcriptFilter) {
        history = history.filter(entry => 
          entry.transcriptId && options.transcriptFilter!.includes(entry.transcriptId)
        );
      }

      if (options.dateRange) {
        const startDate = new Date(options.dateRange.start);
        const endDate = new Date(options.dateRange.end);
        history = history.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          return entryDate >= startDate && entryDate <= endDate;
        });
      }

      // Export in requested format
      const exportData = options.format === 'json'
        ? JSON.stringify({ history, metadata: { exportTime: new Date().toISOString(), count: history.length } }, null, 2)
        : history.map(entry => [
            entry.timestamp,
            entry.stepId,
            entry.transcriptId || '',
            entry.prompt.replace(/\t/g, ' ').replace(/\n/g, ' '),
            entry.response.replace(/\t/g, ' ').replace(/\n/g, ' '),
            entry.estimatedInputTokens,
            entry.estimatedOutputTokens,
            entry.actualInputTokens || '',
            entry.actualOutputTokens || ''
          ].join('\t')).join('\n');

      const filename = `upath-prompt-history-${new Date().toISOString().replace(/[:.]/g, '-')}.${options.format}`;
      const contentType = options.format === 'json' 
        ? 'application/json' 
        : 'text/tab-separated-values';

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .status(200)
        .send(exportData);

    } catch (error) {
      fastify.log.error('Failed to export prompt history:', error);
      return reply.status(500).send({
        error: `Failed to export prompt history: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // GET /api/state/session/:sessionId/stats - Get session statistics
  fastify.get<SessionParams>('/state/session/:sessionId/stats', async (request: FastifyRequest<SessionParams>, reply: FastifyReply) => {
    const { sessionId } = request.params;

    try {
      const session = await getExecutor().getSession(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: `Session ${sessionId} not found`
        });
      }

      // Get prompt history for this session
      const sessionHistory = globalPromptLogger.getHistory().filter(
        entry => entry.transcriptId && session.state.transcripts.some(t => t.id === entry.transcriptId)
      );

      // Calculate token statistics
      const tokenStats = sessionHistory.reduce((acc, entry) => {
        acc.totalEstimatedInput += entry.estimatedInputTokens;
        acc.totalEstimatedOutput += entry.estimatedOutputTokens;
        acc.totalActualInput += entry.actualInputTokens || 0;
        acc.totalActualOutput += entry.actualOutputTokens || 0;
        return acc;
      }, {
        totalEstimatedInput: 0,
        totalEstimatedOutput: 0,
        totalActualInput: 0,
        totalActualOutput: 0
      });

      return reply.status(200).send({
        sessionId,
        status: session.state.status,
        progress: session.state.progress,
        currentStep: session.state.currentStep,
        transcriptCount: session.state.transcripts.length,
        completedSteps: Object.keys(session.state.stepOutputs).length,
        promptHistoryCount: sessionHistory.length,
        tokenStats,
        createdAt: session.createdAt,
        lastExecutedAt: session.lastExecutedAt
      });

    } catch (error) {
      fastify.log.error('Failed to get session stats:', error);
      return reply.status(500).send({
        error: `Failed to get session stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}

// Export prompt logger for use in graph execution
export { globalPromptLogger };