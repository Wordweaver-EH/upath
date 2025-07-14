/**
 * Pipeline Backend Toggle Service
 * 
 * Provides runtime switching between traditional frontend pipeline execution
 * and LangGraph backend execution. This allows gradual migration and testing
 * of the new backend integration.
 */

import * as React from 'react';

export interface BackendToggleState {
  useLangGraphBackend: boolean;
  backendUrl: string;
  isBackendHealthy: boolean;
  lastHealthCheck: number;
}

class PipelineBackendToggle {
  private state: BackendToggleState;
  private listeners: Array<(state: BackendToggleState) => void> = [];

  constructor() {
    // Backend is now permanently enabled - frontend pipeline has been removed
    this.state = {
      useLangGraphBackend: true, // Always true
      backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
      isBackendHealthy: false,
      lastHealthCheck: 0
    };

    // Always check backend health on initialization
    this.checkBackendHealth();
  }

  /**
   * Get current backend toggle state
   */
  getState(): BackendToggleState {
    return { ...this.state };
  }

  /**
   * Enable LangGraph backend - DEPRECATED (always enabled)
   */
  enableLangGraphBackend(): void {
    console.log('✅ [BackendToggle] LangGraph backend is always enabled');
  }

  /**
   * Disable LangGraph backend - NO LONGER SUPPORTED
   */
  disableLangGraphBackend(): void {
    console.error('❌ [BackendToggle] Cannot disable LangGraph backend - frontend pipeline has been permanently removed');
  }

  /**
   * Toggle between backends - NO LONGER SUPPORTED
   */
  toggleBackend(): boolean {
    console.error('❌ [BackendToggle] Cannot toggle backends - only LangGraph backend is available');
    return true; // Always return true (backend enabled)
  }

  /**
   * Check if LangGraph backend is enabled
   */
  isLangGraphBackendEnabled(): boolean {
    return this.state.useLangGraphBackend;
  }

  /**
   * Check backend health status
   */
  async checkBackendHealth(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.state.backendUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const isHealthy = response.ok;
      this.setState({
        isBackendHealthy: isHealthy,
        lastHealthCheck: Date.now()
      });

      return isHealthy;
    } catch (error) {
      console.warn('[BackendToggle] Backend health check failed:', error);
      this.setState({
        isBackendHealthy: false,
        lastHealthCheck: Date.now()
      });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get backend status info
   */
  getBackendStatus(): {
    isEnabled: boolean;
    isHealthy: boolean;
    url: string;
    lastChecked: Date | null;
  } {
    return {
      isEnabled: this.state.useLangGraphBackend,
      isHealthy: this.state.isBackendHealthy,
      url: this.state.backendUrl,
      lastChecked: this.state.lastHealthCheck ? new Date(this.state.lastHealthCheck) : null
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: BackendToggleState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<BackendToggleState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Force backend health recheck
   */
  async recheckBackendHealth(): Promise<boolean> {
    console.log('[BackendToggle] Forcing backend health recheck...');
    return await this.checkBackendHealth();
  }

  /**
   * Get recommended backend based on health status
   */
  getRecommendedBackend(): 'langgraph' | 'traditional' {
    // If LangGraph is enabled but backend is unhealthy, recommend traditional
    if (this.state.useLangGraphBackend && !this.state.isBackendHealthy) {
      return 'traditional';
    }
    
    // If LangGraph is enabled and backend is healthy, recommend LangGraph
    if (this.state.useLangGraphBackend && this.state.isBackendHealthy) {
      return 'langgraph';
    }
    
    // Default to traditional
    return 'traditional';
  }
}

// Export singleton instance
export const pipelineBackendToggle = new PipelineBackendToggle();

// Export React hook for components
export function usePipelineBackendToggle() {
  const [state, setState] = React.useState(pipelineBackendToggle.getState());

  React.useEffect(() => {
    const unsubscribe = pipelineBackendToggle.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
    enableLangGraphBackend: () => pipelineBackendToggle.enableLangGraphBackend(),
    disableLangGraphBackend: () => pipelineBackendToggle.disableLangGraphBackend(),
    toggleBackend: () => pipelineBackendToggle.toggleBackend(),
    checkBackendHealth: () => pipelineBackendToggle.checkBackendHealth(),
    getBackendStatus: () => pipelineBackendToggle.getBackendStatus(),
    getRecommendedBackend: () => pipelineBackendToggle.getRecommendedBackend()
  };
}

