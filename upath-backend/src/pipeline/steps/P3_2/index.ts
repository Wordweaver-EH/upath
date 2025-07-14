/**
 * P3_2 Identify Generic Diachronic Units - Step Module
 * Exactly matches the working prototype's step structure
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

export const P3_2_Step: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
};

// Auto-register step
import { stepRegistry } from '../../core/registry';
stepRegistry.register(P3_2_Step);