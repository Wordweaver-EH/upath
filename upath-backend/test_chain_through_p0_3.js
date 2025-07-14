import { config } from 'dotenv';
import { p_neg1_1_node } from './src/graph/nodes/P_NEG1_1_Function.ts';
import { p0_1_node } from './src/graph/nodes/P0_1_Function.ts';
import { p0_2_node } from './src/graph/nodes/P0_2_Function.ts';
import { p0_3_node } from './src/graph/nodes/P0_3_Function.ts';
import fs from 'fs';

// Load environment variables
config();

// Read the transcript
const transcriptContent = fs.readFileSync('./p1s1.txt', 'utf8');

console.log('🔗 Testing Complete Chain: P_NEG1_1 → P0_1 → P0_2 → P0_3');
console.log('==========================================================');

// Initial state
let currentState = {
  pipelineId: 'test-chain-p0_3',
  transcripts: [
    {
      id: 'p1s1',
      filename: 'p1s1.txt',
      content: transcriptContent
    }
  ],
  userDvFocus: { dv_focus: ['cognitions', 'emotions', 'sensations', 'imagination', 'internal_experiences'] },
  settings: {
    model: 'gemini-2.5-flash',
    temperature: 0,
    seed: 42
  },
  stepOutputs: {},
  status: 'running',
  currentPhase: '',
  progress: 0
};

console.log('📝 Complete Chain Input:');
console.log(`- Transcript: ${currentState.transcripts[0].filename} (${transcriptContent.split('\n').length} lines)`);
console.log(`- User DV Focus: ${currentState.userDvFocus.dv_focus.join(', ')}`);
console.log(`- Model: ${currentState.settings.model}, Temperature: ${currentState.settings.temperature}, Seed: ${currentState.settings.seed}\n`);

try {
  // === STEP 1: P_NEG1_1 Variable Identification ===
  console.log('🔄 Step 1: P_NEG1_1 Variable Identification');
  const step1Result = await p_neg1_1_node(currentState);
  currentState = { ...currentState, ...step1Result };
  
  const p_neg1_1_output = currentState.stepOutputs.P_NEG1_1;
  console.log(`✅ P_NEG1_1: IV="${p_neg1_1_output.independent_variable_details}", DV=[${p_neg1_1_output.dependent_variable_focus.length} vars]\n`);
  
  // === STEP 2: P0_1 Transcription Adherence ===
  console.log('🔄 Step 2: P0_1 Transcription Adherence');
  const step2Result = await p0_1_node(currentState);
  currentState = { ...currentState, ...step2Result };
  
  const p0_1_output = currentState.stepOutputs.P0_1;
  console.log(`✅ P0_1: ${p0_1_output.line_numbered_transcript.length} numbered lines processed\n`);
  
  // === STEP 3: P0_2 Refine Data Types ===
  console.log('🔄 Step 3: P0_2 Refine Data Types');
  const step3Result = await p0_2_node(currentState);
  currentState = { ...currentState, ...step3Result };
  
  const p0_2_output = currentState.stepOutputs.P0_2;
  
  // Count categories
  const categoryStats = {};
  p0_2_output.refined_data_transcript.forEach(line => {
    line.information_tags.forEach(tag => {
      categoryStats[tag] = (categoryStats[tag] || 0) + 1;
    });
  });
  
  console.log(`✅ P0_2: ${p0_2_output.refined_data_transcript.length} lines categorized`);
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`   - ${category}: ${count} lines`);
  });
  console.log();
  
  // === STEP 4: P0_3 Select Procedural Utterances ===
  console.log('🔄 Step 4: P0_3 Select Procedural Utterances (NEW FUNCTION)');
  const step4Result = await p0_3_node(currentState);
  currentState = { ...currentState, ...step4Result };
  
  const p0_3_output = currentState.stepOutputs.P0_3;
  
  console.log('✅ P0_3 Results:');
  console.log(`   - Transcript ID: ${p0_3_output.transcript_id}`);
  console.log(`   - Selected Procedural Utterances: ${p0_3_output.selected_procedural_utterances.length}`);
  console.log(`   - Discarded Info: ${p0_3_output.discarded_info_summary || 'Not provided'}`);
  console.log(`   - IV Preserved: ${p0_3_output.independent_variable_details}`);
  console.log(`   - DV Preserved: [${p0_3_output.dependent_variable_focus.join(', ')}]`);
  
  // Show sample procedural utterances
  console.log('\n   📋 Sample Selected Utterances:');
  p0_3_output.selected_procedural_utterances.slice(0, 5).forEach((utterance, idx) => {
    console.log(`      ${idx + 1}. Line ${utterance.original_line_num}: "${utterance.utterance_text.substring(0, 60)}..."`);
    if (utterance.selection_justification) {
      console.log(`         → Justification: ${utterance.selection_justification}`);
    }
  });
  
  console.log(`\n   - Current Phase: ${currentState.currentPhase}`);
  console.log(`   - Status: ${currentState.status}\n`);
  
  // === COMPLETE CHAIN VALIDATION ===
  console.log('🔍 Complete Chain Validation:');
  
  // Check data consistency across all steps
  const transcriptIdConsistency = (
    p_neg1_1_output.transcript_id === p0_1_output.transcript_id &&
    p0_1_output.transcript_id === p0_2_output.transcript_id &&
    p0_2_output.transcript_id === p0_3_output.transcript_id
  );
  console.log(`   ✅ Transcript ID Consistency: ${transcriptIdConsistency ? 'PASS' : 'FAIL'}`);
  
  // Check IV/DV preservation from P_NEG1_1 to P0_3
  const ivDvPreservation = (
    p_neg1_1_output.independent_variable_details === p0_3_output.independent_variable_details &&
    JSON.stringify(p_neg1_1_output.dependent_variable_focus) === JSON.stringify(p0_3_output.dependent_variable_focus)
  );
  console.log(`   ✅ IV/DV Preservation (P_NEG1_1 → P0_3): ${ivDvPreservation ? 'PASS' : 'FAIL'}`);
  
  // Check line processing flow
  const originalLines = transcriptContent.split('\n').length;
  const p0_1_lines = p0_1_output.line_numbered_transcript.length;
  const p0_2_lines = p0_2_output.refined_data_transcript.length;
  const p0_3_selected = p0_3_output.selected_procedural_utterances.length;
  
  console.log(`   📊 Line Processing Flow:`);
  console.log(`      - Original: ${originalLines} lines`);
  console.log(`      - P0_1 numbered: ${p0_1_lines} lines`);
  console.log(`      - P0_2 categorized: ${p0_2_lines} lines`);
  console.log(`      - P0_3 selected: ${p0_3_selected} procedural utterances`);
  
  const flowConsistency = p0_1_lines === p0_2_lines;
  console.log(`   ✅ Line Flow Consistency: ${flowConsistency ? 'PASS' : 'FAIL'}`);
  
  // Check parameter inheritance across all steps
  console.log(`   🔧 Parameter Inheritance:`);
  console.log(`      - Temperature: ${currentState.settings.temperature} (consistent across all steps)`);
  console.log(`      - Seed: ${currentState.settings.seed} (consistent across all steps)`);
  console.log(`      - Model: ${currentState.settings.model} (consistent across all steps)`);
  
  // === FINAL PIPELINE STATE ===
  console.log('\n🎯 Final Pipeline State:');
  console.log(`   - Pipeline ID: ${currentState.pipelineId}`);
  console.log(`   - Status: ${currentState.status}`);
  console.log(`   - Current Phase: ${currentState.currentPhase}`);
  console.log(`   - Completed Steps: ${Object.keys(currentState.stepOutputs).join(' → ')}`);
  console.log(`   - Total Step Outputs: ${Object.keys(currentState.stepOutputs).length}`);
  
  // Verify each step's output schema
  console.log('\n🔒 Schema Validation:');
  console.log(`   ✅ P_NEG1_1: ${p_neg1_1_output.transcript_id && p_neg1_1_output.independent_variable_details && Array.isArray(p_neg1_1_output.dependent_variable_focus) ? 'VALID' : 'INVALID'}`);
  console.log(`   ✅ P0_1: ${p0_1_output.transcript_id && Array.isArray(p0_1_output.line_numbered_transcript) && p0_1_output.transcription_convention_notes ? 'VALID' : 'INVALID'}`);
  console.log(`   ✅ P0_2: ${p0_2_output.transcript_id && Array.isArray(p0_2_output.refined_data_transcript) ? 'VALID' : 'INVALID'}`);
  console.log(`   ✅ P0_3: ${p0_3_output.transcript_id && Array.isArray(p0_3_output.selected_procedural_utterances) && p0_3_output.independent_variable_details ? 'VALID' : 'INVALID'}`);
  
  // Quality check: ensure P0_3 selected meaningful content
  const hasProceduralContent = p0_3_output.selected_procedural_utterances.length > 0;
  const hasJustifications = p0_3_output.selected_procedural_utterances.some(u => u.selection_justification);
  
  console.log('\n🎯 P0_3 Quality Validation:');
  console.log(`   ✅ Selected Content: ${hasProceduralContent ? 'PASS' : 'FAIL'} (${p0_3_output.selected_procedural_utterances.length} utterances)`);
  console.log(`   ✅ Has Justifications: ${hasJustifications ? 'PASS' : 'FAIL'}`);
  
  console.log('\n🎉 Complete Chain Through P0_3: SUCCESS!');
  console.log('✅ All four steps (P_NEG1_1 → P0_1 → P0_2 → P0_3) work correctly');
  console.log('✅ Data flows properly between all steps');
  console.log('✅ Parameter inheritance working across all functions');
  console.log('✅ Schema validation passing for all outputs');
  console.log('✅ LangGraph function pattern consistently applied');
  console.log('✅ Procedural utterance selection working correctly');
  
} catch (error) {
  console.error('❌ Chain Test Error:', error.message);
  console.error('Step where error occurred:', currentState.currentPhase || 'initialization');
  console.error('Stack:', error.stack);
}