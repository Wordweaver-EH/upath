/**
 * P4S_1_A Identify and Group SSS Nodes - Step Module
 * Exactly matches the working prototype's step structure
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

export const P4S_1_A_Step: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
};

// Auto-register step
import { stepRegistry } from '../../core/registry';
stepRegistry.register(P4S_1_A_Step);