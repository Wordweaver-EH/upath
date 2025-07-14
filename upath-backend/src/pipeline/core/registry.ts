/**
 * Step Registry System for Modular µ-PATH Pipeline
 * Manages registration and retrieval of step modules
 */

import { StepId } from '../../types';
import { StepModule, StepRegistry as IStepRegistry } from './interfaces';

/**
 * Step Registry Implementation
 * Thread-safe step module management system
 */
export class StepRegistry implements IStepRegistry {
  private steps = new Map<StepId, StepModule>();
  private registrationOrder: StepId[] = [];

  /**
   * Register a step module
   * @param step The step module to register
   * @throws Error if step with same ID is already registered
   */
  register(step: StepModule): void {
    if (this.steps.has(step.config.id)) {
      throw new Error(`Step ${step.config.id} is already registered`);
    }

    // Validate step module structure
    this.validateStepModule(step);

    this.steps.set(step.config.id, step);
    this.registrationOrder.push(step.config.id);

    console.log(`[StepRegistry] Registered step: ${step.config.id} - ${step.config.title}`);
  }

  /**
   * Get a registered step module
   * @param stepId The step ID to retrieve
   * @returns The step module
   * @throws Error if step is not registered
   */
  get(stepId: StepId): StepModule {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} is not registered. Available steps: ${this.getRegisteredStepIds().join(', ')}`);
    }
    return step;
  }

  /**
   * Get all registered step modules
   * @returns Array of all registered step modules
   */
  getAllSteps(): StepModule[] {
    return Array.from(this.steps.values());
  }

  /**
   * Check if a step is registered
   * @param stepId The step ID to check
   * @returns True if step is registered
   */
  isRegistered(stepId: StepId): boolean {
    return this.steps.has(stepId);
  }

  /**
   * Get list of registered step IDs
   * @returns Array of registered step IDs
   */
  getRegisteredStepIds(): StepId[] {
    return Array.from(this.steps.keys());
  }

  /**
   * Get registration order of steps
   * @returns Array of step IDs in registration order
   */
  getRegistrationOrder(): StepId[] {
    return [...this.registrationOrder];
  }

  /**
   * Get step count
   * @returns Number of registered steps
   */
  getStepCount(): number {
    return this.steps.size;
  }

  /**
   * Get steps by part (e.g., "Part0", "Part1", etc.)
   * @param part The part name to filter by
   * @returns Array of step modules in the specified part
   */
  getStepsByPart(part: string): StepModule[] {
    return this.getAllSteps().filter(step => step.config.part === part);
  }

  /**
   * Validate step dependencies
   * Checks that all dependency steps are registered
   * @param stepId The step to validate dependencies for
   * @throws Error if dependencies are not met
   */
  validateDependencies(stepId: StepId): void {
    const step = this.get(stepId);
    if (!step.config.dependencies) {
      return; // No dependencies to validate
    }

    const missingDeps = step.config.dependencies.filter(depId => !this.isRegistered(depId));
    if (missingDeps.length > 0) {
      throw new Error(`Step ${stepId} has missing dependencies: ${missingDeps.join(', ')}`);
    }
  }

  /**
   * Get dependency chain for a step
   * Returns all steps that must be executed before the given step
   * @param stepId The step to get dependencies for
   * @returns Array of dependency step IDs in execution order
   */
  getDependencyChain(stepId: StepId): StepId[] {
    const visited = new Set<StepId>();
    const chain: StepId[] = [];

    const collectDependencies = (currentStepId: StepId) => {
      if (visited.has(currentStepId)) {
        return; // Avoid cycles
      }
      
      visited.add(currentStepId);
      const step = this.get(currentStepId);
      
      if (step.config.dependencies) {
        for (const depId of step.config.dependencies) {
          collectDependencies(depId);
          if (!chain.includes(depId)) {
            chain.push(depId);
          }
        }
      }
    };

    collectDependencies(stepId);
    return chain;
  }

  /**
   * Validate step module structure
   * @param step The step module to validate
   * @throws Error if step module is invalid
   */
  private validateStepModule(step: StepModule): void {
    if (!step.config) {
      throw new Error('Step module must have a config property');
    }

    if (!step.config.id) {
      throw new Error('Step config must have an id');
    }

    if (!step.config.title) {
      throw new Error(`Step ${step.config.id} must have a title`);
    }

    if (!step.config.part) {
      throw new Error(`Step ${step.config.id} must have a part`);
    }

    if (typeof step.config.isJsonOutput !== 'boolean') {
      throw new Error(`Step ${step.config.id} must have isJsonOutput boolean property`);
    }

    if (typeof step.getInput !== 'function') {
      throw new Error(`Step ${step.config.id} must have a getInput function`);
    }

    if (typeof step.generatePrompt !== 'function') {
      throw new Error(`Step ${step.config.id} must have a generatePrompt function`);
    }

    // parseOutput and validateAndClean are optional
    if (step.parseOutput && typeof step.parseOutput !== 'function') {
      throw new Error(`Step ${step.config.id} parseOutput must be a function if provided`);
    }

    if (step.validateAndClean && typeof step.validateAndClean !== 'function') {
      throw new Error(`Step ${step.config.id} validateAndClean must be a function if provided`);
    }
  }

  /**
   * Clear all registered steps (for testing)
   */
  clear(): void {
    this.steps.clear();
    this.registrationOrder = [];
    console.log('[StepRegistry] Cleared all registered steps');
  }

  /**
   * Get registry statistics
   * @returns Object with registry statistics
   */
  getStats(): {
    totalSteps: number;
    stepsByPart: Record<string, number>;
    stepsWithDependencies: number;
    stepsWithParseOutput: number;
    stepsWithValidateAndClean: number;
  } {
    const steps = this.getAllSteps();
    const stepsByPart: Record<string, number> = {};

    for (const step of steps) {
      stepsByPart[step.config.part] = (stepsByPart[step.config.part] || 0) + 1;
    }

    return {
      totalSteps: steps.length,
      stepsByPart,
      stepsWithDependencies: steps.filter(s => s.config.dependencies?.length).length,
      stepsWithParseOutput: steps.filter(s => s.parseOutput).length,
      stepsWithValidateAndClean: steps.filter(s => s.validateAndClean).length,
    };
  }
}

// Global registry instance
export const stepRegistry = new StepRegistry();

// Export convenience functions
export const registerStep = (step: StepModule) => stepRegistry.register(step);
export const getStep = (stepId: StepId) => stepRegistry.get(stepId);
export const isStepRegistered = (stepId: StepId) => stepRegistry.isRegistered(stepId);
export const getAllSteps = () => stepRegistry.getAllSteps();