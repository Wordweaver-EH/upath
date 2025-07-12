import { Graph } from '../graphBuilder';
import { StepId, ExecutionContext } from '../types';

/**
 * Calculates progress dynamically based on graph structure
 * instead of using hardcoded step order
 */
export class ProgressCalculator {
  private graph: Graph;
  private sortedNodes: string[] | null;
  private nodeDepths: Map<string, number>;

  constructor(graph: Graph) {
    this.graph = graph;
    this.sortedNodes = graph.topologicalSort();
    this.nodeDepths = this.calculateNodeDepths();
  }

  /**
   * Calculate progress percentage for a given step
   */
  calculateProgress(currentStep: string): number {
    // Special cases
    if (currentStep === StepId.COMPLETE) {
      return 100;
    }
    
    if (currentStep === StepId.IDLE) {
      return 0;
    }

    // Check if step exists in graph
    if (!this.graph.nodes.has(currentStep)) {
      return 0;
    }

    // If we have a valid topological sort, use it
    if (this.sortedNodes && this.sortedNodes.length > 0) {
      const currentIndex = this.sortedNodes.indexOf(currentStep);
      if (currentIndex === -1) {
        return 0;
      }
      
      // Calculate progress as percentage
      // Reserve 100% for COMPLETE step only - cap other steps at 95%
      const maxProgressForNonComplete = 95;
      const progress = Math.round(((currentIndex + 1) / this.sortedNodes.length) * maxProgressForNonComplete);
      return progress;
    }

    // Fallback: use depth-based calculation for cyclic graphs
    return this.calculateProgressByDepth(currentStep);
  }

  /**
   * Calculate node depths from entry point
   */
  private calculateNodeDepths(): Map<string, number> {
    const depths = new Map<string, number>();
    const visited = new Set<string>();
    
    const dfs = (node: string, depth: number) => {
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      depths.set(node, Math.min(depths.get(node) || Infinity, depth));
      
      const edges = this.graph.edges.get(node) || [];
      for (const target of edges) {
        dfs(target, depth + 1);
      }
    };
    
    if (this.graph.entryPoint) {
      dfs(this.graph.entryPoint, 0);
    }
    
    return depths;
  }

  /**
   * Fallback progress calculation using node depths
   */
  private calculateProgressByDepth(currentStep: string): number {
    const currentDepth = this.nodeDepths.get(currentStep);
    if (currentDepth === undefined) {
      return 0;
    }

    // Find max depth
    let maxDepth = 0;
    for (const depth of this.nodeDepths.values()) {
      maxDepth = Math.max(maxDepth, depth);
    }

    if (maxDepth === 0) {
      return 100; // Single node
    }

    // Calculate progress based on depth
    // Reserve 100% for COMPLETE step only - cap other steps at 95%
    const maxProgressForNonComplete = 95;
    const progress = Math.round(((currentDepth + 1) / (maxDepth + 1)) * maxProgressForNonComplete);
    return Math.min(progress, maxProgressForNonComplete);
  }

  /**
   * Enrich execution context with progress information
   */
  enrichContextWithProgress(
    context: ExecutionContext,
    currentStep: string
  ): ExecutionContext & { progress: number } {
    const progress = this.calculateProgress(currentStep);
    
    return {
      ...context,
      progress
    };
  }

  /**
   * Get detailed progress information
   */
  getProgressInfo(currentStep: string): {
    percentage: number;
    currentStepIndex: number;
    totalSteps: number;
  } {
    const percentage = this.calculateProgress(currentStep);
    
    // Get current step index and total steps
    let currentStepIndex = -1;
    let totalSteps = this.graph.nodes.size;
    
    if (this.sortedNodes) {
      currentStepIndex = this.sortedNodes.indexOf(currentStep);
      totalSteps = this.sortedNodes.length;
    } else {
      // Use depth for index approximation
      const depth = this.nodeDepths.get(currentStep) || 0;
      currentStepIndex = depth;
    }
    
    return {
      percentage,
      currentStepIndex: Math.max(0, currentStepIndex),
      totalSteps
    };
  }
}