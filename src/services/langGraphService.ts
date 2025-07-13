import { StepId, RawTranscript, SettingsData, CurrentStepInfo } from '../../types';

/**
 * Backend LangGraph Integration Service
 * 
 * This service provides integration with the LangGraph backend for pipeline execution.
 * It replaces the direct Gemini API calls in the frontend with backend-mediated execution,
 * maintaining security by keeping API keys on the backend.
 */

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
  : 'http://localhost:3001';

/**
 * Interface for backend session creation response
 */
interface CreateSessionResponse {
  sessionId: string;
  message: string;
}

/**
 * Interface for backend execution response
 */
interface ExecuteStepResponse {
  success: boolean;
  state?: {
    stepOutputs: Record<string, any>;
    metadata: {
      progress: {
        percentage: number;
        currentStepIndex: number;
        totalSteps: number;
      };
      currentStep: StepId | null;
      lastCompletedStep?: StepId;
      lastUpdateTime: number;
    };
  };
  executionResult?: {
    stepId: StepId;
    status: 'completed' | 'error';
    output?: any;
    error?: any;
    completedAt?: number;
  };
  error?: string;
}

/**
 * Interface for HIL correction request
 */
interface HilCorrectionRequest {
  sessionId: string;
  stepId: StepId;
  userGuidance: string;
  originalPrompt?: string;
  previousResponse?: string;
  transcriptId?: string;
  temperature?: number;
  seed?: number;
}

/**
 * Interface for HIL correction response
 */
interface HilCorrectionResponse {
  success: boolean;
  correctedOutput?: any;
  updatedState?: {
    stepOutputs: Record<string, any>;
    metadata: any;
    currentStep: StepId | null;
    lastCompletedStep?: StepId;
  };
  error?: string;
  message?: string;
}

/**
 * Interface for IRR analysis request
 */
interface IrrAnalysisRequest {
  sessionId: string;
  runAOutputs: any[];
  runBOutputs: any[];
  temperature?: number;
  seed?: number;
}

/**
 * Interface for IRR analysis response
 */
interface IrrAnalysisResponse {
  success: boolean;
  gduMappings?: any[];
  error?: string;
  message?: string;
}

export class LangGraphService {
  private currentSessionId: string | null = null;

  /**
   * Helper method to handle API response errors consistently
   */
  private async handleResponseError(response: Response): Promise<never> {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const contentType = response.headers?.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (jsonError) {
          console.warn('[LangGraphService] Failed to parse error response as JSON:', jsonError);
        }
      }
    } catch (headersError) {
      // In case headers is not available (e.g., in tests), just use the default message
      console.warn('[LangGraphService] Headers not available, using default error message');
    }
    
    throw new Error(errorMsg);
  }

  /**
   * Initialize a new LangGraph session with transcripts
   */
  async createSession(transcripts: RawTranscript[], settings: SettingsData): Promise<string> {
    try {
      // Debug: Log what we're sending
      console.log('📤 [LangGraphService] Sending transcripts:', transcripts);
      
      const requestBody = {
        transcripts: transcripts.map(t => ({
          id: t.id,
          filename: t.filename,
          content: t.content
        })),
        settings: {
          userDvFocus: settings.userDvFocus?.dv_focus?.join(', ') || '',
          model: 'gemini-1.5-flash', // Default model for LangGraph
          temperature: settings.temperature || 0.7,
          seed: settings.seed
        }
      };
      
      console.log('📤 [LangGraphService] Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${BACKEND_URL}/api/graph/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      const data: CreateSessionResponse = await response.json();
      this.currentSessionId = data.sessionId;
      
      console.log(`✅ [LangGraphService] Created session: ${data.sessionId}`);
      return data.sessionId;
    } catch (error) {
      console.error('❌ [LangGraphService] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Execute the next step in the pipeline
   */
  async executeNextStep(sessionId?: string, settings?: Partial<SettingsData>): Promise<ExecuteStepResponse> {
    const effectiveSessionId = sessionId || this.currentSessionId;
    if (!effectiveSessionId) {
      throw new Error('No active session. Call createSession() first.');
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/graph/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: effectiveSessionId,
          model: settings?.model || 'gemini-1.5-flash',
          temperature: settings?.temperature || 0.7,
          useGrounding: false, // Grounding not used in pipeline
          seed: settings?.seed
        }),
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      const data: ExecuteStepResponse = await response.json();
      
      if (data.success) {
        console.log(`✅ [LangGraphService] Step executed:`, data.executionResult?.stepId);
      } else {
        console.error('❌ [LangGraphService] Step execution failed:', data.error);
      }

      return data;
    } catch (error) {
      console.error('❌ [LangGraphService] Failed to execute step:', error);
      throw error;
    }
  }

  /**
   * Apply Human-in-the-Loop correction to a specific step
   */
  async applyHilCorrection(request: HilCorrectionRequest): Promise<HilCorrectionResponse> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/hil`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      const data: HilCorrectionResponse = await response.json();
      
      if (data.success) {
        console.log(`✅ [LangGraphService] HIL correction applied for step:`, request.stepId);
      } else {
        console.error('❌ [LangGraphService] HIL correction failed:', data.error);
      }

      return data;
    } catch (error) {
      console.error('❌ [LangGraphService] Failed to apply HIL correction:', error);
      throw error;
    }
  }

  /**
   * Perform Inter-Rater Reliability analysis
   */
  async performIrrAnalysis(request: IrrAnalysisRequest): Promise<IrrAnalysisResponse> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/irr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      const data: IrrAnalysisResponse = await response.json();
      
      if (data.success) {
        console.log(`✅ [LangGraphService] IRR analysis completed with ${data.gduMappings?.length} mappings`);
      } else {
        console.error('❌ [LangGraphService] IRR analysis failed:', data.error);
      }

      return data;
    } catch (error) {
      console.error('❌ [LangGraphService] Failed to perform IRR analysis:', error);
      throw error;
    }
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set the current session ID (for session restoration)
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Clear the current session
   */
  clearSession(): void {
    this.currentSessionId = null;
  }

  /**
   * Get session status from backend
   */
  async getSessionStatus(sessionId?: string): Promise<any> {
    const effectiveSessionId = sessionId || this.currentSessionId;
    if (!effectiveSessionId) {
      throw new Error('No active session. Call createSession() first.');
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/graph/session/${effectiveSessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await this.handleResponseError(response);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [LangGraphService] Failed to get session status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const langGraphService = new LangGraphService();