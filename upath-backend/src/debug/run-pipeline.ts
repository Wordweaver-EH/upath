import 'dotenv/config';
import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
// Step config imports (frontend step configs — pure TS, no React runtime deps)
import { P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG } from '../../../src/config/pipeline/partNeg1/variableIdentification';
import { P0_1_TRANSCRIPTION_ADHERENCE_CONFIG } from '../../../src/config/pipeline/part0/transcriptionAdherence';
import { P0_2_REFINE_DATA_TYPES_CONFIG } from '../../../src/config/pipeline/part0/refineDataTypes';
import { P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG } from '../../../src/config/pipeline/part0/selectProceduralUtterances';
import { P1_1_INITIAL_SEGMENTATION_CONFIG } from '../../../src/config/pipeline/part1/P1_1_initialSegmentation';
import { P1_2_COARSE_PHASE_TAGGING_CONFIG } from '../../../src/config/pipeline/part1/P1_2_coarsePhaseTagging';
import { generatePhaseSpecificPrompt } from '../../../src/config/pipeline/part1/P1_3_intraPhaSorting';
import { P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG } from '../../../src/config/pipeline/part1/P1_4_diachronicUnitGrouping';
import { P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG } from '../../../src/config/pipeline/part1/P1_5_constructSpecificDiachronicStructure';
import { P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG } from '../../../src/config/pipeline/part2/P2S_1_groupUtterancesByTopic';
import { P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG } from '../../../src/config/pipeline/part2/P2S_2_identifySpecificSynchronicUnits';
import { P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG } from '../../../src/config/pipeline/part2/P2S_3_defineSpecificSynchronicStructure';
// P2S_4 is UI-only (isJsonOutput: false, no generatePrompt) — not applicable to CLI

const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';

// Resolve debug-output relative to this file's location (CJS __dirname is available via tsx)
const DEBUG_OUTPUT_DIR = path.resolve(__dirname, '../../debug-output');

// ── Gemini caller ────────────────────────────────────────────────────────────

async function callGemini(
  prompt: string,
  model: string,
  isJsonOutput: boolean,
  responseSchema?: object
): Promise<unknown> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY not set or empty in upath-backend/.env');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const generationConfig: Record<string, unknown> = {
    temperature: 0.0,
    ...(isJsonOutput && { responseMimeType: 'application/json' }),
    ...(responseSchema !== undefined && { responseSchema }),
  };

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  });

  const text = result.response.text();
  if (isJsonOutput) return JSON.parse(text) as unknown;
  return text;
}

// ── Step registry ─────────────────────────────────────────────────────────────

type StepAlias =
  | 'p_neg1_1' | 'p0_1' | 'p0_2' | 'p0_3'
  | 'p1_1' | 'p1_2' | 'p1_3' | 'p1_4' | 'p1_5'
  | 'p2s_1' | 'p2s_2' | 'p2s_3';

interface StepEntry {
  config: {
    generatePrompt?: (input: unknown) => string;
    responseSchema?: object;
    isJsonOutput: boolean;
  } | null;
  isP13: boolean;
  isP2S: boolean;
}

const STEP_ORDER: StepAlias[] = [
  'p_neg1_1', 'p0_1', 'p0_2', 'p0_3',
  'p1_1', 'p1_2', 'p1_3', 'p1_4', 'p1_5',
  'p2s_1', 'p2s_2', 'p2s_3',
];

const STEP_REGISTRY: Record<StepAlias, StepEntry> = {
  p_neg1_1: { config: P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG,             isP13: false, isP2S: false },
  p0_1:     { config: P0_1_TRANSCRIPTION_ADHERENCE_CONFIG,                 isP13: false, isP2S: false },
  p0_2:     { config: P0_2_REFINE_DATA_TYPES_CONFIG,                       isP13: false, isP2S: false },
  p0_3:     { config: P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG,            isP13: false, isP2S: false },
  p1_1:     { config: P1_1_INITIAL_SEGMENTATION_CONFIG,                    isP13: false, isP2S: false },
  p1_2:     { config: P1_2_COARSE_PHASE_TAGGING_CONFIG,                    isP13: false, isP2S: false },
  p1_3:     { config: null,                                                 isP13: true,  isP2S: false },
  p1_4:     { config: P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG,                isP13: false, isP2S: false },
  p1_5:     { config: P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG, isP13: false, isP2S: false },
  p2s_1:    { config: P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG,              isP13: false, isP2S: true  },
  p2s_2:    { config: P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG,     isP13: false, isP2S: true  },
  p2s_3:    { config: P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG,   isP13: false, isP2S: true  },
};

async function main(): Promise<void> {
  console.error('Debug pipeline CLI — scaffold only (not yet implemented)');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
