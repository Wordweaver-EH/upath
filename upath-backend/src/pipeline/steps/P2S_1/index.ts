/**
 * P2S_1 Group Utterances by Topic - Step Module
 * Exactly matches the working prototype's step structure
 */

import { StepModule } from '../../core/interfaces';
import { stepConfig } from './config';
import { getInput } from './getInput';
import { generatePrompt } from './generatePrompt';
import { parseOutput } from './parseOutput';

export const P2S_1_Step: StepModule = {
  config: stepConfig,
  getInput,
  generatePrompt,
  parseOutput,
};

// Auto-register step
import { stepRegistry } from '../../core/registry';
stepRegistry.register(P2S_1_Step);