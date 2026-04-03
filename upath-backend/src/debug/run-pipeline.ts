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

// ── File I/O ─────────────────────────────────────────────────────────────────

function loadJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function saveOutput(stepAlias: StepAlias, output: unknown): void {
  if (!fs.existsSync(DEBUG_OUTPUT_DIR)) {
    fs.mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
  }
  const outPath = path.join(DEBUG_OUTPUT_DIR, `${stepAlias}_output.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.error(`  saved → ${outPath}`);
}

// ── Summary printer ───────────────────────────────────────────────────────────

function printSummary(stepAlias: StepAlias, output: unknown): void {
  if (typeof output !== 'object' || output === null) {
    console.error(`[${stepAlias}] (text output, length ${String(output).length})`);
    return;
  }
  const o = output as Record<string, unknown>;
  switch (stepAlias) {
    case 'p1_3': {
      const segs = (o['sorted_segments'] as unknown[]) ?? [];
      console.error(`[p1_3] ${segs.length} segments sorted`);
      break;
    }
    case 'p1_4': {
      const dus = (o['diachronic_units'] as Array<Record<string, unknown>>) ?? [];
      console.error(`[p1_4] ${dus.length} DUs:`);
      for (const du of dus) {
        console.error(`  ${String(du['unit_id'])}: ${String(du['description'])}`);
      }
      break;
    }
    case 'p1_5': {
      const sds = (o['specific_diachronic_structure'] as Record<string, unknown>) ?? {};
      const phases = (sds['phases'] as Array<Record<string, unknown>>) ?? [];
      const hinges = (sds['hinge_points'] as unknown[]) ?? [];
      console.error(`[p1_5] ${phases.length} phases, ${hinges.length} hinge points:`);
      for (const p of phases) {
        const units = (p['units_involved'] as unknown[]) ?? [];
        console.error(`  "${String(p['phase_name'])}" (${units.length} DUs)`);
      }
      break;
    }
    case 'p2s_1':
    case 'p2s_2':
    case 'p2s_3': {
      const byDu = (o['p2s_outputs_by_du'] as Record<string, unknown>) ?? {};
      console.error(`[${stepAlias}] ${Object.keys(byDu).length} DUs processed`);
      break;
    }
    default:
      console.error(`[${stepAlias}] done`);
  }
}

// ── Standard step runner ──────────────────────────────────────────────────────

async function runStandardStep(
  stepAlias: StepAlias,
  input: unknown,
  model: string
): Promise<unknown> {
  const entry = STEP_REGISTRY[stepAlias];
  const cfg = entry.config;
  if (!cfg?.generatePrompt) {
    throw new Error(`Step ${stepAlias} has no generatePrompt — cannot run via CLI`);
  }
  const prompt = cfg.generatePrompt(input);
  return callGemini(prompt, model, cfg.isJsonOutput, cfg.responseSchema);
}

// ── P1.3 special runner (per-phase iteration) ─────────────────────────────────

const P13_PHASES = [
  'Initial State',
  'Core Experience',
  'Final Action',
  'Post-Hoc Reflection',
] as const;

async function runP13(p1_2_output: unknown, model: string): Promise<unknown> {
  const p = p1_2_output as Record<string, unknown>;
  const phaseTaggedUtterances = (p['phase_tagged_utterances'] as Array<Record<string, unknown>>) ?? [];

  // Group segments by coarse_phase
  const phaseGroups: Record<string, unknown[]> = {
    'Initial State': [], 'Core Experience': [], 'Final Action': [], 'Post-Hoc Reflection': [],
  };
  for (const ptu of phaseTaggedUtterances) {
    const segments = (ptu['segments'] as Array<Record<string, unknown>>) ?? [];
    for (const seg of segments) {
      const phase = String(seg['coarse_phase']);
      const bucket = phaseGroups[phase];
      if (bucket !== undefined) bucket.push(seg);
    }
  }

  const sortedSegments: unknown[] = [];

  for (const phaseName of P13_PHASES) {
    const segs = phaseGroups[phaseName] ?? [];
    if (segs.length === 0) continue;

    console.error(`  sorting phase "${phaseName}" (${segs.length} segments)…`);
    // generatePhaseSpecificPrompt expects PhaseTaggedSegment[] — cast is safe because
    // the data comes from P1.2 output which matches the shape
    const prompt = generatePhaseSpecificPrompt(phaseName, segs as Parameters<typeof generatePhaseSpecificPrompt>[1]);
    // P1.3 phases return JSON text (not structured JSON output mode in the original pipeline)
    const text = await callGemini(prompt, model, false) as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m || m[0] === undefined) {
        throw new Error(`Cannot parse P1.3 response for phase "${phaseName}"`);
      }
      parsed = JSON.parse(m[0]) as Record<string, unknown>;
    }

    const phaseSorted = (parsed['sorted_segments'] as unknown[]) ?? [];
    sortedSegments.push(...phaseSorted);
  }

  return {
    transcript_id: p['transcript_id'],
    sorted_segments: sortedSegments,
    independent_variable_details: p['independent_variable_details'],
    dependent_variable_focus: p['dependent_variable_focus'],
  };
}

async function main(): Promise<void> {
  console.error('Debug pipeline CLI — scaffold only (not yet implemented)');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
