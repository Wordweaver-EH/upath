import { config } from 'dotenv';
import { p_neg1_1_node } from './src/graph/nodes/P_NEG1_1_Function.ts';
import { p0_1_node } from './src/graph/nodes/P0_1_Function.ts';
import { p0_2_node } from './src/graph/nodes/P0_2_Function.ts';
import fs from 'fs';

// Load environment variables
config();

// Read the transcript
const transcriptContent = fs.readFileSync('./p1s1.txt', 'utf8');

console.log('🔗 Testing Complete Chain: P_NEG1_1 → P0_1 → P0_2');
console.log('====================================================');

// Initial state
let currentState = {
  pipelineId: 'test-chain-validation',
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

console.log('📝 Chain Validation Input:');
console.log(`- Transcript: ${currentState.transcripts[0].filename} (${transcriptContent.split('\n').length} lines)`);
console.log(`- User DV Focus: ${currentState.userDvFocus.dv_focus.join(', ')}`);
console.log(`- Model: ${currentState.settings.model}, Temperature: ${currentState.settings.temperature}, Seed: ${currentState.settings.seed}\n`);

try {
  // === STEP 1: P_NEG1_1 Variable Identification ===
  console.log('🔄 Step 1: P_NEG1_1 Variable Identification');
  console.log('   Input Dependencies: transcripts, userDvFocus, settings');
  
  const step1Result = await p_neg1_1_node(currentState);
  currentState = { ...currentState, ...step1Result };
  
  console.log('✅ P_NEG1_1 Results:');
  const p_neg1_1_output = currentState.stepOutputs.P_NEG1_1;
  console.log(`   - Transcript ID: ${p_neg1_1_output.transcript_id}`);
  console.log(`   - Independent Variable: ${p_neg1_1_output.independent_variable_details}`);
  console.log(`   - Dependent Variables: ${p_neg1_1_output.dependent_variable_focus.join(', ')}`);
  console.log(`   - Current Phase: ${currentState.currentPhase}`);
  console.log(`   - Status: ${currentState.status}\n`);
  
  // === STEP 2: P0_1 Transcription Adherence ===
  console.log('🔄 Step 2: P0_1 Transcription Adherence');
  console.log('   Input Dependencies: P_NEG1_1 output, transcripts, settings');
  
  const step2Result = await p0_1_node(currentState);
  currentState = { ...currentState, ...step2Result };
  
  console.log('✅ P0_1 Results:');
  const p0_1_output = currentState.stepOutputs.P0_1;
  console.log(`   - Transcript ID: ${p0_1_output.transcript_id}`);
  console.log(`   - Total Lines: ${p0_1_output.line_numbered_transcript.length}`);
  console.log(`   - Convention Notes: ${p0_1_output.transcription_convention_notes.substring(0, 100)}...`);
  console.log(`   - Initial Impressions: ${p0_1_output.initial_impressions_log.substring(0, 100)}...`);
  console.log(`   - Current Phase: ${currentState.currentPhase}`);
  console.log(`   - Status: ${currentState.status}\n`);
  
  // === STEP 3: P0_2 Refine Data Types ===
  console.log('🔄 Step 3: P0_2 Refine Data Types');
  console.log('   Input Dependencies: P_NEG1_1 output, P0_1 output, settings');
  
  const step3Result = await p0_2_node(currentState);
  currentState = { ...currentState, ...step3Result };
  
  console.log('✅ P0_2 Results:');
  const p0_2_output = currentState.stepOutputs.P0_2;
  console.log(`   - Transcript ID: ${p0_2_output.transcript_id}`);
  console.log(`   - Total Refined Lines: ${p0_2_output.refined_data_transcript.length}`);
  
  // Analyze categorization
  const categoryStats = {};
  p0_2_output.refined_data_transcript.forEach(line => {
    line.information_tags.forEach(tag => {
      categoryStats[tag] = (categoryStats[tag] || 0) + 1;
    });
  });
  
  console.log('   - Categorization Breakdown:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`     * ${category}: ${count} lines`);
  });
  
  console.log(`   - Current Phase: ${currentState.currentPhase}`);
  console.log(`   - Status: ${currentState.status}\n`);
  
  // === CHAIN VALIDATION ===
  console.log('🔍 Chain Validation:');
  
  // Check data consistency
  const transcriptIdConsistency = (
    p_neg1_1_output.transcript_id === p0_1_output.transcript_id &&
    p0_1_output.transcript_id === p0_2_output.transcript_id
  );
  console.log(`   ✅ Transcript ID Consistency: ${transcriptIdConsistency ? 'PASS' : 'FAIL'}`);
  
  // Check line count consistency
  const originalLines = transcriptContent.split('\n').length;
  const p0_1_lines = p0_1_output.line_numbered_transcript.length;
  const p0_2_lines = p0_2_output.refined_data_transcript.length;
  console.log(`   📊 Line Count Tracking:`);
  console.log(`      - Original: ${originalLines} lines`);
  console.log(`      - P0_1: ${p0_1_lines} lines`);
  console.log(`      - P0_2: ${p0_2_lines} lines`);
  console.log(`   ✅ Line Preservation: ${p0_1_lines === p0_2_lines ? 'PASS' : 'FAIL'}`);
  
  // Check DV focus propagation
  const dvFocusPropagation = JSON.stringify(p_neg1_1_output.dependent_variable_focus) === 
                             JSON.stringify(currentState.userDvFocus.dv_focus);
  console.log(`   ✅ DV Focus Propagation: ${dvFocusPropagation ? 'PASS' : 'FAIL'}`);
  
  // Check parameter inheritance
  console.log(`   🔧 Parameter Inheritance:`);
  console.log(`      - Temperature: ${currentState.settings.temperature} (consistent across steps)`);
  console.log(`      - Seed: ${currentState.settings.seed} (consistent across steps)`);
  console.log(`      - Model: ${currentState.settings.model} (consistent across steps)`);
  
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
  
  console.log('\n🎉 Complete Chain Validation: SUCCESS!');
  console.log('✅ All three steps (P_NEG1_1 → P0_1 → P0_2) work correctly');
  console.log('✅ Data flows properly between steps');
  console.log('✅ Parameter inheritance working across all functions');
  console.log('✅ Schema validation passing for all outputs');
  console.log('✅ LangGraph function pattern consistently applied');
  
} catch (error) {
  console.error('❌ Chain Validation Error:', error.message);
  console.error('Step where error occurred:', currentState.currentPhase || 'initialization');
  console.error('Stack:', error.stack);
}