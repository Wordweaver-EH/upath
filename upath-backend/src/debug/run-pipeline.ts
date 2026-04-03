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

// ── P2S per-DU runner ─────────────────────────────────────────────────────────

async function runP2S(
  stepAlias: 'p2s_1' | 'p2s_2' | 'p2s_3',
  input: unknown,
  model: string
): Promise<{ transcript_id: string; p2s_outputs_by_du: Record<string, unknown> }> {
  const entry = STEP_REGISTRY[stepAlias];
  const cfg = entry.config;
  if (!cfg?.generatePrompt) throw new Error(`No generatePrompt for ${stepAlias}`);

  const p2sByDu: Record<string, unknown> = {};

  if (stepAlias === 'p2s_1') {
    // input is p1_5 output. Also need p1_4 (DU→segment IDs) and p1_1 (segment text).
    const p1_5 = input as Record<string, unknown>;
    // p2s_1 requires both p1_4_output.json (DU→segment mapping) and p1_1_output.json
    // (segment text) to be present in debug-output/. Run --from p1_1 --to p1_5 first.
    const p1_4 = loadJsonFile(path.join(DEBUG_OUTPUT_DIR, 'p1_4_output.json')) as Record<string, unknown>;
    const p1_1 = loadJsonFile(path.join(DEBUG_OUTPUT_DIR, 'p1_1_output.json')) as Record<string, unknown>;

    const dus = (p1_4['diachronic_units'] as Array<Record<string, unknown>>) ?? [];

    for (const du of dus) {
      const duId = String(du['unit_id']);
      const segIds = new Set<string>(
        ((du['source_segment_ids'] as string[]) ?? [])
      );
      const segments: unknown[] = [];

      // Collect segment objects from P1.1 output that belong to this DU
      const segmentedUtterances = (p1_1['segmented_utterances'] as Array<Record<string, unknown>>) ?? [];
      for (const segContainer of segmentedUtterances) {
        const segs = (segContainer['segments'] as Array<Record<string, unknown>>) ?? [];
        for (const seg of segs) {
          if (segIds.has(String(seg['segment_id']))) segments.push(seg);
        }
      }

      if (segments.length === 0) {
        console.error(`  [p2s_1] WARNING: no segments for DU ${duId} — skipping`);
        continue;
      }

      const duInput = {
        transcript_id: String(p1_5['transcript_id']),
        analyzed_du_id: duId,
        segments_for_du_analysis: segments,
        independent_variable_details: p1_4['independent_variable_details'],
        dependent_variable_focus: p1_4['dependent_variable_focus'],
      };

      console.error(`  → DU ${duId} (${segments.length} segments)…`);
      const prompt = cfg.generatePrompt(duInput);
      const duOutput = await callGemini(prompt, model, cfg.isJsonOutput, cfg.responseSchema);
      p2sByDu[duId] = { p2s_1_output: duOutput };
    }

    return { transcript_id: String(p1_5['transcript_id']), p2s_outputs_by_du: p2sByDu };
  }

  if (stepAlias === 'p2s_2') {
    // input is p2s_1 aggregate output
    const agg = input as { transcript_id: string; p2s_outputs_by_du: Record<string, Record<string, unknown>> };
    for (const [duId, duData] of Object.entries(agg.p2s_outputs_by_du)) {
      const duInput = duData['p2s_1_output'];
      if (duInput === undefined) { console.error(`  [p2s_2] WARNING: no p2s_1_output for DU ${duId} — skipping`); continue; }
      console.error(`  → DU ${duId}…`);
      const prompt = cfg.generatePrompt(duInput);
      const duOutput = await callGemini(prompt, model, cfg.isJsonOutput, cfg.responseSchema);
      p2sByDu[duId] = { ...duData, p2s_2_output: duOutput };
    }
    return { transcript_id: agg.transcript_id, p2s_outputs_by_du: p2sByDu };
  }

  // p2s_3: input is p2s_2 aggregate output
  const agg = input as { transcript_id: string; p2s_outputs_by_du: Record<string, Record<string, unknown>> };
  for (const [duId, duData] of Object.entries(agg.p2s_outputs_by_du)) {
    const duInput = duData['p2s_2_output'];
    if (duInput === undefined) { console.error(`  [p2s_3] WARNING: no p2s_2_output for DU ${duId} — skipping`); continue; }
    console.error(`  → DU ${duId}…`);
    const prompt = cfg.generatePrompt(duInput);
    const duOutput = await callGemini(prompt, model, cfg.isJsonOutput, cfg.responseSchema);
    p2sByDu[duId] = { ...duData, p2s_3_output: duOutput };
  }
  return { transcript_id: agg.transcript_id, p2s_outputs_by_du: p2sByDu };
}

// ── Chain orchestration ───────────────────────────────────────────────────────

function resolveStepRange(fromAlias: string, toAlias: string): StepAlias[] {
  const fromIdx = STEP_ORDER.indexOf(fromAlias as StepAlias);
  const toIdx = STEP_ORDER.indexOf(toAlias as StepAlias);
  if (fromIdx === -1) {
    throw new Error(`Unknown step: "${fromAlias}". Valid steps: ${STEP_ORDER.join(', ')}`);
  }
  if (toIdx === -1) {
    throw new Error(`Unknown step: "${toAlias}". Valid steps: ${STEP_ORDER.join(', ')}`);
  }
  if (toIdx < fromIdx) {
    throw new Error(`--to step must come after --from step in pipeline order`);
  }
  return STEP_ORDER.slice(fromIdx, toIdx + 1);
}

function loadInitialInput(
  firstStep: StepAlias,
  inputFile: string | undefined,
  transcriptFile: string | undefined,
  dvFocus: string | undefined
): unknown {
  // --transcript: construct raw input for p_neg1_1 or p0_1
  if (transcriptFile !== undefined) {
    if (firstStep !== 'p_neg1_1' && firstStep !== 'p0_1') {
      throw new Error(`--transcript is only valid when --from is p_neg1_1 or p0_1`);
    }
    const content = fs.readFileSync(transcriptFile, 'utf8');
    const filename = path.basename(transcriptFile);
    if (firstStep === 'p_neg1_1') {
      if (!dvFocus) {
        throw new Error(`--dv-focus "focus1,focus2" is required when starting from p_neg1_1`);
      }
      return {
        filename_or_id: filename,
        raw_transcript_text_from_file: content,
        dependent_variable_focus_list: dvFocus.split(',').map((s) => s.trim()),
      };
    }
    if (dvFocus !== undefined) {
      console.error(`Warning: --dv-focus is ignored when --from is p0_1`);
    }
    return { filename_or_id: filename, raw_transcript_text_from_file: content };
  }

  // --input: explicit file path
  if (inputFile !== undefined) return loadJsonFile(inputFile);

  // Auto-load from debug-output/<previous step>_output.json
  const firstIdx = STEP_ORDER.indexOf(firstStep);
  const prevStep = firstIdx > 0 ? STEP_ORDER[firstIdx - 1] : undefined;
  if (prevStep !== undefined) {
    const autoPath = path.join(DEBUG_OUTPUT_DIR, `${prevStep}_output.json`);
    if (fs.existsSync(autoPath)) {
      console.error(`[auto-load] ${autoPath}`);
      return loadJsonFile(autoPath);
    }
  }

  const prevStepFile = firstStep !== 'p_neg1_1'
    ? `debug-output/${(STEP_ORDER[STEP_ORDER.indexOf(firstStep) - 1] ?? 'prev')}_output.json`
    : undefined;
  throw new Error(
    `No input for step ${firstStep}. Provide --input <file> or --transcript <file>` +
    (prevStepFile !== undefined ? `, or ensure ${prevStepFile} exists` : '')
  );
}

async function runChain(steps: StepAlias[], initialInput: unknown, model: string): Promise<void> {
  let currentInput = initialInput;

  for (const stepAlias of steps) {
    console.error(`\n▶ ${stepAlias}…`);
    const entry = STEP_REGISTRY[stepAlias];

    let output: unknown;
    if (entry.isP13) {
      output = await runP13(currentInput, model);
    } else if (entry.isP2S) {
      output = await runP2S(stepAlias as 'p2s_1' | 'p2s_2' | 'p2s_3', currentInput, model);
    } else {
      output = await runStandardStep(stepAlias, currentInput, model);
    }

    saveOutput(stepAlias, output);
    printSummary(stepAlias, output);
    currentInput = output;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

function printUsage(): void {
  console.error(`
Usage:
  npm run debug -- --step <id> [--input <file>] [--model <id>]
  npm run debug -- --from <id> --to <id> [--input <file>] [--model <id>]
  npm run debug -- --from p_neg1_1 --transcript <file> --dv-focus "focus1,focus2"
  npm run debug -- --from p0_1 --transcript <file>

Valid step IDs: ${STEP_ORDER.join(', ')}

Default model: ${DEFAULT_MODEL}
Outputs saved to: upath-backend/debug-output/<step>_output.json
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      step:        { type: 'string' },
      from:        { type: 'string' },
      to:          { type: 'string' },
      input:       { type: 'string' },
      transcript:  { type: 'string' },
      model:       { type: 'string' },
      'dv-focus':  { type: 'string' },
    },
    allowPositionals: false,
  });

  const fromAlias = values['step'] ?? values['from'];
  const toAlias   = values['step'] ?? values['to'] ?? values['from'];

  if (fromAlias === undefined || toAlias === undefined) {
    printUsage();
    process.exit(1);
  }

  const model = values['model'] ?? DEFAULT_MODEL;
  const steps = resolveStepRange(fromAlias, toAlias);
  const firstStep = steps[0];
  if (firstStep === undefined) throw new Error('No steps resolved');

  const initialInput = loadInitialInput(
    firstStep,
    values['input'],
    values['transcript'],
    values['dv-focus']
  );

  await runChain(steps, initialInput, model);
  console.error('\n✅ Done');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
