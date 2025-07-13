/**
 * Step Module Loader
 * Registers all available step modules with the step registry
 * 
 * This file is the central point for loading and registering all pipeline steps.
 * Each new step module should be imported and registered here.
 */

import { stepRegistry } from '../core/registry';
import { P_NEG1_1_StepModule } from './P_NEG1_1';
import { P0_1_StepModule } from './P0_1';
import { P0_2_StepModule } from './P0_2';

/**
 * Load and register all available step modules
 * This function must be called during server initialization
 */
export function loadAllSteps(): void {
  console.log('[StepLoader] Loading all pipeline steps...');

  try {
    // Register P_NEG1_1 - Variable Identification
    stepRegistry.register(P_NEG1_1_StepModule);

    // Register P0_1 - Transcription Adherence & Line Numbering
    stepRegistry.register(P0_1_StepModule);

    // Register P0_2 - Refining Data - Identifying Information Types
    stepRegistry.register(P0_2_StepModule);

    // Future step registrations will be added here:
    // stepRegistry.register(P0_3_StepModule);
    // ... etc

    const stats = stepRegistry.getStats();
    console.log(`[StepLoader] Successfully loaded ${stats.totalSteps} step(s)`);
    console.log(`[StepLoader] Steps by part:`, stats.stepsByPart);
    console.log(`[StepLoader] Steps with dependencies: ${stats.stepsWithDependencies}`);
    console.log(`[StepLoader] Steps with parseOutput: ${stats.stepsWithParseOutput}`);

    // Log all registered step IDs for debugging
    const registeredIds = stepRegistry.getRegisteredStepIds();
    console.log(`[StepLoader] Registered step IDs: ${registeredIds.join(', ')}`);

  } catch (error) {
    console.error('[StepLoader] Failed to load steps:', error);
    throw error; // Re-throw to prevent server from starting with incomplete step registry
  }
}

/**
 * Reload all steps (for development/testing)
 * Clears registry and reloads all steps
 */
export function reloadAllSteps(): void {
  console.log('[StepLoader] Reloading all pipeline steps...');
  stepRegistry.clear();
  loadAllSteps();
}

// Export the registry for external access
export { stepRegistry } from '../core/registry';

// Export all step modules for direct access if needed
export { P_NEG1_1_StepModule } from './P_NEG1_1';
export { P0_1_StepModule } from './P0_1';
export { P0_2_StepModule } from './P0_2';