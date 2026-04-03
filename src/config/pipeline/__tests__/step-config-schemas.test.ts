import { describe, it, expect } from 'vitest';
import { P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG } from '../partNeg1/variableIdentification';
import { P0_1_TRANSCRIPTION_ADHERENCE_CONFIG } from '../part0/transcriptionAdherence';
import { P0_2_REFINE_DATA_TYPES_CONFIG } from '../part0/refineDataTypes';
import { P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG } from '../part0/selectProceduralUtterances';
import { P1_1_INITIAL_SEGMENTATION_CONFIG } from '../part1/P1_1_initialSegmentation';
import { P1_2_COARSE_PHASE_TAGGING_CONFIG } from '../part1/P1_2_coarsePhaseTagging';
import { P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG } from '../part1/P1_4_diachronicUnitGrouping';
import { P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG } from '../part2/P2S_1_groupUtterancesByTopic';
import { P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG } from '../part2/P2S_2_identifySpecificSynchronicUnits';
import { P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG } from '../part2/P2S_3_defineSpecificSynchronicStructure';

const configs = [
  { id: 'P_NEG1_1', config: P_NEG1_1_VARIABLE_IDENTIFICATION_CONFIG },
  { id: 'P0_1', config: P0_1_TRANSCRIPTION_ADHERENCE_CONFIG },
  { id: 'P0_2', config: P0_2_REFINE_DATA_TYPES_CONFIG },
  { id: 'P0_3', config: P0_3_SELECT_PROCEDURAL_UTTERANCES_CONFIG },
  { id: 'P1_1', config: P1_1_INITIAL_SEGMENTATION_CONFIG },
  { id: 'P1_2', config: P1_2_COARSE_PHASE_TAGGING_CONFIG },
  { id: 'P1_4', config: P1_4_DIACHRONIC_UNIT_GROUPING_CONFIG },
  { id: 'P2S_1', config: P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG },
  { id: 'P2S_2', config: P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS_CONFIG },
  { id: 'P2S_3', config: P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE_CONFIG },
];

describe('Step config responseSchema', () => {
  it.each(configs)('$id has a valid responseSchema', ({ id, config }) => {
    const schema = (config as any).responseSchema;
    expect(schema, `${id}: responseSchema must be defined`).toBeDefined();
    expect(schema.type, `${id}: responseSchema.type must be "object"`).toBe('object');
    expect(schema.properties, `${id}: responseSchema.properties must be a non-empty object`).toBeDefined();
    expect(Object.keys(schema.properties).length, `${id}: responseSchema.properties must have at least one key`).toBeGreaterThan(0);
    expect(schema.required, `${id}: responseSchema.required must be a non-empty array`).toBeDefined();
    expect(Array.isArray(schema.required), `${id}: responseSchema.required must be an array`).toBe(true);
    expect(schema.required.length, `${id}: responseSchema.required must have at least one entry`).toBeGreaterThan(0);
  });
});
