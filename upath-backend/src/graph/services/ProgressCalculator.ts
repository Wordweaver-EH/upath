import { Graph } from '../graphBuilder';
import { StepId } from '../types/enums';

export interface ProgressInfo {
  currentStep: StepId | string;
  currentStepIndex: number;
  totalSteps: number;
  percentage: number;
  isComplete: boolean;
  stepsCompleted: number;
  stepsRemaining: number;
}

export class ProgressCalculator {
  private graph: Graph;
  private cachedTopologicalSort: string[] | null | undefined;

  constructor(graph: Graph) {
    this.graph = graph;
    this.cachedTopologicalSort = undefined;
  }

  /**
   * Calculate progress percentage based on current step
   * Uses topological sort to determine step order dynamically
   */
  calculateProgress(currentStep: StepId | string): number {
    // Return 100 for COMPLETE step
    if (currentStep === StepId.COMPLETE) {
      return 100;
    }

    // Get topological sort (cached)
    const sortedSteps = this.getTopologicalSort();
    
    // Handle cyclic graphs
    if (!sortedSteps) {
      return 0;
    }

    // Find current step index
    const currentIndex = sortedSteps.indexOf(currentStep);
    if (currentIndex === -1) {
      return 0;
    }

    // Calculate percentage
    return Math.round(((currentIndex + 1) / sortedSteps.length) * 100);
  }

  /**
   * Get detailed progress information
   */
  getProgressInfo(currentStep: StepId | string): ProgressInfo {
    const sortedSteps = this.getTopologicalSort();
    
    // Handle cyclic graphs
    if (!sortedSteps) {
      return {
        currentStep,
        currentStepIndex: -1,
        totalSteps: 0,
        percentage: 0,
        isComplete: false,
        stepsCompleted: 0,
        stepsRemaining: 0
      };
    }

    const currentIndex = sortedSteps.indexOf(currentStep);
    const totalSteps = sortedSteps.length;
    const isComplete = currentStep === StepId.COMPLETE;
    const stepsCompleted = currentIndex === -1 ? 0 : currentIndex + 1;
    const stepsRemaining = currentIndex === -1 ? totalSteps : totalSteps - stepsCompleted;
    const percentage = isComplete ? 100 : this.calculateProgress(currentStep);

    return {
      currentStep,
      currentStepIndex: currentIndex,
      totalSteps,
      percentage,
      isComplete,
      stepsCompleted,
      stepsRemaining
    };
  }

  /**
   * Reset the cached topological sort
   * Useful if the graph structure changes
   */
  resetCache(): void {
    this.cachedTopologicalSort = undefined;
  }

  /**
   * Get topological sort with caching
   */
  private getTopologicalSort(): string[] | null {
    // Use cached value if available
    if (this.cachedTopologicalSort !== undefined) {
      return this.cachedTopologicalSort;
    }

    // Calculate and cache
    this.cachedTopologicalSort = this.graph.topologicalSort();
    return this.cachedTopologicalSort;
  }
}