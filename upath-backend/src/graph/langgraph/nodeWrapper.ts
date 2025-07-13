import { BaseNode } from '../nodes/BaseNode';
import { GraphState, ExecutionContext } from '../types/state';
import { UPathMVPState, PHASE_SEQUENCE } from './annotations';
import { StepId } from '../types/enums';

/**
 * Wraps existing BaseNode implementations for use in LangGraph
 * 
 * This adapter function allows us to reuse all existing node logic
 * while converting between the old GraphState and new LangGraph state
 */
export function wrapExistingNode(NodeClass: typeof BaseNode) {
  return async (state: UPathMVPState): Promise<Partial<UPathMVPState>> => {
    try {
      // Create instance of the node
      const node = new NodeClass();
      
      // Convert LangGraph state to legacy GraphState format
      const legacyState: GraphState = {
        sessionId: state.pipelineId,
        status: state.status,
        currentStep: state.currentPhase || node.id,
        lastCompletedStep: state.currentPhase,
        progress: state.progress,
        transcripts: state.transcripts,
        stepOutputs: state.stepOutputs,
        errors: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pipelineVersion: '2.0',
          settings: {
            model: 'gemini-1.5-pro',
            temperature: 0.7,
            useGrounding: true,
          },
          currentTranscriptIndex: state.currentTranscriptIndex,
          currentPhaseIndex: state.currentPhaseIndex,
          currentGDUIndex: state.currentGDUIndex,
          currentPhaseName: state.currentPhase,
          globalDvFocus: [],
          gdus: state.gdus,
        },
      };
      
      // Create execution context from state settings
      const context: ExecutionContext = {
        model: state.settings?.model || process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
        temperature: state.settings?.temperature ?? 0.7,
        seed: state.settings?.seed ?? 42,
        useGrounding: state.settings?.useGrounding ?? true,
      };
      
      // Execute the node
      console.log(`[LangGraph] Executing node: ${node.id}`);
      const result = await node.execute(legacyState, context);
      
      // Calculate progress
      const currentPhaseIdx = PHASE_SEQUENCE.indexOf(node.id);
      const progress = Math.round(((currentPhaseIdx + 1) / PHASE_SEQUENCE.length) * 100);
      
      // Extract GDUs if this is P3_2
      let gdus = state.gdus;
      if (node.id === StepId.P3_2) {
        gdus = result.identified_gdus || [];
      }
      
      // Return updated state
      return {
        stepOutputs: {
          ...state.stepOutputs,
          [node.id]: result,
        },
        currentPhase: node.id,
        progress,
        gdus,
        status: 'running',
      };
    } catch (error) {
      console.error(`[LangGraph] Error in node ${NodeClass.name}:`, error);
      return {
        errors: [{
          nodeId: NodeClass.name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }],
        status: 'failed',
      };
    }
  };
}

/**
 * Special wrapper for multi-transcript processing phases
 * Used for P_NEG1_1 and P0_* phases
 */
export function wrapMultiTranscriptNode(NodeClass: typeof BaseNode) {
  return async (state: UPathMVPState): Promise<Partial<UPathMVPState>> => {
    try {
      const node = new NodeClass();
      
      // For multi-transcript phases, we process all transcripts at once
      const legacyState: GraphState = {
        sessionId: state.pipelineId,
        status: state.status,
        currentStep: node.id,
        lastCompletedStep: state.currentPhase,
        progress: state.progress,
        transcripts: state.transcripts, // All transcripts
        stepOutputs: state.stepOutputs,
        errors: {},
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pipelineVersion: '2.0',
          settings: {
            model: 'gemini-1.5-pro',
            temperature: 0.7,
            useGrounding: true,
          },
          globalDvFocus: [],
        },
      };
      
      const context: ExecutionContext = {
        model: state.settings?.model || process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
        temperature: state.settings?.temperature ?? 0.7,
        seed: state.settings?.seed ?? 42,
        useGrounding: state.settings?.useGrounding ?? true,
      };
      
      console.log(`[LangGraph] Executing multi-transcript node: ${node.id}`);
      const result = await node.execute(legacyState, context);
      
      return {
        stepOutputs: {
          ...state.stepOutputs,
          [node.id]: result,
        },
        currentPhase: node.id,
        status: 'running',
      };
    } catch (error) {
      console.error(`[LangGraph] Error in multi-transcript node:`, error);
      return {
        errors: [{
          nodeId: NodeClass.name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }],
        status: 'failed',
      };
    }
  };
}

/**
 * Progress calculator node
 */
export async function updateProgressNode(state: UPathMVPState): Promise<Partial<UPathMVPState>> {
  const totalPhases = PHASE_SEQUENCE.length;
  const completedPhases = state.currentPhaseIndex + 1;
  const progress = Math.round((completedPhases / totalPhases) * 100);
  
  return { progress };
}