/**
 * Step Module Loader
 * Registers all available step modules with the step registry
 * 
 * This file is the central point for loading and registering all pipeline steps.
 * Each new step module should be imported and registered here.
 */

import { stepRegistry } from '../core/registry';
import './P_NEG1_1'; // Auto-registers P_NEG1_1_StepModule
import './P0_1'; // Auto-registers P0_1_StepModule
import './P0_2'; // Auto-registers P0_2_StepModule
import './P0_3'; // Auto-registers P0_3_StepModule
import './P1_1'; // Auto-registers P1_1_StepModule
import './P1_2'; // Auto-registers P1_2_StepModule
import './P1_3'; // Auto-registers P1_3_StepModule
import './P1_4'; // Auto-registers P1_4_StepModule
import './P2S_1'; // Auto-registers P2S_1_Step
import './P2S_2'; // Auto-registers P2S_2_Step
import './P2S_3'; // Auto-registers P2S_3_Step
import './P3_1'; // Auto-registers P3_1_Step
import './P3_2'; // Auto-registers P3_2_Step
import './P3_3'; // Auto-registers P3_3_Step
import './P4S_1_A'; // Auto-registers P4S_1_A_Step
import './P4S_1_B'; // Auto-registers P4S_1_B_Step

/**
 * Load and register all available step modules
 * This function must be called during server initialization
 */
export function loadAllSteps(): void {
  console.log('[StepLoader] Loading all pipeline steps...');

  try {
    // All steps auto-register when their modules are imported above
    // No manual registration needed - steps register themselves

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
export { P0_3_StepModule } from './P0_3';
export { P1_1_StepModule } from './P1_1';
export { P1_2_StepModule } from './P1_2';
export { P1_3_StepModule } from './P1_3';
export { P1_4_StepModule } from './P1_4';
export { P2S_1_Step } from './P2S_1';
export { P2S_2_Step } from './P2S_2';
export { P2S_3_Step } from './P2S_3';
export { P3_1_Step } from './P3_1';
export { P3_2_Step } from './P3_2';
export { P3_3_Step } from './P3_3';
export { P4S_1_A_Step } from './P4S_1_A';
export { P4S_1_B_Step } from './P4S_1_B';