import { StepId } from '../../../types';

export interface StepConfig {
  id: StepId;
  title: string;
  part: string;
  isJsonOutput: boolean;
  getInput: (...args: any[]) => { data: any; error?: string } | { data: null; error: string };
  generatePrompt?: (input: any) => string;
  responseSchema?: object;
  validateAndClean?: (output: any, ...args: any[]) => any;
}

export type ConfigMap = { [key in StepId]?: StepConfig };